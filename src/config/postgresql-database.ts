import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../models/postgresql-schema';

// PostgreSQL database configuration
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workshopsai_cms',
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  max: 10, // connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
};

// Create PostgreSQL connection pool
const connectionString = `postgresql://${pgConfig.user}:${pgConfig.password}@${pgConfig.host}:${pgConfig.port}/${pgConfig.database}${pgConfig.ssl ? '?sslmode=require' : ''}`;

const client = postgres(connectionString, {
  max: pgConfig.max,
  idle_timeout: pgConfig.idle_timeout,
  connect_timeout: pgConfig.connect_timeout,
});

// Create drizzle instance with PostgreSQL
export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === 'development',
});

// Export database connection
export { client };

// Row-Level Security helper functions
export class RLSHelper {
  /**
   * Set current user context for RLS policies
   */
  static async setCurrentUser(
    userId: string,
    userRole: string,
    isAdmin: boolean = false,
  ): Promise<void> {
    await client`
      SET LOCAL app.current_user_id = ${userId};
      SET LOCAL app.current_user_role = ${userRole};
      SET LOCAL app.is_admin = ${isAdmin ? 'true' : 'false'};
    `;
  }

  /**
   * Clear current user context
   */
  static async clearCurrentUser(): Promise<void> {
    await client`
      RESET app.current_user_id;
      RESET app.current_user_role;
      RESET app.is_admin;
    `;
  }

  /**
   * Check if user has permission to access resource
   */
  static async checkPermission(
    userId: string,
    tableName: string,
    recordId: string,
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  ): Promise<boolean> {
    try {
      const result = await client`
        SELECT has_table_privilege(
          current_user,
          ${tableName},
          ${operation}
        ) as has_privilege;
      `;
      return result[0]?.has_privilege || false;
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }

  /**
   * Create audit log entry for GDPR compliance
   */
  static async createAuditLog(
    userId: string | null,
    tableName: string,
    recordId: string,
    operation: string,
    oldValues: any = null,
    newValues: any = null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await client`
        INSERT INTO audit_logs (
          user_id,
          table_name,
          record_id,
          operation,
          old_values,
          new_values,
          ip_address,
          user_agent
        ) VALUES (
          ${userId || null},
          ${tableName},
          ${recordId},
          ${operation},
          ${oldValues ? JSON.stringify(oldValues) : null},
          ${newValues ? JSON.stringify(newValues) : null},
          ${ipAddress || null},
          ${userAgent || null}
        );
      `;
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }
}

// Health check function for PostgreSQL
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await client`SELECT 1 as health_check`;
    return result.length > 0;
  } catch (error) {
    console.error('PostgreSQL health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await client.end();
    console.log('PostgreSQL connection closed successfully');
  } catch (error) {
    console.error('Error closing PostgreSQL connection:', error);
  }
}

// Transaction helper with RLS support
export async function withRLS<T>(
  userId: string,
  userRole: string,
  isAdmin: boolean = false,
  callback: () => Promise<T>,
): Promise<T> {
  await RLSHelper.setCurrentUser(userId, userRole, isAdmin);

  try {
    return await callback();
  } finally {
    await RLSHelper.clearCurrentUser();
  }
}

// Export PostgreSQL schema for use in other files
export * from '../models/postgresql-schema';
