import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/models/postgresql-schema.ts",
  out: "./migrations",
  dbCredentials: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "workshopsai_cms",
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  },
  verbose: true,
  strict: true,
});