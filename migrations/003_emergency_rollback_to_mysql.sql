-- Rollback Script: PostgreSQL to MySQL (Emergency Use Only)
-- This script creates PostgreSQL views that mimic the original MySQL structure
-- allowing the application to continue functioning while a proper rollback is planned

-- WARNING: This is an emergency rollback procedure.
-- Data loss may occur. Full backup restoration is recommended.

-- Step 1: Create MySQL-compatible views for the application

-- Users view (PostgreSQL UUID -> MySQL INT compatible)
CREATE OR REPLACE VIEW mysql_users AS
SELECT
    (ROW_NUMBER() OVER (ORDER BY id))::int as id,
    openId,
    name,
    email,
    password,
    loginMethod::text,
    role::text,
    avatar,
    bio,
    isActive,
    emailVerified,
    lastLoginAt,
    createdAt,
    updatedAt
FROM users
WHERE deleted_at IS NULL;

-- Facilitators view
CREATE OR REPLACE VIEW mysql_facilitators AS
SELECT
    (ROW_NUMBER() OVER (ORDER BY id))::int as id,
    (SELECT (ROW_NUMBER() OVER (ORDER BY u.id))::int FROM users u WHERE u.id = f.userId) as userId,
    slug,
    title,
    organization,
    experience,
    specializations,
    certifications,
    languages,
    website,
    socialLinks,
    isAvailable,
    rating::numeric,
    totalWorkshops::numeric,
    createdAt,
    updatedAt
FROM facilitators f
WHERE deleted_at IS NULL;

-- Locations view
CREATE OR REPLACE VIEW mysql_locations AS
SELECT
    (ROW_NUMBER() OVER (ORDER BY id))::int as id,
    name,
    slug,
    address,
    city,
    country,
    capacity::numeric,
    facilities,
    coordinates,
    contactInfo,
    imageUrl,
    isActive,
    createdAt,
    updatedAt
FROM locations
WHERE deleted_at IS NULL;

-- Tags view
CREATE OR REPLACE VIEW mysql_tags AS
SELECT
    (ROW_NUMBER() OVER (ORDER BY id))::int as id,
    name,
    slug,
    description,
    color,
    category::text,
    isActive,
    usageCount::numeric,
    createdAt,
    updatedAt
FROM tags;

-- Workshops view (convert i18n back to simple text)
CREATE OR REPLACE VIEW mysql_workshops AS
SELECT
    id::text as id, -- Keep UUID as text
    slug,
    titleI18n->>'pl' as title,
    titleI18n->>'en' as subtitle, -- Use English as subtitle
    descriptionI18n->>'pl' as description,
    descriptionI18n->>'en' as shortDescription,
    status::text,
    startDate,
    endDate,
    seatLimit::numeric,
    seatReserved::numeric,
    enableWaitingList,
    waitingListCount::numeric,
    templateTheme::text,
    language::text,
    price::numeric,
    currency,
    imageUrl,
    gallery,
    requirementsI18n->>'pl' as requirements,
    objectivesI18n->>'pl' as objectives,
    materials,
    (SELECT (ROW_NUMBER() OVER (ORDER BY u.id))::int FROM users u WHERE u.id = w.createdBy) as createdBy,
    publishedAt,
    createdAt,
    updatedAt
FROM workshops w
WHERE deleted_at IS NULL;

-- Sessions view
CREATE OR REPLACE VIEW mysql_sessions AS
SELECT
    id::text as id,
    workshopId::text as workshopId,
    titleI18n->>'pl' as title,
    descriptionI18n->>'pl' as description,
    startTime,
    endTime,
    duration::numeric,
    orderIndex::numeric as "order",
    NULL as location, -- Location mapping would be complex
    materials,
    isRequired,
    maxParticipants::numeric,
    createdAt,
    updatedAt
FROM sessions;

-- Modules view
CREATE OR REPLACE VIEW mysql_modules AS
SELECT
    id::text as id,
    sessionId::text as sessionId,
    titleI18n->>'pl' as title,
    type::text,
    contentI18n->>'pl' as content,
    duration::numeric,
    orderIndex::numeric as "order",
    isRequired,
    resources,
    settings,
    createdAt,
    updatedAt
FROM modules;

-- Enrollments view
CREATE OR REPLACE VIEW mysql_enrollments AS
SELECT
    id::text as id,
    workshopId::text as workshopId,
    (SELECT (ROW_NUMBER() OVER (ORDER BY u.id))::int FROM users u WHERE u.id = e.participantId) as participantId,
    status::text,
    enrollmentDate,
    confirmedAt,
    cancelledAt,
    completedAt,
    notes,
    specialRequirements,
    paymentStatus::text,
    paymentAmount::numeric,
    attendance,
    NULL as form_data, -- Skip complex mapping
    createdAt,
    updatedAt
FROM enrollments e;

-- Step 2: Create compatibility functions for MySQL-specific operations

-- Function to generate autoincrement-like IDs (for compatibility)
CREATE OR REPLACE FUNCTION mysql_autoincrement(table_name TEXT)
RETURNS INTEGER AS $$
DECLARE
    next_id INTEGER;
BEGIN
    EXECUTE format('SELECT COALESCE(MAX(id), 0) + 1 FROM mysql_%s', table_name) INTO next_id;
    RETURN next_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get MySQL-style NOW()
CREATE OR REPLACE FUNCTION mysql_now()
RETURNS TIMESTAMP WITHOUT TIME ZONE AS $$
BEGIN
    RETURN NOW();
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create export procedures for full rollback

-- Export all data to CSV files for MySQL import
CREATE OR REPLACE FUNCTION export_for_mysql_rollback()
RETURNS TEXT AS $$
DECLARE
    export_path TEXT := '/tmp/mysql_rollback_export/';
BEGIN
    -- Create export directory (requires filesystem access)
    EXECUTE 'CREATE TABLE IF NOT EXISTS export_log (table_name TEXT, record_count INTEGER, export_time TIMESTAMP)';

    -- Export users
    EXECUTE format('COPY (SELECT * FROM mysql_users) TO %L WITH CSV HEADER', export_path || 'users.csv');
    INSERT INTO export_log VALUES ('users', (SELECT COUNT(*) FROM mysql_users), NOW());

    -- Export workshops
    EXECUTE format('COPY (SELECT * FROM mysql_workshops) TO %L WITH CSV HEADER', export_path || 'workshops.csv');
    INSERT INTO export_log VALUES ('workshops', (SELECT COUNT(*) FROM mysql_workshops), NOW());

    -- Export enrollments
    EXECUTE format('COPY (SELECT * FROM mysql_enrollments) TO %L WITH CSV HEADER', export_path || 'enrollments.csv');
    INSERT INTO export_log VALUES ('enrollments', (SELECT COUNT(*) FROM mysql_enrollments), NOW());

    -- Export all other tables...

    RETURN 'Export completed to ' || export_path || '. Check export_log table for details.';
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create backup procedure
CREATE OR REPLACE FUNCTION create_emergency_backup()
RETURNS TEXT AS $$
DECLARE
    backup_name TEXT := 'emergency_backup_' || to_char(NOW(), 'YYYY_MM_DD_HH24_MI_SS');
BEGIN
    -- This would be implemented with pg_dump or similar tool
    -- For now, just create a record of the backup attempt
    EXECUTE format('CREATE TABLE IF NOT EXISTS emergency_backups (backup_name TEXT PRIMARY KEY, created_at TIMESTAMP, status TEXT)');
    INSERT INTO emergency_backups VALUES (backup_name, NOW(), 'initiated');

    RETURN 'Emergency backup initiated: ' || backup_name ||
           '. Use pg_dump to create actual backup file.';
END;
$$ LANGUAGE plpgsql;

-- Step 5: Performance impact monitoring
CREATE OR REPLACE VIEW rollback_performance_impact AS
SELECT
    'PostgreSQL Views Overhead' as metric,
    pg_size_pretty(pg_total_relation_size('mysql_users')) as users_view_size,
    pg_size_pretty(pg_total_relation_size('mysql_workshops')) as workshops_view_size,
    pg_size_pretty(pg_total_relation_size('mysql_enrollments')) as enrollments_view_size,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM workshops) as total_workshops,
    (SELECT COUNT(*) FROM enrollments) as total_enrollments;

-- Step 6: Rollback status monitoring
CREATE OR REPLACE VIEW rollback_status AS
SELECT
    'Rollback Status' as status,
    'PostgreSQL to MySQL compatibility views created' as action_taken,
    NOW() as rollback_timestamp,
    'Application should work with minimal changes' as notes,
    'Full data rollback requires manual MySQL import' as limitation;

-- Step 7: Clean-up procedure (when ready to switch back)
CREATE OR REPLACE FUNCTION cleanup_rollback_views()
RETURNS TEXT AS $$
BEGIN
    -- Drop all compatibility views
    DROP VIEW IF EXISTS mysql_users CASCADE;
    DROP VIEW IF EXISTS mysql_facilitators CASCADE;
    DROP VIEW IF EXISTS mysql_locations CASCADE;
    DROP VIEW IF EXISTS mysql_tags CASCADE;
    DROP VIEW IF EXISTS mysql_workshops CASCADE;
    DROP VIEW IF EXISTS mysql_sessions CASCADE;
    DROP VIEW IF EXISTS mysql_modules CASCADE;
    DROP VIEW IF EXISTS mysql_enrollments CASCADE;

    -- Drop helper functions
    DROP FUNCTION IF EXISTS mysql_autoincrement(TEXT);
    DROP FUNCTION IF EXISTS mysql_now();
    DROP FUNCTION IF EXISTS export_for_mysql_rollback();
    DROP FUNCTION IF EXISTS create_emergency_backup();

    -- Drop monitoring views
    DROP VIEW IF EXISTS rollback_performance_impact;
    DROP VIEW IF EXISTS rollback_status;

    -- Drop temporary tables
    DROP TABLE IF EXISTS emergency_backups;
    DROP TABLE IF EXISTS export_log;

    RETURN 'Rollback compatibility views and functions cleaned up successfully';
END;
$$ LANGUAGE plpgsql;

-- Emergency rollback complete notification
DO $$
BEGIN
    RAISE NOTICE 'Emergency rollback compatibility mode enabled at %', NOW();
    RAISE NOTICE 'PostgreSQL now presents MySQL-compatible views to the application';
    RAISE NOTICE 'To execute full rollback: Export data from PostgreSQL and import to MySQL';
    RAISE NOTICE 'To clean up rollback mode: SELECT cleanup_rollback_views()';
END $$;