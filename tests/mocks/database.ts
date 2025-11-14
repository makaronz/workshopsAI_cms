/**
 * Database Mock Utilities
 * Comprehensive mock implementations for database operations
 */

import { Pool, Client } from 'pg';

export interface MockQueryResult {
  rows: any[];
  rowCount: number;
  command: string;
  fields: any[];
}

export class MockDatabase {
  private data: Map<string, any[]> = new Map();
  private sequences: Map<string, number> = new Map();

  constructor() {
    // Initialize with some default data
    this.initializeData();
  }

  private initializeData() {
    // Users table
    this.data.set('users', [
      {
        id: '1',
        email: 'admin@test.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        email: 'user@test.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    // Workshops table
    this.data.set('workshops', [
      {
        id: '1',
        title: 'Test Workshop 1',
        description: 'A test workshop',
        slug: 'test-workshop-1',
        status: 'draft',
        maxParticipants: 20,
        createdBy: '1',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    // Questionnaires table
    this.data.set('questionnaires', [
      {
        id: '1',
        title: 'Test Questionnaire',
        description: 'A test questionnaire',
        workshopId: '1',
        createdBy: '1',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    // Initialize sequences
    this.sequences.set('users_id', 3);
    this.sequences.set('workshops_id', 2);
    this.sequences.set('questionnaires_id', 2);
  }

  async query(text: string, params?: any[]): Promise<MockQueryResult> {
    // Simulate database query delay
    await new Promise(resolve => setTimeout(resolve, 10));

    // Parse the query to determine the operation
    const query = text.toLowerCase().trim();

    if (query.startsWith('select')) {
      return this.handleSelect(query, params);
    } else if (query.startsWith('insert')) {
      return this.handleInsert(query, params);
    } else if (query.startsWith('update')) {
      return this.handleUpdate(query, params);
    } else if (query.startsWith('delete')) {
      return this.handleDelete(query, params);
    }

    // Default response
    return {
      rows: [],
      rowCount: 0,
      command: 'UNKNOWN',
      fields: []
    };
  }

  private handleSelect(query: string, params?: any[]): MockQueryResult {
    // Simple mock implementation for SELECT queries
    if (query.includes('users')) {
      const users = this.data.get('users') || [];
      return {
        rows: users,
        rowCount: users.length,
        command: 'SELECT',
        fields: []
      };
    }

    if (query.includes('workshops')) {
      const workshops = this.data.get('workshops') || [];
      return {
        rows: workshops,
        rowCount: workshops.length,
        command: 'SELECT',
        fields: []
      };
    }

    if (query.includes('questionnaires')) {
      const questionnaires = this.data.get('questionnaires') || [];
      return {
        rows: questionnaires,
        rowCount: questionnaires.length,
        command: 'SELECT',
        fields: []
      };
    }

    return {
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      fields: []
    };
  }

  private handleInsert(query: string, params?: any[]): MockQueryResult {
    if (query.includes('users')) {
      const newUser = {
        id: String(this.getNextSequence('users_id')),
        email: params?.[0],
        username: params?.[1],
        firstName: params?.[2],
        lastName: params?.[3],
        role: params?.[4] || 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const users = this.data.get('users') || [];
      users.push(newUser);
      this.data.set('users', users);

      return {
        rows: [newUser],
        rowCount: 1,
        command: 'INSERT',
        fields: []
      };
    }

    if (query.includes('workshops')) {
      const newWorkshop = {
        id: String(this.getNextSequence('workshops_id')),
        title: params?.[0],
        description: params?.[1],
        slug: params?.[2],
        status: params?.[3] || 'draft',
        maxParticipants: params?.[4] || 20,
        createdBy: params?.[5],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const workshops = this.data.get('workshops') || [];
      workshops.push(newWorkshop);
      this.data.set('workshops', workshops);

      return {
        rows: [newWorkshop],
        rowCount: 1,
        command: 'INSERT',
        fields: []
      };
    }

    return {
      rows: [],
      rowCount: 0,
      command: 'INSERT',
      fields: []
    };
  }

  private handleUpdate(query: string, params?: any[]): MockQueryResult {
    if (query.includes('users') && query.includes('where id')) {
      const userId = params?.[params.length - 1];
      const users = this.data.get('users') || [];
      const userIndex = users.findIndex(u => u.id === userId);

      if (userIndex !== -1) {
        users[userIndex] = {
          ...users[userIndex],
          updatedAt: new Date()
        };
        this.data.set('users', users);

        return {
          rows: [users[userIndex]],
          rowCount: 1,
          command: 'UPDATE',
          fields: []
        };
      }
    }

    return {
      rows: [],
      rowCount: 0,
      command: 'UPDATE',
      fields: []
    };
  }

  private handleDelete(query: string, params?: any[]): MockQueryResult {
    if (query.includes('users') && query.includes('where id')) {
      const userId = params?.[0];
      const users = this.data.get('users') || [];
      const initialLength = users.length;
      const filteredUsers = users.filter(u => u.id !== userId);

      this.data.set('users', filteredUsers);

      return {
        rows: [],
        rowCount: initialLength - filteredUsers.length,
        command: 'DELETE',
        fields: []
      };
    }

    return {
      rows: [],
      rowCount: 0,
      command: 'DELETE',
      fields: []
    };
  }

  private getNextSequence(sequenceName: string): number {
    const current = this.sequences.get(sequenceName) || 1;
    const next = current + 1;
    this.sequences.set(sequenceName, next);
    return current;
  }

  // Transaction support
  async begin(): Promise<any> {
    return { query: this.query.bind(this), commit: () => Promise.resolve(), rollback: () => Promise.resolve() };
  }

  // Reset database state
  reset(): void {
    this.data.clear();
    this.sequences.clear();
    this.initializeData();
  }

  // Add custom test data
  addData(tableName: string, data: any[]): void {
    this.data.set(tableName, data);
  }

  // Get table data for testing
  getData(tableName: string): any[] {
    return this.data.get(tableName) || [];
  }
}

// Mock Pool implementation
export const mockPool = {
  connect: jest.fn().mockResolvedValue({
    query: jest.fn().mockImplementation((text, params) => {
      const db = new MockDatabase();
      return db.query(text, params);
    }),
    release: jest.fn()
  }),
  end: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockImplementation((text, params) => {
    const db = new MockDatabase();
    return db.query(text, params);
  })
};

// Mock Client implementation
export const mockClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockImplementation((text, params) => {
    const db = new MockDatabase();
    return db.query(text, params);
  }),
  end: jest.fn().mockResolvedValue(undefined)
};

// Export mock database instance for tests
export const mockDatabase = new MockDatabase();