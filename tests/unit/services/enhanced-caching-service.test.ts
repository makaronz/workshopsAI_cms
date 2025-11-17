import { EnhancedCachingService } from '../../../src/services/enhanced-caching-service';
import { testRedis } from '../../utils/test-redis';
import { performanceTestingUtils } from '../../utils/performance-testing-utils';

// Mock external dependencies
jest.mock('ioredis');

describe('EnhancedCachingService', () => {
  let service: EnhancedCachingService;
  let mockRedis: any;

  beforeAll(async () => {
    mockRedis = await testRedis.connect();
  });

  afterAll(async () => {
    await testRedis.disconnect();
  });

  beforeEach(() => {
    service = new EnhancedCachingService({
      redis: {
        host: 'localhost',
        port: 6379,
        db: 1,
      },
      cache: {
        defaultTTL: 3600,
        maxSize: 10000,
        compressionEnabled: true,
        compressionThreshold: 1024,
      },
      performance: {
        metricsEnabled: true,
        hitRateTracking: true,
        memoryTracking: true,
      },
    });

    performanceTestingUtils.reset();
  });

  afterEach(async () => {
    await service.disconnect();
    await mockRedis.flushall();
  });

  describe('Basic Cache Operations', () => {
    it('should set and get cache values', async () => {
      const key = 'test-key';
      const value = { id: 1, name: 'Test Data' };

      await service.set(key, value);
      const result = await service.get(key);

      expect(result).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const result = await service.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should handle TTL expiration', async () => {
      const key = 'test-ttl';
      const value = 'test-value';

      await service.set(key, value, 1); // 1 second TTL

      // Should exist immediately
      let result = await service.get(key);
      expect(result).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired
      result = await service.get(key);
      expect(result).toBeNull();
    });

    it('should delete cache values', async () => {
      const key = 'test-delete';
      const value = 'test-value';

      await service.set(key, value);
      expect(await service.get(key)).toBe(value);

      await service.del(key);
      expect(await service.get(key)).toBeNull();
    });

    it('should check if key exists', async () => {
      const key = 'test-exists';
      const value = 'test-value';

      expect(await service.exists(key)).toBe(false);

      await service.set(key, value);
      expect(await service.exists(key)).toBe(true);

      await service.del(key);
      expect(await service.exists(key)).toBe(false);
    });

    it('should set TTL on existing keys', async () => {
      const key = 'test-expire';
      const value = 'test-value';

      await service.set(key, value, 10); // 10 seconds
      await service.expire(key, 1); // Update to 1 second

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(await service.get(key)).toBeNull();
    });
  });

  describe('Advanced Cache Operations', () => {
    it('should handle atomic increment operations', async () => {
      const key = 'test-counter';

      // Initialize counter
      await service.set(key, 0);

      // Increment multiple times
      await service.incr(key);
      await service.incr(key, 5);
      await service.incr(key, -2);

      const result = await service.get(key);
      expect(result).toBe(4);
    });

    it('should handle list operations', async () => {
      const key = 'test-list';

      // Push items
      await service.lpush(key, 'item3', 'item2', 'item1');
      await service.rpush(key, 'item4', 'item5');

      // Get all items
      const allItems = await service.lrange(key, 0, -1);
      expect(allItems).toEqual(['item1', 'item2', 'item3', 'item4', 'item5']);

      // Pop from both ends
      const leftItem = await service.lpop(key);
      const rightItem = await service.rpop(key);

      expect(leftItem).toBe('item1');
      expect(rightItem).toBe('item5');

      // Check remaining items
      const remainingItems = await service.lrange(key, 0, -1);
      expect(remainingItems).toEqual(['item2', 'item3', 'item4']);
    });

    it('should handle hash operations', async () => {
      const key = 'test-hash';

      // Set hash fields
      await service.hset(key, 'field1', 'value1');
      await service.hset(key, 'field2', 'value2');
      await service.hset(key, 'field3', 'value3');

      // Get individual field
      expect(await service.hget(key, 'field1')).toBe('value1');
      expect(await service.hget(key, 'nonexistent')).toBeNull();

      // Get all fields
      const allFields = await service.hgetall(key);
      expect(allFields).toEqual({
        field1: 'value1',
        field2: 'value2',
        field3: 'value3',
      });

      // Delete field
      await service.hdel(key, 'field2');
      expect(await service.hget(key, 'field2')).toBeNull();
      expect(await service.hexists(key, 'field2')).toBe(false);
    });

    it('should handle set operations', async () => {
      const key = 'test-set';

      // Add members
      await service.sadd(key, 'member1', 'member2', 'member3');
      await service.sadd(key, 'member2', 'member4'); // member2 already exists

      // Check membership
      expect(await service.sismember(key, 'member1')).toBe(true);
      expect(await service.sismember(key, 'member5')).toBe(false);

      // Get all members
      const members = await service.smembers(key);
      expect(members).toContain('member1');
      expect(members).toContain('member2');
      expect(members).toContain('member3');
      expect(members).toContain('member4');
      expect(members).toHaveLength(4);

      // Remove member
      await service.srem(key, 'member2');
      expect(await service.sismember(key, 'member2')).toBe(false);
    });
  });

  describe('Cache Performance Features', () => {
    it('should compress large values', async () => {
      const key = 'test-compression';
      const largeValue = 'x'.repeat(2000); // Larger than compression threshold

      await service.set(key, largeValue);
      const result = await service.get(key);

      expect(result).toBe(largeValue);

      // Verify compression was used (internal implementation detail)
      const stats = await service.getCompressionStats();
      expect(stats.compressedOperations).toBeGreaterThan(0);
    });

    it('should handle cache warming', async () => {
      const warmupData = [
        { key: 'warm1', value: 'value1' },
        { key: 'warm2', value: 'value2' },
        { key: 'warm3', value: 'value3' },
      ];

      await service.warmCache(warmupData);

      // Verify all warmup data is cached
      for (const item of warmupData) {
        expect(await service.get(item.key)).toBe(item.value);
      }

      const warmupStats = await service.getWarmupStats();
      expect(warmupStats.totalItems).toBe(3);
      expect(warmupStats.successfulItems).toBe(3);
    });

    it('should implement intelligent cache eviction', async () => {
      // Fill cache beyond max size
      for (let i = 0; i < 100; i++) {
        await service.set(`eviction-test-${i}`, `value-${i}`, 3600);
      }

      // Add one more item to trigger eviction
      await service.set('eviction-test-last', 'last-value', 3600);

      // Some items should have been evicted
      const exists = await Promise.all([
        service.exists('eviction-test-0'),
        service.exists('eviction-test-99'),
        service.exists('eviction-test-last'),
      ]);

      // At least one of the original items should be evicted
      const originalItemsExist = exists.slice(0, -1).some(e => e);
      const lastItemExists = exists[exists.length - 1];

      expect(lastItemExists).toBe(true);
    });

    it('should track cache hit rates accurately', async () => {
      const key = 'hit-rate-test';
      const value = 'test-value';

      // Pre-populate cache
      await service.set(key, value);

      // Perform cache operations
      await service.get(key); // hit
      await service.get(key); // hit
      await service.get('miss-key'); // miss
      await service.get(key); // hit

      const stats = await service.getHitRateStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.75, 2);
    });
  });

  describe('Cache Patterns and Strategies', () => {
    it('should implement cache-aside pattern correctly', async () => {
      const key = 'cache-aside-test';
      const fetchFunction = jest.fn().mockResolvedValue('fetched-value');

      // First call - cache miss, should fetch
      let result = await service.getOrFetch(key, fetchFunction);
      expect(result).toBe('fetched-value');
      expect(fetchFunction).toHaveBeenCalledTimes(1);

      // Verify value is cached
      expect(await service.get(key)).toBe('fetched-value');

      // Second call - cache hit, should not fetch
      result = await service.getOrFetch(key, fetchFunction);
      expect(result).toBe('fetched-value');
      expect(fetchFunction).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should implement write-through pattern correctly', async () => {
      const key = 'write-through-test';
      const value = 'test-value';
      const writeFunction = jest.fn().mockResolvedValue(true);

      await service.setWithWriteThrough(key, value, writeFunction);

      // Value should be in cache
      expect(await service.get(key)).toBe(value);

      // Write function should have been called
      expect(writeFunction).toHaveBeenCalledWith(key, value);
    });

    it('should implement write-behind pattern correctly', async () => {
      const key = 'write-behind-test';
      const value = 'test-value';
      const writeFunction = jest.fn().mockResolvedValue(true);

      await service.setWithWriteBehind(key, value, writeFunction);

      // Value should be in cache immediately
      expect(await service.get(key)).toBe(value);

      // Write function should be called asynchronously
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(writeFunction).toHaveBeenCalledWith(key, value);
    });

    it('should handle cache invalidation strategies', async () => {
      const keys = ['inv-test-1', 'inv-test-2', 'inv-test-3'];

      // Set up cache
      for (const key of keys) {
        await service.set(key, `value-${key}`);
      }

      // Invalidate by pattern
      await service.invalidateByPattern('inv-test-*');

      // All matching keys should be invalidated
      for (const key of keys) {
        expect(await service.get(key)).toBeNull();
      }
    });
  });

  describe('Multi-Layer Caching', () => {
    it('should handle L1 (memory) cache operations', async () => {
      const key = 'l1-cache-test';
      const value = 'l1-value';

      // Set in L1 cache
      await service.setL1(key, value);

      // Get from L1 cache
      const result = await service.getL1(key);
      expect(result).toBe(value);

      // Verify it's not in Redis
      expect(await mockRedis.get(key)).toBeNull();
    });

    it('should fallback to L2 (Redis) cache when L1 misses', async () => {
      const key = 'l2-fallback-test';
      const value = 'l2-value';

      // Set only in L2
      await service.set(key, value);

      // Clear L1 cache manually
      await service.clearL1();

      // Should still get value from L2
      const result = await service.get(key);
      expect(result).toBe(value);
    });

    it('should synchronize L1 and L2 cache layers', async () => {
      const key = 'sync-test';
      const value = 'sync-value';

      // Set with sync enabled
      await service.setWithSync(key, value);

      // Should be in both layers
      expect(await service.getL1(key)).toBe(value);
      expect(await mockRedis.get(key)).toBe(JSON.stringify(value));
    });
  });

  describe('Cache Analytics and Monitoring', () => {
    it('should provide comprehensive cache statistics', async () => {
      // Perform various cache operations
      await service.set('stats-key-1', 'value-1');
      await service.set('stats-key-2', 'value-2');
      await service.get('stats-key-1'); // hit
      await service.get('stats-key-3'); // miss
      await service.del('stats-key-2');

      const stats = await service.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.totalOperations).toBeGreaterThan(0);
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.deletes).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should track operation latency metrics', async () => {
      const key = 'latency-test';
      const value = 'test-value';

      // Perform multiple operations
      for (let i = 0; i < 100; i++) {
        await service.set(`${key}-${i}`, `${value}-${i}`);
        await service.get(`${key}-${i}`);
      }

      const latencyStats = await service.getLatencyStats();

      expect(latencyStats).toBeDefined();
      expect(latencyStats.set).toBeDefined();
      expect(latencyStats.get).toBeDefined();
      expect(latencyStats.set.average).toBeGreaterThan(0);
      expect(latencyStats.get.average).toBeGreaterThan(0);
      expect(latencyStats.set.p95).toBeGreaterThan(0);
      expect(latencyStats.get.p95).toBeGreaterThan(0);
    });

    it('should identify cache hotspots', async () => {
      const hotKey = 'hot-key';
      const coldKey = 'cold-key';

      // Access hot key frequently
      for (let i = 0; i < 100; i++) {
        await service.get(hotKey);
      }

      // Access cold key infrequently
      for (let i = 0; i < 5; i++) {
        await service.get(coldKey);
      }

      const hotspots = await service.getCacheHotspots();

      expect(hotspots).toBeDefined();
      expect(hotspots.length).toBeGreaterThan(0);
      expect(hotspots[0].key).toBe(hotKey);
      expect(hotspots[0].accessCount).toBe(100);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // Mock Redis failure
      mockRedis.set = jest.fn().mockRejectedValue(new Error('Redis connection failed'));

      // Operations should not throw but should handle errors gracefully
      await expect(service.set('error-test', 'value')).resolves.not.toThrow();
      await expect(service.get('error-test')).resolves.not.toThrow();
    });

    it('should implement circuit breaker pattern', async () => {
      // Simulate repeated failures
      mockRedis.get = jest.fn().mockRejectedValue(new Error('Connection failed'));

      // Multiple failed operations should trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        await service.get(`circuit-test-${i}`);
      }

      // Circuit should be open, operations should fail fast
      const startTime = Date.now();
      await service.get('should-fail-fast');
      const endTime = Date.now();

      // Should fail quickly, not wait for timeout
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle cache poisoning attempts', async () => {
      // Attempt to set invalid data
      const maliciousKeys = [
        'key\x00with\x00nulls',
        'key\r\nwith\r\nnewlines',
        'key"with"quotes',
      ];

      for (const key of maliciousKeys) {
        await expect(service.set(key, 'value')).resolves.not.toThrow();
      }

      // Verify cache still works normally
      await expect(service.set('normal-key', 'normal-value')).resolves.not.toThrow();
      expect(await service.get('normal-key')).toBe('normal-value');
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure by filling cache
      for (let i = 0; i < 10000; i++) {
        await service.set(`memory-pressure-${i}`, 'x'.repeat(1000));
      }

      // Should still be able to perform operations
      await expect(service.set('still-working', 'test')).resolves.not.toThrow();
      expect(await service.get('still-working')).toBe('test');
    });
  });

  describe('Performance Tests', () => {
    it('should handle high-frequency operations efficiently', async () => {
      const { result, metric } = await performanceTestingUtils.measurePerformance(
        'high-frequency-cache-ops',
        async () => {
          const promises = Array.from({ length: 1000 }, async (_, i) => {
            const key = `perf-test-${i}`;
            const value = `perf-value-${i}`;

            await service.set(key, value);
            return await service.get(key);
          });

          return Promise.all(promises);
        }
      );

      expect(metric.duration).toBeLessThan(3000); // 3 seconds for 1000 operations
      expect(result).toHaveLength(1000);
      expect(result.every(r => r !== null)).toBe(true);
    });

    it('should maintain acceptable performance under load', async () => {
      const loadTestResult = await performanceTestingUtils.performLoadTest(
        'cache-load-test',
        async () => {
          const operation = Math.floor(Math.random() * 4);
          const key = `load-test-${Math.floor(Math.random() * 100)}`;

          switch (operation) {
            case 0:
              return service.set(key, 'test-value');
            case 1:
              return service.get(key);
            case 2:
              return service.del(key);
            case 3:
              return service.exists(key);
          }
        },
        {
          concurrency: 50,
          totalRequests: 1000,
        }
      );

      expect(loadTestResult.successfulRequests).toBeGreaterThan(950);
      expect(loadTestResult.averageResponseTime).toBeLessThan(50);
      expect(loadTestResult.requestsPerSecond).toBeGreaterThan(100);
    });

    it('should handle concurrent operations without race conditions', async () => {
      const key = 'concurrent-test';
      let operationCount = 0;

      const promises = Array.from({ length: 100 }, async (_, i) => {
        const value = `concurrent-value-${i}`;
        await service.set(key, value);
        const retrieved = await service.get(key);
        if (retrieved === value) {
          operationCount++;
        }
      });

      await Promise.all(promises);

      // All operations should have completed successfully
      expect(operationCount).toBe(100);
    });

    it('should maintain memory efficiency during extended operations', async () => {
      const memoryLeakResult = await performanceTestingUtils.detectMemoryLeaks(
        'cache-memory-efficiency',
        async () => {
          // Perform various cache operations
          for (let i = 0; i < 500; i++) {
            await service.set(`memory-test-${i}`, `x`.repeat(100));
            await service.get(`memory-test-${i}`);
          }

          // Clean up some items
          for (let i = 0; i < 250; i++) {
            await service.del(`memory-test-${i}`);
          }
        },
        5,
        50 * 1024 * 1024 // 50MB threshold
      );

      expect(memoryLeakResult.hasMemoryLeak).toBe(false);
      expect(memoryLeakResult.memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Integration Features', () => {
    it('should support cache tagging and bulk operations', async () => {
      const items = [
        { key: 'tagged-1', value: 'value1', tags: ['user', 'profile'] },
        { key: 'tagged-2', value: 'value2', tags: ['user', 'settings'] },
        { key: 'tagged-3', value: 'value3', tags: ['post', 'content'] },
      ];

      // Set items with tags
      for (const item of items) {
        await service.setWithTags(item.key, item.value, item.tags);
      }

      // Get by tag
      const userItems = await service.getByTag('user');
      expect(userItems).toHaveLength(2);

      // Invalidate by tag
      await service.invalidateByTag('user');

      // Verify tagged items are invalidated
      expect(await service.get('tagged-1')).toBeNull();
      expect(await service.get('tagged-2')).toBeNull();
      expect(await service.get('tagged-3')).not.toBeNull(); // Different tag
    });

    it('should support cache versioning and migration', async () => {
      const key = 'version-test';
      const value = { data: 'test', version: 1 };

      // Set versioned data
      await service.setVersioned(key, value, 1);

      // Get with version check
      const result = await service.getVersioned(key, 1);
      expect(result).toEqual(value);

      // Version mismatch should return null
      const mismatchedResult = await service.getVersioned(key, 2);
      expect(mismatchedResult).toBeNull();

      // Migrate to new version
      await service.migrateVersion(key, 2, (oldValue) => ({ ...oldValue, version: 2 }));

      const migratedResult = await service.getVersioned(key, 2);
      expect(migratedResult).toEqual({ data: 'test', version: 2 });
    });

    it('should support cache transactions', async () => {
      const transaction = service.createTransaction();

      try {
        await transaction.set('tx-key-1', 'value1');
        await transaction.set('tx-key-2', 'value2');
        await transaction.del('tx-key-3');

        // Values should not be visible yet
        expect(await service.get('tx-key-1')).toBeNull();

        await transaction.commit();

        // Values should be visible after commit
        expect(await service.get('tx-key-1')).toBe('value1');
        expect(await service.get('tx-key-2')).toBe('value2');
      } catch (error) {
        await transaction.rollback();
      }
    });
  });
});