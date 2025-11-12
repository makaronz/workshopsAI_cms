import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
  decimal,
  datetime,
  index,
  primaryKey
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Users table - extended for CMS roles
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  password: varchar("password", { length: 255 }),
  loginMethod: mysqlEnum("loginMethod", ["local", "oauth", "sso"]).default("local").notNull(),
  role: mysqlEnum("role", ["participant", "facilitator", "moderator", "sociologist-editor", "admin"]).default("participant").notNull(),
  avatar: varchar("avatar", { length: 1024 }),
  bio: text("bio"),
  isActive: boolean("isActive").default(true).notNull(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  emailIdx: index("idx_email").on(table.email),
  roleIdx: index("idx_role").on(table.role),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Facilitators table - detailed facilitator profiles
 */
export const facilitators = mysqlTable("facilitators", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }),
  organization: varchar("organization", { length: 255 }),
  experience: text("experience"),
  specializations: json("specializations").$type<string[]>(),
  certifications: json("certifications").$type<string[]>(),
  languages: json("languages").$type<string[]>(),
  website: varchar("website", { length: 500 }),
  socialLinks: json("socialLinks").$type<Record<string, string>>(),
  isAvailable: boolean("isAvailable").default(true).notNull(),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0.00"),
  totalWorkshops: int("totalWorkshops").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_user_id").on(table.userId),
  slugIdx: index("idx_slug").on(table.slug),
}));

export type Facilitator = typeof facilitators.$inferSelect;
export type InsertFacilitator = typeof facilitators.$inferInsert;

/**
 * Locations table - workshop venues
 */
export const locations = mysqlTable("locations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  capacity: int("capacity"),
  facilities: json("facilities").$type<string[]>(),
  coordinates: json("coordinates").$type<{ lat: number; lng: number }>(),
  contactInfo: json("contactInfo").$type<{ email?: string; phone?: string }>(),
  imageUrl: varchar("imageUrl", { length: 1024 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  slugIdx: index("idx_slug").on(table.slug),
  cityIdx: index("idx_city").on(table.city),
}));

export type Location = typeof locations.$inferSelect;
export type InsertLocation = typeof locations.$inferInsert;

/**
 * Tags table - workshop categories and tags
 */
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#000000"),
  category: mysqlEnum("category", ["theme", "skill", "level", "format", "audience"]).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  usageCount: int("usageCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  slugIdx: index("idx_slug").on(table.slug),
  categoryIdx: index("idx_category").on(table.category),
}));

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

/**
 * Workshops table - main workshop content
 */
export const workshops = mysqlTable("workshops", {
  id: varchar("id", { length: 36 }).primaryKey().default(`uuid()`),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  description: text("description"),
  shortDescription: varchar("shortDescription", { length: 1000 }),
  status: mysqlEnum("status", ["draft", "published", "archived", "cancelled"]).default("draft").notNull(),
  startDate: datetime("startDate"),
  endDate: datetime("endDate"),
  seatLimit: int("seatLimit"),
  seatReserved: int("seatReserved").default(0),
  enableWaitingList: boolean("enableWaitingList").default(true).notNull(),
  waitingListCount: int("waitingListCount").default(0),
  templateTheme: mysqlEnum("templateTheme", ["integracja", "konflikty", "well-being", "custom"]).default("custom"),
  language: mysqlEnum("language", ["pl", "en"]).default("pl").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).default("0.00"),
  currency: varchar("currency", { length: 3 }).default("PLN"),
  imageUrl: varchar("imageUrl", { length: 1024 }),
  gallery: json("gallery").$type<string[]>(),
  requirements: json("requirements").$type<string[]>(),
  objectives: json("objectives").$type<string[]>(),
  materials: json("materials").$type<Array<{ name: string; url: string; type: string }>>(),
  createdBy: int("createdBy").notNull(),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  slugIdx: index("idx_slug").on(table.slug),
  statusIdx: index("idx_status").on(table.status),
  startDateIdx: index("idx_start_date").on(table.startDate),
  createdByIdx: index("idx_created_by").on(table.createdBy),
}));

export type Workshop = typeof workshops.$inferSelect;
export type InsertWorkshop = typeof workshops.$inferInsert;

/**
 * Workshop Sessions table
 */
export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(`uuid()`),
  workshopId: varchar("workshopId", { length: 36 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startTime: datetime("startTime").notNull(),
  endTime: datetime("endTime").notNull(),
  duration: int("duration"), // in minutes
  order: int("order").default(0),
  location: text("location"),
  materials: json("materials").$type<Array<{ name: string; url: string; type: string }>>(),
  isRequired: boolean("isRequired").default(true).notNull(),
  maxParticipants: int("maxParticipants"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  workshopIdIdx: index("idx_workshop_id").on(table.workshopId),
  orderIdx: index("idx_order").on(table.order),
}));

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Session Modules table - individual content blocks
 */
export const modules = mysqlTable("modules", {
  id: varchar("id", { length: 36 }).primaryKey().default(`uuid()`),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
  title: varchar("title", { length: 255 }),
  type: mysqlEnum("type", ["text", "video", "quiz", "exercise", "discussion", "presentation", "file"]).notNull(),
  content: json("content").notNull(), // Flexible content structure based on type
  duration: int("duration"), // in minutes
  order: int("order").default(0),
  isRequired: boolean("isRequired").default(true).notNull(),
  resources: json("resources").$type<Array<{ name: string; url: string; type: string }>>(),
  settings: json("settings").$type<Record<string, any>>(), // Type-specific settings
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("idx_session_id").on(table.sessionId),
  orderIdx: index("idx_order").on(table.order),
  typeIdx: index("idx_type").on(table.type),
}));

export type Module = typeof modules.$inferSelect;
export type InsertModule = typeof modules.$inferInsert;

/**
 * Enrollments table - workshop registrations
 */
export const enrollments = mysqlTable("enrollments", {
  id: varchar("id", { length: 36 }).primaryKey().default(`uuid()`),
  workshopId: varchar("workshopId", { length: 36 }).notNull(),
  participantId: int("participantId").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "waitlisted", "cancelled", "completed"]).default("pending").notNull(),
  enrollmentDate: timestamp("enrollmentDate").defaultNow().notNull(),
  confirmedAt: timestamp("confirmedAt"),
  cancelledAt: timestamp("cancelledAt"),
  completedAt: timestamp("completedAt"),
  notes: text("notes"),
  specialRequirements: text("specialRequirements"),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "refunded", "waived"]).default("pending"),
  paymentAmount: decimal("paymentAmount", { precision: 10, scale: 2 }),
  attendance: json("attendance").$type<Array<{ sessionId: string; attended: boolean; notes?: string }>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  workshopIdIdx: index("idx_workshop_id").on(table.workshopId),
  participantIdIdx: index("idx_participant_id").on(table.participantId),
  statusIdx: index("idx_status").on(table.status),
  enrollmentDateIdx: index("idx_enrollment_date").on(table.enrollmentDate),
}));

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = typeof enrollments.$inferInsert;

/**
 * Workshop Tags junction table
 */
export const workshopTags = mysqlTable("workshopTags", {
  id: int("id").autoincrement().primaryKey(),
  workshopId: varchar("workshopId", { length: 36 }).notNull(),
  tagId: int("tagId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workshopIdIdx: index("idx_workshop_id").on(table.workshopId),
  tagIdIdx: index("idx_tag_id").on(table.tagId),
}));

export type WorkshopTag = typeof workshopTags.$inferSelect;
export type InsertWorkshopTag = typeof workshopTags.$inferInsert;

/**
 * Workshop Facilitators junction table
 */
export const workshopFacilitators = mysqlTable("workshopFacilitators", {
  id: int("id").autoincrement().primaryKey(),
  workshopId: varchar("workshopId", { length: 36 }).notNull(),
  facilitatorId: int("facilitatorId").notNull(),
  role: mysqlEnum("role", ["lead", "assistant", "guest"]).default("assistant").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workshopIdIdx: index("idx_workshop_id").on(table.workshopId),
  facilitatorIdIdx: index("idx_facilitator_id").on(table.facilitatorId),
}));

export type WorkshopFacilitator = typeof workshopFacilitators.$inferSelect;
export type InsertWorkshopFacilitator = typeof workshopFacilitators.$inferInsert;

/**
 * Workshop Locations junction table
 */
export const workshopLocations = mysqlTable("workshopLocations", {
  id: int("id").autoincrement().primaryKey(),
  workshopId: varchar("workshopId", { length: 36 }).notNull(),
  locationId: int("locationId").notNull(),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workshopIdIdx: index("idx_workshop_id").on(table.workshopId),
  locationIdIdx: index("idx_location_id").on(table.locationId),
}));

export type WorkshopLocation = typeof workshopLocations.$inferSelect;
export type InsertWorkshopLocation = typeof workshopLocations.$inferInsert;

/**
 * Announcements table - workshop announcements
 */
export const announcements = mysqlTable("announcements", {
  id: varchar("id", { length: 36 }).primaryKey().default(`uuid()`),
  workshopId: varchar("workshopId", { length: 36 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  type: mysqlEnum("type", ["info", "reminder", "update", "cancellation", "urgent"]).default("info").notNull(),
  sendEmail: boolean("sendEmail").default(false).notNull(),
  emailSentAt: timestamp("emailSentAt"),
  isPublished: boolean("isPublished").default(false).notNull(),
  publishedAt: timestamp("publishedAt"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  workshopIdIdx: index("idx_workshop_id").on(table.workshopId),
  typeIdx: index("idx_type").on(table.type),
  isPublishedIdx: index("idx_is_published").on(table.isPublished),
}));

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;

/**
 * Feedback table - workshop feedback and reviews
 */
export const feedback = mysqlTable("feedback", {
  id: varchar("id", { length: 36 }).primaryKey().default(`uuid()`),
  workshopId: varchar("workshopId", { length: 36 }).notNull(),
  participantId: int("participantId").notNull(),
  rating: int("rating"), // 1-5 stars
  content: text("content"),
  isPublic: boolean("isPublic").default(false).notNull(),
  isAnonymous: boolean("isAnonymous").default(false).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewedBy: int("reviewedBy"),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  workshopIdIdx: index("idx_workshop_id").on(table.workshopId),
  participantIdIdx: index("idx_participant_id").on(table.participantId),
  statusIdx: index("idx_status").on(table.status),
}));

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  facilitatorProfile: one(facilitators, { fields: [users.id], references: [facilitators.userId] }),
  createdWorkshops: many(workshops),
  enrollments: many(enrollments),
  feedback: many(feedback),
  announcements: many(announcements),
}));

export const facilitatorsRelations = relations(facilitators, ({ one, many }) => ({
  user: one(users, { fields: [facilitators.userId], references: [users.id] }),
  workshopFacilitators: many(workshopFacilitators),
}));

export const locationsRelations = relations(locations, ({ many }) => ({
  workshopLocations: many(workshopLocations),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  workshopTags: many(workshopTags),
}));

export const workshopsRelations = relations(workshops, ({ one, many }) => ({
  creator: one(users, { fields: [workshops.createdBy], references: [users.id] }),
  sessions: many(sessions),
  enrollments: many(enrollments),
  workshopTags: many(workshopTags),
  workshopFacilitators: many(workshopFacilitators),
  workshopLocations: many(workshopLocations),
  announcements: many(announcements),
  feedback: many(feedback),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  workshop: one(workshops, { fields: [sessions.workshopId], references: [workshops.id] }),
  modules: many(modules),
}));

export const modulesRelations = relations(modules, ({ one }) => ({
  session: one(sessions, { fields: [modules.sessionId], references: [sessions.id] }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  workshop: one(workshops, { fields: [enrollments.workshopId], references: [workshops.id] }),
  participant: one(users, { fields: [enrollments.participantId], references: [users.id] }),
}));

export const workshopTagsRelations = relations(workshopTags, ({ one }) => ({
  workshop: one(workshops, { fields: [workshopTags.workshopId], references: [workshops.id] }),
  tag: one(tags, { fields: [workshopTags.tagId], references: [tags.id] }),
}));

export const workshopFacilitatorsRelations = relations(workshopFacilitators, ({ one }) => ({
  workshop: one(workshops, { fields: [workshopFacilitators.workshopId], references: [workshops.id] }),
  facilitator: one(facilitators, { fields: [workshopFacilitators.facilitatorId], references: [facilitators.id] }),
}));

export const workshopLocationsRelations = relations(workshopLocations, ({ one }) => ({
  workshop: one(workshops, { fields: [workshopLocations.workshopId], references: [workshops.id] }),
  location: one(locations, { fields: [workshopLocations.locationId], references: [locations.id] }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  workshop: one(workshops, { fields: [announcements.workshopId], references: [workshops.id] }),
  creator: one(users, { fields: [announcements.createdBy], references: [users.id] }),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  workshop: one(workshops, { fields: [feedback.workshopId], references: [workshops.id] }),
  participant: one(users, { fields: [feedback.participantId], references: [users.id] }),
  reviewer: one(users, { fields: [feedback.reviewedBy], references: [users.id] }),
}));