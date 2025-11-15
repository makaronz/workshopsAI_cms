/**
 * Enhanced Test Data Factory
 *
 * Provides comprehensive test data generation with:
 * - Realistic data using Faker.js
 * - Relationship management between entities
 * - Version-controlled test data sets
 * - Performance-optimized data generation
 * - Data validation and constraints
 */

import { faker } from '@faker-js/faker';
import {
  User,
  Workshop,
  Questionnaire,
  Question,
  Response,
  AnalysisJob,
  LLMAnalysis,
  WorkshopEnrollment
} from '../../src/types';

export class EnhancedTestDataFactory {
  private static readonly DATA_VERSIONS = {
    V1: '1.0.0',
    V2: '2.0.0',
    CURRENT: '2.1.0'
  };

  private static readonly PERFORMANCE_SETTINGS = {
    BATCH_SIZE: 100,
    MAX_RELATIONSHIP_DEPTH: 3,
    CACHE_SIZE: 1000
  };

  // Cache for generated data to improve performance
  private static cache = new Map<string, any>();

  /**
   * Generate a complete workshop ecosystem with all related entities
   */
  static generateCompleteWorkshopEcosystem(options: {
    userCount?: number;
    workshopCount?: number;
    questionnairesPerWorkshop?: number;
    questionsPerQuestionnaire?: number;
    responsesPerQuestionnaire?: number;
    analysesPerQuestionnaire?: number;
    version?: string;
  } = {}): WorkshopEcosystem {
    const {
      userCount = 10,
      workshopCount = 5,
      questionnairesPerWorkshop = 2,
      questionsPerQuestionnaire = 10,
      responsesPerQuestionnaire = 25,
      analysesPerQuestionnaire = 3,
      version = this.DATA_VERSIONS.CURRENT
    } = options;

    const cacheKey = `ecosystem-${JSON.stringify(options)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    console.log(`🏭 Generating workshop ecosystem with ${userCount} users, ${workshopCount} workshops...`);

    const startTime = Date.now();
    const ecosystem: WorkshopEcosystem = {
      version,
      users: [],
      workshops: [],
      questionnaires: [],
      questions: [],
      responses: [],
      analyses: [],
      enrollments: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        generationTime: 0,
        entityCounts: {
          users: userCount,
          workshops: workshopCount,
          questionnaires: workshopCount * questionnairesPerWorkshop,
          questions: workshopCount * questionnairesPerWorkshop * questionsPerQuestionnaire,
          responses: workshopCount * questionnairesPerWorkshop * responsesPerQuestionnaire,
          analyses: workshopCount * questionnairesPerWorkshop * analysesPerQuestionnaire
        }
      }
    };

    // Generate users
    ecosystem.users = this.generateUsers(userCount, {
      includeAdmins: true,
      includeInactive: true,
      diversity: true
    });

    // Generate workshops
    ecosystem.workshops = this.generateWorkshops(workshopCount, ecosystem.users);

    // Generate questionnaires for workshops
    for (const workshop of ecosystem.workshops) {
      const workshopQuestionnaires = this.generateQuestionnaires(
        questionnairesPerWorkshop,
        workshop.createdBy
      );
      ecosystem.questionnaires.push(...workshopQuestionnaires);

      // Generate questions for questionnaires
      for (const questionnaire of workshopQuestionnaires) {
        const questionnaireQuestions = this.generateQuestions(
          questionsPerQuestionnaire,
          questionnaire.id
        );
        ecosystem.questions.push(...questionnaireQuestions);

        // Generate responses for questionnaires
        const responseUsers = this.selectRandomUsers(
          ecosystem.users,
          responsesPerQuestionnaire
        );

        for (const user of responseUsers) {
          const response = this.generateResponse(user.id, questionnaire.id, questionnaireQuestions);
          ecosystem.responses.push(response);

          // Generate enrollments
          if (!ecosystem.enrollments.find(e => e.userId === user.id && e.workshopId === workshop.id)) {
            ecosystem.enrollments.push(
              this.generateEnrollment(user.id, workshop.id)
            );
          }
        }

        // Generate analyses for questionnaires
        for (let i = 0; i < analysesPerQuestionnaire; i++) {
          const analysis = this.generateAnalysis(questionnaire.id);
          ecosystem.analyses.push(analysis);
        }
      }
    }

    ecosystem.metadata.generationTime = Date.now() - startTime;
    console.log(`✅ Generated ecosystem in ${ecosystem.metadata.generationTime}ms`);

    // Cache the result
    this.cache.set(cacheKey, ecosystem);
    return ecosystem;
  }

  /**
   * Generate users with realistic data and varied roles
   */
  static generateUsers(count: number, options: {
    includeAdmins?: boolean;
    includeInactive?: boolean;
    diversity?: boolean;
  } = {}): User[] {
    const { includeAdmins = false, includeInactive = false, diversity = false } = options;
    const users: User[] = [];

    for (let i = 0; i < count; i++) {
      const user: User = {
        id: faker.datatype.uuid(),
        email: diversity
          ? this.generateDiverseEmail(i)
          : faker.internet.email(),
        username: faker.internet.userName(),
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        role: this.assignUserRole(includeAdmins, i, count),
        isActive: includeInactive ? faker.datatype.boolean() : true,
        profile: {
          bio: faker.lorem.paragraph(),
          avatar: faker.internet.avatar(),
          location: faker.address.city(),
          website: faker.internet.url(),
          phone: faker.phone.number(),
          socialLinks: {
            linkedin: faker.internet.url(),
            twitter: faker.internet.url(),
            github: faker.internet.url()
          }
        },
        preferences: {
          language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de']),
          timezone: faker.address.timeZone(),
          notifications: {
            email: faker.datatype.boolean(),
            push: faker.datatype.boolean(),
            sms: faker.datatype.boolean()
          },
          theme: faker.helpers.arrayElement(['light', 'dark', 'auto'])
        },
        security: {
          lastLogin: faker.date.recent(),
          loginAttempts: faker.datatype.number({ min: 0, max: 5 }),
          passwordChangedAt: faker.date.past(),
          twoFactorEnabled: faker.datatype.boolean(),
          mfaMethod: faker.helpers.arrayElement(['totp', 'sms', 'email', null])
        },
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent()
      };

      users.push(user);
    }

    return users;
  }

  /**
   * Generate workshops with realistic data and varied statuses
   */
  static generateWorkshops(count: number, users: User[]): Workshop[] {
    const workshops: Workshop[] = [];

    for (let i = 0; i < count; i++) {
      const creator = faker.helpers.arrayElement(users);
      const startDate = faker.date.future();
      const endDate = new Date(startDate.getTime() + faker.datatype.number({ min: 3600000, max: 86400000 })); // 1-24 hours later

      const workshop: Workshop = {
        id: faker.datatype.uuid(),
        title: this.generateWorkshopTitle(),
        description: faker.lorem.paragraphs(2),
        shortDescription: faker.lorem.sentences(2),
        createdBy: creator.id,
        instructor: {
          id: creator.id,
          name: `${creator.firstName} ${creator.lastName}`,
          bio: faker.lorem.paragraph(),
          avatar: creator.profile?.avatar,
          expertise: faker.helpers.arrayElements([
            'JavaScript', 'React', 'Node.js', 'Python', 'AI/ML',
            'Web Development', 'Mobile Development', 'DevOps'
          ], faker.datatype.number({ min: 2, max: 4 }))
        },
        category: faker.helpers.arrayElement([
          'Programming', 'Design', 'Business', 'Marketing',
          'Data Science', 'AI/ML', 'DevOps', 'Security'
        ]),
        level: faker.helpers.arrayElement(['beginner', 'intermediate', 'advanced']),
        format: faker.helpers.arrayElement(['online', 'in-person', 'hybrid']),
        capacity: faker.datatype.number({ min: 10, max: 100 }),
        currentEnrollment: 0,
        waitlist: 0,
        schedule: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          duration: faker.datatype.number({ min: 60, max: 480 }), // 1-8 hours
          timezone: faker.address.timeZone(),
          sessions: this.generateSessions(startDate, endDate)
        },
        location: {
          type: faker.helpers.arrayElement(['online', 'physical']),
          address: faker.address.streetAddress(),
          city: faker.address.city(),
          country: faker.address.country(),
          meetingUrl: faker.internet.url(),
          meetingRoom: faker.datatype.boolean() ? faker.lorem.words(2) : null
        },
        pricing: {
          type: faker.helpers.arrayElement(['free', 'paid', 'subscription']),
          amount: faker.datatype.boolean() ? faker.datatype.number({ min: 50, max: 1000 }) : 0,
          currency: 'USD',
          earlyBirdPrice: faker.datatype.boolean() ? faker.datatype.number({ min: 25, max: 500 }) : null,
          discounts: this.generateDiscounts()
        },
        requirements: {
          prerequisites: faker.helpers.arrayElements([
            'Basic programming knowledge', 'Computer with internet',
            'Web browser', 'Development environment setup'
          ], faker.datatype.number({ min: 1, max: 3 })),
          materials: ['Laptop', 'Notebook', 'Internet connection'],
          software: ['VS Code', 'Git', 'Modern web browser']
        },
        learningObjectives: this.generateLearningObjectives(),
        agenda: this.generateAgenda(),
        resources: this.generateResources(),
        status: faker.helpers.arrayElement(['draft', 'published', 'cancelled', 'completed']),
        tags: faker.helpers.arrayElements([
          'JavaScript', 'React', 'Node.js', 'Python', 'AI', 'Web Dev',
          'Frontend', 'Backend', 'Full Stack', 'Beginner', 'Advanced'
        ], faker.datatype.number({ min: 3, max: 6 })),
        ratings: {
          average: faker.datatype.number({ min: 3, max: 5, precision: 0.1 }),
          count: faker.datatype.number({ min: 0, max: 100 })
        },
        images: this.generateWorkshopImages(),
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent()
      };

      workshops.push(workshop);
    }

    return workshops;
  }

  /**
   * Generate questionnaires with various question types
   */
  static generateQuestionnaires(count: number, createdBy: string): Questionnaire[] {
    const questionnaires: Questionnaire[] = [];

    for (let i = 0; i < count; i++) {
      const questionnaire: Questionnaire = {
        id: faker.datatype.uuid(),
        title: this.generateQuestionnaireTitle(),
        description: faker.lorem.paragraph(),
        instructions: faker.lorem.sentences(3),
        createdBy,
        category: faker.helpers.arrayElement([
          'feedback', 'survey', 'assessment', 'evaluation', 'research'
        ]),
        type: faker.helpers.arrayElement(['workshop', 'course', 'general', 'specific']),
        isPublic: faker.datatype.boolean(),
        isAnonymous: faker.datatype.boolean(),
        allowMultipleSubmissions: faker.datatype.boolean(),
        requireAuthentication: faker.datatype.boolean(),
        status: faker.helpers.arrayElement(['draft', 'active', 'closed', 'archived']),
        settings: {
          showProgress: faker.datatype.boolean(),
          allowBackNavigation: faker.datatype.boolean(),
          randomizeQuestions: faker.datatype.boolean(),
          timeLimit: faker.datatype.boolean() ? faker.datatype.number({ min: 300, max: 3600 }) : null,
          maxAttempts: faker.datatype.number({ min: 1, max: 5 }),
          passScore: faker.datatype.boolean() ? faker.datatype.number({ min: 60, max: 100 }) : null
        },
        metadata: {
          version: faker.system.semver(),
          language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de']),
          estimatedTime: faker.datatype.number({ min: 5, max: 60 }),
          difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard'])
        },
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent()
      };

      questionnaires.push(questionnaire);
    }

    return questionnaires;
  }

  /**
   * Generate questions with various types and validation rules
   */
  static generateQuestions(count: number, questionnaireId: string): Question[] {
    const questions: Question[] = [];
    const questionTypes = [
      'text', 'textarea', 'multiple-choice', 'checkbox',
      'rating', 'scale', 'date', 'time', 'email', 'url', 'file'
    ];

    for (let i = 0; i < count; i++) {
      const type = faker.helpers.arrayElement(questionTypes);
      const question: Question = {
        id: faker.datatype.uuid(),
        questionnaireId,
        type,
        text: this.generateQuestionText(type),
        description: faker.datatype.boolean() ? faker.lorem.sentences(2) : null,
        required: faker.datatype.boolean(),
        order: i + 1,
        validation: this.generateValidationRules(type),
        options: type.includes('choice') || type === 'checkbox' ? this.generateOptions() : null,
        conditional: faker.datatype.boolean() ? this.generateConditionalLogic() : null,
        metadata: {
          category: faker.helpers.arrayElement(['personal', 'technical', 'feedback', 'evaluation']),
          tags: faker.helpers.arrayElements(['important', 'optional', 'research', 'feedback'], 2),
          analytics: {
            responseCount: 0,
            averageTime: faker.datatype.number({ min: 10, max: 300 }),
            skipRate: faker.datatype.number({ min: 0, max: 100, precision: 0.1 })
          }
        },
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent()
      };

      questions.push(question);
    }

    return questions;
  }

  /**
   * Generate realistic responses based on question types
   */
  static generateResponse(userId: string, questionnaireId: string, questions: Question[]): Response {
    const answers: any[] = [];

    for (const question of questions) {
      let answer;

      switch (question.type) {
        case 'text':
        case 'textarea':
          answer = faker.lorem.paragraph();
          break;
        case 'multiple-choice':
          answer = faker.helpers.arrayElement(question.options || [])?.value;
          break;
        case 'checkbox':
          answer = faker.helpers.arrayElements(question.options || [], faker.datatype.number({ min: 1, max: 3 }))
            .map(opt => opt.value);
          break;
        case 'rating':
          answer = faker.datatype.number({ min: 1, max: 5 });
          break;
        case 'scale':
          answer = faker.datatype.number({ min: 1, max: 10 });
          break;
        case 'date':
          answer = faker.date.past().toISOString().split('T')[0];
          break;
        case 'time':
          answer = faker.date.recent().toTimeString().slice(0, 5);
          break;
        case 'email':
          answer = faker.internet.email();
          break;
        case 'url':
          answer = faker.internet.url();
          break;
        case 'file':
          answer = {
            name: faker.system.fileName(),
            type: faker.helpers.arrayElement(['pdf', 'doc', 'jpg', 'png']),
            size: faker.datatype.number({ min: 1024, max: 10485760 }),
            url: faker.internet.url()
          };
          break;
        default:
          answer = faker.lorem.words(3);
      }

      answers.push({
        questionId: question.id,
        answer,
        responseTime: faker.datatype.number({ min: 100, max: 30000 })
      });
    }

    return {
      id: faker.datatype.uuid(),
      userId,
      questionnaireId,
      answers,
      status: 'completed',
      progress: 100,
      timeSpent: faker.datatype.number({ min: 300, max: 3600 }),
      startedAt: faker.date.recent(),
      submittedAt: faker.date.recent(),
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      metadata: {
        device: faker.helpers.arrayElement(['desktop', 'mobile', 'tablet']),
        browser: faker.helpers.arrayElement(['chrome', 'firefox', 'safari', 'edge']),
        location: {
          country: faker.address.country(),
          city: faker.address.city()
        }
      }
    };
  }

  /**
   * Generate analysis jobs for LLM processing
   */
  static generateAnalysis(questionnaireId: string): AnalysisJob {
    const analysisTypes = ['thematic', 'sentiment', 'clusters', 'insights', 'summary'];
    const selectedTypes = faker.helpers.arrayElements(analysisTypes, faker.datatype.number({ min: 1, max: 3 }));

    return {
      id: faker.datatype.uuid(),
      questionnaireId,
      analysisTypes: selectedTypes,
      status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
      triggeredBy: 'automated',
      parameters: {
        sampleSize: faker.datatype.number({ min: 10, max: 1000 }),
        confidence: faker.datatype.number({ min: 0.7, max: 0.95, precision: 0.01 }),
        language: 'en',
        includeDemographics: faker.datatype.boolean()
      },
      progress: faker.datatype.number({ min: 0, max: 100 }),
      createdAt: faker.date.recent(),
      startedAt: faker.datatype.boolean() ? faker.date.recent() : null,
      completedAt: faker.datatype.boolean() ? faker.date.recent() : null,
      estimatedCompletion: faker.date.future()
    };
  }

  /**
   * Generate workshop enrollment data
   */
  static generateEnrollment(userId: string, workshopId: string): WorkshopEnrollment {
    return {
      id: faker.datatype.uuid(),
      userId,
      workshopId,
      status: faker.helpers.arrayElement(['registered', 'confirmed', 'completed', 'cancelled']),
      enrolledAt: faker.date.past(),
      completedAt: faker.datatype.boolean() ? faker.date.recent() : null,
      attendance: faker.datatype.number({ min: 0, max: 100 }),
      progress: faker.datatype.number({ min: 0, max: 100 }),
      certificate: {
        issued: faker.datatype.boolean(),
        url: faker.datatype.boolean() ? faker.internet.url() : null,
        issuedAt: faker.datatype.boolean() ? faker.date.recent() : null
      },
      payment: {
        status: faker.helpers.arrayElement(['pending', 'completed', 'refunded']),
        amount: faker.datatype.number({ min: 50, max: 500 }),
        currency: 'USD',
        paidAt: faker.datatype.boolean() ? faker.date.recent() : null
      },
      feedback: faker.datatype.boolean() ? {
        rating: faker.datatype.number({ min: 1, max: 5 }),
        comment: faker.lorem.paragraph(),
        submittedAt: faker.date.recent()
      } : null
    };
  }

  // Helper methods for generating specific data
  private static generateDiverseEmail(index: number): string {
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.com', 'university.edu'];
    const patterns = [
      (i: number) => `user${i}@${domains[i % domains.length]}`,
      (i: number) => `test.user${i}@${domains[(i + 1) % domains.length]}`,
      (i: number) => `participant${i}@${domains[(i + 2) % domains.length]}`,
    ];

    return patterns[index % patterns.length](index);
  }

  private static assignUserRole(includeAdmins: boolean, index: number, total: number): string {
    if (includeAdmins && index < Math.max(1, Math.floor(total * 0.1))) {
      return 'admin';
    }
    if (index < Math.floor(total * 0.2)) {
      return 'instructor';
    }
    return 'user';
  }

  private static generateWorkshopTitle(): string {
    const topics = [
      'Advanced React Patterns', 'Node.js Microservices', 'Machine Learning Basics',
      'Web Security Fundamentals', 'CSS Animation Techniques', 'API Design Principles',
      'Database Optimization', 'DevOps Best Practices', 'Mobile App Development',
      'Cloud Computing Essentials', 'UI/UX Design Principles', 'Python for Data Science'
    ];

    const formats = [
      '{topic} Workshop',
      'Introduction to {topic}',
      'Mastering {topic}',
      '{topic} for Beginners',
      'Advanced {topic} Techniques'
    ];

    const topic = faker.helpers.arrayElement(topics);
    const format = faker.helpers.arrayElement(formats);

    return format.replace('{topic}', topic);
  }

  private static generateQuestionnaireTitle(): string {
    const purposes = [
      'Workshop Feedback', 'Course Evaluation', 'Satisfaction Survey',
      'Learning Assessment', 'User Experience Feedback', 'Quality Improvement',
      'Research Study', 'Market Research', 'Product Feedback', 'Service Evaluation'
    ];

    const qualifiers = [
      'Comprehensive', 'Detailed', 'Quick', 'In-depth', 'Post-Event',
      'Pre-Event', 'Mid-Program', 'Final', 'Continuous', 'Periodic'
    ];

    const purpose = faker.helpers.arrayElement(purposes);
    const qualifier = faker.datatype.boolean() ? faker.helpers.arrayElement(qualifiers) + ' ' : '';

    return `${qualifier}${purpose} Questionnaire`;
  }

  private static generateQuestionText(type: string): string {
    const questionTemplates = {
      text: [
        'What are your thoughts on {topic}?',
        'Please describe your experience with {topic}.',
        'How would you improve {topic}?'
      ],
      'multiple-choice': [
        'Which {topic} do you prefer?',
        'Select the best option for {topic}.',
        'Choose your level of expertise in {topic}.'
      ],
      rating: [
        'Rate your satisfaction with {topic}.',
        'How would you rate the quality of {topic}?',
        'Please rate your overall experience.'
      ],
      default: [
        'Please provide feedback on {topic}.',
        'What is your opinion about {topic}?',
        'Share your thoughts on {topic}.'
      ]
    };

    const templates = questionTemplates[type] || questionTemplates.default;
    const template = faker.helpers.arrayElement(templates);
    const topic = faker.helpers.arrayElement(['the course', 'the workshop', 'the content', 'the instructor', 'the materials']);

    return template.replace('{topic}', topic);
  }

  private static generateValidationRules(type: string) {
    const baseRules = {
      required: faker.datatype.boolean(),
      minLength: faker.datatype.boolean() ? faker.datatype.number({ min: 1, max: 10 }) : null,
      maxLength: faker.datatype.boolean() ? faker.datatype.number({ min: 50, max: 1000 }) : null,
    };

    switch (type) {
      case 'email':
        return { ...baseRules, format: 'email' };
      case 'url':
        return { ...baseRules, format: 'url' };
      case 'number':
        return {
          ...baseRules,
          min: faker.datatype.number({ min: 0, max: 100 }),
          max: faker.datatype.number({ min: 101, max: 1000 })
        };
      default:
        return baseRules;
    }
  }

  private static generateOptions() {
    const count = faker.datatype.number({ min: 2, max: 6 });
    return Array.from({ length: count }, (_, i) => ({
      id: faker.datatype.uuid(),
      label: faker.lorem.words(2),
      value: `option-${i + 1}`,
      order: i + 1
    }));
  }

  private static generateConditionalLogic() {
    return {
      type: 'show_if',
      questionId: faker.datatype.uuid(),
      operator: faker.helpers.arrayElement(['equals', 'contains', 'greater_than', 'less_than']),
      value: faker.lorem.words(1)
    };
  }

  private static generateSessions(startDate: Date, endDate: Date) {
    const sessionCount = faker.datatype.number({ min: 1, max: 5 });
    const sessions = [];
    const sessionDuration = (endDate.getTime() - startDate.getTime()) / sessionCount;

    for (let i = 0; i < sessionCount; i++) {
      const sessionStart = new Date(startDate.getTime() + i * sessionDuration);
      const sessionEnd = new Date(sessionStart.getTime() + sessionDuration);

      sessions.push({
        id: faker.datatype.uuid(),
        title: `Session ${i + 1}`,
        description: faker.lorem.sentences(2),
        startTime: sessionStart.toISOString(),
        endTime: sessionEnd.toISOString(),
        topics: faker.helpers.arrayElements([
          'Introduction', 'Theory', 'Hands-on', 'Practice', 'Review',
          'Q&A', 'Break', 'Assessment', 'Discussion', 'Summary'
        ], faker.datatype.number({ min: 2, max: 4 }))
      });
    }

    return sessions;
  }

  private static generateDiscounts() {
    const discounts = [];
    const discountCount = faker.datatype.number({ min: 0, max: 2 });

    for (let i = 0; i < discountCount; i++) {
      discounts.push({
        type: faker.helpers.arrayElement(['early_bird', 'group', 'student', 'loyalty']),
        value: faker.datatype.number({ min: 5, max: 50 }),
        condition: faker.lorem.sentence()
      });
    }

    return discounts;
  }

  private static generateLearningObjectives() {
    const count = faker.datatype.number({ min: 3, max: 7 });
    return Array.from({ length: count }, () => ({
      id: faker.datatype.uuid(),
      text: faker.lorem.sentences(2),
      category: faker.helpers.arrayElement(['skill', 'knowledge', 'attitude'])
    }));
  }

  private static generateAgenda() {
    return {
      overview: faker.lorem.paragraph(),
      topics: Array.from({ length: faker.datatype.number({ min: 5, max: 10 }) }, (_, i) => ({
        id: faker.datatype.uuid(),
        title: faker.lorem.words(3),
        description: faker.lorem.sentences(2),
        duration: faker.datatype.number({ min: 15, max: 120 }),
        order: i + 1,
        type: faker.helpers.arrayElement(['lecture', 'activity', 'break', 'discussion', 'assessment'])
      }))
    };
  }

  private static generateResources() {
    return {
      materials: Array.from({ length: faker.datatype.number({ min: 2, max: 8 }) }, () => ({
        id: faker.datatype.uuid(),
        title: faker.lorem.words(3),
        type: faker.helpers.arrayElement(['document', 'video', 'link', 'tool']),
        url: faker.internet.url(),
        description: faker.lorem.sentences(1),
        optional: faker.datatype.boolean()
      })),
      prerequisites: Array.from({ length: faker.datatype.number({ min: 1, max: 4 }) }, () => ({
        id: faker.datatype.uuid(),
        title: faker.lorem.words(2),
        description: faker.lorem.sentences(1),
        type: 'requirement'
      }))
    };
  }

  private static generateWorkshopImages() {
    return {
      thumbnail: faker.internet.url(),
      banner: faker.internet.url(),
      gallery: Array.from({ length: faker.datatype.number({ min: 0, max: 5 }) }, () => ({
        url: faker.internet.url(),
        caption: faker.lorem.sentences(1),
        alt: faker.lorem.words(3)
      }))
    };
  }

  private static selectRandomUsers(users: User[], count: number): User[] {
    return faker.helpers.arrayElements(users, Math.min(count, users.length));
  }

  /**
   * Clear the test data cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.PERFORMANCE_SETTINGS.CACHE_SIZE
    };
  }
}

// Type definitions for the factory
interface WorkshopEcosystem {
  version: string;
  users: User[];
  workshops: Workshop[];
  questionnaires: Questionnaire[];
  questions: Question[];
  responses: Response[];
  analyses: AnalysisJob[];
  enrollments: WorkshopEnrollment[];
  metadata: {
    generatedAt: string;
    generationTime: number;
    entityCounts: {
      users: number;
      workshops: number;
      questionnaires: number;
      questions: number;
      responses: number;
      analyses: number;
    };
  };
}

export default EnhancedTestDataFactory;