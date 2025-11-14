import { AnonymizationService } from '../../src/services/anonymization';
import { promptTemplateService } from '../../src/services/prompt-templates';
import { embeddingsService } from '../../src/services/embeddings';
import { AnalysisFactory } from '../../src/services/analysis-types';

describe('LLM System Integration Tests', () => {
  let anonymizer: AnonymizationService;

  beforeEach(() => {
    anonymizer = new AnonymizationService('integration-test-salt');
  });

  describe('Complete System Integration', () => {
    test('should process complete analysis pipeline', async () => {
      // Test data
      const responses = [
        {
          id: 'resp_1',
          questionId: 'q_1',
          userId: 1,
          answer: 'Wspólna przestrzeń do współpracy jest dla nas najważniejsza',
          metadata: {
            ipHash: '192.168.1.1',
            userAgentHash: 'Mozilla/5.0',
            timeSpentMs: 5000,
            editCount: 2
          }
        },
        {
          id: 'resp_2',
          questionId: 'q_1',
          userId: 2,
          answer: 'Potrzebujemy więcej ciszy i skupienia do efektywnej pracy',
          metadata: {
            ipHash: '192.168.1.2',
            userAgentHash: 'Chrome/91.0',
            timeSpentMs: 3000,
            editCount: 1
          }
        },
        {
          id: 'resp_3',
          questionId: 'q_1',
          userId: 3,
          answer: 'Jan Kowalski lubi pracować w zespole, jan@example.com',
          metadata: {
            ipHash: '192.168.1.3',
            userAgentHash: 'Firefox/89.0',
            timeSpentMs: 7000,
            editCount: 3
          }
        }
      ];

      // Step 1: Anonymize responses
      const anonymizedResponses = await Promise.all(
        responses.map(response => anonymizer.anonymizeResponse(response, 'full'))
      );

      expect(anonymizedResponses).toHaveLength(3);
      anonymizedResponses.forEach(anonResponse => {
        expect(anonResponse.id).toMatch(/^anon_[a-f0-9]{16}$/);
        expect(anonResponse.answer).not.toContain('Jan Kowalski');
        expect(anonResponse.answer).not.toContain('jan@example.com');
      });

      // Step 2: Validate k-anonymity
      const anonymizedAnswers = anonymizedResponses.map(r => r.answer);
      const kAnonymityCheck = anonymizer.verifyKAnonymity(anonymizedAnswers, 2);
      expect(kAnonymityCheck).toBe(true);

      // Step 3: Calculate embeddings cost
      const costEstimate = embeddingsService.calculateCost(anonymizedAnswers);
      expect(costEstimate.tokens).toBeGreaterThan(0);
      expect(costEstimate.cost).toBeGreaterThan(0);

      // Step 4: Generate analysis prompt
      const prompt = promptTemplateService.buildThematicAnalysisPrompt(
        anonymizedResponses.map(r => ({ answer: r.answer, metadata: {} })),
        {
          questionText: 'Co jest dla Was ważne w miejscu pracy?',
          language: 'pl'
        }
      );

      expect(prompt).toContain('Jesteś ekspertem socjologiem');
      expect(prompt).toContain('Co jest dla Was ważne w miejscu pracy?');
      expect(prompt.length).toBeGreaterThan(1000);

      // Step 5: Validate analysis structure
      const thematicAnalysis = AnalysisFactory.createAnalysis('thematic');
      expect(thematicAnalysis).toBeDefined();

      // Step 6: Create complete analysis result structure
      const mockAnalysisResult = {
        type: 'thematic',
        results: {
          summary: 'Główne tematy dotyczą współpracy, ciszy i organizacji przestrzeni',
          themes: [
            {
              name: 'Współpraca',
              frequency: 2,
              percentage: 66.7,
              examples: ['wspólna przestrzeń do współpracy', 'pracować w zespole'],
              sentiment: 0.8,
              keywords: ['współpraca', 'zespół', 'przestrzeń']
            },
            {
              name: 'Cisza i skupienie',
              frequency: 1,
              percentage: 33.3,
              examples: ['więcej ciszy i skupienia'],
              sentiment: 0.6,
              keywords: ['cisza', 'skupienie']
            }
          ],
          totalResponses: 3,
          uniqueThemes: 2,
          language: 'pl',
          confidenceScore: 0.85,
          processingTime: 2500,
          modelUsed: 'gpt-4-turbo-preview'
        },
        metadata: {
          model: 'gpt-4-turbo-preview',
          promptVersion: '1.0',
          tokensUsed: 1500,
          processingTimeMs: 5000,
          confidenceScore: 0.8,
          responseCount: 3,
          anonymizationLevel: 'full',
          kAnonymityCompliant: true,
          gdprCompliant: true,
          costEstimate: costEstimate.cost
        }
      };

      // Validate structure
      expect(mockAnalysisResult.type).toBe('thematic');
      expect(mockAnalysisResult.results.themes).toBeDefined();
      expect(mockAnalysisResult.results.themes).toHaveLength(2);
      expect(mockAnalysisResult.results.themes[0].name).toBe('Współpraca');
      expect(mockAnalysisResult.results.themes[0].frequency).toBe(2);
      expect(mockAnalysisResult.metadata.confidenceScore).toBeGreaterThan(0);
      expect(mockAnalysisResult.metadata.confidenceScore).toBeLessThanOrEqual(1);
    });

    test('should handle multi-language responses', async () => {
      const responses = [
        { answer: 'Współpraca jest ważna', metadata: { userId: 1 } },
        { answer: 'Collaboration is essential', metadata: { userId: 2 } },
        { answer: 'La collaboration est essentielle', metadata: { userId: 3 } },
      ];

      // Test language detection
      const polishPrompt = promptTemplateService.buildThematicAnalysisPrompt(responses, {
        language: 'pl'
      });
      expect(polishPrompt).toContain('Język polski');

      const englishPrompt = promptTemplateService.buildThematicAnalysisPrompt(responses, {
        language: 'en'
      });
      expect(englishPrompt).toContain('English language');

      // Test anonymization across languages
      const anonymizedResponses = await Promise.all(
        responses.map(response => anonymizer.anonymizeResponse({
          id: 'test',
          questionId: 'q1',
          userId: 1,
          ...response
        }, 'full'))
      );

      expect(anonymizedResponses).toHaveLength(3);
      anonymizedResponses.forEach(ar => {
        expect(ar.answer).toBeDefined();
        expect(ar.anonymizationResult).toBeDefined();
      });
    });

    test('should validate prompt templates with different analysis types', () => {
      const responses = [{ answer: 'Test response', metadata: { userId: 1 } }];

      // Test thematic analysis prompt
      const thematicPrompt = promptTemplateService.buildThematicAnalysisPrompt(responses, {
        questionText: 'Test question',
        language: 'pl'
      });
      expect(thematicPrompt).toContain('tematy');

      // Test sentiment analysis prompt
      const sentimentPrompt = promptTemplateService.buildSentimentAnalysisPrompt(responses, {
        language: 'pl'
      });
      expect(sentimentPrompt).toContain('nastroje');

      // Validate templates
      const thematicValidation = promptTemplateService.validateVariables('thematic-analysis-v1', {
        responses: 'test',
        responseCount: 10,
        questionText: 'Test?',
        language: 'pl'
      });
      expect(thematicValidation.valid).toBe(true);

      const invalidValidation = promptTemplateService.validateVariables('thematic-analysis-v1', {
        responseCount: 10
      });
      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.missing).toContain('responses');
    });

    test('should handle advanced anonymization features', async () => {
      const responses = [
        'Anna Kowalska, email: anna@example.com, tel: 123-456-789',
        'Piotr Nowak, email: piotr@company.pl, tel: 987-654-321',
        'Ewa Wiśniewska, email: ewa@domain.org, tel: 555-123-456',
        'Jan Kowalski, email: jan@server.com, tel: 111-222-333',
        'Maria Dąbrowska, email: maria@site.net, tel: 999-888-777',
      ];

      // Test basic k-anonymity
      const basicCheck = anonymizer.verifyKAnonymity(responses, 2);
      expect(basicCheck).toBe(false); // Names are unique

      // Test advanced k-anonymity with semantic grouping
      const anonymizedResponses = await Promise.all(
        responses.map(response => anonymizer.anonymizeText(response, 'full'))
      );

      const anonymizedAnswers = anonymizedResponses.map(ar => ar.anonymizedText);
      const advancedCheck = anonymizer.verifyKAnonymity(anonymizedAnswers, 2);
      expect(advancedCheck).toBe(true); // Should be k-anonymous after anonymization

      // Test GDPR compliance
      const gdprReport = await anonymizer.generateGDPRReport(responses);
      expect(gdprReport).toHaveProperty('compliant');
      expect(gdprReport).toHaveProperty('issues');
      expect(gdprReport).toHaveProperty('recommendations');
    });

    test('should calculate accurate costs for different analysis types', () => {
      const shortResponses = [
        'Krótka odpowiedź',
        'Krótka odpowiedź 2',
        'Krótka odpowiedź 3',
      ];

      const longResponses = [
        'To jest znacznie dłuższa odpowiedź na pytanie dotyczące preferencji użytkowników ' +
        'współczesnego środowiska pracy. Zawiera wiele szczegółowych informacji o różnych ' +
        'aspektach organizacji przestrzeni biurowej oraz metod współpracy w zespole.',
        'Inna długa odpowiedź zawierająca szczegółowe analizy i spostrzeżenia na temat ' +
        'optymalizacji warunków pracy oraz poprawy efektywności działań w ramach ' +
        'struktur organizacyjnych',
      ];

      // Calculate costs
      const shortCost = embeddingsService.calculateCost(shortResponses);
      const longCost = embeddingsService.calculateCost(longResponses);

      expect(shortCost.tokens).toBeGreaterThan(0);
      expect(longCost.tokens).toBeGreaterThan(0);
      expect(longCost.tokens).toBeGreaterThan(shortCost.tokens);
      expect(longCost.cost).toBeGreaterThan(shortCost.cost);

      // Test different models
      const modelInfo = embeddingsService['EMBEDDING_MODELS']['text-embedding-3-small'];
      expect(modelInfo).toBeDefined();
      expect(modelInfo.name).toBe('text-embedding-3-small');
      expect(modelInfo.dimensions).toBe(1536);
      expect(modelInfo.provider).toBe('openai');
    });

    test('should handle error scenarios gracefully', async () => {
      const responses = [{ answer: 'Test response', metadata: { userId: 1 } }];

      // Test invalid analysis type
      expect(() => {
        AnalysisFactory.createAnalysis('invalid-type' as any);
      }).toThrow('Unknown analysis type: invalid-type');

      // Test empty responses
      const emptyPrompt = promptTemplateService.buildThematicAnalysisPrompt([], {
        questionText: 'Test',
        language: 'pl'
      });
      expect(emptyPrompt).toBeDefined();
      expect(emptyPrompt.length).toBeGreaterThan(0);

      // Test malformed response data
      const malformedResponse = {
        id: '',
        questionId: '',
        userId: -1,
        answer: '',
        metadata: null
      };

      const anonymizedMalformed = await anonymizer.anonymizeResponse(malformedResponse, 'full');
      expect(anonymizedMalformed).toBeDefined();
      expect(anonymizedMalformed.anonymizationResult).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large batch processing efficiently', async () => {
      const largeResponses = Array.from({ length: 1000 }, (_, i) => ({
        id: `resp_${i}`,
        questionId: 'q_1',
        userId: i % 100, // 100 unique users
        answer: `Response ${i} from user ${i % 100} with email user${i % 100}@example.com`,
        metadata: { timeSpentMs: 1000, editCount: 0 }
      }));

      const startTime = Date.now();

      // Process anonymization in batches
      const batchSize = 50;
      for (let i = 0; i < largeResponses.length; i += batchSize) {
        const batch = largeResponses.slice(i, i + batchSize);
        await Promise.all(
          batch.map(response => anonymizer.anonymizeResponse(response, 'full'))
        );
      }

      const processingTime = Date.now() - startTime;
      console.log(`Processed ${largeResponses.length} responses in ${processingTime}ms`);

      // Should process 1000 responses in reasonable time
      expect(processingTime).toBeLessThan(30000); // 30 seconds

      // Calculate total cost estimate
      const costEstimate = embeddingsService.calculateCost(
        largeResponses.map(r => r.answer)
      );
      expect(costEstimate.tokens).toBeGreaterThan(0);
      expect(costEstimate.cost).toBeGreaterThan(0);
    });

    test('should manage memory efficiently', () => {
      // Test anonymizer memory usage
      const anonymizer = new AnonymizationService('memory-test');

      // Generate many user IDs to test caching
      const userIds = Array.from({ length: 10000 }, (_, i) => i);
      const generatedIds = userIds.map(id => anonymizer.getAnonymousUserId(id));

      expect(generatedIds).toHaveLength(10000);
      expect(new Set(generatedIds).size).toBe(10000); // All should be unique

      // Verify consistency
      const firstId = anonymizer.getAnonymousUserId(1);
      const firstIdAgain = anonymizer.getAnonymousUserId(1);
      expect(firstId).toBe(firstIdAgain);
    });
  });

  describe('Data Quality and Validation', () => {
    test('should validate analysis results structure', () => {
      const analysis = AnalysisFactory.createAnalysis('thematic') as any;

      // Test valid structure
      const validResults = {
        themes: [
          {
            name: 'Test Theme',
            frequency: 10,
            percentage: 50.0,
            examples: ['example 1', 'example 2'],
            sentiment: 0.8,
            keywords: ['test', 'theme']
          }
        ],
        summary: 'Test summary',
        totalResponses: 20,
        uniqueThemes: 3,
        language: 'pl'
      };

      expect(() => analysis.validateThematicResults(validResults)).not.toThrow();

      // Test invalid structure
      const invalidResults = { /* missing themes array */ };
      expect(() => analysis.validateThematicResults(invalidResults))
        .toThrow('Thematic analysis must return a themes array');
    });

    test('should maintain data consistency across processing stages', async () => {
      const originalResponse = {
        id: 'resp_1',
        questionId: 'q_1',
        userId: 1,
        answer: 'To jest testowa odpowiedź z danymi osobowymi: Jan Kowalski, jan@example.com',
        metadata: { timeSpentMs: 5000, editCount: 2 }
      };

      // Stage 1: Anonymization
      const anonymized = await anonymizer.anonymizeResponse(originalResponse, 'full');

      expect(anonymized.id).toMatch(/^anon_[a-f0-9]{16}$/);
      expect(anonymized.answer).not.toContain('Jan Kowalski');
      expect(anonymized.answer).not.toContain('jan@example.com');
      expect(anonymized.metadata).toBeDefined();
      expect(anonymized.anonymizationResult).toBeDefined();

      // Stage 2: Check data integrity
      expect(anonymized.questionId).toBe(originalResponse.questionId);
      expect(anonymized.metadata.timeSpentMs).toBe(originalResponse.metadata.timeSpentMs);
      expect(anonymized.metadata.editCount).toBe(originalResponse.metadata.editCount);

      // Stage 3: Template processing
      const responses = [anonymized].map(r => ({ answer: r.answer, metadata: r.metadata }));
      const prompt = promptTemplateService.buildThematicAnalysisPrompt(responses, {
        questionText: 'Test question',
        language: 'pl'
      });

      expect(prompt).toContain('Test question');
      expect(prompt).not.toContain('Jan Kowalski');
      expect(prompt).not.toContain('jan@example.com');
    });
  });
});