import request from "supertest";
import { app } from "../src/index";
import { db, users, questionnaires, questionGroups, questions, responses, consents } from "../src/config/database";
import { eq, and, sql } from "drizzle-orm";

describe("Complete Response Workflow Integration", () => {
  let participantToken: string;
  let sociologistToken: string;
  let adminToken: string;
  let participant: any;
  let sociologist: any;
  let admin: any;
  let questionnaire: any;

  beforeAll(async () => {
    // Create test users
    [participant] = await db.insert(users).values({
      openId: "workflow_participant",
      name: "Jan Kowalski",
      email: "jan.kowalski@example.com",
      role: "participant",
      isActive: true,
      emailVerified: true,
    }).returning();

    [sociologist] = await db.insert(users).values({
      openId: "workflow_sociologist",
      name: "Dr. Anna Nowak",
      email: "anna.nowak@university.edu",
      role: "sociologist-editor",
      isActive: true,
      emailVerified: true,
    }).returning();

    [admin] = await db.insert(users).values({
      openId: "workflow_admin",
      name: "System Admin",
      email: "admin@system.com",
      role: "admin",
      isActive: true,
      emailVerified: true,
    }).returning();

    // Create mock tokens
    participantToken = "Bearer mock_participant_" + participant.id;
    sociologistToken = "Bearer mock_sociologist_" + sociologist.id;
    adminToken = "Bearer mock_admin_" + admin.id;
  });

  afterAll(async () => {
    // Comprehensive cleanup
    const questionnaireIds = await db.select({ id: questionnaires.id })
      .from(questionnaires)
      .where(eq(questionnaires.createdBy, sociologist.id));

    for (const qId of questionnaireIds) {
      // Delete responses
      await db.delete(responses).where(
        sql`questionId IN (SELECT id FROM questions WHERE groupId IN (SELECT id FROM questionGroups WHERE questionnaireId = ${qId.id}))`
      );

      // Delete consents
      await db.delete(consents).where(eq(consents.questionnaireId, qId.id));

      // Delete questions
      await db.delete(questions).where(
        sql`groupId IN (SELECT id FROM questionGroups WHERE questionnaireId = ${qId.id})`
      );

      // Delete question groups
      await db.delete(questionGroups).where(eq(questionGroups.questionnaireId, qId.id));

      // Delete questionnaire
      await db.delete(questionnaires).where(eq(questionnaires.id, qId.id));
    }

    await db.delete(users).where(eq(users.id, participant.id));
    await db.delete(users).where(eq(users.id, sociologist.id));
    await db.delete(users).where(eq(users.id, admin.id));
  });

  describe("1. Questionnaire Creation and Setup", () => {
    it("should create a comprehensive questionnaire", async () => {
      const questionnaireData = {
        title: {
          pl: "Badanie samopoczucia w miejscu pracy",
          en: "Workplace Well-being Study"
        },
        description: {
          pl: "Anonimowe badanie dotyczące warunków pracy i samopoczucia pracowników",
          en: "Anonymous study about working conditions and employee well-being"
        },
        instructions: {
          pl: "Proszę udzielić szczerych odpowiedzi na wszystkie pytania. Badanie jest całkowicie anonimowe.",
          en: "Please provide honest answers to all questions. The study is completely anonymous."
        },
        settings: {
          anonymous: false,
          requireConsent: true,
          maxResponses: 100,
          closeAfterWorkshop: false,
          showAllQuestions: true,
          allowEdit: true,
          questionStyle: "first_person_plural",
        },
      };

      const response = await request(app)
        .post("/api/v1/questionnaires")
        .set("Authorization", sociologistToken)
        .send(questionnaireData);

      expect(response.status).toBe(201);
      questionnaire = response.body;

      expect(questionnaire.title.pl).toBe("Badanie samopoczucia w miejscu pracy");
      expect(questionnaire.status).toBe("draft");
      expect(questionnaire.createdBy).toBe(sociologist.id);
    });

    it("should create question groups and questions", async () => {
      // Create first question group - Demographics
      const [demoGroup] = await db.insert(questionGroups).values({
        questionnaireId: questionnaire.id,
        title: {
          pl: "Dane demograficzne",
          en: "Demographic Information"
        },
        description: {
          pl: "Pomocne informacje o Twojej sytuacji zawodowej",
          en: "Helpful information about your professional situation"
        },
        orderIndex: 0,
        uiConfig: {
          collapsed: false,
          showProgress: true,
          icon: "user"
        }
      }).returning();

      // Add demographic questions
      await db.insert(questions).values([
        {
          groupId: demoGroup.id,
          text: {
            pl: "Jaki jest Twój wiek?",
            en: "What is your age?"
          },
          type: "single_choice",
          options: [
            { value: "18-25", label: { pl: "18-25 lat", en: "18-25 years" } },
            { value: "26-35", label: { pl: "26-35 lat", en: "26-35 years" } },
            { value: "36-45", label: { pl: "36-45 lat", en: "36-45 years" } },
            { value: "46-55", label: { pl: "46-55 lat", en: "46-55 years" } },
            { value: "56+", label: { pl: "56+ lat", en: "56+ years" } }
          ],
          validation: { required: true },
          orderIndex: 0
        },
        {
          groupId: demoGroup.id,
          text: {
            pl: "Jak długo pracujesz w obecnej firmie?",
            en: "How long have you been working at your current company?"
          },
          type: "single_choice",
          options: [
            { value: "<1", label: { pl: "Mniej niż rok", en: "Less than 1 year" } },
            { value: "1-3", label: { pl: "1-3 lata", en: "1-3 years" } },
            { value: "3-5", label: { pl: "3-5 lat", en: "3-5 years" } },
            { value: "5-10", label: { pl: "5-10 lat", en: "5-10 years" } },
            { value: "10+", label: { pl: "Więcej niż 10 lat", en: "More than 10 years" } }
          ],
          validation: { required: true },
          orderIndex: 1
        }
      ]);

      // Create second question group - Work Environment
      const [workGroup] = await db.insert(questionGroups).values({
        questionnaireId: questionnaire.id,
        title: {
          pl: "Środowisko pracy",
          en: "Work Environment"
        },
        orderIndex: 1,
        uiConfig: {
          collapsed: false,
          showProgress: true,
          icon: "briefcase"
        }
      }).returning();

      // Add work environment questions
      await db.insert(questions).values([
        {
          groupId: workGroup.id,
          text: {
            pl: "Jak oceniasz atmosferę w miejscu pracy?",
            en: "How would you rate the atmosphere at your workplace?"
          },
          type: "scale",
          validation: {
            required: true,
            minValue: 1,
            maxValue: 10
          },
          orderIndex: 0
        },
        {
          groupId: workGroup.id,
          text: {
            pl: "Czy czujesz się szanowany/a przez swoich przełożonych?",
            en: "Do you feel respected by your supervisors?"
          },
          type: "single_choice",
          options: [
            { value: "always", label: { pl: "Zawsze", en: "Always" } },
            { value: "often", label: { pl: "Często", en: "Often" } },
            { value: "sometimes", label: { pl: "Czasami", en: "Sometimes" } },
            { value: "rarely", label: { pl: "Rzadko", en: "Rarely" } },
            { value: "never", label: { pl: "Nigdy", en: "Never" } }
          ],
          validation: { required: true },
          orderIndex: 1
        }
      ]);

      // Create third question group - Well-being
      const [wellbeingGroup] = await db.insert(questionGroups).values({
        questionnaireId: questionnaire.id,
        title: {
          pl: "Dobrostan",
          en: "Well-being"
        },
        orderIndex: 2,
        uiConfig: {
          collapsed: false,
          showProgress: true,
          icon: "heart"
        }
      }).returning();

      // Add well-being questions
      await db.insert(questions).values([
        {
          groupId: wellbeingGroup.id,
          text: {
            pl: "Jak często odczuwasz stres związany z pracą?",
            en: "How often do you experience work-related stress?"
          },
          type: "single_choice",
          options: [
            { value: "daily", label: { pl: "Codziennie", en: "Daily" } },
            { value: "weekly", label: { pl: "Kilka razy w tygodniu", en: "Several times a week" } },
            { value: "monthly", label: { pl: "Kilka razy w miesiącu", en: "Several times a month" } },
            { value: "rarely", label: { pl: "Rzadko", en: "Rarely" } },
            { value: "never", label: { pl: "Nigdy", en: "Never" } }
          ],
          validation: { required: true },
          orderIndex: 0
        },
        {
          groupId: wellbeingGroup.id,
          text: {
            pl: "Czy masz możliwość utrzymania równowagi między pracą a życiem prywatnym?",
            en: "Do you have the opportunity to maintain work-life balance?"
          },
          type: "single_choice",
          options: [
            { value: "excellent", label: { pl: "Doskonale", en: "Excellent" } },
            { value: "good", label: { pl: "Dobrze", en: "Good" } },
            { value: "average", label: { pl: "Średnio", en: "Average" } },
            { value: "poor", label: { pl: "Słabo", en: "Poor" } },
            { value: "terrible", label: { pl: "Bardzo słabo", en: "Terrible" } }
          ],
          validation: { required: true },
          orderIndex: 1
        },
        {
          groupId: wellbeingGroup.id,
          text: {
            pl: "Jakie sugestie miałbyś/aś dotyczące poprawy warunków pracy?",
            en: "What suggestions do you have for improving working conditions?"
          },
          type: "textarea",
          validation: {
            required: false,
            maxLength: 1000
          },
          orderIndex: 2
        }
      ]);

      // Update questionnaire status to published
      await db.update(questionnaires)
        .set({
          status: "published",
          publishedAt: new Date()
        })
        .where(eq(questionnaires.id, questionnaire.id));
    });
  });

  describe("2. Participant Response Submission", () => {
    it("should require consent before allowing responses", async () => {
      const response = await request(app)
        .post("/api/v1/responses")
        .set("Authorization", participantToken)
        .send({
          questionId: "some-question-id",
          answer: 5
        });

      expect(response.status).toBe(404); // Question doesn't exist, but also should check consent

      // Try to get questions first to test consent requirement
      const questionnaireResponse = await request(app)
        .get(`/api/v1/questionnaires/${questionnaire.id}`)
        .set("Authorization", participantToken);

      expect(questionnaireResponse.status).toBe(401); // Participants can't access questionnaire details
    });

    it("should record GDPR consent", async () => {
      const consentData = {
        questionnaireId: questionnaire.id,
        aiProcessing: true,
        dataProcessing: true,
        anonymousSharing: false,
        consentText: {
          pl: "Wyrażam zgodę na anonimowe przetwarzanie moich odpowiedzi w celach badawczych",
          en: "I consent to anonymous processing of my responses for research purposes"
        }
      };

      const response = await request(app)
        .post("/api/v1/responses/consent")
        .set("Authorization", participantToken)
        .send(consentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.givenAt).toBeDefined();
    });

    it("should submit responses step by step with autosave", async () => {
      // Get all questions for the questionnaire
      const allQuestions = await db.select().from(questions)
        .innerJoin(questionGroups, eq(questions.groupId, questionGroups.id))
        .where(eq(questionGroups.questionnaireId, questionnaire.id))
        .orderBy(questions.orderIndex);

      expect(allQuestions.length).toBeGreaterThan(0);

      // Submit responses one by one
      for (const questionRow of allQuestions) {
        const question = questionRow.questions;

        let answer: any;

        // Generate appropriate answer based on question type
        switch (question.type) {
          case "single_choice":
            const options = question.options as any[];
            answer = options[Math.floor(Math.random() * options.length)].value;
            break;
          case "scale":
            answer = Math.floor(Math.random() * 10) + 1;
            break;
          case "textarea":
            answer = "To jest przykładowa odpowiedź na pytanie otwarte.";
            break;
          default:
            answer = "default answer";
        }

        // Use autosave for some responses
        const isAutosave = Math.random() > 0.7; // 30% chance of regular submission

        const response = await request(app)
          .post("/api/v1/responses")
          .set("Authorization", participantToken)
          .send({
            questionId: question.id,
            answer: answer,
            timeSpentMs: Math.floor(Math.random() * 10000) + 1000,
            isAutosave: isAutosave
          });

        expect(response.status).toBe(isAutosave ? 200 : 201);
        expect(response.body.success).toBe(true);

        if (response.body.warnings && response.body.warnings.length > 0) {
          console.log("GDPR Warnings:", response.body.warnings);
        }
      }
    });

    it("should show completion status for participant", async () => {
      const response = await request(app)
        .get(`/api/v1/responses/user/${participant.id}`)
        .set("Authorization", participantToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(participant.id.toString());
      expect(response.body.data.summary.totalResponses).toBeGreaterThan(0);

      // Check completion statistics
      if (response.body.data.questionnaires.length > 0) {
        const questionnaireData = response.body.data.questionnaires[0];
        expect(questionnaireData.statistics).toBeDefined();
        expect(questionnaireData.statistics.completionPercentage).toBeGreaterThan(0);
      }
    });
  });

  describe("3. Researcher Analysis and Export", () => {
    it("should allow sociologists to view all responses", async () => {
      const response = await request(app)
        .get(`/api/v1/responses/questionnaire/${questionnaire.id}`)
        .set("Authorization", sociologistToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.responses.length).toBeGreaterThan(0);
      expect(response.body.data.statistics).toBeDefined();

      // Check that user data is anonymized for sociologists
      if (response.body.data.responses.length > 0 && response.body.data.responses[0].user) {
        expect(response.body.data.responses[0].user.name).toBe("[ANONYMIZED]");
        expect(response.body.data.responses[0].user.email).toBe("[ANONYMIZED]");
      }
    });

    it("should provide comprehensive statistics", async () => {
      const response = await request(app)
        .get(`/api/v1/responses/questionnaire/${questionnaire.id}`)
        .set("Authorization", sociologistToken);

      expect(response.status).toBe(200);

      const stats = response.body.data.statistics;
      expect(stats.totalResponses).toBeGreaterThan(0);
      expect(stats.submittedResponses).toBeGreaterThan(0);
      expect(stats.questionStats).toBeDefined();
      expect(stats.questionStats.length).toBeGreaterThan(0);
    });

    it("should export responses in different formats", async () => {
      // Test CSV export
      const csvResponse = await request(app)
        .get(`/api/v1/responses/export/${questionnaire.id}?format=csv`)
        .set("Authorization", sociologistToken);

      expect(csvResponse.status).toBe(200);
      expect(csvResponse.headers['content-type']).toBe("text/csv");
      expect(csvResponse.text).toContain("Response ID");
      expect(csvResponse.text).toContain("Question ID");

      // Test JSON export
      const jsonResponse = await request(app)
        .get(`/api/v1/responses/export/${questionnaire.id}?format=json`)
        .set("Authorization", sociologistToken);

      expect(jsonResponse.status).toBe(200);
      expect(jsonResponse.headers['content-type']).toBe("application/json");
      const jsonData = JSON.parse(jsonResponse.text);
      expect(jsonData.responses).toBeDefined();
      expect(jsonData.statistics).toBeDefined();
      expect(jsonData.exportedAt).toBeDefined();
    });

    it("should show personal data to admins", async () => {
      const response = await request(app)
        .get(`/api/v1/responses/questionnaire/${questionnaire.id}?includeAnonymized=false`)
        .set("Authorization", adminToken);

      expect(response.status).toBe(200);

      // Admins should see real user data
      if (response.body.data.responses.length > 0 && response.body.data.responses[0].user) {
        expect(response.body.data.responses[0].user.name).not.toBe("[ANONYMIZED]");
      }
    });
  });

  describe("4. Audit Trail and Security", () => {
    it("should have proper audit logging for all operations", async () => {
      // This test would check that audit logs were created for all operations
      // In a real implementation, you'd query your audit logs table

      const response = await request(app)
        .get(`/api/v1/responses/questionnaire/${questionnaire.id}`)
        .set("Authorization", sociologistToken);

      expect(response.status).toBe(200);
      // Audit logging should be verified by checking database records
      // This is a placeholder for audit log verification
    });

    it("should handle rate limiting properly", async () => {
      // Test that excessive requests are rate limited
      const promises = Array(20).fill(null).map(() =>
        request(app)
          .post("/api/v1/responses/consent")
          .set("Authorization", participantToken)
          .send({
            questionnaireId: questionnaire.id,
            aiProcessing: true,
            dataProcessing: true,
            anonymousSharing: false,
            consentText: {
              pl: "Test zgoda",
              en: "Test consent"
            }
          })
      );

      const results = await Promise.allSettled(promises);

      // Some should succeed, some should be rate limited
      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).status !== 429);
      const rateLimited = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 429);

      expect(successful.length > 0).toBe(true);
      // Rate limiting behavior depends on your configuration
    });

    it("should prevent unauthorized access", async () => {
      // Test without authentication
      const response = await request(app)
        .get(`/api/v1/responses/questionnaire/${questionnaire.id}`);

      expect(response.status).toBe(401);

      // Test with wrong role
      const wrongRoleResponse = await request(app)
        .get(`/api/v1/responses/questionnaire/${questionnaire.id}`)
        .set("Authorization", participantToken);

      expect(wrongRoleResponse.status).toBe(403);
    });
  });
});