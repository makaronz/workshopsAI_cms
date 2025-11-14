-- Performance Optimization Migration for WorkshopsAI CMS
-- This migration implements comprehensive database performance optimizations

-- ========================================
-- 1. ADVANCED INDEXING STRATEGY
-- ========================================

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workshops_status_created_at 
ON workshops(status, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workshops_created_by_status 
ON workshops(created_by, status) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workshops_published_at_desc 
ON workshops(published_at DESC) WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workshops_slug_active 
ON workshops(slug) WHERE deleted_at IS NULL;

-- Enrollment and user workshop access patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_user_status 
ON enrollments(participant_id, enrollment_status) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_workshop_status 
ON enrollments(workshop_id, enrollment_status) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_created_at 
ON enrollments(created_at DESC) WHERE deleted_at IS NULL;

-- Questionnaire and response optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questionnaires_workshop_active 
ON questionnaires(workshop_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_questionnaire_created 
ON responses(questionnaire_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_user_questionnaire 
ON responses(user_id, questionnaire_id) WHERE deleted_at IS NULL;

-- Session optimization for workshop schedules
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_workshop_start 
ON sessions(workshop_id, start_time) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_datetime_range 
ON sessions(start_time, end_time) WHERE deleted_at IS NULL;

-- File access patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_entity_type 
ON files(associated_entity_type, associated_entity_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_access_level 
ON files(access_level) WHERE deleted_at IS NULL;

-- Email and notification patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_notifications_status 
ON email_notifications(status, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_notifications_user_status 
ON email_notifications(user_id, status) WHERE deleted_at IS NULL;

-- Tags and search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_category 
ON tags(category) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workshop_tags_workshop 
ON workshop_tags(workshop_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workshop_tags_tag 
ON workshop_tags(tag_id) WHERE deleted_at IS NULL;

-- Full-text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workshops_title_fts 
ON workshops USING gin(to_tsvector('english', title_i18n::jsonb ->> 'en')) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workshops_description_fts 
ON workshops USING gin(to_tsvector('english', description_i18n::jsonb ->> 'en')) 
WHERE deleted_at IS NULL;

-- ========================================
-- 2. PERFORMANCE MONITORING VIEWS
-- ========================================

-- View for slow query analysis
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE mean_time > 100 -- queries taking more than 100ms on average
ORDER BY mean_time DESC
LIMIT 20;

-- View for index usage analysis
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;

-- ========================================
-- 3. CACHED VIEWS FOR COMMON QUERIES
-- ========================================

-- Materialized view for workshop statistics (refresh every hour)
CREATE MATERIALIZED VIEW workshop_statistics AS
SELECT 
    w.id,
    w.title_i18n,
    w.status,
    COUNT(DISTINCT e.participant_id) as enrolled_count,
    COUNT(DISTINCT CASE WHEN e.enrollment_status = 'confirmed' THEN e.participant_id END) as confirmed_count,
    COUNT(DISTINCT s.id) as session_count,
    COUNT(DISTINCT q.id) as questionnaire_count,
    MAX(e.created_at) as last_enrollment,
    w.created_at,
    w.updated_at
FROM workshops w
LEFT JOIN enrollments e ON w.id = e.workshop_id AND e.deleted_at IS NULL
LEFT JOIN sessions s ON w.id = s.workshop_id AND s.deleted_at IS NULL
LEFT JOIN questionnaires q ON w.id = q.workshop_id AND q.deleted_at IS NULL
WHERE w.deleted_at IS NULL
GROUP BY w.id, w.title_i18n, w.status, w.created_at, w.updated_at;

CREATE UNIQUE INDEX idx_workshop_statistics_id ON workshop_statistics(id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_workshop_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY workshop_statistics;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. PERFORMANCE TRIGGERS AND FUNCTIONS
-- ========================================

-- Function to update search vectors incrementally
CREATE OR REPLACE FUNCTION update_workshop_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    -- Update search vectors for both English and Polish
    NEW.search_vector_en := to_tsvector('english', 
        COALESCE(NEW.title_i18n->>'en', '') || ' ' ||
        COALESCE(NEW.description_i18n->>'en', '') || ' ' ||
        COALESCE(NEW.short_description_i18n->>'en', '')
    );
    
    NEW.search_vector_pl := to_tsvector('polish',
        COALESCE(NEW.title_i18n->>'pl', '') || ' ' ||
        COALESCE(NEW.description_i18n->>'pl', '') || ' ' ||
        COALESCE(NEW.short_description_i18n->>'pl', '')
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add search vector columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'workshops' AND column_name = 'search_vector_en') THEN
        ALTER TABLE workshops ADD COLUMN search_vector_en tsvector;
        ALTER TABLE workshops ADD COLUMN search_vector_pl tsvector;
        
        -- Create indexes for search vectors
        CREATE INDEX CONCURRENTLY idx_workshops_search_en ON workshops USING gin(search_vector_en) 
        WHERE deleted_at IS NULL;
        CREATE INDEX CONCURRENTLY idx_workshops_search_pl ON workshops USING gin(search_vector_pl) 
        WHERE deleted_at IS NULL;
        
        -- Create trigger
        CREATE TRIGGER update_workshop_search_vector_trigger
            BEFORE INSERT OR UPDATE ON workshops
            FOR EACH ROW EXECUTE FUNCTION update_workshop_search_vector();
    END IF;
END;
$$;

-- ========================================
-- 5. PERFORMANCE ANALYSIS FUNCTIONS
-- ========================================

-- Function to analyze table bloat
CREATE OR REPLACE FUNCTION analyze_table_bloat()
RETURNS TABLE(
    table_name TEXT,
    bloat_size BIGINT,
    bloat_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        bloat_size,
        ROUND(bloat_size::NUMERIC / pg_total_relation_size(schemaname||'.'||tablename) * 100, 2) as bloat_percentage
    FROM (
        SELECT 
            schemaname,
            tablename,
            (ceil(relpages/8)*8192 - (stats.n_dead_tup * (23 + MAX(COALESCE(null_frac,0)) * 24))) as bloat_size
        FROM pg_class 
        JOIN pg_stat_user_tables stats ON pg_class.relname = stats.tablename
        WHERE schemaname = 'public'
    ) bloat_analysis
    WHERE bloat_size > 0
    ORDER BY bloat_size DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get connection pool statistics
CREATE OR REPLACE FUNCTION get_connection_stats()
RETURNS TABLE(
    total_connections INTEGER,
    active_connections INTEGER,
    idle_connections INTEGER,
    waiting_connections INTEGER,
    max_connections INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_connections,
        COUNT(*) FILTER (WHERE state = 'active') as active_connections,
        COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
        COUNT(*) FILTER (WHERE wait_event IS NOT NULL) as waiting_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
    FROM pg_stat_activity;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. AUTOMATED PERFORMANCE JOBS
-- ========================================

-- Create a job to cleanup old audit logs (older than 1 year)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs 
    WHERE timestamp < NOW() - INTERVAL '1 year';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a job to update table statistics
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
BEGIN
    -- Analyze frequently updated tables
    ANALYZE workshops;
    ANALYZE enrollments;
    ANALYZE responses;
    ANALYZE sessions;
    ANALYZE questionnaires;
    ANALYZE audit_logs;
    
    -- Refresh materialized view
    PERFORM refresh_workshop_statistics();
END;
$$ LANGUAGE plpgsql;

COMMIT;
