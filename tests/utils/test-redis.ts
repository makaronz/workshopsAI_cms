import Redis from 'ioredis';

// Mock Redis implementation for testing
export class MockRedis {
  private data: Map<string, any> = new Map();
  private ttl: Map<string, number> = new Map();

  async get(key: string): Promise<string | null> {
    this.checkTTL(key);
    return this.data.get(key) || null;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK' | null> {
    this.data.set(key, value);

    if (duration && typeof duration === 'number') {
      this.ttl.set(key, Date.now() + duration * 1000);
    } else if (mode === 'EX' && typeof duration === 'number') {
      this.ttl.set(key, Date.now() + duration * 1000);
    }

    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    await this.set(key, value, 'EX', seconds);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.data.has(key);
    this.data.delete(key);
    this.ttl.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    this.checkTTL(key);
    return this.data.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (this.data.has(key)) {
      this.ttl.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    this.checkTTL(key);
    const expiry = this.ttl.get(key);
    if (!expiry) return -1;
    const remaining = Math.ceil((expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -1;
  }

  async flushall(): Promise<'OK'> {
    this.data.clear();
    this.ttl.clear();
    return 'OK';
  }

  async hget(key: string, field: string): Promise<string | null> {
    const hash = this.data.get(key);
    if (hash && typeof hash === 'object') {
      return hash[field] || null;
    }
    return null;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    let hash = this.data.get(key);
    if (!hash || typeof hash !== 'object') {
      hash = {};
      this.data.set(key, hash);
    }
    const isNew = !hash[field];
    hash[field] = value;
    return isNew ? 1 : 0;
  }

  async hdel(key: string, field: string): Promise<number> {
    const hash = this.data.get(key);
    if (hash && typeof hash === 'object' && hash[field]) {
      delete hash[field];
      return 1;
    }
    return 0;
  }

  async hexists(key: string, field: string): Promise<number> {
    const hash = this.data.get(key);
    if (hash && typeof hash === 'object' && hash[field]) {
      return 1;
    }
    return 0;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.data.get(key);
    return (hash && typeof hash === 'object') ? { ...hash } : {};
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    let list = this.data.get(key);
    if (!Array.isArray(list)) {
      list = [];
      this.data.set(key, list);
    }
    list.unshift(...values);
    return list.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    let list = this.data.get(key);
    if (!Array.isArray(list)) {
      list = [];
      this.data.set(key, list);
    }
    list.push(...values);
    return list.length;
  }

  async lpop(key: string): Promise<string | null> {
    const list = this.data.get(key);
    if (Array.isArray(list) && list.length > 0) {
      return list.shift() || null;
    }
    return null;
  }

  async rpop(key: string): Promise<string | null> {
    const list = this.data.get(key);
    if (Array.isArray(list) && list.length > 0) {
      return list.pop() || null;
    }
    return null;
  }

  async llen(key: string): Promise<number> {
    const list = this.data.get(key);
    return Array.isArray(list) ? list.length : 0;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.data.get(key);
    if (!Array.isArray(list)) {
      return [];
    }

    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }

  async disconnect(): Promise<void> {
    // Mock disconnect - nothing to do
  }

  // Helper methods
  private checkTTL(key: string): void {
    const expiry = this.ttl.get(key);
    if (expiry && Date.now() > expiry) {
      this.data.delete(key);
      this.ttl.delete(key);
    }
  }

  // Testing utilities
  getMemoryUsage(): { dataSize: number; ttlSize: number } {
    return {
      dataSize: this.data.size,
      ttlSize: this.ttl.size,
    };
  }

  getAllKeys(): string[] {
    return Array.from(this.data.keys());
  }

  clear(): void {
    this.data.clear();
    this.ttl.clear();
  }
}

// Test Redis helper class
export class TestRedisHelper {
  private redis: MockRedis | Redis = null as any;

  async connect(useRealRedis = false): Promise<MockRedis | Redis> {
    if (useRealRedis && process.env.TEST_REDIS_URL) {
      this.redis = new Redis(process.env.TEST_REDIS_URL);
      await this.redis.ping();
    } else {
      this.redis = new MockRedis();
    }
    return this.redis;
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
    }
  }

  async clear(): Promise<void> {
    if (this.redis) {
      await this.redis.flushall();
    }
  }

  getInstance(): MockRedis | Redis {
    return this.redis;
  }

  // Cache testing utilities
  async testCachePerformance(
    key: string,
    value: any,
    iterations = 1000
  ): Promise<{ averageGetTime: number; averageSetTime: number }> {
    const serializedValue = JSON.stringify(value);

    // Test SET performance
    const setTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await this.redis.set(`${key}-${i}`, serializedValue);
      const end = process.hrtime.bigint();
      setTimes.push(Number(end - start) / 1000000); // Convert to milliseconds
    }

    // Test GET performance
    const getTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await this.redis.get(`${key}-${i}`);
      const end = process.hrtime.bigint();
      getTimes.push(Number(end - start) / 1000000); // Convert to milliseconds
    }

    // Cleanup
    for (let i = 0; i < iterations; i++) {
      await this.redis.del(`${key}-${i}`);
    }

    const averageSetTime = setTimes.reduce((a, b) => a + b, 0) / setTimes.length;
    const averageGetTime = getTimes.reduce((a, b) => a + b, 0) / getTimes.length;

    return { averageSetTime, averageGetTime };
  }
}

// Export singleton instance
export const testRedis = new TestRedisHelper();

// Factory function for creating test Redis instances
export const createTestRedis = (useRealRedis = false): Promise<MockRedis | Redis> => {
  return testRedis.connect(useRealRedis);
};