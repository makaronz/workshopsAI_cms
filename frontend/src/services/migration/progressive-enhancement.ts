import migrationApiClient from './api-client';

export interface Feature {
  name: string;
  required: boolean; // Critical for basic functionality
  fallbackAvailable: boolean; // Has a fallback implementation
  checkImplementation: () => Promise<boolean>;
  fallbackImplementation?: () => Promise<any>;
  progressiveLevels: {
    basic?: () => Promise<any>;
    enhanced?: () => Promise<any>;
    advanced?: () => Promise<any>;
  };
}

export interface ProgressiveConfig {
  enableGracefulDegradation: boolean;
  enableFeatureDetection: boolean;
  enableOfflineFallback: boolean;
  maxRetries: number;
  retryDelay: number;
}

class ProgressiveEnhancementService {
  private static instance: ProgressiveEnhancementService;
  private features: Map<string, Feature> = new Map();
  private currentSystemCapabilities: {
    networkSpeed: 'slow' | 'medium' | 'fast';
    deviceType: 'mobile' | 'tablet' | 'desktop';
    browserSupport: 'basic' | 'modern' | 'advanced';
    migrationPhase: string;
  } = {
    networkSpeed: 'fast',
    deviceType: 'desktop',
    browserSupport: 'modern',
    migrationPhase: 'pre-migration'
  };
  private config: ProgressiveConfig = {
    enableGracefulDegradation: true,
    enableFeatureDetection: true,
    enableOfflineFallback: true,
    maxRetries: 3,
    retryDelay: 1000
  };

  static getInstance(): ProgressiveEnhancementService {
    if (!ProgressiveEnhancementService.instance) {
      ProgressiveEnhancementService.instance = new ProgressiveEnhancementService();
    }
    return ProgressiveEnhancementService.instance;
  }

  constructor() {
    this.detectSystemCapabilities();
    this.setupEventListeners();
  }

  private detectSystemCapabilities(): void {
    // Detect device type
    const userAgent = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      this.currentSystemCapabilities.deviceType = 'mobile';
    } else if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      this.currentSystemCapabilities.deviceType = 'tablet';
    }

    // Detect browser support
    const features = [
      'IntersectionObserver' in window,
      'ResizeObserver' in window,
      'fetch' in window,
      'serviceWorker' in navigator,
      'cache' in window,
      'WebAssembly' in window
    ];

    const supportedFeatures = features.filter(Boolean).length;
    if (supportedFeatures >= 5) {
      this.currentSystemCapabilities.browserSupport = 'advanced';
    } else if (supportedFeatures >= 3) {
      this.currentSystemCapabilities.browserSupport = 'modern';
    } else {
      this.currentSystemCapabilities.browserSupport = 'basic';
    }

    // Detect network speed (approximation)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
          this.currentSystemCapabilities.networkSpeed = 'slow';
        } else if (connection.effectiveType === '3g') {
          this.currentSystemCapabilities.networkSpeed = 'medium';
        }
      }
    }

    // Get migration phase
    const migrationStatus = migrationApiClient.getMigrationStatus();
    if (migrationStatus) {
      this.currentSystemCapabilities.migrationPhase = migrationStatus.phase;
    }
  }

  private setupEventListeners(): void {
    // Listen for migration phase changes
    window.addEventListener('migration-phase-changed', ((event: CustomEvent) => {
      this.currentSystemCapabilities.migrationPhase = event.detail.phase;
      this.adjustFeaturesForMigration();
    }) as EventListener);

    // Listen for network changes
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection && connection.addEventListener) {
        connection.addEventListener('change', () => {
          this.detectSystemCapabilities();
          this.adjustFeaturesForNetwork();
        });
      }
    }
  }

  registerFeature(feature: Feature): void {
    this.features.set(feature.name, feature);
  }

  async executeFeature<T = any>(
    featureName: string,
    level: 'basic' | 'enhanced' | 'advanced' = 'enhanced'
  ): Promise<T> {
    const feature = this.features.get(featureName);
    if (!feature) {
      throw new Error(`Feature '${featureName}' not registered`);
    }

    // Check if feature is available
    const isAvailable = await this.isFeatureAvailable(featureName);

    if (!isAvailable) {
      if (!feature.fallbackAvailable) {
        throw new Error(`Feature '${featureName}' is required but not available and has no fallback`);
      }

      if (feature.fallbackImplementation) {
        console.warn(`Using fallback for feature: ${featureName}`);
        return feature.fallbackImplementation();
      }

      throw new Error(`Feature '${featureName}' fallback not implemented`);
    }

    // Determine appropriate level based on capabilities
    const actualLevel = this.determineAppropriateLevel(level);

    try {
      let retries = 0;
      while (retries <= this.config.maxRetries) {
        try {
          if (actualLevel === 'advanced' && feature.progressiveLevels.advanced) {
            return await feature.progressiveLevels.advanced();
          } else if (actualLevel === 'enhanced' && feature.progressiveLevels.enhanced) {
            return await feature.progressiveLevels.enhanced();
          } else if (feature.progressiveLevels.basic) {
            return await feature.progressiveLevels.basic();
          }
          break;
        } catch (error) {
          retries++;
          if (retries <= this.config.maxRetries) {
            console.warn(`Feature '${featureName}' failed, retrying (${retries}/${this.config.maxRetries}):`, error);
            await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * retries));
          } else {
            throw error;
          }
        }
      }

      throw new Error(`No valid implementation found for feature '${featureName}' at level '${actualLevel}'`);
    } catch (error) {
      // Try fallback if available
      if (feature.fallbackAvailable && feature.fallbackImplementation) {
        console.warn(`Using fallback for feature '${featureName}' due to error:`, error);
        return feature.fallbackImplementation();
      }
      throw error;
    }
  }

  async isFeatureAvailable(featureName: string): Promise<boolean> {
    const feature = this.features.get(featureName);
    if (!feature) return false;

    try {
      return await feature.checkImplementation();
    } catch (error) {
      console.warn(`Feature check failed for '${featureName}':`, error);
      return false;
    }
  }

  private determineAppropriateLevel(
    requestedLevel: 'basic' | 'enhanced' | 'advanced'
  ): 'basic' | 'enhanced' | 'advanced' {
    // Adjust based on migration phase
    if (this.currentSystemCapabilities.migrationPhase === 'migration') {
      return 'basic'; // Use basic features during migration
    }

    // Adjust based on network speed
    if (this.currentSystemCapabilities.networkSpeed === 'slow') {
      return 'basic';
    }

    // Adjust based on device type
    if (this.currentSystemCapabilities.deviceType === 'mobile') {
      return Math.min(requestedLevel === 'advanced' ? 1 : requestedLevel === 'enhanced' ? 0 : 0, 1) as 'basic' | 'enhanced';
    }

    // Adjust based on browser support
    if (this.currentSystemCapabilities.browserSupport === 'basic') {
      return 'basic';
    }

    return requestedLevel;
  }

  private adjustFeaturesForMigration(): void {
    // Adjust features based on migration phase
    switch (this.currentSystemCapabilities.migrationPhase) {
      case 'pre-migration':
        // Normal operation
        break;

      case 'migration':
        // Disable non-essential features
        this.config.maxRetries = 1;
        this.config.retryDelay = 500;
        break;

      case 'post-migration':
        // Gradually restore features
        this.config.maxRetries = 2;
        break;

      case 'complete':
        // Full operation restored
        this.config.maxRetries = 3;
        break;
    }
  }

  private adjustFeaturesForNetwork(): void {
    // Adjust features based on network conditions
    switch (this.currentSystemCapabilities.networkSpeed) {
      case 'slow':
        this.config.maxRetries = 1;
        this.config.retryDelay = 2000;
        break;
      case 'medium':
        this.config.maxRetries = 2;
        break;
      case 'fast':
        this.config.maxRetries = 3;
        this.config.retryDelay = 1000;
        break;
    }
  }

  // Utility methods for common progressive enhancement patterns
  createAsyncComponent<T>(loader: () => Promise<T>, fallback?: () => Promise<T>): () => Promise<T> {
    return async () => {
      try {
        return await loader();
      } catch (error) {
        if (fallback) {
          console.warn('Component loading failed, using fallback:', error);
          return await fallback();
        }
        throw error;
      }
    };
  }

  createProgressiveImage(src: string, options: {
    lowQualitySrc?: string;
    placeholderSrc?: string;
    lazy?: boolean;
  } = {}): HTMLImageElement {
    const img = document.createElement('img');

    if (options.placeholderSrc) {
      img.src = options.placeholderSrc;
    }

    if (options.lazy && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.loadImageProgressively(img, src, options.lowQualitySrc);
              observer.unobserve(img);
            }
          });
        },
        { rootMargin: '50px' }
      );
      observer.observe(img);
    } else {
      this.loadImageProgressively(img, src, options.lowQualitySrc);
    }

    return img;
  }

  private loadImageProgressively(
    img: HTMLImageElement,
    highQualitySrc: string,
    lowQualitySrc?: string
  ): void {
    if (lowQualitySrc) {
      const tempImg = new Image();
      tempImg.src = lowQualitySrc;
      tempImg.onload = () => {
        img.src = lowQualitySrc;
        img.className += ' loaded';
      };
    }

    const highImg = new Image();
    highImg.src = highQualitySrc;
    highImg.onload = () => {
      img.src = highQualitySrc;
      img.className += ' high-quality loaded';
    };
  }

  // Get current system capabilities
  getSystemCapabilities() {
    return { ...this.currentSystemCapabilities };
  }

  // Update configuration
  updateConfig(config: Partial<ProgressiveConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Check if we're in a degraded state
  isDegradedState(): boolean {
    return this.currentSystemCapabilities.migrationPhase === 'migration' ||
           this.currentSystemCapabilities.networkSpeed === 'slow';
  }

  // Get recommended feature level
  getRecommendedLevel(): 'basic' | 'enhanced' | 'advanced' {
    if (this.isDegradedState()) {
      return 'basic';
    }

    if (this.currentSystemCapabilities.deviceType === 'desktop' &&
        this.currentSystemCapabilities.browserSupport === 'advanced' &&
        this.currentSystemCapabilities.networkSpeed === 'fast') {
      return 'advanced';
    }

    return 'enhanced';
  }
}

export const progressiveEnhancementService = ProgressiveEnhancementService.getInstance();
export default progressiveEnhancementService;

// Decorator for progressive enhancement
export function progressive(featureName: string, level: 'basic' | 'enhanced' | 'advanced' = 'enhanced') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await progressiveEnhancementService.executeFeature(featureName, level);
      } catch (error) {
        console.error(`Progressive enhancement failed for feature '${featureName}':`, error);
        // Fallback to original method if available
        if (originalMethod) {
          return originalMethod.apply(this, args);
        }
        throw error;
      }
    };

    return descriptor;
  };
}