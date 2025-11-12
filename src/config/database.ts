import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../models/schema";

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "workshopsai_cms",
  timezone: "+00:00",
  charset: "utf8mb4",
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  connectionLimit: 10,
};

// Create connection pool
const connectionPool = mysql.createPool(dbConfig);

// Create drizzle instance
export const db = drizzle(connectionPool, {
  schema,
  mode: "default",
  logger: process.env.NODE_ENV === "development"
});

// Export database connection
export { connectionPool };

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const connection = await connectionPool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await connectionPool.end();
    console.log("Database connection closed successfully");
  } catch (error) {
    console.error("Error closing database connection:", error);
  }
}

// Export schema for use in other files
export * from "../models/schema";