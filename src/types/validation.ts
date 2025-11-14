import { z } from 'zod';

// Common validation patterns
export const emailSchema = z.string().email('Invalid email format');
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  );
export const slugSchema = z
  .string()
  .regex(
    /^[a-z0-9-]+$/,
    'Slug can only contain lowercase letters, numbers, and hyphens',
  );
export const dateTimeSchema = z.string().datetime('Invalid datetime format');
export const uuidSchema = z.string().uuid('Invalid UUID format');

// User validation schemas
export const registerUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long').max(255),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['participant', 'facilitator']).default('participant'),
});

export const loginUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters long')
    .max(255)
    .optional(),
  email: emailSchema.optional(),
  bio: z.string().max(1000).optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// Facilitator validation schemas
export const createFacilitatorSchema = z.object({
  slug: slugSchema,
  title: z.string().max(255).optional(),
  organization: z.string().max(255).optional(),
  experience: z.string().max(2000).optional(),
  specializations: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  website: z.string().url().optional().or(z.literal('')),
  socialLinks: z
    .record(z.string().url().optional().or(z.literal('')))
    .default({}),
  isAvailable: z.boolean().default(true),
});

export const updateFacilitatorSchema = createFacilitatorSchema.partial();

// Workshop validation schemas
export const createWorkshopSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long').max(255),
  slug: slugSchema,
  subtitle: z.string().max(500).optional(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters long'),
  shortDescription: z.string().max(1000).optional(),
  startDate: dateTimeSchema.optional(),
  endDate: dateTimeSchema.optional(),
  seatLimit: z
    .number()
    .int()
    .min(0, 'Seat limit must be a non-negative integer')
    .optional(),
  enableWaitingList: z.boolean().default(true),
  templateTheme: z
    .enum(['integracja', 'konflikty', 'well-being', 'custom'])
    .default('custom'),
  language: z.enum(['pl', 'en']).default('pl'),
  price: z.number().min(0).default(0),
  currency: z.string().length(3).default('PLN'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  gallery: z.array(z.string().url()).default([]),
  requirements: z.array(z.string()).default([]),
  objectives: z.array(z.string()).default([]),
  materials: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().url(),
        type: z.string().min(1),
      }),
    )
    .default([]),
  tagIds: z.array(z.number().int().positive()).default([]),
  facilitatorIds: z.array(z.number().int().positive()).default([]),
  locationIds: z.array(z.number().int().positive()).default([]),
});

export const updateWorkshopSchema = createWorkshopSchema.partial();

export const publishWorkshopSchema = z.object({
  publishDate: dateTimeSchema.optional(),
});

// Session validation schemas
export const createSessionSchema = z.object({
  workshopId: uuidSchema,
  title: z.string().min(3, 'Title must be at least 3 characters long').max(255),
  description: z.string().optional(),
  startTime: dateTimeSchema,
  endTime: dateTimeSchema,
  duration: z.number().int().positive().optional(),
  location: z.string().optional(),
  materials: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().url(),
        type: z.string().min(1),
      }),
    )
    .default([]),
  isRequired: z.boolean().default(true),
  maxParticipants: z.number().int().positive().optional(),
  order: z.number().int().min(0).default(0),
});

export const updateSessionSchema = createSessionSchema.partial();

// Module validation schemas
export const textModuleSchema = z.object({
  content: z.string().min(1, 'Text content is required'),
  format: z.enum(['plain', 'markdown', 'html']).default('plain'),
});

export const videoModuleSchema = z.object({
  url: z.string().url('Invalid video URL'),
  duration: z.number().int().positive(),
  thumbnail: z.string().url().optional(),
  captions: z.string().optional(),
});

export const quizModuleSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        type: z.enum(['multiple-choice', 'true-false', 'open-ended']),
        options: z.array(z.string()).optional(),
        correctAnswer: z.union([z.string(), z.array(z.string())]),
        points: z.number().int().min(0).default(1),
        explanation: z.string().optional(),
      }),
    )
    .min(1, 'Quiz must have at least one question'),
  timeLimit: z.number().int().positive().optional(),
  passingScore: z.number().min(0).max(100).default(70),
});

export const exerciseModuleSchema = z.object({
  instructions: z.string().min(1, 'Instructions are required'),
  duration: z.number().int().positive(),
  materials: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().url(),
        type: z.string().min(1),
      }),
    )
    .default([]),
  submissionType: z.enum(['text', 'file', 'none']).default('none'),
  maxFileSize: z.number().int().positive().optional(),
  allowedFileTypes: z.array(z.string()).optional(),
});

export const discussionModuleSchema = z.object({
  prompt: z.string().min(1, 'Discussion prompt is required'),
  duration: z.number().int().positive(),
  isModerated: z.boolean().default(true),
  maxParticipants: z.number().int().positive().optional(),
});

export const presentationModuleSchema = z.object({
  slides: z
    .array(
      z.object({
        title: z.string().min(1),
        content: z.string(),
        order: z.number().int().min(0),
      }),
    )
    .min(1, 'Presentation must have at least one slide'),
  speakerNotes: z.string().optional(),
});

export const fileModuleSchema = z.object({
  url: z.string().url('Invalid file URL'),
  name: z.string().min(1),
  type: z.string().min(1),
  size: z.number().int().positive(),
  description: z.string().optional(),
});

export const createModuleSchema = z.object({
  sessionId: uuidSchema,
  title: z.string().min(1).max(255),
  type: z.enum([
    'text',
    'video',
    'quiz',
    'exercise',
    'discussion',
    'presentation',
    'file',
  ]),
  content: z.union([
    textModuleSchema,
    videoModuleSchema,
    quizModuleSchema,
    exerciseModuleSchema,
    discussionModuleSchema,
    presentationModuleSchema,
    fileModuleSchema,
  ]),
  duration: z.number().int().positive().optional(),
  order: z.number().int().min(0).default(0),
  isRequired: z.boolean().default(true),
  resources: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().url(),
        type: z.string().min(1),
      }),
    )
    .default([]),
  settings: z.record(z.any()).default({}),
});

export const updateModuleSchema = createModuleSchema.partial();

// Enrollment validation schemas
export const createEnrollmentSchema = z.object({
  workshopId: uuidSchema,
  notes: z.string().max(1000).optional(),
  specialRequirements: z.string().max(1000).optional(),
});

export const updateEnrollmentSchema = z.object({
  status: z
    .enum(['pending', 'confirmed', 'waitlisted', 'cancelled', 'completed'])
    .optional(),
  notes: z.string().max(1000).optional(),
  specialRequirements: z.string().max(1000).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'refunded', 'waived']).optional(),
  paymentAmount: z.number().min(0).optional(),
  attendance: z
    .array(
      z.object({
        sessionId: uuidSchema,
        attended: z.boolean(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
});

// Tag validation schemas
export const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema,
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .default('#000000'),
  category: z.enum(['theme', 'skill', 'level', 'format', 'audience']),
});

export const updateTagSchema = createTagSchema.partial();

// Location validation schemas
export const createLocationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: slugSchema,
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  capacity: z.number().int().positive().optional(),
  facilities: z.array(z.string()).default([]),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  contactInfo: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .default({}),
  imageUrl: z.string().url().optional().or(z.literal('')),
});

export const updateLocationSchema = createLocationSchema.partial();

// Announcement validation schemas
export const createAnnouncementSchema = z.object({
  workshopId: uuidSchema,
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  type: z
    .enum(['info', 'reminder', 'update', 'cancellation', 'urgent'])
    .default('info'),
  sendEmail: z.boolean().default(false),
});

export const updateAnnouncementSchema = createAnnouncementSchema
  .partial()
  .omit({ workshopId: true });

// Feedback validation schemas
export const createFeedbackSchema = z.object({
  workshopId: uuidSchema,
  rating: z.number().int().min(1).max(5),
  content: z.string().max(2000).optional(),
  isPublic: z.boolean().default(false),
  isAnonymous: z.boolean().default(false),
});

export const reviewFeedbackSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  reviewNotes: z.string().max(1000).optional(),
});

// Query validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const workshopFilterSchema = paginationSchema.extend({
  status: z.enum(['draft', 'published', 'archived', 'cancelled']).optional(),
  templateTheme: z
    .enum(['integracja', 'konflikty', 'well-being', 'custom'])
    .optional(),
  language: z.enum(['pl', 'en']).optional(),
  tagIds: z.array(z.number().int().positive()).optional(),
  facilitatorIds: z.array(z.number().int().positive()).optional(),
  startDateFrom: dateTimeSchema.optional(),
  startDateTo: dateTimeSchema.optional(),
  search: z.string().optional(),
});

export const enrollmentFilterSchema = paginationSchema.extend({
  status: z
    .enum(['pending', 'confirmed', 'waitlisted', 'cancelled', 'completed'])
    .optional(),
  workshopId: uuidSchema.optional(),
  paymentStatus: z.enum(['pending', 'paid', 'refunded', 'waived']).optional(),
  startDateFrom: dateTimeSchema.optional(),
  startDateTo: dateTimeSchema.optional(),
});

// Export all schemas
export const validationSchemas = {
  // User
  registerUser: registerUserSchema,
  loginUser: loginUserSchema,
  updateUser: updateUserSchema,
  changePassword: changePasswordSchema,

  // Facilitator
  createFacilitator: createFacilitatorSchema,
  updateFacilitator: updateFacilitatorSchema,

  // Workshop
  createWorkshop: createWorkshopSchema,
  updateWorkshop: updateWorkshopSchema,
  publishWorkshop: publishWorkshopSchema,

  // Session
  createSession: createSessionSchema,
  updateSession: updateSessionSchema,

  // Module
  createModule: createModuleSchema,
  updateModule: updateModuleSchema,

  // Enrollment
  createEnrollment: createEnrollmentSchema,
  updateEnrollment: updateEnrollmentSchema,

  // Tag
  createTag: createTagSchema,
  updateTag: updateTagSchema,

  // Location
  createLocation: createLocationSchema,
  updateLocation: updateLocationSchema,

  // Announcement
  createAnnouncement: createAnnouncementSchema,
  updateAnnouncement: updateAnnouncementSchema,

  // Feedback
  createFeedback: createFeedbackSchema,
  reviewFeedback: reviewFeedbackSchema,

  // Query
  pagination: paginationSchema,
  workshopFilter: workshopFilterSchema,
  enrollmentFilter: enrollmentFilterSchema,
};

// Type exports
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginUserInput = z.infer<typeof loginUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateWorkshopInput = z.infer<typeof createWorkshopSchema>;
export type UpdateWorkshopInput = z.infer<typeof updateWorkshopSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
