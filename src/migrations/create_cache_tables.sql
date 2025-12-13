-- Hybrid Cache PostgreSQL Schema
-- This file creates the necessary tables for the L2 PostgreSQL cache layer

-- Create cache entries table
CREATE TABLE IF NOT EXISTS cache_entries (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value BYTEA NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    size_bytes INTEGER DEFAULT 0,
    checksum TEXT,
    compressed BOOLEAN DEFAULT FALSE,
    level VARCHAR(10) DEFAULT 'L2',
    priority VARCHAR(10) DEFAULT 'medium'
);

-- Create index on key for fast lookups
CREATE INDEX IF NOT EXISTS idx_cache_entries_key ON cache_entries (key);

-- Create index on expiration time for cleanup
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries (expires_at);

-- Create GIN index on tags for tag-based invalidation
CREATE INDEX IF NOT EXISTS idx_cache_entries_tags ON cache_entries USING GIN (tags);

-- Create index on last accessed for LRU eviction
CREATE INDEX IF NOT EXISTS idx_cache_entries_last_accessed ON cache_entries (last_accessed);

-- Create partial index for non-expired entries
CREATE INDEX IF NOT EXISTS idx_cache_entries_active ON cache_entries (key)
WHERE (expires_at IS NULL OR expires_at > NOW());

-- Create index on priority for cache management
CREATE INDEX IF NOT EXISTS idx_cache_entries_priority ON cache_entries (priority);

-- Create index on level for multi-level cache support
CREATE INDEX IF NOT EXISTS idx_cache_entries_level ON cache_entries (level);

-- Create cache statistics table for monitoring
CREATE TABLE IF NOT EXISTS cache_statistics (
    id SERIAL PRIMARY KEY,
    cache_level VARCHAR(10) NOT NULL,
    metric_name VARCHAR(50) NOT NULL,
    metric_value NUMERIC NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create index on statistics for querying
CREATE INDEX IF NOT EXISTS idx_cache_statistics_level_metric ON cache_statistics (cache_level, metric_name);
CREATE INDEX IF NOT EXISTS idx_cache_statistics_recorded_at ON cache_statistics (recorded_at);

-- Create cache warming jobs table for tracking warming operations
CREATE TABLE IF NOT EXISTS cache_warming_jobs (
    id SERIAL PRIMARY KEY,
    strategy_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    keys_warmed INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on warming jobs
CREATE INDEX IF NOT EXISTS idx_cache_warming_jobs_status ON cache_warming_jobs (status);
CREATE INDEX IF NOT EXISTS idx_cache_warming_jobs_strategy ON cache_warming_jobs (strategy_name);
CREATE INDEX IF NOT EXISTS idx_cache_warming_jobs_created_at ON cache_warming_jobs (created_at);

-- Create cache invalidation log for tracking invalidation operations
CREATE TABLE IF NOT EXISTS cache_invalidation_log (
    id SERIAL PRIMARY KEY,
    operation_type VARCHAR(20) NOT NULL, -- 'key', 'tag', 'pattern', 'all'
    target TEXT NOT NULL, -- key, tag, pattern, or 'all'
    keys_affected INTEGER DEFAULT 0,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on invalidation log
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_operation ON cache_invalidation_log (operation_type);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_created_at ON cache_invalidation_log (created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cache_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER cache_entries_updated_at
    BEFORE UPDATE ON cache_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_cache_entries_updated_at();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache_entries()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_entries
    WHERE expires_at IS NOT NULL AND expires_at <= NOW()
    RETURNING key INTO deleted_count;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Log the cleanup operation
    INSERT INTO cache_invalidation_log (operation_type, target, keys_affected, reason)
    VALUES ('cleanup', 'expired', deleted_count, 'Scheduled cleanup of expired entries');

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_statistics()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_entries', COUNT(*),
        'total_size', COALESCE(SUM(size_bytes), 0),
        'active_entries', COUNT(*) FILTER (WHERE expires_at IS NULL OR expires_at > NOW()),
        'expired_entries', COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at <= NOW()),
        'compressed_entries', COUNT(*) FILTER (WHERE compressed = TRUE),
        'average_size', COALESCE(AVG(size_bytes), 0),
        'largest_entry', (SELECT MAX(size_bytes) FROM cache_entries),
        'access_stats', jsonb_build_object(
            'total_accesses', COALESCE(SUM(access_count), 0),
            'average_accesses', COALESCE(AVG(access_count), 0),
            'most_accessed', (SELECT MAX(access_count) FROM cache_entries)
        ),
        'priority_distribution', (
            SELECT jsonb_agg(jsonb_build_object(priority, COUNT(*)))
            FROM (
                SELECT priority, COUNT(*) as count
                FROM cache_entries
                GROUP BY priority
            ) t
        ),
        'tag_distribution', (
            SELECT jsonb_agg(jsonb_build_object(tag, COUNT(*)))
            FROM (
                SELECT unnest(tags) as tag, COUNT(*) as count
                FROM cache_entries
                WHERE tags != '{}'
                GROUP BY tag
            ) t
        )
    ) INTO result
    FROM cache_entries;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to optimize cache table (rebuild indexes, update statistics)
CREATE OR REPLACE FUNCTION optimize_cache_table()
RETURNS VOID AS $$
BEGIN
    -- Update table statistics for query optimizer
    ANALYZE cache_entries;
    ANALYZE cache_statistics;
    ANALYZE cache_warming_jobs;
    ANALYZE cache_invalidation_log;

    -- Log the optimization
    INSERT INTO cache_invalidation_log (operation_type, target, reason)
    VALUES ('optimize', 'cache_tables', 'Scheduled table optimization');
END;
$$ LANGUAGE plpgsql;

-- Create a view for active cache entries
CREATE OR REPLACE VIEW active_cache_entries AS
SELECT
    id,
    key,
    size_bytes,
    tags,
    level,
    priority,
    access_count,
    last_accessed,
    expires_at,
    compressed
FROM cache_entries
WHERE (expires_at IS NULL OR expires_at > NOW());

-- Create a view for cache performance metrics
CREATE OR REPLACE VIEW cache_performance_metrics AS
SELECT
    DATE_TRUNC('hour', recorded_at) as hour,
    cache_level,
    metric_name,
    AVG(metric_value) as avg_value,
    MIN(metric_value) as min_value,
    MAX(metric_value) as max_value,
    COUNT(*) as sample_count
FROM cache_statistics
WHERE recorded_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', recorded_at), cache_level, metric_name
ORDER BY hour DESC, cache_level, metric_name;

-- Grant permissions (adjust based on your database user)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'workshopsai_cms_user') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON cache_entries TO workshopsai_cms_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON cache_statistics TO workshopsai_cms_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON cache_warming_jobs TO workshopsai_cms_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON cache_invalidation_log TO workshopsai_cms_user;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO workshopsai_cms_user;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO workshopsai_cms_user;
    END IF;
END
$$;