import migrationApiClient from './api-client';

export interface CacheWarmingStrategy {
  name: string;
  priority: number; // 1-10, higher = more important
  urls: Array<{
    url: string;
    config?: any;
    ttl?: number;
    tags?: string[];
  }>;
  dependencies?: string[]; // Other strategies that must run first
}

export interface CacheWarmingPlan {
  strategies: CacheWarmingStrategy[];
  batchSize: number;
  delayBetweenBatches: number; // ms
  maxRetries: number;
}

class CacheWarmingService {
  private static instance: CacheWarmingService;
  private isWarming = false;
  private warmpProgress = 0;
  private warmingStats = {
    totalUrls: 0,
    warmedUrls: 0,
    failedUrls: 0,
    startTime: null as Date | null,
    endTime: null as Date | null
  };

  static getInstance(): CacheWarmingService {
    if (!CacheWarmingService.instance) {
      CacheWarmingService.instance = new CacheWarmingService();
    }
    return CacheWarmingService.instance;
  }

  async executeWarmingPlan(plan: CacheWarmingPlan): Promise<void> {
    if (this.isWarming) {
      console.warn('Cache warming already in progress');
      return;
    }

    this.isWarming = true;
    this.warmpProgress = 0;
    this.warmingStats = {
      totalUrls: plan.strategies.reduce((sum, s) => sum + s.urls.length, 0),
      warmedUrls: 0,
      failedUrls: 0,
      startTime: new Date(),
      endTime: null
    };

    try {
      // Sort strategies by priority and resolve dependencies
      const sortedStrategies = this.sortStrategies(plan.strategies);

      // Execute strategies in batches
      for (let i = 0; i < sortedStrategies.length; i += plan.batchSize) {
        const batch = sortedStrategies.slice(i, i + plan.batchSize);

        await this.executeBatch(batch, plan.maxRetries);

        // Update progress
        this.warmpProgress = ((i + batch.length) / sortedStrategies.length) * 100;

        // Delay between batches
        if (i + batch.length < sortedStrategies.length) {
          await new Promise(resolve => setTimeout(resolve, plan.delayBetweenBatches));
        }
      }

      this.warmingStats.endTime = new Date();
      console.log('Cache warming completed:', this.getWarmingStats());
    } finally {
      this.isWarming = false;
    }
  }

  private sortStrategies(strategies: CacheWarmingStrategy[]): CacheWarmingStrategy[] {
    const sorted: CacheWarmingStrategy[] = [];
    const visited = new Set<string>();

    const visit = (strategy: CacheWarmingStrategy) => {
      if (visited.has(strategy.name)) return;
      visited.add(strategy.name);

      // Visit dependencies first
      if (strategy.dependencies) {
        for (const depName of strategy.dependencies) {
          const dep = strategies.find(s => s.name === depName);
          if (dep) visit(dep);
        }
      }

      sorted.push(strategy);
    };

    // Sort by priority within dependency groups
    strategies
      .sort((a, b) => b.priority - a.priority)
      .forEach(visit);

    return sorted;
  }

  private async executeBatch(strategies: CacheWarmingStrategy[], maxRetries: number): Promise<void> {
    const promises = strategies.map(strategy => this.executeStrategy(strategy, maxRetries));
    await Promise.allSettled(promises);
  }

  private async executeStrategy(strategy: CacheWarmingStrategy, maxRetries: number): Promise<void> {
    console.log(`Executing cache warming strategy: ${strategy.name}`);

    for (const { url, config, ttl, tags } of strategy.urls) {
      let retries = 0;
      let success = false;

      while (retries <= maxRetries && !success) {
        try {
          await migrationApiClient.get(url, config, {
            cache: {
              ttl: ttl || 300000, // 5 minutes default
              tag: tags?.join(','),
              strategy: 'cache-first'
            }
          });

          this.warmingStats.warmedUrls++;
          success = true;
        } catch (error) {
          retries++;
          console.warn(`Failed to warm cache for ${url} (attempt ${retries}/${maxRetries + 1}):`, error);

          if (retries <= maxRetries) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
          } else {
            this.warmingStats.failedUrls++;
          }
        }
      }
    }
  }

  getWarmingProgress(): number {
    return this.warmpProgress;
  }

  getWarmingStats() {
    const duration = this.warmingStats.endTime && this.warmingStats.startTime
      ? this.warmingStats.endTime.getTime() - this.warmingStats.startTime.getTime()
      : 0;

    return {
      ...this.warmingStats,
      duration,
      isWarming: this.isWarming,
      successRate: this.warmingStats.totalUrls > 0
        ? (this.warmingStats.warmedUrls / this.warmingStats.totalUrls) * 100
        : 0
    };
  }

  // Predefined warming strategies for common scenarios
  static getCommonStrategies(): CacheWarmingStrategy[] {
    return [
      {
        name: 'user-data',
        priority: 10,
        urls: [
          { url: '/auth/me', ttl: 600000 }, // 10 minutes
          { url: '/user/preferences', ttl: 3600000 }, // 1 hour
          { url: '/user/permissions', ttl: 1800000 }, // 30 minutes
          { url: '/user/recent-workshops', ttl: 300000 } // 5 minutes
        ]
      },
      {
        name: 'workshop-lists',
        priority: 9,
        dependencies: ['user-data'],
        urls: [
          { url: '/workshops', ttl: 180000 }, // 3 minutes
          { url: '/workshops/my', ttl: 120000 }, // 2 minutes
          { url: '/workshops/recent', ttl: 60000 }, // 1 minute
          { url: '/workshops/favorites', ttl: 300000 } // 5 minutes
        ]
      },
      {
        name: 'dashboard-data',
        priority: 8,
        dependencies: ['workshop-lists'],
        urls: [
          { url: '/dashboard/overview', ttl: 60000 }, // 1 minute
          { url: '/dashboard/analytics', ttl: 300000 }, // 5 minutes
          { url: '/dashboard/notifications', ttl: 30000 } // 30 seconds
        ]
      },
      {
        name: 'template-data',
        priority: 7,
        urls: [
          { url: '/templates', ttl: 1800000 }, // 30 minutes
          { url: '/templates/popular', ttl: 900000 }, // 15 minutes
          { url: '/templates/recent', ttl: 600000 } // 10 minutes
        ]
      },
      {
        name: 'questionnaire-data',
        priority: 6,
        urls: [
          { url: '/questionnaires', ttl: 300000 }, // 5 minutes
          { url: '/questionnaires/drafts', ttl: 600000 }, // 10 minutes
          { url: '/questionnaires/templates', ttl: 1800000 } // 30 minutes
        ]
      },
      {
        name: 'system-config',
        priority: 5,
        urls: [
          { url: '/system/config', ttl: 3600000 }, // 1 hour
          { url: '/system/features', ttl: 1800000 }, // 30 minutes
          { url: '/system/maintenance', ttl: 60000 } // 1 minute
        ]
      }
    ];
  }

  // Context-aware warming based on user behavior
  async warmUserSpecificContext(userId: string): Promise<void> {
    const userStrategy: CacheWarmingStrategy = {
      name: 'user-context',
      priority: 10,
      urls: [
        { url: `/users/${userId}/workshops`, ttl: 120000 },
        { url: `/users/${userId}/activity`, ttl: 60000 },
        { url: `/users/${userId}/collaborations`, ttl: 180000 },
        { url: `/users/${userId}/notifications`, ttl: 30000 }
      ]
    };

    await this.executeStrategy(userStrategy, 2);
  }

  // Warm specific workshop context
  async warmWorkshopContext(workshopId: string): Promise<void> {
    const workshopStrategy: CacheWarmingStrategy = {
      name: 'workshop-context',
      priority: 10,
      urls: [
        { url: `/workshops/${workshopId}`, ttl: 180000 },
        { url: `/workshops/${workshopId}/participants`, ttl: 60000 },
        { url: `/workshops/${workshopId}/questions`, ttl: 120000 },
        { url: `/workshops/${workshopId}/responses`, ttl: 30000 },
        { url: `/workshops/${workshopId}/analytics`, ttl: 180000 }
      ]
    };

    await this.executeStrategy(workshopStrategy, 2);
  }

  // Intelligent warming based on migration phase
  async warmForMigrationPhase(phase: string): Promise<void> {
    let strategies: CacheWarmingStrategy[] = [];

    switch (phase) {
      case 'pre-migration':
        // Warm critical user data before migration starts
        strategies = CacheWarmingService.getCommonStrategies()
          .filter(s => s.priority >= 8);
        break;

      case 'migration':
        // Focus on frequently accessed data during migration
        strategies = CacheWarmingService.getCommonStrategies()
          .filter(s => ['user-data', 'workshop-lists'].includes(s.name));
        break;

      case 'post-migration':
        // Warm all data to prime new cache systems
        strategies = CacheWarmingService.getCommonStrategies();
        break;

      default:
        // Default warming
        strategies = CacheWarmingService.getCommonStrategies()
          .filter(s => s.priority >= 7);
    }

    const plan: CacheWarmingPlan = {
      strategies,
      batchSize: 3,
      delayBetweenBatches: 1000,
      maxRetries: 2
    };

    await this.executeWarmingPlan(plan);
  }

  // Emergency warming for performance degradation
  async emergencyWarm(): Promise<void> {
    const emergencyStrategies: CacheWarmingStrategy[] = [
      {
        name: 'emergency-critical',
        priority: 10,
        urls: [
          { url: '/auth/me', ttl: 600000 },
          { url: '/workshops/my', ttl: 120000 },
          { url: '/dashboard/overview', ttl: 60000 }
        ]
      }
    ];

    const plan: CacheWarmingPlan = {
      strategies: emergencyStrategies,
      batchSize: 1,
      delayBetweenBatches: 0,
      maxRetries: 1
    };

    await this.executeWarmingPlan(plan);
  }
}

export const cacheWarmingService = CacheWarmingService.getInstance();
export default cacheWarmingService;