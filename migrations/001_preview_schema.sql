-- Preview Schema Migration
-- Creates tables for real-time preview functionality

-- Create custom enums
CREATE TYPE preview_type AS ENUM ('workshop', 'questionnaire');
CREATE TYPE device_type AS ENUM ('desktop', 'tablet', 'mobile');
CREATE TYPE font_size AS ENUM ('small', 'medium', 'large');
CREATE TYPE change_type AS ENUM ('content', 'settings', 'style', 'structure');
CREATE TYPE analytics_event_type AS ENUM ('view', 'click', 'scroll', 'interaction', 'error', 'navigation');
CREATE TYPE validation_error_type AS ENUM ('error', 'warning', 'info');
CREATE TYPE validation_error_category AS ENUM ('accessibility', 'performance', 'content', 'structure');

-- Preview Sessions Table
CREATE TABLE IF NOT EXISTS preview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type preview_type NOT NULL,
    resource_id UUID NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    content JSONB DEFAULT '{}',

    -- Settings
    mobile_preview BOOLEAN DEFAULT false,
    tablet_preview BOOLEAN DEFAULT false,
    device_type device_type DEFAULT 'desktop',
    dark_mode BOOLEAN DEFAULT false,
    high_contrast BOOLEAN DEFAULT false,
    font_size font_size DEFAULT 'medium',
    auto_save BOOLEAN DEFAULT true,
    show_interaction_hints BOOLEAN DEFAULT true,
    simulate_participant_view BOOLEAN DEFAULT false,
    test_mode BOOLEAN DEFAULT false,
    accessibility_mode BOOLEAN DEFAULT false,

    -- Metadata
    version VARCHAR(20) DEFAULT '1.0.0',
    accessibility_score INTEGER DEFAULT 0,
    last_validated TIMESTAMP WITH TIME ZONE,
    tags TEXT[],
    category VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT preview_sessions_title_length CHECK (length(title) >= 1 AND length(title) <= 200),
    CONSTRAINT preview_sessions_version_format CHECK (version ~ '^\d+\.\d+\.\d+$'),
    CONSTRAINT preview_sessions_accessibility_score CHECK (accessibility_score >= 0 AND accessibility_score <= 100)
);

-- Preview Collaborators Table
CREATE TABLE IF NOT EXISTS preview_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES preview_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'collaborator',
    permissions TEXT[],
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT preview_collaborators_role CHECK (role IN ('owner', 'collaborator', 'viewer')),
    CONSTRAINT preview_collaborators_unique_user_session UNIQUE (session_id, user_id)
);

-- Preview Change History Table
CREATE TABLE IF NOT EXISTS preview_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES preview_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type change_type NOT NULL,
    description TEXT NOT NULL,
    data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT preview_change_history_description_length CHECK (length(description) >= 1)
);

-- Preview Analytics Events Table
CREATE TABLE IF NOT EXISTS preview_analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES preview_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type analytics_event_type NOT NULL,
    element TEXT,
    data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    duration INTEGER,

    -- Constraints
    CONSTRAINT preview_analytics_events_duration_positive CHECK (duration IS NULL OR duration >= 0)
);

-- Preview Validation Errors Table
CREATE TABLE IF NOT EXISTS preview_validation_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES preview_sessions(id) ON DELETE CASCADE,
    type validation_error_type NOT NULL,
    category validation_error_category NOT NULL,
    message TEXT NOT NULL,
    element TEXT,
    suggestion TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT preview_validation_errors_message_length CHECK (length(message) >= 1),
    CONSTRAINT preview_validation_errors_resolved_at_consistency CHECK (
        (resolved = true AND resolved_at IS NOT NULL) OR
        (resolved = false AND resolved_at IS NULL)
    )
);

-- Preview Performance Metrics Table
CREATE TABLE IF NOT EXISTS preview_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES preview_sessions(id) ON DELETE CASCADE,
    load_time INTEGER, -- milliseconds
    interaction_latency INTEGER, -- milliseconds
    memory_usage INTEGER, -- bytes
    rendering_time INTEGER, -- milliseconds
    accessibility_compliance INTEGER, -- percentage
    mobile_optimization INTEGER, -- percentage
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT preview_performance_metrics_positive CHECK (
        (load_time IS NULL OR load_time >= 0) AND
        (interaction_latency IS NULL OR interaction_latency >= 0) AND
        (memory_usage IS NULL OR memory_usage >= 0) AND
        (rendering_time IS NULL OR rendering_time >= 0)
    ),
    CONSTRAINT preview_performance_metrics_percentage CHECK (
        (accessibility_compliance IS NULL OR (accessibility_compliance >= 0 AND accessibility_compliance <= 100)) AND
        (mobile_optimization IS NULL OR (mobile_optimization >= 0 AND mobile_optimization <= 100))
    )
);

-- Preview Engagement Metrics Table (Aggregated)
CREATE TABLE IF NOT EXISTS preview_engagement_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES preview_sessions(id) ON DELETE CASCADE,
    total_views INTEGER DEFAULT 0,
    unique_interactions INTEGER DEFAULT 0,
    time_spent INTEGER, -- seconds
    drop_off_points TEXT[],
    completion_rate INTEGER, -- percentage
    user_satisfaction INTEGER, -- 1-5 scale
    date DATE DEFAULT CURRENT_DATE NOT NULL,

    -- Constraints
    CONSTRAINT preview_engagement_metrics_non_negative CHECK (
        total_views >= 0 AND unique_interactions >= 0 AND
        (time_spent IS NULL OR time_spent >= 0)
    ),
    CONSTRAINT preview_engagement_metrics_percentage CHECK (
        completion_rate IS NULL OR (completion_rate >= 0 AND completion_rate <= 100)
    ),
    CONSTRAINT preview_engagement_metrics_satisfaction CHECK (
        user_satisfaction IS NULL OR (user_satisfaction >= 1 AND user_satisfaction <= 5)
    ),
    CONSTRAINT preview_engagement_metrics_unique_session_date UNIQUE (session_id, date)
);

-- Preview Session Snapshots Table (for versioning)
CREATE TABLE IF NOT EXISTS preview_session_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES preview_sessions(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    content JSONB NOT NULL,
    settings JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT preview_session_snapshots_version_format CHECK (version ~ '^\d+\.\d+\.\d+$')
);

-- Preview Room State Table (for WebSocket room management)
CREATE TABLE IF NOT EXISTS preview_room_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(255) UNIQUE NOT NULL,
    session_id UUID NOT NULL REFERENCES preview_sessions(id) ON DELETE CASCADE,
    active_participants INTEGER DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    state JSONB,
    metadata JSONB,

    -- Constraints
    CONSTRAINT preview_room_states_active_participants_non_negative CHECK (active_participants >= 0)
);

-- Create indexes for better performance

-- Preview sessions indexes
CREATE INDEX IF NOT EXISTS idx_preview_sessions_owner_id ON preview_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_preview_sessions_type ON preview_sessions(type);
CREATE INDEX IF NOT EXISTS idx_preview_sessions_resource_id ON preview_sessions(resource_id);
CREATE INDEX IF NOT EXISTS idx_preview_sessions_created_at ON preview_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_preview_sessions_updated_at ON preview_sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_preview_sessions_last_accessed ON preview_sessions(last_accessed);

-- Preview collaborators indexes
CREATE INDEX IF NOT EXISTS idx_preview_collaborators_session_id ON preview_collaborators(session_id);
CREATE INDEX IF NOT EXISTS idx_preview_collaborators_user_id ON preview_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_preview_collaborators_role ON preview_collaborators(role);
CREATE INDEX IF NOT EXISTS idx_preview_collaborators_last_active_at ON preview_collaborators(last_active_at);

-- Preview change history indexes
CREATE INDEX IF NOT EXISTS idx_preview_change_history_session_id ON preview_change_history(session_id);
CREATE INDEX IF NOT EXISTS idx_preview_change_history_user_id ON preview_change_history(user_id);
CREATE INDEX IF NOT EXISTS idx_preview_change_history_timestamp ON preview_change_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_preview_change_history_type ON preview_change_history(type);

-- Preview analytics events indexes
CREATE INDEX IF NOT EXISTS idx_preview_analytics_events_session_id ON preview_analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_preview_analytics_events_user_id ON preview_analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_preview_analytics_events_timestamp ON preview_analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_preview_analytics_events_event_type ON preview_analytics_events(event_type);

-- Preview validation errors indexes
CREATE INDEX IF NOT EXISTS idx_preview_validation_errors_session_id ON preview_validation_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_preview_validation_errors_type ON preview_validation_errors(type);
CREATE INDEX IF NOT EXISTS idx_preview_validation_errors_category ON preview_validation_errors(category);
CREATE INDEX IF NOT EXISTS idx_preview_validation_errors_resolved ON preview_validation_errors(resolved);
CREATE INDEX IF NOT EXISTS idx_preview_validation_errors_timestamp ON preview_validation_errors(timestamp);

-- Preview performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_preview_performance_metrics_session_id ON preview_performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_preview_performance_metrics_timestamp ON preview_performance_metrics(timestamp);

-- Preview engagement metrics indexes
CREATE INDEX IF NOT EXISTS idx_preview_engagement_metrics_session_id ON preview_engagement_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_preview_engagement_metrics_date ON preview_engagement_metrics(date);

-- Preview session snapshots indexes
CREATE INDEX IF NOT EXISTS idx_preview_session_snapshots_session_id ON preview_session_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_preview_session_snapshots_version ON preview_session_snapshots(version);
CREATE INDEX IF NOT EXISTS idx_preview_session_snapshots_timestamp ON preview_session_snapshots(timestamp);

-- Preview room states indexes
CREATE INDEX IF NOT EXISTS idx_preview_room_states_room_id ON preview_room_states(room_id);
CREATE INDEX IF NOT EXISTS idx_preview_room_states_session_id ON preview_room_states(session_id);
CREATE INDEX IF NOT EXISTS idx_preview_room_states_last_activity ON preview_room_states(last_activity);

-- Create update timestamp trigger for preview_sessions
CREATE OR REPLACE FUNCTION update_preview_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_preview_sessions_updated_at
    BEFORE UPDATE ON preview_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_preview_sessions_updated_at();

-- Row Level Security (RLS) for preview tables
ALTER TABLE preview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE preview_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE preview_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE preview_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE preview_validation_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE preview_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE preview_engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE preview_session_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE preview_room_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies for preview_sessions
CREATE POLICY "Users can view their own preview sessions" ON preview_sessions
    FOR SELECT USING (
        owner_id = auth.uid() OR
        id IN (
            SELECT session_id FROM preview_collaborators
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own preview sessions" ON preview_sessions
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their preview sessions" ON preview_sessions
    FOR UPDATE USING (
        owner_id = auth.uid()
    );

CREATE POLICY "Owners can delete their preview sessions" ON preview_sessions
    FOR DELETE USING (
        owner_id = auth.uid()
    );

-- RLS Policies for preview_collaborators
CREATE POLICY "Users can view collaborators for sessions they have access to" ON preview_collaborators
    FOR SELECT USING (
        user_id = auth.uid() OR
        session_id IN (
            SELECT id FROM preview_sessions
            WHERE owner_id = auth.uid() OR
            id IN (
                SELECT session_id FROM preview_collaborators
                WHERE user_id = auth.uid()
            )
        )
    );

-- Additional RLS policies for other tables can be added similarly
-- For now, we'll keep basic policies in place

COMMIT;