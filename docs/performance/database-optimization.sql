-- Database Performance Optimization SQL Script
-- Implements advanced optimizations for high-traffic workshop platform

-- 1. Partitioning for large tables (questionnaire_responses, analysis_jobs)
CREATE TABLE IF NOT EXISTS questionnaire_responses_partitioned (
    LIKE questionnaire_responses INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for better query performance
CREATE TABLE IF NOT EXISTS questionnaire_responses_2024_01 PARTITION OF questionnaire_responses_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE IF NOT EXISTS questionnaire_responses_2024_02 PARTITION OF questionnaire_responses_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- 2. Advanced query optimization with CTEs and window functions
CREATE OR REPLACE FUNCTION get_workshop_performance_stats(workshop_id_param UUID)
RETURNS TABLE (
    total_questionnaires BIGINT,
    total_responses BIGINT,
    avg_completion_time DECIMAL,
    completion_rate DECIMAL,
    last_24h_responses BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH workshop_data AS (
        SELECT
            COUNT(DISTINCT q.id) as questionnaire_count,
            COUNT(DISTINCT r.id) as response_count,
            AVG(EXTRACT(EPOCH FROM (r.completed_at - r.started_at))) as avg_completion_seconds
        FROM workshops w
        LEFT JOIN questionnaires q ON w.id = q.workshop_id
        LEFT JOIN responses r ON q.id = r.questionnaire_id
        WHERE w.id = workshop_id_param
        AND r.status = 'submitted'
    ),
    recent_data AS (
        SELECT COUNT(DISTINCT r.id) as recent_response_count
        FROM workshops w
        LEFT JOIN questionnaires q ON w.id = q.workshop_id
        LEFT JOIN responses r ON q.id = r.questionnaire_id
        WHERE w.id = workshop_id_param
        AND r.created_at >= NOW() - INTERVAL '24 hours'
        AND r.status = 'submitted'
    )
    SELECT
        wd.questionnaire_count,
        wd.response_count,
        COALESCE(wd.avg_completion_seconds, 0),
        CASE
            WHEN wd.questionnaire_count > 0 THEN
                ROUND((wd.response_count::DECIMAL / wd.questionnaire_count) * 100, 2)
            ELSE 0
        END as completion_rate,
        rd.recent_response_count
    FROM workshop_data wd, recent_data rd;
END;
$$ LANGUAGE plpgsql;

-- 3. Optimized full-text search with trigrams for better performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create optimized GIN index for full-text search with trigrams
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questionnaires_title_trgm
ON questionnaires USING GIN (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workshops_description_trgm
ON workshops USING GIN (description gin_trgm_ops);

-- 4. Connection pool optimization settings
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '8MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- 5. Optimized prepared statements for frequently used queries
PREPARE get_questionnaire_by_workshop(UUID) AS
SELECT q.*, COUNT(r.id) as response_count
FROM questionnaires q
LEFT JOIN responses r ON q.id = r.questionnaire_id AND r.status = 'submitted'
WHERE q.workshop_id = $1
GROUP BY q.id
ORDER BY q.created_at DESC;

PREPARE get_user_responses(UUID, UUID) AS
SELECT r.*, q.title as questionnaire_title
FROM responses r
JOIN questionnaires q ON r.questionnaire_id = q.id
WHERE r.user_id = $1 AND q.workshop_id = $2
ORDER BY r.created_at DESC;

-- 6. Advanced monitoring queries for performance insights
CREATE OR REPLACE VIEW performance_dashboard AS
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    ROUND((n_dead_tup::DECIMAL / NULLIF(n_live_tup + n_dead_tup, 0)) * 100, 2) as bloat_percentage,
    seq_scan,
    idx_scan,
    ROUND((idx_scan::DECIMAL / NULLIF(seq_scan + idx_scan, 0)) * 100, 2) as index_usage_percentage,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 7. Optimized batch operations for bulk inserts/updates
CREATE OR REPLACE FUNCTION bulk_insert_responses(responses_data JSONB)
RETURNS INTEGER AS $$
DECLARE
    inserted_count INTEGER := 0;
    response_record JSONB;
BEGIN
    FOR response_record IN SELECT * FROM jsonb_array_elements(responses_data)
    LOOP
        INSERT INTO responses (
            id, questionnaire_id, user_id, status, answers,
            created_at, updated_at, started_at, completed_at
        ) VALUES (
            (response_record->>'id')::UUID,
            (response_record->>'questionnaire_id')::UUID,
            (response_record->>'user_id')::UUID,
            response_record->>'status',
            response_record->>'answers',
            COALESCE((response_record->>'created_at')::TIMESTAMP, NOW()),
            COALESCE((response_record->>'updated_at')::TIMESTAMP, NOW()),
            (response_record->>'started_at')::TIMESTAMP,
            (response_record->>'completed_at')::TIMESTAMP
        ) ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            answers = EXCLUDED.answers,
            updated_at = EXCLUDED.updated_at;

        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- 8. Database maintenance optimization
CREATE OR REPLACE FUNCTION optimize_database()
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    vacuum_result TEXT;
    analyze_result TEXT;
    reindex_result TEXT;
BEGIN
    -- Optimize tables with high bloat
    EXECUTE 'VACUUM (ANALYZE, VERBOSE) questionnaire_responses';
    GET DIAGNOSTICS vacuum_result = ROW_COUNT;

    -- Update statistics for better query planning
    EXECUTE 'ANALYZE VERBOSE';
    GET DIAGNOSTICS analyze_result = ROW_COUNT;

    -- Rebuild fragmented indexes
    REINDEX INDEX CONCURRENTLY idx_questionnaires_workshop_status_created;
    GET DIAGNOSTICS reindex_result = ROW_COUNT;

    result := FORMAT('Database optimization completed. Vacuum: %s, Analyze: %s, Reindex: %s',
                     vacuum_result, analyze_result, reindex_result);

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Apply configuration changes
SELECT pg_reload_conf();

-- 9. Create materialized views for common aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS workshop_summary_stats AS
SELECT
    w.id,
    w.title,
    COUNT(DISTINCT q.id) as questionnaire_count,
    COUNT(DISTINCT r.id) as total_responses,
    COUNT(DISTINCT CASE WHEN r.status = 'submitted' THEN r.id END) as submitted_responses,
    COUNT(DISTINCT CASE WHEN r.created_at >= NOW() - INTERVAL '7 days' THEN r.id END) as weekly_responses,
    AVG(EXTRACT(EPOCH FROM (r.completed_at - r.started_at))) as avg_completion_time_seconds
FROM workshops w
LEFT JOIN questionnaires q ON w.id = q.workshop_id
LEFT JOIN responses r ON q.id = r.questionnaire_id
GROUP BY w.id, w.title
WITH DATA;

-- Create unique index for materialized view refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_workshop_summary_stats_id
ON workshop_summary_stats (id);

-- Create refresh function
CREATE OR REPLACE FUNCTION refresh_workshop_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY workshop_summary_stats;
END;
$$ LANGUAGE plpgsql;

-- Schedule periodic refresh (requires pg_cron extension)
-- SELECT cron.schedule('refresh-workshop-stats', '0 */2 * * *', 'SELECT refresh_workshop_stats();');