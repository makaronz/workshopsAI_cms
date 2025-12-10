import {
  db,
  responses,
  questions,
  questionGroups,
  questionnaires,
  users,
  enrollments,
  consents,
  eq,
  and,
  desc,
  asc,
  inArray,
  sql,
  isNull,
} from '../config/database';
import {
  Response,
  InsertResponse,
  Consent,
  InsertConsent,
  Question,
  Questionnaire,
} from '../models/postgresql-schema';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export class ResponseService {
  /**
   * Create or update a response (autosave functionality)
   */
  async saveResponse(
    data: {
      questionId: string;
      questionnaireId: string;
      userId?: string;
      enrollmentId?: string;
      answer: any;
      status?: 'draft' | 'submitted';
    },
    metadata?: {
      ipHash?: string;
      userAgentHash?: string;
      timeSpentMs?: number;
    },
  ): Promise<Response> {
    // Check if response exists
    const existingResponse = await db.query.responses.findFirst({
      where: and(
        eq(responses.questionId, data.questionId),
        data.userId
          ? eq(responses.userId, data.userId)
          : isNull(responses.userId),
        data.enrollmentId
          ? eq(responses.enrollmentId, data.enrollmentId)
          : isNull(responses.enrollmentId),
      ),
    });

    const responseMetadata = {
      ip_hash: metadata?.ipHash || this.hashData('anonymous'),
      user_agent_hash: metadata?.userAgentHash || this.hashData('anonymous'),
      time_spent_ms: metadata?.timeSpentMs || 0,
      edit_count: existingResponse
        ? (existingResponse.metadata as any)?.edit_count + 1 || 1
        : 1,
    };

    const responseData: InsertResponse = {
      id: existingResponse?.id || uuidv4(),
      questionId: data.questionId,
      userId: data.userId,
      enrollmentId: data.enrollmentId,
      questionnaireId: data.questionnaireId,
      answer: data.answer,
      metadata: responseMetadata,
      status: data.status || 'draft',
      submittedAt:
        data.status === 'submitted'
          ? new Date()
          : existingResponse?.submittedAt,
    };

    if (existingResponse) {
      const [updatedResponse] = await db
        .update(responses)
        .set({
          ...responseData,
          updatedAt: new Date(),
        })
        .where(eq(responses.id, existingResponse.id))
        .returning();

      return updatedResponse;
    } else {
      const [createdResponse] = await db
        .insert(responses)
        .values(responseData)
        .returning();

      return createdResponse;
    }
  }

  /**
   * Submit all responses for a questionnaire
   */
  async submitQuestionnaireResponses(
    questionnaireId: string,
    userId?: string,
    enrollmentId?: string,
  ): Promise<{ submitted: number; total: number }> {
    // Get all questions for the questionnaire
    const allQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .innerJoin(questionGroups, eq(questions.groupId, questionGroups.id))
      .where(eq(questionGroups.questionnaireId, questionnaireId));

    // Update all draft responses to submitted
    const updateQuery = db
      .update(responses)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(responses.status, 'draft'),
          inArray(
            responses.questionId,
            allQuestions.map(q => q.id),
          ),
          userId ? eq(responses.userId, userId) : isNull(responses.userId),
          enrollmentId
            ? eq(responses.enrollmentId, enrollmentId)
            : isNull(responses.enrollmentId),
        ),
      );

    const result = await updateQuery;

    return {
      submitted: result.length > 0 ? result.length : 0,
      total: allQuestions.length,
    };
  }

  /**
   * Get all responses for a user/questionnaire combination
   */
  async getUserResponses(
    questionnaireId: string,
    userId?: string,
    enrollmentId?: string,
  ): Promise<{
    responses: Response[];
    questionnaire: Questionnaire;
    completionStatus: {
      totalQuestions: number;
      answeredQuestions: number;
      submittedQuestions: number;
      completionPercentage: number;
    };
  }> {
    // Get questionnaire with questions
    const questionnaire = await db.query.questionnaires.findFirst({
      where: eq(questionnaires.id, questionnaireId),
      with: {
        groups: {
          with: {
            questions: {
              orderBy: (questions, { asc }) => [asc(questions.orderIndex)],
            },
          },
        },
      },
    });

    if (!questionnaire) {
      throw new Error('Questionnaire not found');
    }

    // Get all questions for response mapping
    const allQuestions =
      questionnaire.groups?.flatMap(g => g.questions || []) || [];

    // Get user responses
    const userResponses = await db.query.responses.findMany({
      where: and(
        inArray(
          responses.questionId,
          allQuestions.map(q => q.id),
        ),
        userId ? eq(responses.userId, userId) : isNull(responses.userId),
        enrollmentId
          ? eq(responses.enrollmentId, enrollmentId)
          : isNull(responses.enrollmentId),
      ),
    });

    // Calculate completion status
    const totalQuestions = allQuestions.length;
    const answeredQuestions = userResponses.length;
    const submittedQuestions = userResponses.filter(
      r => r.status === 'submitted',
    ).length;
    const completionPercentage =
      totalQuestions > 0
        ? Math.round((answeredQuestions / totalQuestions) * 100)
        : 0;

    return {
      responses: userResponses,
      questionnaire,
      completionStatus: {
        totalQuestions,
        answeredQuestions,
        submittedQuestions,
        completionPercentage,
      },
    };
  }

  /**
   * Create GDPR consent record
   */
  async createConsent(
    data: {
      questionnaireId: string;
      userId?: string;
      consentType: 'research_analysis' | 'marketing_emails' | 'data_sharing' | 'anonymous_presentation';
      granted: boolean;
      consentText: { pl: string; en: string };
    },
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<Consent> {
    const consentData: InsertConsent = {
      id: uuidv4(),
      questionnaireId: data.questionnaireId,
      userId: data.userId,
      consentType: data.consentType,
      granted: data.granted,
      consentText: data.consentText,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      givenAt: new Date(),
    };

    const [consent] = await db.insert(consents).values(consentData).returning();

    return consent;
  }

  /**
   * Check if user has given consent for questionnaire
   */
  async hasUserConsent(
    questionnaireId: string,
    userId?: string,
  ): Promise<Consent | null> {
    const consent = await db.query.consents.findFirst({
      where: and(
        eq(consents.questionnaireId, questionnaireId),
        userId ? eq(consents.userId, userId) : sql`1=1`, // Allow anonymous users
        eq(consents.granted, true),
      ),
      orderBy: [desc(consents.createdAt)],
    });

    return consent || null;
  }

  /**
   * Withdraw consent - Update existing consent to not granted
   */
  async withdrawConsent(consentId: string, userId?: string): Promise<boolean> {
    await db
      .update(consents)
      .set({
        granted: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(consents.id, consentId),
          userId ? eq(consents.userId, userId) : sql`1=1`,
        ),
      );

    return true; // Simplified return since Drizzle doesn't provide affectedRows
  }

  /**
   * Get anonymized responses for LLM analysis
   */
  async getAnonymizedResponses(
    questionnaireId: string,
    includeNonConsenting = false,
  ): Promise<
    Array<{
      questionId: string;
      questionText: { pl: string; en: string };
      answer: any;
      metadata: {
        timestamp_bucket: string;
        question_type: string;
      };
    }>
  > {
    // Build where conditions
    const whereConditions = [
      eq(questionGroups.questionnaireId, questionnaireId),
      eq(responses.status, 'submitted'), // Only submitted responses
    ];

    // If not including non-consenting, filter by consent
    if (!includeNonConsenting) {
      whereConditions.push(
        sql`EXISTS (
          SELECT 1 FROM consents c
          WHERE c.questionnaireId = ${questionnaireId}
          AND c.granted = true
          AND (c.userId = ${responses.userId} OR (c.userId IS NULL AND ${responses.userId} IS NULL))
          AND c.revokedAt IS NULL
        )`,
      );
    }

    // Get responses with PII redaction
    const responsesWithQuestions = await db
      .select({
        response: responses,
        question: questions,
      })
      .from(responses)
      .innerJoin(questions, eq(responses.questionId, questions.id))
      .innerJoin(questionGroups, eq(questions.groupId, questionGroups.id))
      .where(and(...whereConditions));

    return responsesWithQuestions.map(({ response, question }) => ({
      questionId: response.questionId,
      questionText: question.textI18n as { pl: string; en: string },
      answer: this.redactPII(response.answer),
      metadata: {
        timestamp_bucket: this.bucketTimestamp(response.createdAt, '1h'),
        question_type: question.type,
      },
    }));
  }

  /**
   * Get response statistics for questionnaire
   */
  /**
   * Get response statistics for questionnaire
   */
  async getResponseStatistics(questionnaireId: string): Promise<{
    totalResponses: number;
    submittedResponses: number;
    draftResponses: number;
    uniqueParticipants: number;
    averageCompletionTime: number;
    questionStats: Array<{
      questionId: string;
      questionText: { pl: string; en: string };
      type: string;
      responseCount: number;
      averageResponseTime: number;
      skipRate: number;
    }>;
  }> {
    // Get basic statistics
    const [basicStats] = await db
      .select({
        totalResponses: sql<number>`COUNT(r.id)`,
        submittedResponses: sql<number>`COUNT(CASE WHEN r.status = 'submitted' THEN 1 END)`,
        draftResponses: sql<number>`COUNT(CASE WHEN r.status = 'draft' THEN 1 END)`,
        uniqueParticipants: sql<number>`COUNT(DISTINCT r.userId)`,
        averageCompletionTime: sql<number>`AVG(CAST(r.metadata->>'time_spent_ms' AS INTEGER))`,
      })
      .from(sql`responses r`)
      .innerJoin(sql`questions q`, sql`r.questionId = q.id`)
      .innerJoin(sql`questionGroups qg`, sql`q.groupId = qg.id`)
      .where(eq(sql`qg.questionnaireId`, questionnaireId));

    // Get question-level statistics
    const questionStats = await db
      .select({
        questionId: questions.id,
        questionText: questions.textI18n,
        type: questions.type,
        responseCount: sql<number>`COUNT(${responses.id})`,
        averageResponseTime: sql<number>`AVG(CAST(${responses.metadata}->>'time_spent_ms' AS INTEGER))`,
      })
      .from(responses)
      .innerJoin(questions, eq(responses.questionId, questions.id))
      .innerJoin(questionGroups, eq(questions.groupId, questionGroups.id))
      .where(
        and(
          eq(questionGroups.questionnaireId, questionnaireId),
          eq(responses.status, 'submitted'),
        ),
      )
      .groupBy(questions.id, questions.textI18n, questions.type)
      .orderBy(asc(questions.orderIndex));

    // Calculate skip rates for each question
    const questionStatsWithSkipRates = await Promise.all(
      questionStats.map(async (stat) => {
        // Get total participants who answered this question
        const [answerStats] = await db
          .select({
            answeredCount: sql<number>`COUNT(DISTINCT responses.userId)`,
          })
          .from(responses)
          .innerJoin(questionGroups, eq(responses.questionId, questions.id))
          .where(
            and(
              eq(questionGroups.questionnaireId, questionnaireId),
              eq(responses.status, 'submitted'),
            ),
          );

        // Get total participants who could have answered this question
        const [totalStats] = await db
          .select({
            totalParticipants: sql<number>`COUNT(DISTINCT responses.userId)`,
          })
          .from(responses)
          .innerJoin(questionGroups, eq(responses.questionId, questions.id))
          .where(
            and(
              eq(questionGroups.questionnaireId, questionnaireId),
              eq(responses.status, 'submitted'),
            ),
          );

        const skipRate = totalStats.totalParticipants > 0 
          ? (totalStats.totalParticipants - answerStats.answeredCount) / totalStats.totalParticipants 
          : 0;

        return {
          ...stat,
          skipRate,
          averageResponseTime: typeof stat.averageResponseTime === 'number' ? stat.averageResponseTime : 0,
        };
      })
    );

    return {
      ...basicStats,
      questionStats: questionStatsWithSkipRates.map(stat => ({
        ...stat,
        averageResponseTime: typeof stat.averageResponseTime === 'number' ? stat.averageResponseTime : 0,
      })),
    };
  }

  /**
   * Export responses to CSV format
   */
  async exportResponsesToCSV(
    questionnaireId: string,
    includePersonalData = false,
  ): Promise<string> {
    const questionnaireResponses = await this.getUserResponses(questionnaireId);

    // Build CSV header
    let csv =
      'Question ID,Question Text (PL),Question Text (EN),Response Type,Answer';

    if (includePersonalData) {
      csv += ',User ID,Email,Created At,Updated At';
    }

    csv += '\n';

    // Create question lookup map
    const questionMap = new Map();
    questionnaireResponses.questionnaire.questionGroups?.forEach(group => {
      group.questions?.forEach(question => {
        questionMap.set(question.id, question);
      });
    });

    // Add response rows
    for (const response of questionnaireResponses.responses) {
      const answer =
        typeof response.answer === 'string'
          ? `"${response.answer.replace(/"/g, '""')}"`
          : JSON.stringify(response.answer);

      // Find the question data from the lookup map
      const question = questionMap.get(response.questionId);

      const row = [
        response.questionId,
        `"${(question?.textI18n as any)?.pl || (question?.textI18n as any)?.en || ''}"`,
        `"${(question?.textI18n as any)?.en || (question?.textI18n as any)?.pl || ''}"`,
        question?.type || '',
        answer,
      ];

      if (includePersonalData) {
        row.push(
          response.userId?.toString() || 'anonymous',
          '',
          response.submittedAt?.toISOString() || '',
          response.updatedAt?.toISOString() || '',
        );
      }

      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * Utility: Hash data for privacy
   */
  private hashData(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Utility: Bucket timestamp for anonymity
   */
  private bucketTimestamp(timestamp: Date, bucket: string): string {
    const date = new Date(timestamp);

    switch (bucket) {
    case '1h':
      date.setMinutes(0, 0, 0);
      break;
    case '1d':
      date.setHours(0, 0, 0, 0);
      break;
    case '1w':
      date.setDate(date.getDate() - date.getDay());
      date.setHours(0, 0, 0, 0);
      break;
    default:
      return date.toISOString();
    }

    return date.toISOString();
  }

  /**
   * Utility: Redact PII from text
   */
  private redactPII(text: any): any {
    if (typeof text !== 'string') {
      return text;
    }

    // Simple PII patterns - in production, use more sophisticated PII detection
    const piiPatterns = [
      {
        pattern: /\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,
        replacement: '[EMAIL]',
      },
      { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE]' },
      { pattern: /\b\d{11}\b/g, replacement: '[PESEL]' }, // Polish PESEL
      { pattern: /\b\d{10}\b/g, replacement: '[NIP]' }, // Polish NIP
    ];

    let redactedText = text;
    for (const { pattern, replacement } of piiPatterns) {
      redactedText = redactedText.replace(pattern, replacement);
    }

    return redactedText;
  }
}

export const responseService = new ResponseService();
