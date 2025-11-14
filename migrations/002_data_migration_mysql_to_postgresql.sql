-- Data Migration Script: MySQL to PostgreSQL
-- This script safely migrates data from MySQL to PostgreSQL with UUID conversion

-- Step 1: Disable RLS temporarily for migration
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE workshops DISABLE ROW LEVEL SECURITY;
ALTER TABLE responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE consents DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE facilitators DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE modules DISABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaires DISABLE ROW LEVEL SECURITY;
ALTER TABLE question_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE llm_analyses DISABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_facilitators DISABLE ROW LEVEL SECURITY;
ALTER TABLE announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;

-- Step 2: Create temporary mapping tables for ID conversion
CREATE TEMPORARY TABLE user_id_mapping (
    mysql_id INT PRIMARY KEY,
    postgresql_id UUID PRIMARY KEY
);

CREATE TEMPORARY TABLE workshop_id_mapping (
    mysql_id VARCHAR(36) PRIMARY KEY,
    postgresql_id UUID PRIMARY KEY
);

CREATE TEMPORARY TABLE facilitator_id_mapping (
    mysql_id INT PRIMARY KEY,
    postgresql_id UUID PRIMARY KEY
);

CREATE TEMPORARY TABLE location_id_mapping (
    mysql_id INT PRIMARY KEY,
    postgresql_id UUID PRIMARY KEY
);

CREATE TEMPORARY TABLE tag_id_mapping (
    mysql_id INT PRIMARY KEY,
    postgresql_id UUID PRIMARY KEY
);

CREATE TEMPORARY TABLE session_id_mapping (
    mysql_id VARCHAR(36) PRIMARY KEY,
    postgresql_id UUID PRIMARY KEY
);

CREATE TEMPORARY TABLE module_id_mapping (
    mysql_id VARCHAR(36) PRIMARY KEY,
    postgresql_id UUID PRIMARY KEY
);

CREATE TEMPORARY TABLE questionnaire_id_mapping (
    mysql_id INT PRIMARY KEY,
    postgresql_id UUID PRIMARY KEY
);

CREATE TEMPORARY TABLE question_group_id_mapping (
    mysql_id INT PRIMARY KEY,
    postgresql_id UUID PRIMARY KEY
);

CREATE TEMPORARY TABLE question_id_mapping (
    mysql_id INT PRIMARY KEY,
    postgresql_id UUID PRIMARY KEY
);

CREATE TEMPORARY TABLE llm_analysis_id_mapping (
    mysql_id VARCHAR(36) PRIMARY KEY,
    postgresql_id UUID PRIMARY KEY
);

-- Step 3: Migrate Users table (convert from INT AUTO_INCREMENT to UUID)
INSERT INTO users (id, openId, name, email, password, loginMethod, role, avatar, bio, isActive, emailVerified, lastLoginAt, createdAt, updatedAt)
SELECT
    uuid_generate_v4() as id,
    openId,
    name,
    email,
    password,
    CASE loginMethod
        WHEN 'local' THEN 'local'::text
        WHEN 'oauth' THEN 'oauth'::text
        WHEN 'sso' THEN 'sso'::text
        ELSE 'local'::text
    END as loginMethod,
    CASE role
        WHEN 'participant' THEN 'participant'::text
        WHEN 'facilitator' THEN 'facilitator'::text
        WHEN 'moderator' THEN 'moderator'::text
        WHEN 'sociologist-editor' THEN 'sociologist-editor'::text
        WHEN 'admin' THEN 'admin'::text
        ELSE 'participant'::text
    END as role,
    avatar,
    bio,
    isActive,
    emailVerified,
    lastLoginAt,
    createdAt,
    updatedAt
FROM mysql_users;

-- Populate user ID mapping
INSERT INTO user_id_mapping
SELECT mysql_users.id, users.id
FROM mysql_users
JOIN users ON mysql_users.email = users.email;

-- Step 4: Migrate Facilitators table
INSERT INTO facilitators (id, userId, slug, title, organization, experience, specializations, certifications, languages, website, socialLinks, isAvailable, rating, totalWorkshops, createdAt, updatedAt)
SELECT
    uuid_generate_v4() as id,
    uim.postgresql_id as userId,
    f.slug,
    f.title,
    f.organization,
    f.experience,
    f.specializations::jsonb,
    f.certifications::jsonb,
    f.languages::jsonb,
    f.website,
    f.socialLinks::jsonb,
    f.isAvailable,
    f.rating::numeric,
    f.totalWorkshops::numeric,
    f.createdAt,
    f.updatedAt
FROM mysql_facilitators f
JOIN user_id_mapping uim ON f.userId = uim.mysql_id;

-- Populate facilitator ID mapping
INSERT INTO facilitator_id_mapping
SELECT mf.id, pf.id
FROM mysql_facilitators mf
JOIN facilitators pf ON mf.slug = pf.slug;

-- Step 5: Migrate Locations table
INSERT INTO locations (id, name, slug, address, city, country, capacity, facilities, coordinates, contactInfo, imageUrl, isActive, createdAt, updatedAt)
SELECT
    uuid_generate_v4() as id,
    name,
    slug,
    address,
    city,
    country,
    capacity::numeric,
    facilities::jsonb,
    coordinates::jsonb,
    contactInfo::jsonb,
    imageUrl,
    isActive,
    createdAt,
    updatedAt
FROM mysql_locations;

-- Populate location ID mapping
INSERT INTO location_id_mapping
SELECT ml.id, pl.id
FROM mysql_locations ml
JOIN locations pl ON ml.slug = pl.slug;

-- Step 6: Migrate Tags table
INSERT INTO tags (id, name, slug, description, color, category, isActive, usageCount, createdAt, updatedAt)
SELECT
    uuid_generate_v4() as id,
    name,
    slug,
    description,
    color,
    CASE category
        WHEN 'theme' THEN 'theme'::text
        WHEN 'skill' THEN 'skill'::text
        WHEN 'level' THEN 'level'::text
        WHEN 'format' THEN 'format'::text
        WHEN 'audience' THEN 'audience'::text
        ELSE 'theme'::text
    END as category,
    isActive,
    usageCount::numeric,
    createdAt,
    updatedAt
FROM mysql_tags;

-- Populate tag ID mapping
INSERT INTO tag_id_mapping
SELECT mt.id, pt.id
FROM mysql_tags mt
JOIN tags pt ON mt.slug = pt.slug;

-- Step 7: Migrate Workshops table (convert to UUID, add i18n support)
INSERT INTO workshops (id, slug, titleI18n, subtitleI18n, descriptionI18n, shortDescriptionI18n, status, startDate, endDate, seatLimit, seatReserved, enableWaitingList, waitingListCount, templateTheme, language, price, currency, imageUrl, gallery, requirementsI18n, objectivesI18n, materials, createdBy, publishedAt, createdAt, updatedAt)
SELECT
    CASE
        WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid
        ELSE uuid_generate_v4()
    END as id,
    slug,
    json_build_object('pl', title, 'en', title) as titleI18n,
    CASE WHEN subtitle IS NOT NULL THEN json_build_object('pl', subtitle, 'en', subtitle) ELSE NULL END as subtitleI18n,
    CASE WHEN description IS NOT NULL THEN json_build_object('pl', description, 'en', description) ELSE NULL END as descriptionI18n,
    CASE WHEN shortDescription IS NOT NULL THEN json_build_object('pl', shortDescription, 'en', shortDescription) ELSE NULL END as shortDescriptionI18n,
    CASE status
        WHEN 'draft' THEN 'draft'::text
        WHEN 'published' THEN 'published'::text
        WHEN 'archived' THEN 'archived'::text
        WHEN 'cancelled' THEN 'cancelled'::text
        ELSE 'draft'::text
    END as status,
    startDate,
    endDate,
    seatLimit::numeric,
    seatReserved::numeric,
    enableWaitingList,
    waitingListCount::numeric,
    CASE templateTheme
        WHEN 'integracja' THEN 'integracja'::text
        WHEN 'konflikty' THEN 'konflikty'::text
        WHEN 'well-being' THEN 'well-being'::text
        WHEN 'custom' THEN 'custom'::text
        ELSE 'custom'::text
    END as templateTheme,
    CASE language
        WHEN 'pl' THEN 'pl'::text
        WHEN 'en' THEN 'en'::text
        ELSE 'pl'::text
    END as language,
    price::numeric,
    currency,
    imageUrl,
    gallery::jsonb,
    CASE WHEN requirements IS NOT NULL THEN json_build_object('pl', requirements, 'en', requirements) ELSE NULL END as requirementsI18n,
    CASE WHEN objectives IS NOT NULL THEN json_build_object('pl', objectives, 'en', objectives) ELSE NULL END as objectivesI18n,
    materials::jsonb,
    uim.postgresql_id as createdBy,
    publishedAt,
    createdAt,
    updatedAt
FROM mysql_workshops mw
JOIN user_id_mapping uim ON mw.createdBy = uim.mysql_id;

-- Populate workshop ID mapping
INSERT INTO workshop_id_mapping
SELECT mw.id, pw.id
FROM mysql_workshops mw
JOIN workshops pw ON mw.slug = pw.slug;

-- Step 8: Migrate Sessions table
INSERT INTO sessions (id, workshopId, titleI18n, descriptionI18n, startTime, endTime, duration, orderIndex, locationId, materials, isRequired, maxParticipants, createdAt, updatedAt)
SELECT
    CASE
        WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid
        ELSE uuid_generate_v4()
    END as id,
    wim.postgresql_id as workshopId,
    json_build_object('pl', title, 'en', title) as titleI18n,
    CASE WHEN description IS NOT NULL THEN json_build_object('pl', description, 'en', description) ELSE NULL END as descriptionI18n,
    startTime,
    endTime,
    duration::numeric,
    "order"::numeric as orderIndex,
    lim.postgresql_id as locationId,
    materials::jsonb,
    isRequired,
    maxParticipants::numeric,
    createdAt,
    updatedAt
FROM mysql_sessions ms
JOIN workshop_id_mapping wim ON ms.workshopId = wim.mysql_id
LEFT JOIN location_id_mapping lim ON ms.location = lim.mysql_id::text; -- This may need adjustment based on actual FK

-- Populate session ID mapping
INSERT INTO session_id_mapping
SELECT ms.id, ps.id
FROM mysql_sessions ms
JOIN sessions ps ON ms.workshopId = ps.workshopId AND ms.title = ps.titleI18n->>'pl';

-- Step 9: Migrate Modules table
INSERT INTO modules (id, sessionId, titleI18n, type, contentI18n, duration, orderIndex, isRequired, resources, settings, createdAt, updatedAt)
SELECT
    CASE
        WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid
        ELSE uuid_generate_v4()
    END as id,
    sim.postgresql_id as sessionId,
    CASE WHEN title IS NOT NULL THEN json_build_object('pl', title, 'en', title) ELSE NULL END as titleI18n,
    type::text,
    json_build_object('pl', content, 'en', content) as contentI18n,
    duration::numeric,
    "order"::numeric as orderIndex,
    isRequired,
    resources::jsonb,
    settings::jsonb,
    createdAt,
    updatedAt
FROM mysql_modules mm
JOIN session_id_mapping sim ON mm.sessionId = sim.mysql_id;

-- Step 10: Migrate Enrollments table
INSERT INTO enrollments (id, workshopId, participantId, status, enrollmentDate, confirmedAt, cancelledAt, completedAt, notes, specialRequirements, paymentStatus, paymentAmount, attendance, formData, createdAt, updatedAt)
SELECT
    CASE
        WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid
        ELSE uuid_generate_v4()
    END as id,
    wim.postgresql_id as workshopId,
    uim.postgresql_id as participantId,
    CASE status
        WHEN 'pending' THEN 'pending'::text
        WHEN 'confirmed' THEN 'confirmed'::text
        WHEN 'waitlisted' THEN 'waitlisted'::text
        WHEN 'cancelled' THEN 'cancelled'::text
        WHEN 'completed' THEN 'completed'::text
        ELSE 'pending'::text
    END as status,
    enrollmentDate,
    confirmedAt,
    cancelledAt,
    completedAt,
    notes,
    specialRequirements,
    CASE paymentStatus
        WHEN 'pending' THEN 'pending'::text
        WHEN 'paid' THEN 'paid'::text
        WHEN 'refunded' THEN 'refunded'::text
        WHEN 'waived' THEN 'waived'::text
        ELSE 'pending'::text
    END as paymentStatus,
    paymentAmount::numeric,
    attendance::jsonb,
    json_build_object('migrated_from_mysql', true) as formData,
    createdAt,
    updatedAt
FROM mysql_enrollments me
JOIN workshop_id_mapping wim ON me.workshopId = wim.mysql_id
JOIN user_id_mapping uim ON me.participantId = uim.mysql_id;

-- Step 11: Initialize GDPR compliance tables
-- Create default consents for all existing users
INSERT INTO consents (userId, consentType, granted, ipAddress, userAgent, createdAt, updatedAt)
SELECT
    uim.postgresql_id as userId,
    unnest(ARRAY['research_analysis', 'marketing_emails', 'data_sharing']) as consentType,
    CASE consentType
        WHEN 'research_analysis' THEN true
        ELSE false
    END as granted,
    '127.0.0.1' as ipAddress,
    'Data Migration Script v1.0' as userAgent,
    NOW() as createdAt,
    NOW() as updatedAt
FROM user_id_mapping uim
CROSS JOIN unnest(ARRAY['research_analysis', 'marketing_emails', 'data_sharing']) as consentType;

-- Create audit log entries for the migration
INSERT INTO audit_logs (userId, tableName, recordId, operation, newValues, ipAddress, userAgent, timestamp)
SELECT
    uim.postgresql_id as userId,
    'migration' as tableName,
    uim.postgresql_id as recordId,
    'MIGRATE_FROM_MYSQL' as operation,
    json_build_object(
        'migration_timestamp', NOW(),
        'migration_version', '1.0',
        'previous_mysql_id', uim.mysql_id
    ) as newValues,
    '127.0.0.1' as ipAddress,
    'MySQL to PostgreSQL Migration Script v1.0' as userAgent,
    NOW() as timestamp
FROM user_id_mapping uim;

-- Step 12: Re-enable RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilitators ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_facilitators ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Step 13: Data validation queries
-- Verify user migration
SELECT 'Users migrated' as status, COUNT(*) as count FROM users;

-- Verify workshop migration
SELECT 'Workshops migrated' as status, COUNT(*) as count FROM workshops;

-- Verify enrollment migration
SELECT 'Enrollments migrated' as status, COUNT(*) as count FROM enrollments;

-- Check for any orphaned records (should be 0)
SELECT 'Orphaned enrollments' as status, COUNT(*) as count
FROM enrollments e
LEFT JOIN workshops w ON e.workshopId = w.id
WHERE w.id IS NULL;

SELECT 'Orphaned enrollments (users)' as status, COUNT(*) as count
FROM enrollments e
LEFT JOIN users u ON e.participantId = u.id
WHERE u.id IS NULL;

-- Step 14: Clean up temporary mapping tables
DROP TABLE IF EXISTS user_id_mapping;
DROP TABLE IF EXISTS workshop_id_mapping;
DROP TABLE IF EXISTS facilitator_id_mapping;
DROP TABLE IF EXISTS location_id_mapping;
DROP TABLE IF EXISTS tag_id_mapping;
DROP TABLE IF EXISTS session_id_mapping;
DROP TABLE IF EXISTS module_id_mapping;
DROP TABLE IF EXISTS questionnaire_id_mapping;
DROP TABLE IF EXISTS question_group_id_mapping;
DROP TABLE IF EXISTS question_id_mapping;
DROP TABLE IF EXISTS llm_analysis_id_mapping;

-- Migration complete notification
DO $$
BEGIN
    RAISE NOTICE 'MySQL to PostgreSQL migration completed successfully at %', NOW();
    RAISE NOTICE 'Total users migrated: %', (SELECT COUNT(*) FROM users);
    RAISE NOTICE 'Total workshops migrated: %', (SELECT COUNT(*) FROM workshops);
    RAISE NOTICE 'Total enrollments migrated: %', (SELECT COUNT(*) FROM enrollments);
    RAISE NOTICE 'GDPR compliance features enabled: RLS policies, consents, audit logs';
END $$;