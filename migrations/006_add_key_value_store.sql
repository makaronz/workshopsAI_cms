-- Migration: Add key-value store table to replace Redis
-- Created: 2025-12-13

CREATE TABLE IF NOT EXISTS key_value_store (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_key_value_expires ON key_value_store(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_key_value_created ON key_value_store(created_at);

-- Function to clean up expired keys (can be called periodically or via trigger)
CREATE OR REPLACE FUNCTION cleanup_expired_keys()
RETURNS INTEGER AS $$
BEGIN
    DELETE FROM key_value_store 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
    
    RETURN 1;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create trigger to auto-cleanup on insert
-- CREATE TRIGGER trigger_cleanup_expired 
-- AFTER INSERT ON key_value_store 
-- EXECUTE FUNCTION cleanup_expired_keys();
