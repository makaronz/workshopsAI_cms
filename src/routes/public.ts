import { Router } from 'express';
import { z } from 'zod';
import { questionnaireService } from '../services/questionnaireService';
import { responseService } from '../services/responseService';
import { db } from '../config/database';
import { createHash } from 'crypto';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// Apply optional authentication to routes that may benefit from it
router.use(optionalAuth);

// Validation schemas
const submitResponseSchema = z.object({
  questionId: z.string().uuid(),
  questionnaireId: z.string().uuid(),
  answer: z.any(),
  enrollmentId: z.string().uuid().optional(),
  metadata: z
    .object({
      timeSpentMs: z.number().optional(),
    })
    .optional(),
});

const submitAllResponsesSchema = z.object({
  questionnaireId: z.string().uuid(),
  enrollmentId: z.string().uuid().optional(),
});

const consentSchema = z.object({
  questionnaireId: z.string().uuid(),
  consentType: z.enum(['research_analysis', 'marketing_emails', 'data_sharing', 'anonymous_presentation']),
  granted: z.boolean(),
});

// Helper functions
const hashData = (data: string): string => {
  return createHash('sha256').update(data).digest('hex');
};

const getClientInfo = (req: any) => ({
  ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
  userAgent: req.headers['user-agent'],
});

// GET /api/v1/public/questionnaires/:id - Get published questionnaire for participants
router.get('/questionnaires/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const questionnaire =
      await questionnaireService.getPublishedQuestionnaire(id);

    if (!questionnaire) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Published questionnaire not found',
      });
    }

    // Check if questionnaire is still open for responses
    if (questionnaire.closedAt && new Date() > questionnaire.closedAt) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Questionnaire is no longer accepting responses',
      });
    }

    // Check response limit
    if (questionnaire.settings?.max_responses) {
      const stats = await questionnaireService.getQuestionnaireStats(id);
      if (
        stats &&
        stats.totalResponses >= questionnaire.settings.max_responses
      ) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Questionnaire has reached maximum number of responses',
        });
      }
    }

    res.json({
      success: true,
      data: questionnaire,
    });
  } catch (error) {
    console.error('Get public questionnaire error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error retrieving questionnaire',
    });
  }
});

// GET /api/v1/public/questionnaires/:id/schema - Get questionnaire schema for validation
router.get('/questionnaires/:id/schema', async (req, res) => {
  try {
    const { id } = req.params;

    const questionnaire =
      await questionnaireService.getPublishedQuestionnaire(id);

    if (!questionnaire) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Published questionnaire not found',
      });
    }

    // Build validation schema
    const schema = {
      questionnaireId: id,
      settings: questionnaire.settings,
      groups: [], // TODO: Implement questionGroups join query - questionGroups is not a direct property
    };

    res.json({
      success: true,
      data: schema,
    });
  } catch (error) {
    console.error('Get questionnaire schema error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error retrieving questionnaire schema',
    });
  }
});

// GET /api/v1/public/responses/my/:questionnaireId - Get user's responses for a questionnaire
router.get('/responses/my/:questionnaireId', async (req, res) => {
  try {
    const { questionnaireId } = req.params;
    const userId = req.user?.id; // Optional, for authenticated users
    const enrollmentId = req.query.enrollmentId as string | undefined;

    const userResponses = await responseService.getUserResponses(
      questionnaireId,
      userId,
      enrollmentId,
    );

    res.json({
      success: true,
      data: userResponses,
    });
  } catch (error) {
    console.error('Get user responses error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error retrieving user responses',
    });
  }
});

// POST /api/v1/public/responses - Save or update a response
router.post('/responses', async (req, res) => {
  try {
    const clientInfo = getClientInfo(req);
    const data = submitResponseSchema.parse(req.body);

    // Validate question exists and is part of published questionnaire
    // This would involve checking if the question exists and is in a published questionnaire
    // For now, we'll assume the validation happens elsewhere

    const response = await responseService.saveResponse(
      {
        questionId: data.questionId, // Required field
        questionnaireId: data.questionnaireId || '', // Required field
        userId: req.user?.id, // Optional for authenticated users
        enrollmentId: data.enrollmentId,
        answer: data.answer,
        status: 'draft',
      },
      {
        ipHash: hashData(clientInfo.ip || 'anonymous'),
        userAgentHash: hashData(clientInfo.userAgent || 'anonymous'),
        timeSpentMs: data.metadata?.timeSpentMs,
      },
    );

    res.status(201).json({
      success: true,
      data: response,
      message: 'Response saved successfully',
    });
  } catch (error) {
    console.error('Save response error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error saving response',
    });
  }
});

// PUT /api/v1/public/responses/:id - Update a specific response
router.put('/responses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const clientInfo = getClientInfo(req);
    const { answer, metadata } = req.body;

    // TODO: This route is problematic - it uses response ID but tries to save with questionId
    // This should either:
    // 1. Use responseId to update existing response, or
    // 2. Be changed to use questionId in path parameter
    // For now, implementing basic update logic
    const response = await responseService.saveResponse(
      {
        questionId: id, // Note: Using id as questionId for now
        questionnaireId: '', // Required field - would need to query this
        answer,
        userId: req.user?.id,
        status: 'draft',
      },
      {
        ipHash: hashData(clientInfo.ip || 'anonymous'),
        userAgentHash: hashData(clientInfo.userAgent || 'anonymous'),
        timeSpentMs: metadata?.timeSpentMs,
      },
    );

    res.json({
      success: true,
      data: response,
      message: 'Response updated successfully',
    });
  } catch (error) {
    console.error('Update response error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error updating response',
    });
  }
});

// POST /api/v1/public/responses/submit - Submit all responses for a questionnaire
router.post('/responses/submit', async (req, res) => {
  try {
    const data = submitAllResponsesSchema.parse(req.body);
    const userId = req.user?.id; // Optional for authenticated users

    // Check if consent is required and has been given
    const questionnaire = await questionnaireService.getPublishedQuestionnaire(
      data.questionnaireId,
    );
    if (!questionnaire) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Questionnaire not found',
      });
    }

    if (questionnaire.settings?.require_consent) {
      const hasConsent = await responseService.hasUserConsent(
        data.questionnaireId,
        userId,
      );

      if (!hasConsent) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Consent is required before submitting responses',
        });
      }
    }

    const result = await responseService.submitQuestionnaireResponses(
      data.questionnaireId,
      userId,
      data.enrollmentId,
    );

    res.json({
      success: true,
      data: result,
      message: 'Responses submitted successfully',
    });
  } catch (error) {
    console.error('Submit responses error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error submitting responses',
    });
  }
});

// POST /api/v1/public/consent - Create consent record
router.post('/consent', async (req, res) => {
  try {
    const clientInfo = getClientInfo(req);
    const data = consentSchema.parse(req.body);

    const consent = await responseService.createConsent(
      {
        questionnaireId: data.questionnaireId,
        consentType: data.consentType,
        granted: data.granted,
        userId: req.user?.id, // Optional for authenticated users
      },
      {
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      },
    );

    res.status(201).json({
      success: true,
      data: consent,
      message: 'Consent recorded successfully',
    });
  } catch (error) {
    console.error('Create consent error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error recording consent',
    });
  }
});

// GET /api/v1/public/consent/:questionnaireId - Check if user has consent
router.get('/consent/:questionnaireId', async (req, res) => {
  try {
    const { questionnaireId } = req.params;
    const userId = req.user?.id; // Optional for authenticated users

    const consent = await responseService.hasUserConsent(
      questionnaireId,
      userId,
    );

    res.json({
      success: true,
      data: {
        hasConsent: !!consent,
        consent,
      },
    });
  } catch (error) {
    console.error('Check consent error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error checking consent',
    });
  }
});

// DELETE /api/v1/public/consent/:consentId - Withdraw consent
router.delete('/consent/:consentId', async (req, res) => {
  try {
    const { consentId } = req.params;
    const userId = req.user?.id; // Optional for authenticated users

    const success = await responseService.withdrawConsent(consentId, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Consent record not found',
      });
    }

    res.json({
      success: true,
      message: 'Consent withdrawn successfully',
    });
  } catch (error) {
    console.error('Withdraw consent error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error withdrawing consent',
    });
  }
});

// GET /api/v1/public/questionnaires/:id/consent-text - Get consent text for questionnaire
router.get('/questionnaires/:id/consent-text', async (req, res) => {
  try {
    const { id } = req.params;
    const { lang = 'pl' } = req.query;

    const questionnaire =
      await questionnaireService.getPublishedQuestionnaire(id);

    if (!questionnaire) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Questionnaire not found',
      });
    }

    // Generate consent text based on questionnaire settings
    const titlePl = (questionnaire.titleI18n as any)?.pl || 'Kwestionariusz';
    const titleEn = (questionnaire.titleI18n as any)?.en || 'Questionnaire';
    const consentText = {
      pl: `Wyrażam zgodę na przetwarzanie moich danych osobowych zawartych w odpowiedziach na kwestionariusz "${titlePl}" w celach badawczych i analitycznych. ${questionnaire.settings?.require_consent ? 'Wyrażam zgodę na przetwarzanie moich odpowiedzi przez systemy AI w celu analizy i identyfikacji wzorców.' : ''} ${questionnaire.settings?.anonymous ? 'Wyrażam zgodę na anonimowe udostępnianie moich odpowiedzi w celach badawczych.' : ''}`,
      en: `I consent to the processing of my personal data contained in the responses to the questionnaire "${titleEn}" for research and analytical purposes. ${questionnaire.settings?.require_consent ? 'I consent to the processing of my responses by AI systems for analysis and pattern identification.' : ''} ${questionnaire.settings?.anonymous ? 'I consent to the anonymous sharing of my responses for research purposes.' : ''}`,
    };

    res.json({
      success: true,
      data: {
        consentText: consentText[lang as 'pl' | 'en'] || consentText.pl,
        requirements: {
          aiProcessing: questionnaire.settings?.require_consent || false,
          dataProcessing: true, // Always required
          anonymousSharing: questionnaire.settings?.anonymous || false,
        },
      },
    });
  } catch (error) {
    console.error('Get consent text error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error retrieving consent text',
    });
  }
});

export default router;
