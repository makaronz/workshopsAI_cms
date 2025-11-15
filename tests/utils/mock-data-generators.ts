import { faker } from '@faker-js/faker';
import {
  users,
  questionnaires,
  questions,
  responses,
  analysisJobs,
  llmAnalyses
} from '../../src/models/llm-schema';

// Types for test data
export interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'moderator';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockQuestionnaire {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  isPublic: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockQuestion {
  id: string;
  questionnaireId: string;
  type: 'text' | 'multiple' | 'single' | 'rating' | 'boolean';
  text: string;
  required: boolean;
  order: number;
  options?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MockResponse {
  id: string;
  userId: string;
  questionnaireId: string;
  status: 'draft' | 'completed' | 'submitted';
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockAnalysisJob {
  id: string;
  questionnaireId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  analysisTypes: Array<'thematic' | 'clusters' | 'contradictions' | 'insights' | 'recommendations' | 'sentiment'>;
  triggeredBy: string;
  scheduledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockLLMAnalysis {
  id: string;
  jobId: string;
  analysisType: 'thematic' | 'clusters' | 'contradictions' | 'insights' | 'recommendations' | 'sentiment';
  status: 'pending' | 'running' | 'completed' | 'failed';
  result: any;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Mock data generators
export class MockDataGenerator {
  static generateUser(overrides: Partial<MockUser> = {}): MockUser {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      passwordHash: faker.string.alphanumeric(64),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: faker.helpers.arrayElement(['admin', 'user', 'moderator']),
      isActive: faker.datatype.boolean(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static generateQuestionnaire(createdBy: string, overrides: Partial<MockQuestionnaire> = {}): MockQuestionnaire {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      createdBy,
      isPublic: faker.datatype.boolean(),
      isArchived: false,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static generateQuestion(questionnaireId: string, overrides: Partial<MockQuestion> = {}): MockQuestion {
    const type = faker.helpers.arrayElement(['text', 'multiple', 'single', 'rating', 'boolean']);
    const hasOptions = ['multiple', 'single'].includes(type);

    return {
      id: faker.string.uuid(),
      questionnaireId,
      type,
      text: faker.lorem.sentence(),
      required: faker.datatype.boolean(),
      order: faker.number.int({ min: 1, max: 10 }),
      ...(hasOptions && {
        options: faker.helpers.arrayElements(['Option A', 'Option B', 'Option C', 'Option D'], { min: 2, max: 4 }),
      }),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static generateResponse(userId: string, questionnaireId: string, overrides: Partial<MockResponse> = {}): MockResponse {
    const status = faker.helpers.arrayElement(['draft', 'completed', 'submitted']);

    return {
      id: faker.string.uuid(),
      userId,
      questionnaireId,
      status,
      ...(status !== 'draft' && { submittedAt: faker.date.recent() }),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static generateAnalysisJob(questionnaireId: string, triggeredBy: string, overrides: Partial<MockAnalysisJob> = {}): MockAnalysisJob {
    const analysisTypes = faker.helpers.arrayElements(
      ['thematic', 'clusters', 'contradictions', 'insights', 'recommendations', 'sentiment'],
      { min: 1, max: 3 }
    );

    return {
      id: faker.string.uuid(),
      questionnaireId,
      status: faker.helpers.arrayElement(['pending', 'running', 'completed', 'failed']),
      analysisTypes,
      triggeredBy,
      ...(faker.datatype.boolean() && { scheduledAt: faker.date.future() }),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static generateLLMAnalysis(jobId: string, overrides: Partial<MockLLMAnalysis> = {}): MockLLMAnalysis {
    const analysisType = faker.helpers.arrayElement(['thematic', 'clusters', 'contradictions', 'insights', 'recommendations', 'sentiment']);
    const status = faker.helpers.arrayElement(['pending', 'running', 'completed', 'failed']);

    let result: any = {};
    let errorMessage: string | undefined;

    if (status === 'completed') {
      switch (analysisType) {
        case 'thematic':
          result = {
            themes: faker.helpers.arrayElements(['Theme A', 'Theme B', 'Theme C'], { min: 2, max: 5 }).map(theme => ({
              name: theme,
              frequency: faker.number.int({ min: 1, max: 10 }),
              examples: faker.helpers.arrayElements(['Example 1', 'Example 2', 'Example 3'], { min: 1, max: 3 }),
            })),
            insights: faker.lorem.sentences(3),
          };
          break;
        case 'clusters':
          result = {
            clusters: faker.helpers.arrayElements(['Cluster A', 'Cluster B', 'Cluster C'], { min: 2, max: 4 }).map(cluster => ({
              name: cluster,
              size: faker.number.int({ min: 2, max: 8 }),
              centroid: faker.lorem.sentence(),
              responses: faker.helpers.arrayElements(['Response 1', 'Response 2', 'Response 3'], { min: 1, max: 3 }),
            })),
          };
          break;
        case 'sentiment':
          result = {
            overall: faker.helpers.arrayElement(['positive', 'negative', 'neutral']),
            distribution: {
              positive: faker.number.int({ min: 0, max: 100 }),
              negative: faker.number.int({ min: 0, max: 100 }),
              neutral: faker.number.int({ min: 0, max: 100 }),
            },
            insights: faker.lorem.sentences(2),
          };
          break;
        default:
          result = { analysis: faker.lorem.paragraph() };
      }
    } else if (status === 'failed') {
      errorMessage = faker.lorem.sentence();
    }

    return {
      id: faker.string.uuid(),
      jobId,
      analysisType,
      status,
      result,
      errorMessage,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  // Batch generators
  static generateUsers(count: number, overrides: Partial<MockUser> = {}): MockUser[] {
    return Array.from({ length: count }, () => this.generateUser(overrides));
  }

  static generateQuestionnaires(count: number, createdBy: string, overrides: Partial<MockQuestionnaire> = {}): MockQuestionnaire[] {
    return Array.from({ length: count }, () => this.generateQuestionnaire(createdBy, overrides));
  }

  static generateQuestions(count: number, questionnaireId: string, overrides: Partial<MockQuestion> = {}): MockQuestion[] {
    return Array.from({ length: count }, (_, index) =>
      this.generateQuestion(questionnaireId, { ...overrides, order: index + 1 })
    );
  }

  static generateResponses(count: number, userId: string, questionnaireId: string, overrides: Partial<MockResponse> = {}): MockResponse[] {
    return Array.from({ length: count }, () => this.generateResponse(userId, questionnaireId, overrides));
  }

  static generateAnalysisJobs(count: number, questionnaireId: string, triggeredBy: string, overrides: Partial<MockAnalysisJob> = {}): MockAnalysisJob[] {
    return Array.from({ length: count }, () => this.generateAnalysisJob(questionnaireId, triggeredBy, overrides));
  }

  static generateLLMAnalyses(count: number, jobId: string, overrides: Partial<MockLLMAnalysis> = {}): MockLLMAnalysis[] {
    return Array.from({ length: count }, () => this.generateLLMAnalysis(jobId, overrides));
  }

  // Complete dataset generator
  static generateCompleteDataset(overrides: {
    userCount?: number;
    questionnaireCount?: number;
    questionsPerQuestionnaire?: number;
    responsesPerQuestionnaire?: number;
    analysisJobsPerQuestionnaire?: number;
    analysesPerJob?: number;
  } = {}) {
    const {
      userCount = 3,
      questionnaireCount = 2,
      questionsPerQuestionnaire = 5,
      responsesPerQuestionnaire = 10,
      analysisJobsPerQuestionnaire = 2,
      analysesPerJob = 3,
    } = overrides;

    const users = this.generateUsers(userCount);
    const datasets: any[] = [];

    users.forEach(user => {
      const questionnaires = this.generateQuestionnaires(questionnaireCount, user.id);

      questionnaires.forEach(questionnaire => {
        const questions = this.generateQuestions(questionsPerQuestionnaire, questionnaire.id);
        const responses = this.generateResponses(responsesPerQuestionnaire, user.id, questionnaire.id);
        const analysisJobs = this.generateAnalysisJobs(analysisJobsPerQuestionnaire, questionnaire.id, user.id);

        const analyses = analysisJobs.flatMap(job =>
          this.generateLLMAnalyses(analysesPerJob, job.id)
        );

        datasets.push({
          user,
          questionnaire,
          questions,
          responses,
          analysisJobs,
          analyses,
        });
      });
    });

    return {
      users,
      datasets,
      totalUsers: users.length,
      totalQuestionnaires: questionnaires.length * userCount,
      totalQuestions: questionsPerQuestionnaire * questionnaireCount * userCount,
      totalResponses: responsesPerQuestionnaire * questionnaireCount * userCount,
      totalAnalysisJobs: analysisJobsPerQuestionnaire * questionnaireCount * userCount,
      totalAnalyses: analysesPerJob * analysisJobsPerQuestionnaire * questionnaireCount * userCount,
    };
  }
}

// Performance testing data generators
export class PerformanceDataGenerator {
  static generateLargeDataset(questionnaireCount = 100, responsesPerQuestionnaire = 50) {
    const startTime = process.hrtime.bigint();

    const result = MockDataGenerator.generateCompleteDataset({
      userCount: 10,
      questionnaireCount,
      questionsPerQuestionnaire: 10,
      responsesPerQuestionnaire,
      analysisJobsPerQuestionnaire: 3,
      analysesPerJob: 4,
    });

    const endTime = process.hrtime.bigint();
    const generationTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    return {
      ...result,
      generationTime,
      dataSize: {
        totalResponses: result.totalResponses,
        totalAnalyses: result.totalAnalyses,
        estimatedSizeMB: Math.round((JSON.stringify(result).length / 1024 / 1024) * 100) / 100,
      },
    };
  }

  static generateConcurrentTestData(concurrency = 50, operationsPerWorker = 10) {
    return Array.from({ length: concurrency }, (_, workerIndex) => ({
      workerId: workerIndex,
      operations: Array.from({ length: operationsPerWorker }, (_, opIndex) => ({
        operationId: `${workerIndex}-${opIndex}`,
        data: MockDataGenerator.generateCompleteDataset({
          questionnaireCount: 1,
          questionsPerQuestionnaire: 3,
          responsesPerQuestionnaire: 5,
        }),
      })),
    }));
  }
}