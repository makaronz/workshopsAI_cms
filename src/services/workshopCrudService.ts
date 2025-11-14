import { Request } from 'express';
import { eq, and, desc, asc, sql, count, isNull, ne } from 'drizzle-orm';
import { db, RLSHelper, withRLS } from '../config/postgresql-database';
import {
  workshops,
  sessions,
  questionnaires,
  users,
  workshopTags,
  tags,
  Workshop,
  InsertWorkshop,
  Session,
  Questionnaire,
  AuditLog,
  InsertAuditLog,
  Tag,
} from '../models/postgresql-schema';

// Types
export interface WorkshopFilters {
  status?: 'draft' | 'published' | 'archived' | 'cancelled';
  publishedAfter?: Date;
  publishedBefore?: Date;
  createdBy?: string;
  hasQuestionnaire?: boolean;
  hasSessions?: boolean;
  limit?: number;
  offset?: number;
}

export interface WorkshopPublishChecklist {
  hasSessions: boolean;
  hasQuestionnaire: boolean;
  allRequiredFields: boolean;
  wcagCompliant: boolean;
  canPublish: boolean;
  errors: string[];
}

export interface CreateWorkshopData {
  slug: string;
  titleI18n: Record<string, string>;
  subtitleI18n?: Record<string, string>;
  descriptionI18n: Record<string, string>;
  shortDescriptionI18n?: Record<string, string>;
  startDate?: Date;
  endDate?: Date;
  seatLimit?: number;
  enableWaitingList?: boolean;
  templateTheme?: 'integracja' | 'konflikty' | 'well-being' | 'custom';
  language?: 'pl' | 'en';
  price?: number;
  currency?: string;
  imageUrl?: string;
  gallery?: string[];
  requirementsI18n?: Record<string, string[]>;
  objectivesI18n?: Record<string, string[]>;
  materials?: Array<{ name: string; url: string; type: string }>;
  tagIds?: string[];
}

export interface UpdateWorkshopData extends Partial<CreateWorkshopData> {
  status?: 'draft' | 'published' | 'archived' | 'cancelled';
  publishedAt?: Date;
}

export interface WorkshopListResponse {
  workshops: (Workshop & {
    sessionCount: number;
    questionnaireCount: number;
    creator: { id: string; name: string; email: string };
    tags: Array<{ id: string; name: string; category: string; color: string }>;
  })[];
  total: number;
  filters: WorkshopFilters;
}

/**
 * Workshop CRUD Service
 */
export class WorkshopCrudService {
  /**
   * Get workshops with filtering and pagination
   */
  static async getWorkshops(
    filters: WorkshopFilters = {},
    request?: Request,
  ): Promise<WorkshopListResponse> {
    const userId = request?.user?.id;
    const userRole = request?.user?.role;
    const isAdmin = userRole === 'admin';

    const executeWithRLS = async () => {
      const {
        status,
        publishedAfter,
        publishedBefore,
        createdBy,
        hasQuestionnaire,
        hasSessions,
        limit = 20,
        offset = 0,
      } = filters;

      // Build base query conditions
      const conditions = [isNull(workshops.deletedAt)];

      if (status) {
        conditions.push(eq(workshops.status, status));
      }

      if (publishedAfter) {
        conditions.push(sql`${workshops.publishedAt} >= ${publishedAfter}`);
      }

      if (publishedBefore) {
        conditions.push(sql`${workshops.publishedAt} <= ${publishedBefore}`);
      }

      if (createdBy) {
        conditions.push(eq(workshops.createdBy, createdBy));
      }

      // Main query with counts and relations
      const workshopData = await db
        .select({
          // Workshop fields
          id: workshops.id,
          slug: workshops.slug,
          titleI18n: workshops.titleI18n,
          subtitleI18n: workshops.subtitleI18n,
          descriptionI18n: workshops.descriptionI18n,
          shortDescriptionI18n: workshops.shortDescriptionI18n,
          status: workshops.status,
          startDate: workshops.startDate,
          endDate: workshops.endDate,
          seatLimit: workshops.seatLimit,
          seatReserved: workshops.seatReserved,
          enableWaitingList: workshops.enableWaitingList,
          waitingListCount: workshops.waitingListCount,
          templateTheme: workshops.templateTheme,
          language: workshops.language,
          price: workshops.price,
          currency: workshops.currency,
          imageUrl: workshops.imageUrl,
          gallery: workshops.gallery,
          requirementsI18n: workshops.requirementsI18n,
          objectivesI18n: workshops.objectivesI18n,
          materials: workshops.materials,
          createdBy: workshops.createdBy,
          publishedAt: workshops.publishedAt,
          createdAt: workshops.createdAt,
          updatedAt: workshops.updatedAt,
          deletedAt: workshops.deletedAt,

          // Aggregated counts
          sessionCount: count(sessions.id),
          questionnaireCount: count(questionnaires.id),

          // Creator info
          creatorId: users.id,
          creatorName: users.name,
          creatorEmail: users.email,
        })
        .from(workshops)
        .leftJoin(sessions, eq(workshops.id, sessions.workshopId))
        .leftJoin(questionnaires, eq(workshops.id, questionnaires.workshopId))
        .leftJoin(users, eq(workshops.createdBy, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(workshops.id, users.id)
        .orderBy(desc(workshops.createdAt))
        .limit(limit)
        .offset(offset);

      // Apply additional filters that require subqueries
      let filteredWorkshops = workshopData;

      if (hasQuestionnaire !== undefined) {
        filteredWorkshops = filteredWorkshops.filter(w =>
          hasQuestionnaire
            ? Number(w.questionnaireCount) > 0
            : Number(w.questionnaireCount) === 0,
        );
      }

      if (hasSessions !== undefined) {
        filteredWorkshops = filteredWorkshops.filter(w =>
          hasSessions
            ? Number(w.sessionCount) > 0
            : Number(w.sessionCount) === 0,
        );
      }

      // Get tags for each workshop
      const workshopIds = filteredWorkshops.map(w => w.id);
      const workshopTagsData =
        workshopIds.length > 0
          ? await db
            .select({
              workshopId: workshopTags.workshopId,
              tagId: workshopTags.tagId,
              tagName: tags.name,
              tagCategory: tags.category,
              tagColor: tags.color,
            })
            .from(workshopTags)
            .leftJoin(tags, eq(workshopTags.tagId, tags.id))
            .where(
              workshopIds.length > 0
                ? sql`${workshopTags.workshopId} IN ${sql.raw(workshopIds.map(id => `'${id}'`).join(','))}`
                : undefined,
            )
          : [];

      // Group tags by workshop
      const tagsByWorkshop = workshopTagsData.reduce(
        (acc, tag) => {
          if (!acc[tag.workshopId]) {
            acc[tag.workshopId] = [];
          }
          if (tag.tagName) {
            acc[tag.workshopId].push({
              id: tag.tagId,
              name: tag.tagName,
              category: tag.tagCategory,
              color: tag.tagColor || '#000000',
            });
          }
          return acc;
        },
        {} as Record<
          string,
          Array<{ id: string; name: string; category: string; color: string }>
        >,
      );

      // Format response
      const formattedWorkshops = filteredWorkshops.map(workshop => ({
        ...workshop,
        creator: {
          id: workshop.creatorId,
          name: workshop.creatorName,
          email: workshop.creatorEmail,
        },
        tags: tagsByWorkshop[workshop.id] || [],
        sessionCount: Number(workshop.sessionCount),
        questionnaireCount: Number(workshop.questionnaireCount),
      }));

      // Get total count
      const totalCountQuery = db
        .select({ count: count(workshops.id) })
        .from(workshops)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const totalResult = await totalCountQuery;
      const total = Number(totalResult[0]?.count || 0);

      return {
        workshops: formattedWorkshops,
        total,
        filters,
      };
    };

    // Execute with RLS if user is authenticated
    if (userId && userRole) {
      return await withRLS(userId, userRole, isAdmin, executeWithRLS);
    } else {
      // For public access, no RLS context needed
      return await executeWithRLS();
    }
  }

  /**
   * Get workshop by ID with full details
   */
  static async getWorkshopById(
    id: string,
    request?: Request,
  ): Promise<
    | (Workshop & {
        sessions: Session[];
        questionnaires: Questionnaire[];
        creator: { id: string; name: string; email: string };
        tags: Array<{
          id: string;
          name: string;
          category: string;
          color: string;
        }>;
      })
    | null
  > {
    const workshopResult = await db
      .select({
        id: workshops.id,
        slug: workshops.slug,
        titleI18n: workshops.titleI18n,
        subtitleI18n: workshops.subtitleI18n,
        descriptionI18n: workshops.descriptionI18n,
        shortDescriptionI18n: workshops.shortDescriptionI18n,
        status: workshops.status,
        startDate: workshops.startDate,
        endDate: workshops.endDate,
        seatLimit: workshops.seatLimit,
        seatReserved: workshops.seatReserved,
        enableWaitingList: workshops.enableWaitingList,
        waitingListCount: workshops.waitingListCount,
        templateTheme: workshops.templateTheme,
        language: workshops.language,
        price: workshops.price,
        currency: workshops.currency,
        imageUrl: workshops.imageUrl,
        gallery: workshops.gallery,
        requirementsI18n: workshops.requirementsI18n,
        objectivesI18n: workshops.objectivesI18n,
        materials: workshops.materials,
        createdBy: workshops.createdBy,
        publishedAt: workshops.publishedAt,
        createdAt: workshops.createdAt,
        updatedAt: workshops.updatedAt,
        deletedAt: workshops.deletedAt,
        creatorId: users.id,
        creatorName: users.name,
        creatorEmail: users.email,
      })
      .from(workshops)
      .leftJoin(users, eq(workshops.createdBy, users.id))
      .where(and(eq(workshops.id, id), isNull(workshops.deletedAt)))
      .limit(1);

    if (!workshopResult || workshopResult.length === 0) {
      return null;
    }

    const workshop = workshopResult[0];

    // Get sessions
    const workshopSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.workshopId, id))
      .orderBy(asc(sessions.orderIndex));

    // Get questionnaires
    const workshopQuestionnaires = await db
      .select()
      .from(questionnaires)
      .where(
        and(
          eq(questionnaires.workshopId, id),
          isNull(questionnaires.deletedAt),
        ),
      )
      .orderBy(desc(questionnaires.createdAt));

    // Get tags
    const workshopTagsData = await db
      .select({
        tagId: workshopTags.tagId,
        tagName: tags.name,
        tagCategory: tags.category,
        tagColor: tags.color,
      })
      .from(workshopTags)
      .leftJoin(tags, eq(workshopTags.tagId, tags.id))
      .where(eq(workshopTags.workshopId, id));

    const workshopTagsFormatted = workshopTagsData
      .map(tag => ({
        id: tag.tagId,
        name: tag.tagName,
        category: tag.tagCategory,
        color: tag.tagColor || '#000000',
      }))
      .filter(tag => tag.name);

    return {
      ...workshop,
      creator: {
        id: workshop.creatorId,
        name: workshop.creatorName,
        email: workshop.creatorEmail,
      },
      sessions: workshopSessions,
      questionnaires: workshopQuestionnaires,
      tags: workshopTagsFormatted,
    };
  }

  /**
   * Create new workshop
   */
  static async createWorkshop(
    data: CreateWorkshopData,
    request?: Request,
  ): Promise<Workshop> {
    const userId = request?.user?.id;

    if (!userId) {
      throw new Error('User authentication required');
    }

    // Validate slug uniqueness
    const existingSlug = await db
      .select({ id: workshops.id })
      .from(workshops)
      .where(and(eq(workshops.slug, data.slug), isNull(workshops.deletedAt)))
      .limit(1);

    if (existingSlug && existingSlug.length > 0) {
      throw new Error('Workshop with this slug already exists');
    }

    // Validate i18n content has required languages
    const hasValidTitle =
      data.titleI18n &&
      Object.keys(data.titleI18n).length > 0 &&
      Object.values(data.titleI18n).some(
        title => title && title.trim().length > 0,
      );

    const hasValidDescription =
      data.descriptionI18n &&
      Object.keys(data.descriptionI18n).length > 0 &&
      Object.values(data.descriptionI18n).some(
        desc => desc && desc.trim().length > 0,
      );

    if (!hasValidTitle) {
      throw new Error(
        'Workshop must have a valid title in at least one language',
      );
    }

    if (!hasValidDescription) {
      throw new Error(
        'Workshop must have a valid description in at least one language',
      );
    }

    // Prepare workshop data
    const workshopData: InsertWorkshop = {
      slug: data.slug,
      titleI18n: data.titleI18n,
      subtitleI18n: data.subtitleI18n || null,
      descriptionI18n: data.descriptionI18n,
      shortDescriptionI18n: data.shortDescriptionI18n || null,
      status: 'draft', // Always start as draft
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      seatLimit: data.seatLimit ? data.seatLimit.toString() : null,
      enableWaitingList: data.enableWaitingList ?? true,
      templateTheme: data.templateTheme || 'custom',
      language: data.language || 'pl',
      price: data.price ? data.price.toString() : '0.00',
      currency: data.currency || 'PLN',
      imageUrl: data.imageUrl || null,
      gallery: data.gallery || null,
      requirementsI18n: data.requirementsI18n || null,
      objectivesI18n: data.objectivesI18n || null,
      materials: data.materials || null,
      createdBy: userId,
    };

    // Insert workshop
    const result = await db.insert(workshops).values(workshopData).returning();

    const workshop = result[0];

    // Handle tags if provided
    if (data.tagIds && data.tagIds.length > 0) {
      await this.addTagsToWorkshop(workshop.id, data.tagIds);
    }

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'workshops',
        workshop.id,
        'CREATE',
        null,
        workshopData,
        request?.ip,
        request?.get('User-Agent'),
      );
    }

    return workshop;
  }

  /**
   * Update workshop
   */
  static async updateWorkshop(
    id: string,
    data: UpdateWorkshopData,
    request?: Request,
  ): Promise<Workshop> {
    const userId = request?.user?.id;

    if (!userId) {
      throw new Error('User authentication required');
    }

    // Get existing workshop
    const existingWorkshop = await db
      .select()
      .from(workshops)
      .where(and(eq(workshops.id, id), isNull(workshops.deletedAt)))
      .limit(1);

    if (!existingWorkshop || existingWorkshop.length === 0) {
      throw new Error('Workshop not found');
    }

    const workshop = existingWorkshop[0];

    // Check if updating slug and validate uniqueness
    if (data.slug && data.slug !== workshop.slug) {
      const existingSlug = await db
        .select({ id: workshops.id })
        .from(workshops)
        .where(
          and(
            eq(workshops.slug, data.slug),
            isNull(workshops.deletedAt),
            sql`${workshops.id} != ${id}`,
          ),
        )
        .limit(1);

      if (existingSlug && existingSlug.length > 0) {
        throw new Error('Workshop with this slug already exists');
      }
    }

    // Validate i18n content if provided
    if (data.titleI18n) {
      const hasValidTitle =
        Object.keys(data.titleI18n).length > 0 &&
        Object.values(data.titleI18n).some(
          title => title && title.trim().length > 0,
        );

      if (!hasValidTitle) {
        throw new Error(
          'Workshop must have a valid title in at least one language',
        );
      }
    }

    if (data.descriptionI18n) {
      const hasValidDescription =
        Object.keys(data.descriptionI18n).length > 0 &&
        Object.values(data.descriptionI18n).some(
          desc => desc && desc.trim().length > 0,
        );

      if (!hasValidDescription) {
        throw new Error(
          'Workshop must have a valid description in at least one language',
        );
      }
    }

    // Prepare update data
    const updateData: Partial<InsertWorkshop> = {};

    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.titleI18n !== undefined) updateData.titleI18n = data.titleI18n;
    if (data.subtitleI18n !== undefined)
      updateData.subtitleI18n = data.subtitleI18n;
    if (data.descriptionI18n !== undefined)
      updateData.descriptionI18n = data.descriptionI18n;
    if (data.shortDescriptionI18n !== undefined)
      updateData.shortDescriptionI18n = data.shortDescriptionI18n;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.startDate !== undefined)
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined)
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.seatLimit !== undefined)
      updateData.seatLimit = data.seatLimit ? data.seatLimit.toString() : null;
    if (data.enableWaitingList !== undefined)
      updateData.enableWaitingList = data.enableWaitingList;
    if (data.templateTheme !== undefined)
      updateData.templateTheme = data.templateTheme;
    if (data.language !== undefined) updateData.language = data.language;
    if (data.price !== undefined)
      updateData.price = data.price ? data.price.toString() : '0.00';
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.gallery !== undefined) updateData.gallery = data.gallery;
    if (data.requirementsI18n !== undefined)
      updateData.requirementsI18n = data.requirementsI18n;
    if (data.objectivesI18n !== undefined)
      updateData.objectivesI18n = data.objectivesI18n;
    if (data.materials !== undefined) updateData.materials = data.materials;
    if (data.publishedAt !== undefined)
      updateData.publishedAt = data.publishedAt;

    // Set publishedAt if status is changing to published
    if (data.status === 'published' && workshop.status !== 'published') {
      updateData.publishedAt = new Date();
    }

    // Add updatedAt timestamp
    updateData.updatedAt = new Date();

    // Update workshop
    const result = await db
      .update(workshops)
      .set(updateData)
      .where(eq(workshops.id, id))
      .returning();

    const updatedWorkshop = result[0];

    // Handle tags if provided
    if (data.tagIds !== undefined) {
      // Remove existing tags
      await db.delete(workshopTags).where(eq(workshopTags.workshopId, id));

      // Add new tags
      if (data.tagIds.length > 0) {
        await this.addTagsToWorkshop(id, data.tagIds);
      }
    }

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'workshops',
        id,
        'UPDATE',
        workshop,
        updateData,
        request?.ip,
        request?.get('User-Agent'),
      );
    }

    return updatedWorkshop;
  }

  /**
   * Soft delete workshop
   */
  static async deleteWorkshop(id: string, request?: Request): Promise<void> {
    const userId = request?.user?.id;

    if (!userId) {
      throw new Error('User authentication required');
    }

    // Get existing workshop
    const existingWorkshop = await db
      .select()
      .from(workshops)
      .where(and(eq(workshops.id, id), isNull(workshops.deletedAt)))
      .limit(1);

    if (!existingWorkshop || existingWorkshop.length === 0) {
      throw new Error('Workshop not found');
    }

    const workshop = existingWorkshop[0];

    // Check if workshop can be deleted (not published with active enrollments)
    if (workshop.status === 'published') {
      // Additional check: could verify no active enrollments exist
      // For now, allow deletion but you might want to add business logic here
    }

    // Soft delete by setting deletedAt
    await db
      .update(workshops)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workshops.id, id));

    // Create audit log
    if (userId) {
      await this.createAuditLog(
        userId,
        'workshops',
        id,
        'DELETE',
        workshop,
        null,
        request?.ip,
        request?.get('User-Agent'),
      );
    }
  }

  /**
   * Check if workshop can be published
   */
  static async checkPublishingChecklist(
    id: string,
  ): Promise<WorkshopPublishChecklist> {
    // Get workshop with relations
    const workshopData = await db
      .select({
        id: workshops.id,
        titleI18n: workshops.titleI18n,
        descriptionI18n: workshops.descriptionI18n,
        status: workshops.status,
        startDate: workshops.startDate,
        endDate: workshops.endDate,
        sessionCount: count(sessions.id),
        questionnaireCount: count(questionnaires.id),
      })
      .from(workshops)
      .leftJoin(sessions, eq(workshops.id, sessions.workshopId))
      .leftJoin(questionnaires, eq(workshops.id, questionnaires.workshopId))
      .where(and(eq(workshops.id, id), isNull(workshops.deletedAt)))
      .groupBy(workshops.id)
      .limit(1);

    if (!workshopData || workshopData.length === 0) {
      throw new Error('Workshop not found');
    }

    const workshop = workshopData[0];
    const errors: string[] = [];

    // Check sessions
    const hasSessions = Number(workshop.sessionCount) > 0;
    if (!hasSessions) {
      errors.push('Workshop must have at least one session');
    }

    // Check questionnaires
    const hasQuestionnaire = Number(workshop.questionnaireCount) > 0;
    if (!hasQuestionnaire) {
      errors.push('Workshop must have at least one questionnaire');
    }

    // Check required fields
    const titleValid =
      workshop.titleI18n &&
      Object.keys(workshop.titleI18n).length > 0 &&
      Object.values(workshop.titleI18n).some(
        title => title && title.trim().length > 0,
      );

    const descriptionValid =
      workshop.descriptionI18n &&
      Object.keys(workshop.descriptionI18n).length > 0 &&
      Object.values(workshop.descriptionI18n).some(
        desc => desc && desc.trim().length > 0,
      );

    const datesValid =
      workshop.startDate &&
      workshop.endDate &&
      new Date(workshop.startDate) < new Date(workshop.endDate);

    const allRequiredFields = titleValid && descriptionValid && datesValid;
    if (!allRequiredFields) {
      if (!titleValid)
        errors.push(
          'Workshop must have a valid title in at least one language',
        );
      if (!descriptionValid)
        errors.push(
          'Workshop must have a valid description in at least one language',
        );
      if (!datesValid)
        errors.push('Workshop must have valid start and end dates');
    }

    // WCAG compliance check (placeholder - would need actual implementation)
    const wcagCompliant = true; // TODO: Implement actual WCAG validation
    if (!wcagCompliant) {
      errors.push('Workshop must meet WCAG accessibility standards');
    }

    const canPublish =
      hasSessions && hasQuestionnaire && allRequiredFields && wcagCompliant;

    return {
      hasSessions,
      hasQuestionnaire,
      allRequiredFields,
      wcagCompliant,
      canPublish,
      errors,
    };
  }

  /**
   * Helper method to add tags to workshop
   */
  private static async addTagsToWorkshop(
    workshopId: string,
    tagIds: string[],
  ): Promise<void> {
    const tagRelations = tagIds.map(tagId => ({
      workshopId,
      tagId,
      createdAt: new Date(),
    }));

    await db.insert(workshopTags).values(tagRelations);
  }

  /**
   * Helper method to create audit log
   */
  private static async createAuditLog(
    userId: string,
    tableName: string,
    recordId: string,
    operation: string,
    oldValues: any = null,
    newValues: any = null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await RLSHelper.createAuditLog(
        userId,
        tableName,
        recordId,
        operation,
        oldValues,
        newValues,
        ipAddress,
        userAgent,
      );
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }
}
