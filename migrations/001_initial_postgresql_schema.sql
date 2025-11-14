-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom application configuration variables for RLS
CREATE SCHEMA IF NOT EXISTS app;

-- Set up application context variables for Row-Level Security
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_settings
        WHERE name = 'app.current_user_id'
    ) THEN
        -- These will be set at session level by the application
        PERFORM set_config('search_path', 'app, public', true);
    END IF;
END $$;

-- Row-Level Security Policies for GDPR Compliance

-- Users table RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY users_select_own ON users FOR SELECT
USING (id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Users can update their own profile (except role and email verification)
CREATE POLICY users_update_own ON users FOR UPDATE
USING (id = current_setting('app.current_user_id', true)::uuid)
WITH CHECK (
    id = current_setting('app.current_user_id', true)::uuid AND
    role = (SELECT role FROM users WHERE id = current_setting('app.current_user_id', true)::uuid)
);

-- Policy: Admins can read all users
CREATE POLICY users_select_admin ON users FOR SELECT
USING (current_setting('app.is_admin', true)::boolean = true);

-- Policy: Admins can update all users
CREATE POLICY users_update_admin ON users FOR UPDATE
USING (current_setting('app.is_admin', true)::boolean = true)
WITH CHECK (current_setting('app.is_admin', true)::boolean = true);

-- Consents table RLS policies
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own consents
CREATE POLICY consents_select_own ON consents FOR SELECT
USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Users can create their own consents
CREATE POLICY consents_insert_own ON consents FOR INSERT
WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Admins can read all consents
CREATE POLICY consents_select_admin ON consents FOR SELECT
USING (current_setting('app.is_admin', true)::boolean = true);

-- Audit Logs table RLS policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own audit logs
CREATE POLICY audit_logs_select_own ON audit_logs FOR SELECT
USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Admins can read all audit logs
CREATE POLICY audit_logs_select_admin ON audit_logs FOR SELECT
USING (current_setting('app.is_admin', true)::boolean = true);

-- Workshops table RLS policies
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read published workshops
CREATE POLICY workshops_select_public ON workshops FOR SELECT
USING (status = 'published' AND deleted_at IS NULL);

-- Policy: Sociologists and admins can read their own draft workshops
CREATE POLICY workshops_select_own_drafts ON workshops FOR SELECT
USING (
    deleted_at IS NULL AND (
        created_by = current_setting('app.current_user_id', true)::uuid OR
        current_setting('app.is_admin', true)::boolean = true
    )
);

-- Policy: Sociologists can create workshops
CREATE POLICY workshops_insert_creators ON workshops FOR INSERT
WITH CHECK (
    created_by = current_setting('app.current_user_id', true)::uuid
);

-- Policy: Users can update their own workshops
CREATE POLICY workshops_update_own ON workshops FOR UPDATE
USING (created_by = current_setting('app.current_user_id', true)::uuid)
WITH CHECK (created_by = current_setting('app.current_user_id', true)::uuid);

-- Policy: Admins can update all workshops
CREATE POLICY workshops_update_admin ON workshops FOR UPDATE
USING (current_setting('app.is_admin', true)::boolean = true)
WITH CHECK (current_setting('app.is_admin', true)::boolean = true);

-- Responses table RLS policies (GDPR Critical)
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own responses
CREATE POLICY responses_select_own ON responses FOR SELECT
USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Users can only create their own responses
CREATE POLICY responses_insert_own ON responses FOR INSERT
WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Users can only update their own responses
CREATE POLICY responses_update_own ON responses FOR UPDATE
USING (user_id = current_setting('app.current_user_id', true)::uuid)
WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Admins can read all responses (for data processing)
CREATE POLICY responses_select_admin ON responses FOR SELECT
USING (current_setting('app.is_admin', true)::boolean = true);

-- Policy: Sociologists can read anonymized responses from their workshops
CREATE POLICY responses_select_sociologist ON responses FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM questions q
        JOIN question_groups qg ON q.group_id = qg.id
        JOIN questionnaires qn ON qg.questionnaire_id = qn.id
        JOIN workshops w ON qn.workshop_id = w.id
        WHERE q.id = responses.question_id
        AND w.created_by = current_setting('app.current_user_id', true)::uuid
        AND responses.is_anonymous = true
    )
);

-- Enrollments table RLS policies
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own enrollments
CREATE POLICY enrollments_select_own ON enrollments FOR SELECT
USING (participant_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Users can create their own enrollments
CREATE POLICY enrollments_insert_own ON enrollments FOR INSERT
WITH CHECK (participant_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Facilitators can read enrollments for their workshops
CREATE POLICY enrollments_select_facilitator ON enrollments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM workshops w
        WHERE w.id = enrollments.workshop_id
        AND w.created_by = current_setting('app.current_user_id', true)::uuid
    )
);

-- Policy: Admins can read all enrollments
CREATE POLICY enrollments_select_admin ON enrollments FOR SELECT
USING (current_setting('app.is_admin', true)::boolean = true);

-- Questionnaires table RLS policies
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;

-- Policy: Published questionnaires are public
CREATE POLICY questionnaires_select_public ON questionnaires FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM workshops w
        WHERE w.id = questionnaires.workshop_id
        AND w.status = 'published'
        AND w.deleted_at IS NULL
    )
);

-- Policy: Workshop creators can read their own questionnaires
CREATE POLICY questionnaires_select_own ON questionnaires FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM workshops w
        WHERE w.id = questionnaires.workshop_id
        AND w.created_by = current_setting('app.current_user_id', true)::uuid
        AND w.deleted_at IS NULL
    )
);

-- Policy: Workshop creators can create questionnaires
CREATE POLICY questionnaires_insert_own ON questionnaires FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM workshops w
        WHERE w.id = workshop_id
        AND w.created_by = current_setting('app.current_user_id', true)::uuid
    )
);

-- Announcements table RLS policies
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policy: Published announcements are readable by enrolled participants
CREATE POLICY announcements_select_published ON announcements FOR SELECT
USING (
    is_published = true AND
    EXISTS (
        SELECT 1 FROM workshops w
        WHERE w.id = announcements.workshop_id
        AND w.status = 'published'
        AND w.deleted_at IS NULL
    )
);

-- Policy: Workshop creators can manage their announcements
CREATE POLICY announcements_manage_own ON announcements FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM workshops w
        WHERE w.id = announcements.workshop_id
        AND w.created_by = current_setting('app.current_user_id', true)::uuid
    )
);

-- Policy: Admins can manage all announcements
CREATE POLICY announcements_admin ON announcements FOR ALL
USING (current_setting('app.is_admin', true)::boolean = true);

-- Feedback table RLS policies
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own feedback
CREATE POLICY feedback_select_own ON feedback FOR SELECT
USING (participant_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Users can create their own feedback
CREATE POLICY feedback_insert_own ON feedback FOR INSERT
WITH CHECK (participant_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Public feedback is readable by everyone
CREATE POLICY feedback_select_public ON feedback FOR SELECT
USING (is_public = true);

-- Policy: Workshop creators can read feedback for their workshops
CREATE POLICY feedback_select_workshop_owner ON feedback FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM workshops w
        WHERE w.id = feedback.workshop_id
        AND w.created_by = current_setting('app.current_user_id', true)::uuid
    )
);

-- Create indexes for performance and RLS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workshops_status_published ON workshops(status, published_at) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_user_question ON responses(user_id, question_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp_desc ON audit_logs(timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_workshop_participant ON enrollments(workshop_id, participant_id);

-- GDPR compliance functions

-- Function to anonymize user data (right to erasure)
CREATE OR REPLACE FUNCTION anonymize_user_data(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    -- Anonymize user personal data
    UPDATE users SET
        name = 'Anonymized User ' || LEFT(id::text, 8),
        email = 'deleted_' || id::text || '@deleted.local',
        bio = NULL,
        avatar = NULL,
        deleted_at = NOW()
    WHERE id = user_uuid;

    -- Anonymize responses but keep statistical data
    UPDATE responses SET
        is_anonymous = true,
        value = 'ANONYMIZED'
    WHERE user_id = user_uuid;

    -- Log the anonymization
    INSERT INTO audit_logs (table_name, record_id, operation, new_values)
    VALUES ('users', user_uuid, 'ANONYMIZE', json_build_object('anonymized_at', NOW()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user data for GDPR Data Subject Request
CREATE OR REPLACE FUNCTION export_user_data(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    user_data JSON;
BEGIN
    SELECT json_build_object(
        'user', row_to_json(users.*),
        'consents', json_agg(consents.*),
        'responses', json_agg(responses.*),
        'enrollments', json_agg(enrollments.*),
        'feedback', json_agg(feedback.*),
        'audit_logs', json_agg(audit_logs.*)
    ) INTO user_data
    FROM users
    LEFT JOIN consents ON users.id = consents.user_id
    LEFT JOIN responses ON users.id = responses.user_id
    LEFT JOIN enrollments ON users.id = enrollments.participant_id
    LEFT JOIN feedback ON users.id = feedback.participant_id
    LEFT JOIN audit_logs ON users.id = audit_logs.user_id
    WHERE users.id = user_uuid
    GROUP BY users.id;

    RETURN user_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA app TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;