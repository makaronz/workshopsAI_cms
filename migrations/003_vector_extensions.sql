-- Vector Database Extensions Migration
-- Adds pgvector extension and vector-related tables for RAG functionality

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create vector similarity functions
CREATE OR REPLACE FUNCTION cosine_similarity(vector_a vector, vector_b vector)
RETURNS FLOAT AS $$
  SELECT 1 - (vector_a <=> vector_b);
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION l2_distance(vector_a vector, vector_b vector)
RETURNS FLOAT AS $$
  SELECT vector_a <-> vector_b;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION inner_product(vector_a vector, vector_b vector)
RETURNS FLOAT AS $$
  SELECT vector_a <#> vector_b;
$$ LANGUAGE sql IMMUTABLE;

-- Document embeddings table for RAG
CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type VARCHAR(50) NOT NULL,
  document_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  language VARCHAR(2) NOT NULL DEFAULT 'en',
  embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
  metadata JSONB,
  confidence_score FLOAT DEFAULT 0.8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for document_embeddings
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_embeddings_unique
ON document_embeddings (document_type, document_id);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_type
ON document_embeddings (document_type);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_id
ON document_embeddings (document_id);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_language
ON document_embeddings (language);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_model
ON document_embeddings (embedding_model);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_created_at
ON document_embeddings (created_at DESC);

-- Vector search queries table for analytics
CREATE TABLE IF NOT EXISTS vector_search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  query_embedding vector(1536) NOT NULL,
  results_found INTEGER DEFAULT 0,
  avg_similarity FLOAT,
  search_time FLOAT, -- in milliseconds
  filters JSONB,
  metric_used VARCHAR(20) DEFAULT 'cosine',
  threshold FLOAT DEFAULT 0.7,
  user_id UUID,
  session_id VARCHAR(255),
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vector_search_queries_user_id
ON vector_search_queries (user_id);

CREATE INDEX IF NOT EXISTS idx_vector_search_queries_session_id
ON vector_search_queries (session_id);

CREATE INDEX IF NOT EXISTS idx_vector_search_queries_created_at
ON vector_search_queries (created_at);

CREATE INDEX IF NOT EXISTS idx_vector_search_queries_search_time
ON vector_search_queries (search_time);

-- Embedding cache table
CREATE TABLE IF NOT EXISTS embedding_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash VARCHAR(64) NOT NULL UNIQUE,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  model VARCHAR(100) NOT NULL,
  language VARCHAR(2) NOT NULL,
  tokens INTEGER DEFAULT 0,
  cost FLOAT DEFAULT 0,
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_embedding_cache_content_hash
ON embedding_cache (content_hash);

CREATE INDEX IF NOT EXISTS idx_embedding_cache_model
ON embedding_cache (model);

CREATE INDEX IF NOT EXISTS idx_embedding_cache_language
ON embedding_cache (language);

CREATE INDEX IF NOT EXISTS idx_embedding_cache_hit_count
ON embedding_cache (hit_count DESC);

CREATE INDEX IF NOT EXISTS idx_embedding_cache_last_accessed
ON embedding_cache (last_accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_embedding_cache_expires_at
ON embedding_cache (expires_at);

-- Vector index configurations table
CREATE TABLE IF NOT EXISTS vector_index_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_name VARCHAR(255) NOT NULL UNIQUE,
  index_type VARCHAR(50) NOT NULL, -- 'ivfflat', 'hnsw', 'exact'
  table_name VARCHAR(100) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  metric VARCHAR(20) NOT NULL, -- 'cosine', 'l2', 'inner_product'
  dimensions INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  configuration JSONB,
  size_estimate FLOAT, -- in MB
  performance JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vector_index_configs_name
ON vector_index_configs (index_name);

CREATE INDEX IF NOT EXISTS idx_vector_index_configs_table
ON vector_index_configs (table_name);

CREATE INDEX IF NOT EXISTS idx_vector_index_configs_active
ON vector_index_configs (is_active);

-- RAG context windows table
CREATE TABLE IF NOT EXISTS rag_context_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  user_id UUID,
  conversation_type VARCHAR(50) NOT NULL, -- 'analysis', 'search', 'chat'
  context_documents JSONB NOT NULL, -- Array of document references
  query_text TEXT NOT NULL,
  context_length INTEGER NOT NULL, -- in tokens
  relevance_scores JSONB,
  response_generated BOOLEAN DEFAULT FALSE,
  response_time FLOAT, -- in milliseconds
  feedback_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_context_windows_session
ON rag_context_windows (session_id);

CREATE INDEX IF NOT EXISTS idx_rag_context_windows_user_id
ON rag_context_windows (user_id);

CREATE INDEX IF NOT EXISTS idx_rag_context_windows_type
ON rag_context_windows (conversation_type);

CREATE INDEX IF NOT EXISTS idx_rag_context_windows_created_at
ON rag_context_windows (created_at);

-- Create trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_embeddings_updated_at
    BEFORE UPDATE ON document_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vector_index_configs_updated_at
    BEFORE UPDATE ON vector_index_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rag_context_windows_updated_at
    BEFORE UPDATE ON rag_context_windows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for automatic vector index creation
CREATE OR REPLACE FUNCTION create_vector_index_if_needed()
RETURNS VOID AS $$
DECLARE
    table_count INTEGER;
BEGIN
    -- Count embeddings in the table
    SELECT COUNT(*) INTO table_count FROM document_embeddings;

    -- Create IVFFlat index if we have more than 1000 embeddings and no vector index exists
    IF table_count > 1000 THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE tablename = 'document_embeddings'
            AND indexname LIKE '%embedding%'
            AND indexname != 'idx_document_embeddings_unique'
        ) THEN
            EXECUTE 'CREATE INDEX CONCURRENTLY idx_document_embeddings_embedding_cosine
                      ON document_embeddings USING ivfflat (embedding vector_cosine_ops)
                      WITH (lists = LEAST(' || table_count || '/10, 1000))';

            -- Log index creation
            INSERT INTO vector_index_configs (index_name, index_type, table_name, column_name, metric, dimensions, configuration)
            VALUES (
                'idx_document_embeddings_embedding_cosine',
                'ivfflat',
                'document_embeddings',
                'embedding',
                'cosine',
                1536,
                jsonb_build_object('lists', LEAST(table_count/10, 1000))
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function for cache cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM embedding_cache
    WHERE expires_at IS NOT NULL AND expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for maintaining cache size (keep top 10000 most accessed)
CREATE OR REPLACE FUNCTION maintain_cache_size()
RETURNS INTEGER AS $$
DECLARE
    cache_size INTEGER;
    deleted_count INTEGER := 0;
BEGIN
    -- Get current cache size
    SELECT COUNT(*) INTO cache_size FROM embedding_cache;

    -- If cache is too large, delete least accessed entries
    IF cache_size > 10000 THEN
        WITH to_delete AS (
            SELECT id
            FROM embedding_cache
            ORDER BY hit_count ASC, last_accessed_at ASC
            LIMIT (cache_size - 10000)
        )
        DELETE FROM embedding_cache
        WHERE id IN (SELECT id FROM to_delete);

        GET DIAGNOSTICS deleted_count = ROW_COUNT;
    END IF;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for embedding statistics
CREATE OR REPLACE VIEW embedding_statistics AS
SELECT
    COUNT(*) as total_embeddings,
    COUNT(DISTINCT document_type) as unique_document_types,
    COUNT(DISTINCT document_id) as unique_documents,
    COUNT(DISTINCT language) as unique_languages,
    COUNT(DISTINCT embedding_model) as unique_models,
    AVG(confidence_score) as avg_confidence_score,
    MIN(created_at) as oldest_embedding,
    MAX(created_at) as newest_embedding,
    (SELECT COUNT(*) FROM embedding_cache) as cache_size
FROM document_embeddings;

-- Create view for search analytics
CREATE OR REPLACE VIEW search_analytics AS
SELECT
    DATE_TRUNC('day', created_at) as search_date,
    COUNT(*) as total_searches,
    AVG(results_found) as avg_results_found,
    AVG(avg_similarity) as avg_similarity_score,
    AVG(search_time) as avg_search_time_ms,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT session_id) as unique_sessions
FROM vector_search_queries
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY search_date DESC;

-- Grant permissions (adjust based on your user setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO workshopsai_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO workshopsai_user;

-- Log migration completion
INSERT INTO vector_index_configs (index_name, index_type, table_name, column_name, metric, dimensions, configuration)
VALUES (
    'migration_003_vector_extensions',
    'migration',
    'multiple',
    'multiple',
    'multiple',
    0,
    jsonb_build_object(
        'migration_date', NOW(),
        'description', 'Initial vector database extensions setup'
    )
) ON CONFLICT (index_name) DO NOTHING;