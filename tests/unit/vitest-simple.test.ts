/**
 * Simple Vitest Test
 * Test to verify Vitest infrastructure is working without Jest conflicts
 */

import { describe, it, expect, vi } from 'vitest'

describe('Vitest Infrastructure', () => {
  it('should run basic test', () => {
    expect(2 + 2).toBe(4)
  })

  it('should handle async operations', async () => {
    const result = await Promise.resolve(42)
    expect(result).toBe(42)
  })

  it('should support mocking', () => {
    const mockFn = vi.fn(() => 'mocked result')
    expect(mockFn()).toBe('mocked result')
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should have basic globals available', () => {
    expect(process.env.NODE_ENV).toBe('test')
  })
})