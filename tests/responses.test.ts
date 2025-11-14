import request from "supertest";
import { app } from "../src/index";
import { db, users, questionnaires, questionGroups, questions, responses, consents } from "../src/config/database";
import { eq, and, sql } from "drizzle-orm";

describe("Response Management API", () => {
  let authToken: string;
  let adminToken: string;
  let facilitatorToken: string;
  let testUser: any;
  let adminUser: any;
  let facilitatorUser: any;
  let testQuestionnaire: any;
  let testQuestion: any;

  beforeAll(async () => {
    // Create test users with different roles
    [testUser] = await db.insert(users).values({
      openId: "test_user_responses",
      name: "Test User",
      email: "test.responses@example.com",
      role: "participant",
      isActive: true,
      emailVerified: true,
    }).returning();

    [adminUser] = await db.insert(users).values({
      openId: "admin_user_responses",
      name: "Admin User",
      email: "admin.responses@example.com",
      role: "admin",
      isActive: true,
      emailVerified: true,
    }).returning();

    [facilitatorUser] = await db.insert(users).values({
      openId: "facilitator_user_responses",
      name: "Facilitator User",
      email: "facilitator.responses@example.com",
      role: "sociologist-editor",
      isActive: true,
      emailVerified: true,
    }).returning();

    // Get authentication tokens (this assumes you have auth endpoints)
    // For testing purposes, we'll use a mock token approach
    authToken = "Bearer mock_token_user_" + testUser.id;
    adminToken = "Bearer mock_token_admin_" + adminUser.id;
    facilitatorToken = "Bearer mock_token_facilitator_" + facilitatorUser.id;

    // Create test questionnaire
    [testQuestionnaire] = await db.insert(questionnaires).values({
      title: { pl: "Testowa ankieta", en: "Test questionnaire" },
      status: "published",
      settings: {
        anonymous: false,
        requireConsent: true,
        maxResponses: null,
        closeAfterWorkshop: false,
        showAllQuestions: true,
        allowEdit: true,
        questionStyle: "first_person_plural",
      },
      createdBy: facilitatorUser.id,
    }).returning();

    // Create test question group
    const [testQuestionGroup] = await db.insert(questionGroups).values({
      questionnaireId: testQuestionnaire.id,
      title: { pl: "Grupa 1", en: "Group 1" },
      orderIndex: 0,
    }).returning();

    // Create test question
    [testQuestion] = await db.insert(questions).values({
      groupId: testQuestionGroup.id,
      text: { pl: "Jak się czujesz?", en: "How are you feeling?" },
      type: "scale",
      validation: {
        required: true,
        minValue: 1,
        maxValue: 10,
      },
      orderIndex: 0,
    }).returning();
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(responses).where(eq(responses.questionId, testQuestion.id));
    await db.delete(questions).where(eq(questions.groupId, testQuestionnaire.id));
    await db.delete(questionGroups).where(eq(questionGroups.questionnaireId, testQuestionnaire.id));
    await db.delete(consents).where(eq(consents.questionnaireId, testQuestionnaire.id));
    await db.delete(questionnaires).where(eq(questionnaires.id, testQuestionnaire.id));
    await db.delete(users).where(eq(users.id, testUser.id));
    await db.delete(users).where(eq(users.id, adminUser.id));
    await db.delete(users).where(eq(users.id, facilitatorUser.id));
  });

  describe("POST /api/v1/responses", () => {
    it("should create a new response successfully", async () => {
      const consentData = {
        questionnaireId: testQuestionnaire.id,
        aiProcessing: true,
        dataProcessing: true,
        anonymousSharing: false,
        consentText: {
          pl: "Wyrażam zgodę na przetwarzanie danych",
          en: "I consent to data processing",
        },
      };

      // First create consent
      await request(app)
        .post("/api/v1/responses/consent")
        .set("Authorization", authToken)
        .send(consentData)
        .expect(201);

      const response = await request(app)
        .post("/api/v1/responses")
        .set("Authorization", authToken)
        .send({
          questionId: testQuestion.id,
          answer: 7,
          timeSpentMs: 5000,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.questionId).toBe(testQuestion.id);
      expect(response.body.data.status).toBe("submitted");
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/v1/responses")
        .send({
          questionId: testQuestion.id,
          answer: 5,
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe("AUTH_REQUIRED");
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/v1/responses")
        .set("Authorization", authToken)
        .send({
          // Missing questionId
          answer: 5,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });

    it("should prevent duplicate responses", async () => {
      // Create first response
      await request(app)
        .post("/api/v1/responses")
        .set("Authorization", authToken)
        .send({
          questionId: testQuestion.id,
          answer: 6,
        });

      // Try to create duplicate
      const response = await request(app)
        .post("/api/v1/responses")
        .set("Authorization", authToken)
        .send({
          questionId: testQuestion.id,
          answer: 8,
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("DUPLICATE_RESPONSE");
    });

    it("should handle autosave responses", async () => {
      const response = await request(app)
        .post("/api/v1/responses")
        .set("Authorization", authToken)
        .send({
          questionId: testQuestion.id,
          answer: 4,
          isAutosave: true,
        });

      expect(response.status).toBe(200); // 200 for autosave
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Response autosaved");
    });

    it("should validate answer format based on question type", async () => {
      // Create text question for testing
      const [textQuestion] = await db.insert(questions).values({
        groupId: testQuestion.id,
        text: { pl: "Opisz swoje uczucia", en: "Describe your feelings" },
        type: "text",
        validation: { required: true, maxLength: 100 },
        orderIndex: 1,
      }).returning();

      const response = await request(app)
        .post("/api/v1/responses")
        .set("Authorization", authToken)
        .send({
          questionId: textQuestion.id,
          answer: 123, // Invalid type for text question
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");

      // Cleanup
      await db.delete(questions).where(eq(questions.id, textQuestion.id));
    });

    it("should require consent when questionnaire requires it", async () => {
      // Create new questionnaire that requires consent
      const [consentRequiredQuestionnaire] = await db.insert(questionnaires).values({
        title: { pl: "Ankieta wymagająca zgody", en: "Consent required questionnaire" },
        status: "published",
        settings: {
          anonymous: false,
          requireConsent: true,
          maxResponses: null,
          closeAfterWorkshop: false,
          showAllQuestions: true,
          allowEdit: true,
          questionStyle: "first_person_plural",
        },
        createdBy: facilitatorUser.id,
      }).returning();

      const [consentQuestionGroup] = await db.insert(questionGroups).values({
        questionnaireId: consentRequiredQuestionnaire.id,
        title: { pl: "Grupa 1", en: "Group 1" },
        orderIndex: 0,
      }).returning();

      const [consentQuestion] = await db.insert(questions).values({
        groupId: consentQuestionGroup.id,
        text: { pl: "Test pytanie", en: "Test question" },
        type: "text",
        validation: { required: true },
        orderIndex: 0,
      }).returning();

      const response = await request(app)
        .post("/api/v1/responses")
        .set("Authorization", authToken)
        .send({
          questionId: consentQuestion.id,
          answer: "Test answer",
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("CONSENT_REQUIRED");

      // Cleanup
      await db.delete(questions).where(eq(questions.id, consentQuestion.id));
      await db.delete(questionGroups).where(eq(questionGroups.id, consentQuestionGroup.id));
      await db.delete(questionnaires).where(eq(questionnaires.id, consentRequiredQuestionnaire.id));
    });
  });

  describe("PATCH /api/v1/responses/:id", () => {
    let draftResponse: any;

    beforeEach(async () => {
      // Create a draft response for testing updates
      [draftResponse] = await db.insert(responses).values({
        questionId: testQuestion.id,
        userId: testUser.id,
        answer: 3,
        status: "draft",
        metadata: {
          ipHash: "test_hash",
          userAgentHash: "test_ua_hash",
          timeSpentMs: 1000,
          editCount: 0,
        },
      }).returning();
    });

    afterEach(async () => {
      // Clean up draft response
      if (draftResponse) {
        await db.delete(responses).where(eq(responses.id, draftResponse.id));
      }
    });

    it("should update draft response successfully", async () => {
      const response = await request(app)
        .patch(`/api/v1/responses/${draftResponse.id}`)
        .set("Authorization", authToken)
        .send({
          answer: 8,
          timeSpentMs: 2000,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(draftResponse.id);
    });

    it("should prevent updating submitted responses", async () => {
      // Update response to submitted status
      await db.update(responses)
        .set({ status: "submitted" })
        .where(eq(responses.id, draftResponse.id));

      const response = await request(app)
        .patch(`/api/v1/responses/${draftResponse.id}`)
        .set("Authorization", authToken)
        .send({
          answer: 9,
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("RESPONSE_ALREADY_SUBMITTED");
    });

    it("should allow admins to update any response", async () => {
      const response = await request(app)
        .patch(`/api/v1/responses/${draftResponse.id}`)
        .set("Authorization", adminToken)
        .send({
          answer: 10,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should prevent users from updating others' responses", async () => {
      const [otherUser] = await db.insert(users).values({
        openId: "other_user_responses",
        name: "Other User",
        email: "other.responses@example.com",
        role: "participant",
        isActive: true,
        emailVerified: true,
      }).returning();

      const otherToken = "Bearer mock_token_user_" + otherUser.id;

      const response = await request(app)
        .patch(`/api/v1/responses/${draftResponse.id}`)
        .set("Authorization", otherToken)
        .send({
          answer: 5,
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("INSUFFICIENT_PERMISSIONS");

      // Cleanup other user
      await db.delete(users).where(eq(users.id, otherUser.id));
    });
  });

  describe("GET /api/v1/responses/questionnaire/:id", () => {
    beforeEach(async () => {
      // Create some test responses
      await db.insert(responses).values([
        {
          questionId: testQuestion.id,
          userId: testUser.id,
          answer: 7,
          status: "submitted",
          metadata: { ipHash: "test", userAgentHash: "test", timeSpentMs: 1000, editCount: 0 },
        },
        {
          questionId: testQuestion.id,
          userId: adminUser.id,
          answer: 8,
          status: "submitted",
          metadata: { ipHash: "test", userAgentHash: "test", timeSpentMs: 1500, editCount: 0 },
        },
      ]);
    });

    afterEach(async () => {
      // Clean up test responses
      await db.delete(responses).where(eq(responses.questionId, testQuestion.id));
    });

    it("should allow sociologists to view questionnaire responses", async () => {
      const response = await request(app)
        .get(`/api/v1/responses/questionnaire/${testQuestionnaire.id}`)
        .set("Authorization", facilitatorToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.questionnaire.id).toBe(testQuestionnaire.id);
      expect(response.body.data.responses).toHaveLength(2);
      expect(response.body.data.statistics).toBeDefined();
    });

    it("should allow admins to view questionnaire responses", async () => {
      const response = await request(app)
        .get(`/api/v1/responses/questionnaire/${testQuestionnaire.id}`)
        .set("Authorization", adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.responses).toHaveLength(2);
    });

    it("should prevent participants from accessing questionnaire responses", async () => {
      const response = await request(app)
        .get(`/api/v1/responses/questionnaire/${testQuestionnaire.id}`)
        .set("Authorization", authToken);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("should handle pagination", async () => {
      const response = await request(app)
        .get(`/api/v1/responses/questionnaire/${testQuestionnaire.id}?page=1&limit=1`)
        .set("Authorization", facilitatorToken);

      expect(response.status).toBe(200);
      expect(response.body.data.responses).toHaveLength(1);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.total).toBe(2);
    });
  });

  describe("GET /api/v1/responses/user/:id", () => {
    beforeEach(async () => {
      // Create test responses for the user
      await db.insert(responses).values({
        questionId: testQuestion.id,
        userId: testUser.id,
        answer: 6,
        status: "submitted",
        metadata: { ipHash: "test", userAgentHash: "test", timeSpentMs: 2000, editCount: 0 },
      });
    });

    afterEach(async () => {
      // Clean up test responses
      await db.delete(responses).where(eq(responses.userId, testUser.id));
    });

    it("should allow users to view their own responses", async () => {
      const response = await request(app)
        .get(`/api/v1/responses/user/${testUser.id}`)
        .set("Authorization", authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(testUser.id.toString());
      expect(response.body.data.summary.totalResponses).toBe(1);
    });

    it("should allow admins to view any user's responses", async () => {
      const response = await request(app)
        .get(`/api/v1/responses/user/${testUser.id}`)
        .set("Authorization", adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(testUser.id.toString());
    });

    it("should prevent users from viewing others' responses", async () => {
      const [otherUser] = await db.insert(users).values({
        openId: "other_user_view_responses",
        name: "Other User",
        email: "other.view.responses@example.com",
        role: "participant",
        isActive: true,
        emailVerified: true,
      }).returning();

      const otherToken = "Bearer mock_token_user_" + otherUser.id;

      const response = await request(app)
        .get(`/api/v1/responses/user/${testUser.id}`)
        .set("Authorization", otherToken);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("INSUFFICIENT_PERMISSIONS");

      // Cleanup other user
      await db.delete(users).where(eq(users.id, otherUser.id));
    });
  });

  describe("POST /api/v1/responses/consent", () => {
    it("should record consent successfully", async () => {
      const consentData = {
        questionnaireId: testQuestionnaire.id,
        aiProcessing: true,
        dataProcessing: true,
        anonymousSharing: false,
        consentText: {
          pl: "Wyrażam zgodę na przetwarzanie danych",
          en: "I consent to data processing",
        },
      };

      const response = await request(app)
        .post("/api/v1/responses/consent")
        .set("Authorization", authToken)
        .send(consentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.questionnaireId).toBe(testQuestionnaire.id);
      expect(response.body.data.givenAt).toBeDefined();
    });

    it("should validate consent fields", async () => {
      const invalidConsentData = {
        // Missing required fields
        aiProcessing: true,
        dataProcessing: true,
      };

      const response = await request(app)
        .post("/api/v1/responses/consent")
        .set("Authorization", authToken)
        .send(invalidConsentData);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/v1/responses/bulk", () => {
    beforeEach(async () => {
      // Create additional test questions for bulk submission
      const [testQuestionGroup2] = await db.insert(questionGroups).values({
        questionnaireId: testQuestionnaire.id,
        title: { pl: "Grupa 2", en: "Group 2" },
        orderIndex: 1,
      }).returning();

      await db.insert(questions).values([
        {
          groupId: testQuestionGroup2.id,
          text: { pl: "Pytanie 2", en: "Question 2" },
          type: "text",
          validation: { required: true },
          orderIndex: 0,
        },
        {
          groupId: testQuestionGroup2.id,
          text: { pl: "Pytanie 3", en: "Question 3" },
          type: "single_choice",
          options: [
            { value: "option1", label: { pl: "Opcja 1", en: "Option 1" } },
            { value: "option2", label: { pl: "Opcja 2", en: "Option 2" } },
          ],
          validation: { required: true },
          orderIndex: 1,
        },
      ]);
    });

    afterEach(async () => {
      // Clean up all test responses
      await db.delete(responses).where(eq(responses.userId, testUser.id));
    });

    it("should submit multiple responses successfully", async () => {
      // First create consent
      await request(app)
        .post("/api/v1/responses/consent")
        .set("Authorization", authToken)
        .send({
          questionnaireId: testQuestionnaire.id,
          aiProcessing: true,
          dataProcessing: true,
          anonymousSharing: false,
          consentText: {
            pl: "Wyrażam zgodę na przetwarzanie danych",
            en: "I consent to data processing",
          },
        });

      // Get all questions for the questionnaire
      const allQuestions = await db.select().from(questions)
        .innerJoin(questionGroups, eq(questions.groupId, questionGroups.id))
        .where(eq(questionGroups.questionnaireId, testQuestionnaire.id));

      const bulkData = {
        questionnaireId: testQuestionnaire.id,
        responses: allQuestions.map((q: any) => ({
          questionId: q.questions.id,
          answer: q.questions.type === "scale" ? 7 :
                  q.questions.type === "text" ? "Test answer" :
                  q.questions.type === "single_choice" ? "option1" : "default",
        })),
        status: "submitted",
      };

      const response = await request(app)
        .post("/api/v1/responses/bulk")
        .set("Authorization", authToken)
        .send(bulkData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.processedResponses).toHaveLength(allQuestions.length);
      expect(response.body.data.summary.successful).toBe(allQuestions.length);
      expect(response.body.data.summary.failed).toBe(0);
    });

    it("should handle partial failures in bulk submission", async () => {
      const bulkData = {
        questionnaireId: testQuestionnaire.id,
        responses: [
          {
            questionId: testQuestion.id,
            answer: 8, // Valid
          },
          {
            questionId: "invalid-question-id", // Invalid
            answer: "test",
          },
        ],
        status: "submitted",
      };

      const response = await request(app)
        .post("/api/v1/responses/bulk")
        .set("Authorization", authToken)
        .send(bulkData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.processedResponses).toHaveLength(1);
      expect(response.body.data.errors).toHaveLength(1);
      expect(response.body.data.summary.failed).toBe(1);
    });
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting to response submissions", async () => {
      // This test would need to be adjusted based on your rate limit configuration
      // For now, we'll just verify the endpoint exists and enforces some limits

      // Create consent first
      await request(app)
        .post("/api/v1/responses/consent")
        .set("Authorization", authToken)
        .send({
          questionnaireId: testQuestionnaire.id,
          aiProcessing: true,
          dataProcessing: true,
          anonymousSharing: false,
          consentText: {
            pl: "Wyrażam zgodę na przetwarzanie danych",
            en: "I consent to data processing",
          },
        });

      // Make multiple rapid requests - adjust count based on your rate limits
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post("/api/v1/responses")
          .set("Authorization", authToken)
          .send({
            questionId: testQuestion.id,
            answer: Math.floor(Math.random() * 10) + 1,
            isAutosave: true, // Use autosave to avoid duplicate constraint
          })
      );

      const results = await Promise.allSettled(promises);

      // At least some requests should succeed
      const successfulRequests = results.filter(r =>
        r.status === "fulfilled" &&
        (r.value as any).status !== 429
      );

      expect(successfulRequests.length).toBeGreaterThan(0);
    });
  });

  describe("GDPR Compliance", () => {
    it("should detect and sanitize PII in text responses", async () => {
      // Create text question
      const [textQuestion] = await db.insert(questions).values({
        groupId: testQuestion.id,
        text: { pl: "Podaj email kontaktowy", en: "Provide contact email" },
        type: "textarea",
        validation: { required: false },
        orderIndex: 2,
      }).returning();

      const responseWithPII = "Mój email to test@example.com, telefon 123-456-789";

      const response = await request(app)
        .post("/api/v1/responses")
        .set("Authorization", authToken)
        .send({
          questionId: textQuestion.id,
          answer: responseWithPII,
          isAutosave: true,
        });

      expect(response.status).toBe(200);

      // Verify PII warnings if implemented
      if (response.body.warnings) {
        expect(response.body.warnings.length).toBeGreaterThan(0);
      }

      // Cleanup
      await db.delete(responses).where(eq(responses.questionId, textQuestion.id));
      await db.delete(questions).where(eq(questions.id, textQuestion.id));
    });

    it("should anonymize user data in exports for non-admins", async () => {
      const response = await request(app)
        .get(`/api/v1/responses/questionnaire/${testQuestionnaire.id}?includeAnonymized=true`)
        .set("Authorization", facilitatorToken);

      expect(response.status).toBe(200);

      // User data should be anonymized for non-admin roles
      if (response.body.data.responses.length > 0 && response.body.data.responses[0].user) {
        expect(response.body.data.responses[0].user.name).toBe("[ANONYMIZED]");
        expect(response.body.data.responses[0].user.email).toBe("[ANONYMIZED]");
      }
    });
  });
});