// Test file for GitHub swarm validation
// This file contains various code patterns to test automated reviews

import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export class TestController {
  private app: express.Application;

  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  // Test method with security patterns
  public async authenticateUser(token: string): Promise<User | null> {
    try {
      // This should trigger security scanning
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      return await User.findById(decoded.userId);
    } catch (error) {
      console.error('Authentication failed:', error);
      return null;
    }
  }

  // Test method with performance considerations
  public async getUsersWithPagination(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    // This should trigger performance analysis
    return await User.find()
      .skip(skip)
      .limit(limit)
      .lean();
  }

  // Test method requiring documentation
  public calculateMetrics(data: number[]): {
    mean: number;
    median: number;
    std: number;
  } {
    // Complex algorithm requiring documentation
    const sorted = [...data].sort((a, b) => a - b);
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length;
    
    return { mean, median, std: Math.sqrt(variance) };
  }

  private setupRoutes(): void {
    this.app.get('/test', (req, res) => {
      res.json({ message: 'GitHub swarm validation endpoint' });
    });
  }
}
