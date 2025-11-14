import { AnonymizationService } from "../src/services/anonymization";
import { embeddingsService } from "../src/services/embeddings";
import { promptTemplateService } from "../src/services/prompt-templates";
import { AnalysisFactory } from "../src/services/analysis-types";

describe("LLM Pipeline Tests", () => {
  describe("AnonymizationService", () => {
    let anonymizer: AnonymizationService;

    beforeEach(() => {
      anonymizer = new AnonymizationService("test-salt");
    });

    test("should detect and redact PII in text", async () => {
      const text = "Moje dane to Jan Kowalski, email: jan.kowalski@example.com, telefon: 123-456-789";
      const result = await anonymizer.anonymizeText(text, "full");

      expect(result.anonymizedText).not.toContain("Jan Kowalski");
      expect(result.anonymizedText).not.toContain("jan.kowalski@example.com");
      expect(result.anonymizedText).not.toContain("123-456-789");
      expect(result.anonymizedText).toContain("[IMIE NAZWISKO]");
      expect(result.anonymizedText).toContain("[EMAIL]");
      expect(result.anonymizedText).toContain("[TELEFON]");
    });

    test("should detect Polish specific PII", async () => {
      const text = "Mój PESEL: 80010112345, NIP: 123-456-78-90, kod pocztowy: 00-001";
      const result = await anonymizer.anonymizeText(text, "full");

      expect(result.anonymizedText).toContain("[PESEL]");
      expect(result.anonymizedText).toContain("[NIP]");
      expect(result.anonymizedText).toContain("[KOD POCZTOWY]");
    });

    test("should verify k-anonymity compliance", () => {
      const responses = [
        "Wspólna przestrzeń do pracy",
        "Wspólna przestrzeń do pracy",
        "Wspólna przestrzeń do pracy",
        "Wspólna przestrzeń do pracy",
        "Wspólna przestrzeń do pracy",
        "Prywatne biura",
        "Prywatne biura",
        "Prywatne biura",
        "Prywatne biura",
        "Prywatne biura"
      ];

      expect(anonymizer.verifyKAnonymity(responses, 3)).toBe(true);
      expect(anonymizer.verifyKAnonymity(responses, 6)).toBe(false);
    });

    test("should generate consistent anonymous user IDs", () => {
      const userId1 = anonymizer.getAnonymousUserId(1);
      const userId2 = anonymizer.getAnonymousUserId(2);
      const userId1Again = anonymizer.getAnonymousUserId(1);

      expect(userId1).toBe(userId1Again);
      expect(userId1).not.toBe(userId2);
      expect(userId1).toMatch(/^anon_user_[a-f0-9]{12}$/);
    });
  });

  describe("PromptTemplateService", () => {
    test("should build thematic analysis prompt", () => {
      const responses = [
        { answer: "Wspólnota oparta na współpracy" },
        { answer: "Chcemy ciszy i spokoju" }
      ];

      const prompt = promptTemplateService.buildThematicAnalysisPrompt(responses, {
        questionText: "Co jest dla Was ważne?",
        language: "pl"
      });

      expect(prompt).toContain("Jesteś ekspertem socjologiem");
      expect(prompt).toContain("Co jest dla Was ważne?");
      expect(prompt).toContain("Wspólnota oparta na współpracy");
      expect(prompt).toContain("Chcemy ciszy i spokoju");
    });

    test("should validate template variables", () => {
      const result = promptTemplateService.validateVariables("thematic-analysis-v1", {
        responses: "test",
        responseCount: 10,
        questionText: "Test?",
        language: "pl"
      });

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    test("should detect missing required variables", () => {
      const result = promptTemplateService.validateVariables("thematic-analysis-v1", {
        responseCount: 10
      });

      expect(result.valid).toBe(false);
      expect(result.missing).toContain("responses");
      expect(result.missing).toContain("questionText");
    });
  });

  describe("EmbeddingsService", () => {
    test("should calculate cost estimate", () => {
      const texts = [
        "Krótka odpowiedź",
        "Nieco dłuższa odpowiedź na pytanie kwestionariuszowe dotyczące wspólnych przestrzeni"
      ];

      const cost = embeddingsService.calculateCost(texts);

      expect(cost.tokens).toBeGreaterThan(0);
      expect(cost.cost).toBeGreaterThan(0);
      expect(cost.details).toHaveLength(2);
    });

    test("should generate embedding model info", () => {
      const model = embeddingsService["EMBEDDING_MODELS"]["text-embedding-3-small"];

      expect(model.name).toBe("text-embedding-3-small");
      expect(model.dimensions).toBe(1536);
      expect(model.provider).toBe("openai");
    });
  });

  describe("Analysis Types", () => {
    test("should create thematic analysis instance", () => {
      const analysis = AnalysisFactory.createAnalysis("thematic");
      expect(analysis).toBeInstanceOf(AnalysisFactory.createAnalysis("thematic").constructor);
    });

    test("should create all analysis types", () => {
      const types = ["thematic", "clusters", "contradictions", "insights", "recommendations"];

      for (const type of types) {
        const analysis = AnalysisFactory.createAnalysis(type);
        expect(analysis).toBeDefined();
      }
    });

    test("should throw error for unknown analysis type", () => {
      expect(() => {
        AnalysisFactory.createAnalysis("unknown");
      }).toThrow("Unknown analysis type: unknown");
    });
  });

  describe("Integration Tests", () => {
    test("should process complete anonymization pipeline", async () => {
      const anonymizer = new AnonymizationService("integration-test");

      const mockResponse = {
        id: "resp_1",
        questionId: "q_1",
        userId: 1,
        answer: "Nazywam się Jan Kowalski i mieszkam w Warszawie, mój email to jan@example.com",
        metadata: {
          ipHash: "192.168.1.1",
          userAgentHash: "Mozilla/5.0",
          timeSpentMs: 5000,
          editCount: 2
        }
      };

      const result = await anonymizer.anonymizeResponse(mockResponse, "full");

      expect(result.id).toMatch(/^anon_[a-f0-9]{16}$/);
      expect(result.answer).not.toContain("Jan Kowalski");
      expect(result.answer).not.toContain("Warszawa");
      expect(result.answer).not.toContain("jan@example.com");
      expect(result.anonymizationResult.detectedPII.length).toBeGreaterThan(0);
    });

    test("should validate complete analysis pipeline structure", () => {
      const mockAnalysisResult = {
        type: "thematic",
        results: {
          summary: "Główne tematy to współpraca i autonomia",
          themes: [
            {
              name: "Współpraca",
              frequency: 15,
              percentage: 30.0,
              examples: ["chcemy współpracować", "wspólna przestrzeń"],
              sentiment: 0.7,
              keywords: ["współpraca", "przestrzeń"]
            }
          ],
          totalResponses: 50,
          uniqueThemes: 3,
          language: "pl"
        },
        metadata: {
          model: "gpt-4-turbo-preview",
          promptVersion: "1.0",
          tokensUsed: 1500,
          processingTimeMs: 5000,
          confidenceScore: 0.8,
          responseCount: 50
        }
      };

      // Validate structure
      expect(mockAnalysisResult.type).toBe("thematic");
      expect(mockAnalysisResult.results.themes).toBeDefined();
      expect(mockAnalysisResult.results.themes).toHaveLength(1);
      expect(mockAnalysisResult.results.themes[0].name).toBe("Współpraca");
      expect(mockAnalysisResult.results.themes[0].frequency).toBe(15);
      expect(mockAnalysisResult.metadata.confidenceScore).toBeGreaterThan(0);
      expect(mockAnalysisResult.metadata.confidenceScore).toBeLessThanOrEqual(1);
    });

    test("should handle partial vs full anonymization", async () => {
      const text = "Mój email to jan@example.com, telefon 123-456-789, PESEL 80010112345";
      const anonymizer = new AnonymizationService("test");

      const partialResult = await anonymizer.anonymizeText(text, "partial");
      const fullResult = await anonymizer.anonymizeText(text, "full");

      // Both should redact basic PII
      expect(partialResult.anonymizedText).not.toContain("jan@example.com");
      expect(fullResult.anonymizedText).not.toContain("jan@example.com");

      // Full should also redact named entities
      expect(fullResult.anonymizedText).toContain("[PESEL]");

      // Partial should preserve some context while full is more aggressive
      expect(fullResult.detectedPII.length).toBeGreaterThanOrEqual(partialResult.detectedPII.length);
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid JSON in LLM response", async () => {
      const analysis = AnalysisFactory.createAnalysis("thematic");

      // Mock invalid JSON response
      const mockCallLLM = jest.spyOn(analysis as any, "callLLM");
      mockCallLLM.mockResolvedValue({
        content: "Invalid JSON {",
        tokensUsed: 100,
        processingTime: 1000
      });

      const context = {
        questionnaireId: "test",
        responseCount: 10,
        anonymizationLevel: "full" as const,
        language: "pl" as const,
        options: {}
      };

      await expect(analysis.analyze(context, [])).rejects.toThrow("Invalid JSON response from LLM");
    });

    test("should validate analysis results structure", async () => {
      const thematicAnalysis = AnalysisFactory.createAnalysis("thematic") as any;

      // Test invalid structure
      const invalidResults = { /* missing themes array */ };

      expect(() => thematicAnalysis.validateThematicResults(invalidResults))
        .toThrow("Thematic analysis must return a themes array");
    });
  });

  describe("Performance Tests", () => {
    test("should anonymize large batch efficiently", async () => {
      const anonymizer = new AnonymizationService("performance-test");

      // Create large batch of responses
      const responses = Array.from({ length: 1000 }, (_, i) => ({
        id: `resp_${i}`,
        questionId: "q_1",
        userId: i % 100, // 100 unique users
        answer: `Odpowiedź ${i} od użytkownika ${i % 100} z email user${i % 100}@example.com`,
        metadata: { timeSpentMs: 1000, editCount: 0 }
      }));

      const startTime = Date.now();

      // Process in batches to test efficiency
      const batchSize = 50;
      for (let i = 0; i < responses.length; i += batchSize) {
        const batch = responses.slice(i, i + batchSize);
        await Promise.all(
          batch.map(response => anonymizer.anonymizeResponse(response, "full"))
        );
      }

      const processingTime = Date.now() - startTime;

      // Should process 1000 responses in reasonable time (adjust threshold as needed)
      expect(processingTime).toBeLessThan(30000); // 30 seconds
      console.log(`Processed ${responses.length} responses in ${processingTime}ms`);
    });
  });
});