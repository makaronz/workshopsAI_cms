import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, desc, asc, inArray, isNull } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../models/postgresql-schema';

// PostgreSQL database configuration
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
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

// Debug: Log the connection string and environment variables
console.log('🔗 Environment variables loaded:');
console.log('  DB_HOST:', process.env.DB_HOST);
console.log('  DB_PORT:', process.env.DB_PORT);
console.log('  DB_USER:', process.env.DB_USER);
console.log('  DB_NAME:', process.env.DB_NAME);
console.log('🔗 PostgreSQL connection string:', connectionString.replace(/:[^:]*@/, ':***@')); // Hide password

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

// Export database connection and operators
export { client };
export { eq, and, desc, asc, inArray, isNull };

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
      SELECT
        set_config('app.current_user_id', ${userId}, true),
        set_config('app.current_user_role', ${userRole}, true),
        set_config('app.is_admin', ${isAdmin ? 'true' : 'false'}, true)
    `;
  }

  /**
   * Clear current user context
   */
  static async clearCurrentUser(): Promise<void> {
    await client`
      SELECT 
        set_config('app.current_user_id', '', true),
        set_config('app.current_user_role', '', true),
        set_config('app.is_admin', '', true)
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
   * Check if user has access to workshop
   */
  static async checkWorkshopAccess(
    workshopId: string,
    userId: string,
    userRole: string,
  ): Promise<boolean> {
    try {
      // Simple implementation - check if user is owner or has appropriate role
      const result = await client`
        SELECT EXISTS (
          SELECT 1 FROM workshops
          WHERE id = ${workshopId}
          AND (
            created_by = ${userId}
            OR ${userRole} = 'admin'
            OR ${userRole} = 'sociologist-editor'
          )
        ) as has_access
      `;
      return result[0]?.has_access || false;
    } catch (error) {
      console.error('Workshop access check failed:', error);
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
        INSERT INTO audit_logs(
      user_id,
      table_name,
      record_id,
      operation,
      old_values,
      new_values,
      ip_address,
      user_agent
    ) VALUES(
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
