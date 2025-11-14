import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../models/postgresql-schema';

// Database configuration for PostgreSQL
const connectionString = process.env['DATABASE_URL'] ||
  `postgresql://${process.env['DB_USER'] || 'postgres'}:${process.env['DB_PASSWORD'] || ''}@${process.env['DB_HOST'] || 'localhost'}:${process.env['DB_PORT'] || '5432'}/${process.env['DB_NAME'] || 'workshopsai_cms'}`;

// Create PostgreSQL connection
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 60,
});

// Create drizzle instance
export const db = drizzle(client, {
  schema,
  logger: process.env['NODE_ENV'] === 'development',
});

// Export database connection and types
export { client };
export type DatabasePool = typeof client;

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await client.end();
    console.log('Database connection closed successfully');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
}

// Export schema and operators for use in other files
export * from '../models/postgresql-schema';
import {
  sql,
  eq,
  and,
  or,
  ne,
  gt,
  gte,
  lt,
  lte,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  between,
  exists,
  notExists,
  desc,
  asc,
} from 'drizzle-orm';

// Export Drizzle ORM operators
export {
  sql,
  eq,
  and,
  or,
  ne,
  gt,
  gte,
  lt,
  lte,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  between,
  exists,
  notExists,
  desc,
  asc,
};
