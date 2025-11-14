import { faker } from '@faker-js/faker';
import {
  Workshop,
  Questionnaire,
  User,
  Enrollment,
  Response,
  ApiResponse
} from '../types';

/**
 * Test Data Factory
 *
 * Generates realistic test data for all entities in the CMS system.
 * Ensures data consistency and provides various data scenarios.
 */

export class TestDataFactory {
  /**
   * Generate test data for any entity type
   */
  static generateTestData<T>(type: string, overrides: Partial<T> = {}): T {
    switch (type) {
      case 'user':
        return this.generateUser(overrides) as T;
      case 'workshop':
        return this.generateWorkshop(overrides) as T;
      case 'questionnaire':
        return this.generateQuestionnaire(overrides) as T;
      case 'enrollment':
        return this.generateEnrollment(overrides) as T;
      case 'response':
        return this.generateQuestionnaireResponse(overrides) as T;
      case 'template':
        return this.generateTemplate(overrides) as T;
      default:
        throw new Error(`Unknown data type: ${type}`);
    }
  }

  /**
   * Generate user test data
   */
  static generateUser(overrides: Partial<User> = {}): User {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName });

    return {
      id: faker.string.uuid(),
      email: email.toLowerCase(),
      password: faker.internet.password({ length: 12, memorable: true }),
      firstName,
      lastName,
      role: faker.helpers.arrayElement(['admin', 'instructor', 'participant']),
      avatar: faker.image.avatar(),
      bio: faker.lorem.paragraph(),
      phone: faker.phone.number(),
      organization: faker.company.name(),
      jobTitle: faker.person.jobTitle(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      isActive: true,
      emailVerified: true,
      lastLogin: faker.date.recent(),
      preferences: {
        language: 'en',
        timezone: 'America/New_York',
        notifications: {
          email: true,
          sms: false,
          push: true
        }
      },
      ...overrides
    };
  }

  /**
   * Generate workshop test data
   */
  static generateWorkshop(overrides: Partial<Workshop> = {}): Workshop {
    const startDate = faker.date.future({ years: 1 });
    const endDate = faker.date.future({ years: 1, refDate: startDate });

    return {
      id: faker.string.uuid(),
      title: faker.lorem.words(3).replace(/\b\w/g, l => l.toUpperCase()),
      description: faker.lorem.paragraphs(2),
      shortDescription: faker.lorem.sentence(),
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      startTime: faker.date.future({ years: 1 }).toTimeString().split(' ')[0].substring(0, 5),
      endTime: faker.date.future({ years: 1 }).toTimeString().split(' ')[0].substring(0, 5),
      timezone: faker.helpers.arrayElement(['America/New_York', 'Europe/London', 'Asia/Tokyo']),
      location: {
        type: faker.helpers.arrayElement(['online', 'in-person', 'hybrid']),
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        country: faker.location.country(),
        coordinates: {
          lat: faker.location.latitude(),
          lng: faker.location.longitude()
        }
      },
      capacity: faker.number.int({ min: 10, max: 100 }),
      currentEnrollments: 0,
      waitlistCapacity: faker.number.int({ min: 5, max: 20 }),
      currentWaitlist: 0,
      price: {
        amount: faker.number.int({ min: 0, max: 1000 }),
        currency: 'USD',
        earlyBirdPrice: faker.datatype.boolean() ? faker.number.int({ min: 0, max: 800 }) : undefined,
        earlyBirdDeadline: faker.datatype.boolean() ? faker.date.future({ years: 1 }).toISOString().split('T')[0] : undefined
      },
      instructor: {
        id: faker.string.uuid(),
        name: `${faker.person.firstName()} ${faker.person.lastName()}`,
        bio: faker.lorem.paragraph(),
        avatar: faker.image.avatar(),
        credentials: faker.lorem.words(2)
      },
      tags: faker.helpers.arrayElements(
        ['javascript', 'python', 'react', 'node.js', 'design', 'leadership', 'agile', 'devops'],
        { min: 2, max: 5 }
      ),
      category: faker.helpers.arrayElement(['technical', 'design', 'business', 'leadership']),
      level: faker.helpers.arrayElement(['beginner', 'intermediate', 'advanced']),
      prerequisites: faker.lorem.sentences(2),
      learningObjectives: faker.lorem.sentences(3),
      agenda: Array(faker.number.int({ min: 3, max: 8 })).fill(null).map(() => ({
        time: `${faker.number.int({ min: 9, max: 17 })}:${faker.string.numeric(2).padStart(2, '0')}`,
        title: faker.lorem.sentence(),
        description: faker.lorem.paragraph(),
        duration: faker.number.int({ min: 30, max: 120 })
      })),
      materials: Array(faker.number.int({ min: 1, max: 5 })).fill(null).map(() => ({
        id: faker.string.uuid(),
        name: faker.lorem.words(3),
        type: faker.helpers.arrayElement(['pdf', 'video', 'link', 'document']),
        url: faker.internet.url(),
        description: faker.lorem.sentence()
      })),
      imageUrl: faker.image.urlLoremFlickr({ category: 'education' }),
      status: faker.helpers.arrayElement(['draft', 'published', 'cancelled', 'completed']),
      isPublic: true,
      requiresApproval: false,
      allowWaitingList: true,
      sendReminders: true,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      publishedAt: faker.date.recent(),
      createdBy: faker.string.uuid(),
      ...overrides
    };
  }

  /**
   * Generate questionnaire test data
   */
  static generateQuestionnaire(overrides: Partial<Questionnaire> = {}): Questionnaire {
    const questionTypes = ['multiple-choice', 'text', 'rating', 'checkbox', 'dropdown', 'date'];

    return {
      id: faker.string.uuid(),
      title: `${faker.lorem.words(3)} Questionnaire`,
      description: faker.lorem.paragraph(),
      instructions: faker.lorem.paragraph(),
      type: faker.helpers.arrayElement(['feedback', 'pre-assessment', 'post-assessment', 'survey']),
      questions: Array(faker.number.int({ min: 3, max: 10 })).fill(null).map((_, index) => ({
        id: `q${index + 1}`,
        type: faker.helpers.arrayElement(questionTypes),
        text: faker.lorem.sentence(),
        description: faker.datatype.boolean() ? faker.lorem.sentence() : undefined,
        required: faker.datatype.boolean(),
        order: index + 1,
        validation: {
          minLength: faker.datatype.boolean() ? faker.number.int({ min: 10, max: 100 }) : undefined,
          maxLength: faker.datatype.boolean() ? faker.number.int({ min: 200, max: 1000 }) : undefined,
          pattern: faker.datatype.boolean() ? faker.helpers.arrayElement(['^[A-Za-z0-9 ]+$', '^[^0-9]*$', '^[A-Z]+$']) : undefined
        },
        options: faker.datatype.boolean() && ['multiple-choice', 'checkbox', 'dropdown'].includes(faker.helpers.arrayElement(questionTypes))
          ? Array(faker.number.int({ min: 2, max: 6 })).fill(null).map(() => ({
              id: faker.string.uuid(),
              text: faker.lorem.words(2),
              value: faker.lorem.slug(),
              order: faker.number.int({ min: 1, max: 10 })
            }))
          : undefined,
        settings: {
          allowOther: faker.datatype.boolean(),
          otherLabel: faker.lorem.words(2),
          randomizeOptions: faker.datatype.boolean(),
          maxSelections: faker.datatype.boolean() ? faker.number.int({ min: 1, max: 3 }) : undefined,
          scale: faker.datatype.boolean() ? faker.number.int({ min: 3, max: 10 }) : undefined,
          scaleLabels: faker.datatype.boolean() ? {
            min: faker.lorem.words(2),
            max: faker.lorem.words(2)
          } : undefined
        }
      })),
      settings: {
        allowAnonymous: faker.datatype.boolean(),
        collectEmail: faker.datatype.boolean(),
        timeLimit: faker.datatype.boolean() ? faker.number.int({ min: 300, max: 3600 }) : undefined,
        showProgress: true,
        allowSaveProgress: true,
        showResults: faker.datatype.boolean(),
        shuffleQuestions: faker.datatype.boolean(),
        requireCompletion: faker.datatype.boolean()
      },
      status: faker.helpers.arrayElement(['draft', 'active', 'closed']),
      isActive: true,
      isTemplate: false,
      templateCategory: faker.helpers.arrayElement(['feedback', 'assessment', 'survey']),
      version: 1,
      responses: 0,
      completions: 0,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      publishedAt: faker.date.recent(),
      createdBy: faker.string.uuid(),
      workshopId: faker.datatype.boolean() ? faker.string.uuid() : undefined,
      ...overrides
    };
  }

  /**
   * Generate enrollment test data
   */
  static generateEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
    const statuses = ['pending', 'confirmed', 'waitlisted', 'cancelled', 'completed'];

    return {
      id: faker.string.uuid(),
      workshopId: faker.string.uuid(),
      participantId: faker.string.uuid(),
      participantEmail: faker.internet.email(),
      participantName: `${faker.person.firstName()} ${faker.person.lastName()}`,
      status: faker.helpers.arrayElement(statuses),
      enrolledAt: faker.date.past(),
      confirmedAt: faker.datatype.boolean() ? faker.date.recent() : undefined,
      cancelledAt: faker.datatype.boolean() ? faker.date.recent() : undefined,
      cancellationReason: faker.datatype.boolean() ? faker.lorem.sentence() : undefined,
      paymentStatus: faker.helpers.arrayElement(['pending', 'paid', 'refunded']),
      paymentAmount: faker.number.int({ min: 0, max: 1000 }),
      paymentMethod: faker.helpers.arrayElement(['credit-card', 'paypal', 'bank-transfer']),
      specialRequirements: faker.datatype.boolean() ? faker.lorem.paragraph() : undefined,
      emergencyContact: {
        name: `${faker.person.firstName()} ${faker.person.lastName()}`,
        relationship: faker.helpers.arrayElement(['spouse', 'parent', 'friend', 'colleague']),
        phone: faker.phone.number(),
        email: faker.internet.email()
      },
      dietaryRequirements: faker.datatype.boolean() ? faker.lorem.words(3) : undefined,
      accessibilityNeeds: faker.datatype.boolean() ? faker.lorem.paragraph() : undefined,
      answers: Array(faker.number.int({ min: 0, max: 5 })).fill(null).map(() => ({
        questionId: faker.string.uuid(),
        answer: faker.lorem.sentence()
      })),
      attendance: {
        daysAttended: faker.number.int({ min: 0, max: 3 }),
        totalDays: faker.number.int({ min: 1, max: 5 }),
        notes: faker.datatype.boolean() ? faker.lorem.paragraph() : undefined
      },
      completion: {
        completed: faker.datatype.boolean(),
        certificateIssued: faker.datatype.boolean(),
        certificateUrl: faker.datatype.boolean() ? faker.internet.url() : undefined,
        completedAt: faker.datatype.boolean() ? faker.date.recent() : undefined
      },
      feedback: faker.datatype.boolean() ? {
        rating: faker.number.int({ min: 1, max: 5 }),
        comments: faker.lorem.paragraph(),
        submittedAt: faker.date.recent()
      } : undefined,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }

  /**
   * Generate questionnaire response test data
   */
  static generateQuestionnaireResponse(overrides: Partial<Response> = {}): Response {
    return {
      id: faker.string.uuid(),
      questionnaireId: faker.string.uuid(),
      workshopId: faker.string.uuid(),
      participantId: faker.string.uuid(),
      participantEmail: faker.internet.email(),
      participantName: faker.person.fullName(),
      status: faker.helpers.arrayElement(['draft', 'submitted', 'completed']),
      startedAt: faker.date.past(),
      submittedAt: faker.datatype.boolean() ? faker.date.recent() : undefined,
      completedAt: faker.datatype.boolean() ? faker.date.recent() : undefined,
      timeSpent: faker.number.int({ min: 60, max: 3600 }),
      answers: Array(faker.number.int({ min: 3, max: 10 })).fill(null).map(() => ({
        questionId: faker.string.uuid(),
        questionText: faker.lorem.sentence(),
        answer: faker.datatype.boolean()
          ? faker.lorem.paragraph()
          : faker.helpers.arrayElement([faker.lorem.words(2), faker.lorem.sentence(), faker.number.int({ min: 1, max: 5 }).toString()]),
        type: faker.helpers.arrayElement(['text', 'multiple-choice', 'rating', 'checkbox']),
        required: faker.datatype.boolean(),
        answeredAt: faker.date.recent()
      })),
      metadata: {
        ipAddress: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        device: faker.helpers.arrayElement(['desktop', 'mobile', 'tablet']),
        browser: faker.helpers.arrayElement(['chrome', 'firefox', 'safari', 'edge']),
        location: {
          country: faker.location.country(),
          city: faker.location.city()
        },
        completionTime: faker.number.int({ min: 300, max: 3600 }),
        questionTimeSpent: Array(faker.number.int({ min: 3, max: 10 })).fill(null).map(() => faker.number.int({ min: 5, max: 300 }))
      },
      quality: {
        completeness: faker.number.float({ min: 0, max: 1, precision: 0.1 }),
        detailLevel: faker.helpers.arrayElement(['minimal', 'basic', 'detailed', 'comprehensive']),
        sentiment: faker.helpers.arrayElement(['positive', 'neutral', 'negative']),
        confidence: faker.number.float({ min: 0, max: 1, precision: 0.1 })
      },
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }

  /**
   * Generate template test data
   */
  static generateTemplate(overrides: Partial<any> = {}): any {
    return {
      id: faker.string.uuid(),
      name: faker.lorem.words(3),
      description: faker.lorem.paragraph(),
      category: faker.helpers.arrayElement(['workshop', 'questionnaire', 'email', 'certificate']),
      type: faker.helpers.arrayElement(['standard', 'custom', 'premium']),
      content: {
        html: faker.lorem.paragraphs(3),
        css: faker.lorem.sentences(2),
        variables: Array(faker.number.int({ min: 1, max: 5 })).fill(null).map(() => ({
          name: faker.lorem.word(),
          type: faker.helpers.arrayElement(['text', 'date', 'number', 'boolean']),
          defaultValue: faker.lorem.words(2),
          description: faker.lorem.sentence()
        }))
      },
      preview: faker.image.urlLoremFlickr({ category: 'abstract' }),
      tags: faker.helpers.arrayElements(
        ['minimal', 'professional', 'colorful', 'modern', 'classic', 'corporate'],
        { min: 1, max: 3 }
      ),
      usage: {
        downloads: faker.number.int({ min: 0, max: 1000 }),
        rating: faker.number.float({ min: 1, max: 5, precision: 0.1 }),
        reviews: faker.number.int({ min: 0, max: 100 })
      },
      pricing: {
        type: faker.helpers.arrayElement(['free', 'premium', 'enterprise']),
        amount: faker.datatype.boolean() ? faker.number.int({ min: 5, max: 100 }) : 0
      },
      isPublic: true,
      isActive: true,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      createdBy: faker.string.uuid(),
      ...overrides
    };
  }

  /**
   * Generate bulk test data for performance testing
   */
  static generateBulkTestData<T>(type: string, count: number, baseOverrides: Partial<T> = {}): T[] {
    return Array(count).fill(null).map((_, index) =>
      this.generateTestData<T>(type, { ...baseOverrides, id: `bulk-${index}-${faker.string.uuid()}` })
    );
  }

  /**
   * Generate test data with specific scenarios
   */
  static generateScenarioData(scenario: string): any {
    switch (scenario) {
      case 'full-workshop-flow':
        return {
          user: this.generateUser({ role: 'instructor' }),
          workshop: this.generateWorkshop({
            status: 'published',
            capacity: 20,
            currentEnrollments: 15
          }),
          enrollments: this.generateBulkTestData('enrollment', 15, { status: 'confirmed' }),
          questionnaire: this.generateQuestionnaire({ type: 'feedback' }),
          responses: this.generateBulkTestData('response', 12, { status: 'completed' })
        };

      case 'stress-test-large-workshop':
        return {
          workshop: this.generateWorkshop({ capacity: 1000, currentEnrollments: 950 }),
          enrollments: this.generateBulkTestData('enrollment', 950),
          questionnaire: this.generateQuestionnaire({
            questions: Array(20).fill(null).map((_, i) => ({
              id: `q${i}`,
              type: faker.helpers.arrayElement(['text', 'rating']),
              text: faker.lorem.sentence(),
              required: faker.datatype.boolean(),
              order: i + 1
            }))
          }),
          responses: this.generateBulkTestData('response', 850)
        };

      case 'edge-case-empty-workshop':
        return {
          workshop: this.generateWorkshop({
            capacity: 50,
            currentEnrollments: 0,
            status: 'published'
          }),
          enrollments: [],
          questionnaire: this.generateQuestionnaire(),
          responses: []
        };

      case 'accessibility-comprehensive':
        return {
          workshop: this.generateWorkshop({
            title: 'Accessibility Testing Workshop',
            description: 'A comprehensive workshop on accessibility testing and compliance.',
            materials: Array(10).fill(null).map(() => ({
              id: faker.string.uuid(),
              name: `Accessible ${faker.lorem.words(2)}`,
              type: 'pdf',
              url: faker.internet.url(),
              description: faker.lorem.sentence(),
              accessibilityFeatures: ['screen-reader-compatible', 'alt-text', 'structured-headings']
            }))
          }),
          questionnaire: this.generateQuestionnaire({
            questions: Array(15).fill(null).map((_, i) => ({
              id: `q${i}`,
              type: faker.helpers.arrayElement(['multiple-choice', 'rating', 'text']),
              text: faker.lorem.sentence(),
              required: faker.datatype.boolean(),
              order: i + 1,
              accessibilityLabels: {
                question: faker.lorem.sentence(),
                instructions: faker.lorem.sentence()
              }
            }))
          })
        };

      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }
  }

  /**
   * Clean up test data from database
   */
  static async cleanupTestData(request: any, authToken: string, data: any[]): Promise<void> {
    for (const item of data) {
      try {
        if (item.id && item.type) {
          const endpoint = this.getEndpointByType(item.type, item.id);
          if (endpoint) {
            await request.delete(endpoint, {
              headers: { Authorization: `Bearer ${authToken}` }
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to cleanup test data: ${JSON.stringify(item)}`, error);
      }
    }
  }

  /**
   * Get API endpoint by data type
   */
  private static getEndpointByType(type: string, id: string): string | null {
    const endpoints = {
      workshop: `/api/workshops/${id}`,
      questionnaire: `/api/questionnaires/${id}`,
      enrollment: `/api/enrollments/${id}`,
      response: `/api/responses/${id}`,
      user: `/api/users/${id}`
    };

    return endpoints[type as keyof typeof endpoints] || null;
  }
}

// Export convenience functions for backward compatibility
export const generateTestData = TestDataFactory.generateTestData.bind(TestDataFactory);
export const generateBulkTestData = TestDataFactory.generateBulkTestData.bind(TestDataFactory);
export const generateScenarioData = TestDataFactory.generateScenarioData.bind(TestDataFactory);
export const cleanupTestData = TestDataFactory.cleanupTestData.bind(TestDataFactory);