-- PostgreSQL Migration: Add Session Management Tables
-- This migration adds tables for PostgreSQL-based session management
-- replacing Redis with persistent storage

-- Create custom types for session management
CREATE TYPE session_status AS ENUM ('active', 'expired', 'revoked', 'suspicious');
CREATE TYPE session_type AS ENUM ('web', 'mobile', 'api', 'desktop');

-- User Sessions table
-- Stores all active and historical user sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL UNIQUE,
    access_token_hash TEXT NOT NULL,
    refresh_token_hash TEXT NOT NULL,
    refresh_token_id TEXT NOT NULL UNIQUE,
    status session_status NOT NULL DEFAULT 'active',
    session_type session_type NOT NULL DEFAULT 'web',
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    location JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    absolute_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    logout_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason TEXT,
    suspicious_activities JSONB DEFAULT '[]'::jsonb,
    risk_score DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Session Audit Logs table
-- Tracks all session-related activities for security and compliance
CREATE TABLE IF NOT EXISTS session_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'login', 'logout', 'refresh', 'access', 'suspicious_activity'
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for optimal performance
-- User Sessions indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token_id ON user_sessions(refresh_token_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON user_sessions(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_accessed ON user_sessions(last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_risk_score ON user_sessions(risk_score);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_fingerprint ON user_sessions(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON user_sessions(created_at);

-- Session Audit Logs indexes
CREATE INDEX IF NOT EXISTS idx_session_audit_logs_session_id ON session_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_session_audit_logs_user_id ON session_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_session_audit_logs_action ON session_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_session_audit_logs_timestamp ON session_audit_logs(timestamp);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic updated_at
CREATE TRIGGER update_user_sessions_updated_at
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies for sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own sessions
CREATE POLICY user_sessions_own_policy ON user_sessions
    FOR ALL
    TO authenticated_user -- This role should be created by your auth system
    USING (user_id = current_setting('app.current_user_id', true)::uuid)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Users can only see their own audit logs
CREATE POLICY session_audit_logs_own_policy ON session_audit_logs
    FOR ALL
    TO authenticated_user
    USING (user_id = current_setting('app.current_user_id', true)::uuid)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Admins can see all sessions
CREATE POLICY user_sessions_admin_policy ON user_sessions
    FOR ALL
    TO admin_role -- This role should be created by your auth system
    USING (true)
    WITH CHECK (true);

-- Policy: Admins can see all audit logs
CREATE POLICY session_audit_logs_admin_policy ON session_audit_logs
    FOR ALL
    TO admin_role
    USING (true)
    WITH CHECK (true);

-- Create view for active sessions
CREATE OR REPLACE VIEW active_sessions AS
SELECT
    us.*,
    u.email as user_email,
    u.name as user_name,
    u.role as user_role
FROM user_sessions us
JOIN users u ON us.user_id = u.id
WHERE us.is_active = true
  AND us.status = 'active'
  AND us.expires_at > NOW();

-- Create view for session analytics
CREATE OR REPLACE VIEW session_analytics AS
SELECT
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions,
    COUNT(CASE WHEN status = 'suspicious' THEN 1 END) as suspicious_sessions,
    session_type,
    COUNT(CASE WHEN device_fingerprint IS NOT NULL THEN 1 END) as sessions_with_fingerprint,
    AVG(risk_score) as avg_risk_score
FROM user_sessions
GROUP BY DATE_TRUNC('day', created_at), session_type
ORDER BY date DESC;

-- Create stored procedure for session cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    UPDATE user_sessions
    SET
        status = 'expired',
        is_active = false,
        updated_at = NOW()
    WHERE
        status = 'active'
        AND expires_at < NOW();

    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Create stored procedure for GDPR user data deletion
CREATE OR REPLACE FUNCTION gdpr_delete_user_sessions(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Soft delete sessions
    UPDATE user_sessions
    SET
        is_active = false,
        status = 'revoked',
        revoked_reason = 'gdpr_request',
        revoked_at = NOW(),
        updated_at = NOW()
    WHERE user_id = target_user_id;

    -- Anonymize audit logs
    UPDATE session_audit_logs
    SET user_id = NULL
    WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create stored procedure to get session statistics
CREATE OR REPLACE FUNCTION get_session_statistics(
    target_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_sessions', COUNT(*),
        'active_sessions', COUNT(CASE WHEN status = 'active' AND is_active = true THEN 1 END),
        'expired_sessions', COUNT(CASE WHEN status = 'expired' THEN 1 END),
        'revoked_sessions', COUNT(CASE WHEN status = 'revoked' THEN 1 END),
        'suspicious_sessions', COUNT(CASE WHEN status = 'suspicious' THEN 1 END),
        'avg_risk_score', COALESCE(AVG(risk_score), 0),
        'max_risk_score', COALESCE(MAX(risk_score), 0),
        'unique_devices', COUNT(DISTINCT device_fingerprint),
        'unique_ips', COUNT(DISTINCT ip_address)
    ) INTO result
    FROM user_sessions
    WHERE target_user_id IS NULL OR user_id = target_user_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust role names based on your system)
-- GRANT USAGE ON SCHEMA public TO authenticated_user, admin_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_sessions TO authenticated_user, admin_role;
-- GRANT SELECT ON session_audit_logs TO authenticated_user, admin_role;
-- GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO admin_role;
-- GRANT EXECUTE ON FUNCTION gdpr_delete_user_sessions(UUID) TO admin_role;
-- GRANT EXECUTE ON FUNCTION get_session_statistics(UUID) TO authenticated_user, admin_role;
-- GRANT SELECT ON active_sessions TO authenticated_user, admin_role;
-- GRANT SELECT ON session_analytics TO admin_role;

-- Create comment documentation
COMMENT ON TABLE user_sessions IS 'Stores all user sessions with security features and audit capabilities';
COMMENT ON TABLE session_audit_logs IS 'Tracks all session-related activities for security and compliance';
COMMENT ON COLUMN user_sessions.suspicious_activities IS 'JSON array storing suspicious activity records';
COMMENT ON COLUMN user_sessions.risk_score IS 'Calculated risk score based on user behavior patterns';
COMMENT ON COLUMN user_sessions.device_fingerprint IS 'Unique identifier for the device/browser combination';
COMMENT ON COLUMN user_sessions.location IS 'Geographic location data when available';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Session management tables created successfully';
    RAISE NOTICE 'Remember to:');
    RAISE NOTICE '1. Run "npm run db:migrate" to apply these changes';
    RAISE NOTICE '2. Update your application environment variables';
    RAISE NOTICE '3. Test the new session management system';
    RAISE NOTICE '4. Consider data migration from Redis if needed';
END $$;