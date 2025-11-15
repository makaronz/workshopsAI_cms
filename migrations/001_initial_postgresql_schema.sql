-- Initial PostgreSQL Schema Setup
-- workshopsAI CMS Database Initialization
--
-- Note: Table schemas are managed by Drizzle ORM
-- This file only creates required extensions and basic configuration

-- Create required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create application schema
CREATE SCHEMA IF NOT EXISTS app;

-- Set up search path
ALTER DATABASE workshopsai_cms_dev SET search_path TO app, public;

-- Create application configuration variables placeholder
-- These will be set at session level by the application for Row-Level Security
COMMENT ON SCHEMA app IS 'Application schema for workshopsAI CMS tables and RLS configuration';

-- Success message
SELECT 'PostgreSQL extensions and schema initialized successfully' AS status;
