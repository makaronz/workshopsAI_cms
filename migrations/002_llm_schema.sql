-- LLM Analysis Schema Migration
-- Adds tables for questionnaires, responses, analysis, and LLM processing

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Questionnaires table - core questionnaire structure
CREATE TABLE IF NOT EXISTS questionnaires (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    workshopId VARCHAR(36) NULL,
    title JSON NOT NULL, -- {"pl": "Tytuł", "en": "Title"}
    description JSON NULL,
    instructions JSON NULL,
    status ENUM('draft', 'review', 'published', 'closed', 'analyzed') NOT NULL DEFAULT 'draft',
    settings JSON NULL, -- {"anonymous": boolean, "requireConsent": boolean, ...}
    publishedAt TIMESTAMP NULL,
    closedAt TIMESTAMP NULL,
    createdBy INT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,

    INDEX idx_questionnaires_workshop_id (workshopId),
    INDEX idx_questionnaires_status (status),
    INDEX idx_questionnaires_created_by (createdBy)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Question Groups table - sections within questionnaires
CREATE TABLE IF NOT EXISTS questionGroups (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    questionnaireId VARCHAR(36) NOT NULL,
    title JSON NOT NULL, -- {"pl": "Sekcja 1", "en": "Section 1"}
    description JSON NULL,
    orderIndex INT NOT NULL DEFAULT 0,
    uiConfig JSON NULL, -- {"collapsed": boolean, "showProgress": boolean, ...}
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,

    INDEX idx_question_groups_questionnaire_id (questionnaireId),
    INDEX idx_question_groups_order (orderIndex),

    FOREIGN KEY (questionnaireId) REFERENCES questionnaires(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Questions table - individual questions within groups
CREATE TABLE IF NOT EXISTS questions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    groupId VARCHAR(36) NOT NULL,
    text JSON NOT NULL, -- {"pl": "Pytanie?", "en": "Question?"}
    type ENUM('text', 'textarea', 'number', 'scale', 'single_choice', 'multiple_choice') NOT NULL,
    options JSON NULL, -- [{"value": "opt1", "label": {"pl": "Opcja 1", "en": "Option 1"}}]
    validation JSON NULL, -- {"required": boolean, "minLength": number, ...}
    conditionalLogic JSON NULL, -- {"showIf": {"questionId": "uuid", "operator": "equals", "value": "val"}}
    orderIndex INT NOT NULL DEFAULT 0,
    helpText JSON NULL, -- {"pl": "Pomoc", "en": "Help"}
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,

    INDEX idx_questions_group_id (groupId),
    INDEX idx_questions_order (orderIndex),
    INDEX idx_questions_type (type),

    FOREIGN KEY (groupId) REFERENCES questionGroups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Responses table - user answers to questions
CREATE TABLE IF NOT EXISTS responses (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    questionId VARCHAR(36) NOT NULL,
    userId INT NULL,
    enrollmentId VARCHAR(36) NULL,
    answer JSON NOT NULL, -- Format varies by question type
    metadata JSON NULL, -- {"ipHash": "hash", "userAgentHash": "hash", "timeSpentMs": 5000}
    submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,

    INDEX idx_responses_question_id (questionId),
    INDEX idx_responses_user_id (userId),
    INDEX idx_responses_enrollment_id (enrollmentId),
    INDEX idx_responses_submitted_at (submittedAt),
    UNIQUE KEY unique_user_question (userId, questionId),

    FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- LLM Analyses table - analysis results and metadata
CREATE TABLE IF NOT EXISTS llmAnalyses (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    questionnaireId VARCHAR(36) NOT NULL,
    analysisType ENUM('thematic', 'clusters', 'contradictions', 'insights', 'recommendations') NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    results JSON NULL, -- Analysis results with themes, clusters, etc.
    metadata JSON NULL, -- {"model": "gpt-4", "promptVersion": "1.0", ...}
    errorMessage TEXT NULL,
    triggeredBy INT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completedAt TIMESTAMP NULL,

    INDEX idx_llm_analyses_questionnaire_id (questionnaireId),
    INDEX idx_llm_analyses_analysis_type (analysisType),
    INDEX idx_llm_analyses_status (status),
    INDEX idx_llm_analyses_created_at (createdAt),

    FOREIGN KEY (questionnaireId) REFERENCES questionnaires(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Consents table - GDPR consent management
CREATE TABLE IF NOT EXISTS consents (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    userId INT NOT NULL,
    questionnaireId VARCHAR(36) NULL,
    consentType ENUM('research_analysis', 'marketing_emails', 'data_sharing', 'anonymous_presentation') NOT NULL,
    granted BOOLEAN NOT NULL,
    ipAddress VARCHAR(45) NULL, -- IPv6 compatible
    userAgent TEXT NULL,
    consentText JSON NULL, -- The actual consent text shown to user
    givenAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    revokedAt TIMESTAMP NULL,
    version VARCHAR(20) DEFAULT '1.0',

    INDEX idx_consents_user_id (userId),
    INDEX idx_consents_questionnaire_id (questionnaireId),
    INDEX idx_consents_consent_type (consentType),
    INDEX idx_consents_granted (granted),
    INDEX idx_consents_given_at (givenAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Embeddings table - vector embeddings for semantic search
CREATE TABLE IF NOT EXISTS embeddings (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    responseId VARCHAR(36) NOT NULL,
    questionId VARCHAR(36) NOT NULL,
    vectorIndex INT NOT NULL, -- Index in external vector DB
    model VARCHAR(100) NOT NULL, -- "text-embedding-3-small", etc.
    dimensions INT NOT NULL, -- 1536, 384, etc.
    provider VARCHAR(50) NOT NULL DEFAULT 'openai', -- openai, anthropic, local
    checksum VARCHAR(64) NULL, -- For content integrity verification
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,

    INDEX idx_embeddings_response_id (responseId),
    INDEX idx_embeddings_question_id (questionId),
    INDEX idx_embeddings_model (model),
    INDEX idx_embeddings_checksum (checksum)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analysis Jobs table - queue management for LLM processing
CREATE TABLE IF NOT EXISTS analysisJobs (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    questionnaireId VARCHAR(36) NOT NULL,
    analysisTypes JSON NOT NULL, -- ["thematic", "clusters", ...]
    status ENUM('queued', 'processing', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'queued',
    priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    progress INT DEFAULT 0, -- 0-100 percentage
    totalSteps INT NOT NULL DEFAULT 1,
    completedSteps INT DEFAULT 0,
    options JSON NULL, -- {"minClusterSize": 3, "includeSentiment": true, ...}
    errorLog JSON NULL, -- [{"step": "string", "error": "string", "timestamp": "string"}]
    estimatedDuration INT NULL, -- in seconds
    actualDuration INT NULL, -- in seconds
    workerId VARCHAR(100) NULL,
    scheduledAt TIMESTAMP NULL,
    startedAt TIMESTAMP NULL,
    completedAt TIMESTAMP NULL,
    triggeredBy INT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,

    INDEX idx_analysis_jobs_questionnaire_id (questionnaireId),
    INDEX idx_analysis_jobs_status (status),
    INDEX idx_analysis_jobs_priority (priority),
    INDEX idx_analysis_jobs_triggered_by (triggeredBy),
    INDEX idx_analysis_jobs_scheduled_at (scheduledAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key constraints
ALTER TABLE consents ADD CONSTRAINT fk_consents_user_id FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE consents ADD CONSTRAINT fk_consents_questionnaire_id FOREIGN KEY (questionnaireId) REFERENCES questionnaires(id) ON DELETE CASCADE;
ALTER TABLE questionnaires ADD CONSTRAINT fk_questionnaires_created_by FOREIGN KEY (createdBy) REFERENCES users(id);
ALTER TABLE llmAnalyses ADD CONSTRAINT fk_llm_analyses_triggered_by FOREIGN KEY (triggeredBy) REFERENCES users(id);
ALTER TABLE analysisJobs ADD CONSTRAINT fk_analysis_jobs_triggered_by FOREIGN KEY (triggeredBy) REFERENCES users(id);

-- Insert sample data for testing
INSERT INTO questionnaires (id, title, status, createdBy) VALUES
('sample-questionnaire-1', '{"pl": "Przykładowy kwestionariusz", "en": "Sample Questionnaire"}', 'published', 1);

-- Create template questionnaire structure (based on PDF template)
INSERT INTO questionGroups (id, questionnaireId, title, orderIndex) VALUES
('group-1', 'sample-questionnaire-1', '{"pl": "1. WIZJA / MANIFEST", "en": "1. VISION / MANIFEST"}', 1),
('group-2', 'sample-questionnaire-1', '{"pl": "2. PRZESTRZEŃ I MATERIA", "en": "2. SPACE AND MATTER"}', 2),
('group-3', 'sample-questionnaire-1', '{"pl": "3. RELACJE, INTERAKCJE I WOLNOŚĆ OSOBISTA", "en": "3. RELATIONS, INTERACTIONS AND PERSONAL FREEDOM"}', 3),
('group-4', 'sample-questionnaire-1', '{"pl": "4. ORGANIZOWANIE", "en": "4. ORGANIZING"}', 4);

-- Insert sample questions
INSERT INTO questions (id, groupId, text, type, validation, orderIndex) VALUES
('q-1', 'group-1', '{"pl": "Co jest dla Was ważne we wspólnym miejscu zamieszkania? Co leży u podstaw tego pomysłu? Z jakimi wartościami utożsamiacie się?", "en": "What is important to you in a shared living space? What is the foundation of this idea? What values do you identify with?"}', 'textarea', '{"required": false, "maxLength": 500}', 1),
('q-2', 'group-1', '{"pl": "Dlaczego Wasze miejsce istnieje? By żyło się łatwiej, zabawniej I na własnych zasadach", "en": "Why does your place exist? So that life is easier, more fun, and on your own terms"}', 'textarea', '{"required": false, "maxLength": 300}', 2),
('q-3', 'group-2', '{"pl": "Jakie potrzeby będziecie realizować w Waszym miejscu? Jakie relacje z innymi potrzebujecie?", "en": "What needs will you fulfill in your place? What relationships with others do you need?"}', 'textarea', '{"required": false, "maxLength": 400}', 1);