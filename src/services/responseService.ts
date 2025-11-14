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
      userId?: number;
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
    userId?: number,
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
      submitted: result[0]?.affectedRows || 0,
      total: allQuestions.length,
    };
  }

  /**
   * Get all responses for a user/questionnaire combination
   */
  async getUserResponses(
    questionnaireId: string,
    userId?: number,
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
        questionGroups: {
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
      questionnaire.questionGroups?.flatMap(g => g.questions || []) || [];

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
      with: {
        question: true,
      },
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
      userId?: number;
      aiProcessing: boolean;
      dataProcessing: boolean;
      anonymousSharing: boolean;
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
      aiProcessing: data.aiProcessing,
      dataProcessing: data.dataProcessing,
      anonymousSharing: data.anonymousSharing,
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
    userId?: number,
  ): Promise<Consent | null> {
    const consent = await db.query.consents.findFirst({
      where: and(
        eq(consents.questionnaireId, questionnaireId),
        userId ? eq(consents.userId, userId) : isNull(consents.userId),
        isNull(consents.withdrawnAt),
      ),
    });

    return consent || null;
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(consentId: string, userId?: number): Promise<boolean> {
    const result = await db
      .update(consents)
      .set({
        withdrawnAt: new Date(),
      })
      .where(
        and(
          eq(consents.id, consentId),
          userId ? eq(consents.userId, userId) : sql`1=1`,
        ),
      );

    return (result[0]?.affectedRows || 0) > 0;
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
      questionText: question.text,
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
        averageCompletionTime: sql<number>`AVG(r.metadata->>'$.time_spent_ms')`,
      })
      .from(sql`responses r`)
      .innerJoin(sql`questions q`, sql`r.questionId = q.id`)
      .innerJoin(sql`questionGroups qg`, sql`q.groupId = qg.id`)
      .where(eq(sql`qg.questionnaireId`, questionnaireId));

    // Get question-level statistics
    const questionStats = await db
      .select({
        questionId: questions.id,
        questionText: questions.text,
        type: questions.type,
        responseCount: sql<number>`COUNT(r.id)`,
        averageResponseTime: sql<number>`AVG(r.metadata->>'$.time_spent_ms')`,
        skipRate: sql<number>`(
          SELECT COUNT(*)
          FROM responses r2
          JOIN questions q2 ON r2.questionId = q2.id
          JOIN questionGroups qg2 ON q2.groupId = qg2.id
          WHERE qg2.questionnaireId = ${questionnaireId}
          AND r2.userId = r.userId
          AND r2.status = 'submitted'
        )`,
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
      .groupBy(questions.id, questions.text, questions.type)
      .orderBy((responses, { asc }) => [asc(questions.orderIndex)]);

    return {
      ...basicStats,
      questionStats: questionStats.map(stat => ({
        ...stat,
        skipRate: typeof stat.skipRate === 'number' ? stat.skipRate : 0,
        averageResponseTime:
          typeof stat.averageResponseTime === 'number'
            ? stat.averageResponseTime
            : 0,
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

    // Add response rows
    for (const response of questionnaireResponses.responses) {
      const answer =
        typeof response.answer === 'string'
          ? `"${response.answer.replace(/"/g, '""')}"`
          : JSON.stringify(response.answer);

      const row = [
        response.questionId,
        `"${response.question?.text?.pl || ''}"`,
        `"${response.question?.text?.en || ''}"`,
        response.question?.type || '',
        answer,
      ];

      if (includePersonalData) {
        row.push(
          response.userId?.toString() || 'anonymous',
          '',
          response.createdAt?.toISOString() || '',
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
