-- Migration: Add Questionnaire System Tables
-- Date: 2025-01-15
-- Description: Add complete questionnaire system with support for questions, responses, consents, and LLM analysis

-- Questionnaires table - main questionnaire container
CREATE TABLE IF NOT EXISTS questionnaires (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    workshopId VARCHAR(36) NULL,
    title JSON NOT NULL,
    instructions JSON NULL,
    status ENUM('draft', 'review', 'published', 'closed', 'analyzed') NOT NULL DEFAULT 'draft',
    settings JSON NULL,
    publishedAt TIMESTAMP NULL,
    closedAt TIMESTAMP NULL,
    createdBy INT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,

    INDEX idx_questionnaire_workshop_id (workshopId),
    INDEX idx_questionnaire_status (status),
    INDEX idx_questionnaire_created_by (createdBy)
);

-- Question Groups table - sections within questionnaires
CREATE TABLE IF NOT EXISTS questionGroups (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    questionnaireId VARCHAR(36) NOT NULL,
    title JSON NOT NULL,
    description JSON NULL,
    orderIndex INT NOT NULL,
    uiConfig JSON NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,

    INDEX idx_question_group_questionnaire_id (questionnaireId),
    INDEX idx_question_group_order (orderIndex),

    FOREIGN KEY (questionnaireId) REFERENCES questionnaires(id) ON DELETE CASCADE
);

-- Questions table - individual questions within groups
CREATE TABLE IF NOT EXISTS questions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    groupId VARCHAR(36) NOT NULL,
    text JSON NOT NULL,
    type ENUM('text', 'textarea', 'number', 'scale', 'single_choice', 'multiple_choice') NOT NULL,
    options JSON NULL,
    validation JSON NULL,
    conditionalLogic JSON NULL,
    orderIndex INT NOT NULL,
    helpText JSON NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,

    INDEX idx_question_group_id (groupId),
    INDEX idx_question_order (orderIndex),
    INDEX idx_question_type (type),

    FOREIGN KEY (groupId) REFERENCES questionGroups(id) ON DELETE CASCADE
);

-- Responses table - participant answers
CREATE TABLE IF NOT EXISTS responses (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    questionId VARCHAR(36) NOT NULL,
    userId INT NULL,
    enrollmentId VARCHAR(36) NULL,
    answer JSON NOT NULL,
    metadata JSON NULL,
    status ENUM('draft', 'submitted') NOT NULL DEFAULT 'draft',
    submittedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,

    INDEX idx_response_question_id (questionId),
    INDEX idx_response_user_id (userId),
    INDEX idx_response_enrollment_id (enrollmentId),
    INDEX idx_response_status (status),

    FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (enrollmentId) REFERENCES enrollments(id) ON DELETE SET NULL
);

-- Consents table - GDPR consent management
CREATE TABLE IF NOT EXISTS consents (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    userId INT NULL,
    questionnaireId VARCHAR(36) NOT NULL,
    aiProcessing BOOLEAN NOT NULL,
    dataProcessing BOOLEAN NOT NULL,
    anonymousSharing BOOLEAN NOT NULL,
    consentText JSON NOT NULL,
    ipAddress VARCHAR(45) NULL,
    userAgent TEXT NULL,
    givenAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    withdrawnAt TIMESTAMP NULL,

    INDEX idx_consent_user_id (userId),
    INDEX idx_consent_questionnaire_id (questionnaireId),

    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (questionnaireId) REFERENCES questionnaires(id) ON DELETE CASCADE
);

-- LLM Analysis table - analysis results storage
CREATE TABLE IF NOT EXISTS llmAnalyses (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    questionnaireId VARCHAR(36) NOT NULL,
    analysisType ENUM('thematic', 'clusters', 'contradictions', 'insights', 'recommendations') NOT NULL,
    results JSON NOT NULL,
    metadata JSON NULL,
    status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    errorMessage TEXT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completedAt TIMESTAMP NULL,
    createdBy INT NOT NULL,

    INDEX idx_llm_analysis_questionnaire_id (questionnaireId),
    INDEX idx_llm_analysis_type (analysisType),
    INDEX idx_llm_analysis_status (status),

    FOREIGN KEY (questionnaireId) REFERENCES questionnaires(id) ON DELETE CASCADE,
    FOREIGN KEY (createdBy) REFERENCES users(id)
);

-- Add constraints and indexes for performance
ALTER TABLE questionnaires ADD CONSTRAINT chk_status CHECK (status IN ('draft', 'review', 'published', 'closed', 'analyzed'));
ALTER TABLE questions ADD CONSTRAINT chk_question_type CHECK (type IN ('text', 'textarea', 'number', 'scale', 'single_choice', 'multiple_choice'));
ALTER TABLE responses ADD CONSTRAINT chk_response_status CHECK (status IN ('draft', 'submitted'));
ALTER TABLE llmAnalyses ADD CONSTRAINT chk_analysis_type CHECK (analysisType IN ('thematic', 'clusters', 'contradictions', 'insights', 'recommendations'));
ALTER TABLE llmAnalyses ADD CONSTRAINT chk_analysis_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- Insert sample questionnaire from template
INSERT IGNORE INTO questionnaires (
    id, title, instructions, status, settings, createdBy, publishedAt
) VALUES (
    UUID(),
    '{"pl": "NASZA (NIE)UTOPIA", "en": "OUR (DIS)UTOPIA"}',
    '{"pl": "Wypełnij kwestionariusz opisujący Waszą wizję wspólnoty. Pamiętaj, że nie ma złych odpowiedzi - chodzi o Wasze autentyczne przemyślenia i marzenia.", "en": "Fill out this questionnaire describing your community vision. Remember, there are no wrong answers - this is about your authentic thoughts and dreams."}',
    'draft',
    '{"anonymous": false, "require_consent": true, "max_responses": null, "close_after_workshop": false, "show_all_questions": true, "allow_edit": true, "question_style": "first_person_plural"}',
    1, -- Assuming admin user with ID 1 exists
    NULL
);

-- Update existing users table to ensure proper role enum (if needed)
ALTER TABLE users MODIFY COLUMN role ENUM('participant', 'facilitator', 'moderator', 'sociologist-editor', 'admin') DEFAULT 'participant' NOT NULL;