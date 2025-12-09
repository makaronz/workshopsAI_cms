import { db } from '../config/database';
import {
  workshops,
  sessions,
  modules,
  users,
  workshopTags,
  workshopFacilitators,
  tags,
  facilitators,
  locations,
  enrollments,
} from '../models/postgresql-schema';
import {
  eq,
  and,
  or,
  desc,
  asc,
  like,
  count,
  gte,
  lte,
  inArray,
} from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import type {
  CreateWorkshopInput,
  UpdateWorkshopInput,
} from '../types/validation';

// Define WorkshopFilter interface with all needed properties
interface WorkshopFilter {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: 'draft' | 'published' | 'archived' | 'cancelled';
  templateTheme?: 'integracja' | 'konflikty' | 'well-being' | 'custom';
  language?: 'pl' | 'en';
  tagIds?: string[];
  facilitatorIds?: string[];
  startDateFrom?: string;
  startDateTo?: string;
  search?: string;
}

export class WorkshopService {
  // Create workshop
  static async createWorkshop(userId: string, data: CreateWorkshopInput) {
    const workshopId = uuidv4();

    // Create workshop with slug if not provided
    const slug =
      data.slug || slugify(data.title, { lower: true, strict: true });

    // Note: Workshop schema uses i18n fields (titleI18n, descriptionI18n, etc.)
    // This insert needs to be refactored to use proper i18n structure
    const [workshop] = await db
      .insert(workshops)
      .values({
        titleI18n: { [data.language || 'pl']: data.title },
        slug,
        subtitleI18n: data.subtitle ? { [data.language || 'pl']: data.subtitle } : undefined,
        descriptionI18n: { [data.language || 'pl']: data.description },
        shortDescriptionI18n: data.shortDescription ? { [data.language || 'pl']: data.shortDescription } : undefined,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        seatLimit: data.seatLimit?.toString(),
        enableWaitingList: data.enableWaitingList,
        templateTheme: data.templateTheme,
        language: data.language,
        price: data.price?.toString() ?? '0',
        currency: data.currency,
        imageUrl: data.imageUrl || null,
        gallery: data.gallery,
        requirementsI18n: data.requirements ? { [data.language || 'pl']: data.requirements } : undefined,
        objectivesI18n: data.objectives ? { [data.language || 'pl']: data.objectives } : undefined,
        materials: data.materials?.filter(m => m.name && m.url && m.type).map(m => ({
          name: m.name,
          url: m.url,
          type: m.type
        })) || [],
        createdBy: userId,
        status: 'draft',
      })
      .returning();

    // Handle tags
    if (data.tagIds && data.tagIds.length > 0) {
      await this.addWorkshopTags(workshopId, data.tagIds);
    }

    // Handle facilitators
    if (data.facilitatorIds && data.facilitatorIds.length > 0) {
      await this.addWorkshopFacilitators(workshopId, data.facilitatorIds);
    }

    // Handle locations
    if (data.locationIds && data.locationIds.length > 0) {
      await this.addWorkshopLocations(
        workshopId,
        data.locationIds,
        data.locationIds[0],
      );
    }

    return workshop;
  }

  // Update workshop
  static async updateWorkshop(
    id: string,
    userId: string,
    data: UpdateWorkshopInput,
  ) {
    // Check if workshop exists and user has permission
    const workshop = await this.getWorkshopById(id);
    if (!workshop) {
      throw new Error('Workshop not found');
    }

    // Check if user is creator or admin
    if (workshop.createdBy !== userId) {
      throw new Error('Permission denied');
    }

    // Update slug if title changed and slug not provided
    const updateData = { ...data };
    if (data.title && !data.slug) {
      updateData.slug = slugify(data.title, { lower: true, strict: true });
    }

    // Only update valid workshop fields
    const validUpdateFields: Record<string, any> = {};
    if (updateData.slug) validUpdateFields.slug = updateData.slug;
    if (data.startDate) validUpdateFields.startDate = new Date(data.startDate);
    if (data.endDate) validUpdateFields.endDate = new Date(data.endDate);
    if (data.price !== undefined) validUpdateFields.price = data.price.toString();
    if (updateData.templateTheme) validUpdateFields.templateTheme = updateData.templateTheme;
    if (updateData.language) validUpdateFields.language = updateData.language;
    if (updateData.imageUrl !== undefined) validUpdateFields.imageUrl = updateData.imageUrl;
    if (updateData.gallery) validUpdateFields.gallery = updateData.gallery;
    if (updateData.materials) validUpdateFields.materials = updateData.materials;
    if (updateData.enableWaitingList !== undefined) validUpdateFields.enableWaitingList = updateData.enableWaitingList;
    if (updateData.seatLimit !== undefined) validUpdateFields.seatLimit = updateData.seatLimit;
    validUpdateFields.updatedAt = new Date();

    const [updatedWorkshop] = await db
      .update(workshops)
      .set(validUpdateFields)
      .where(eq(workshops.id, id))
      .returning();

    // Handle tags update
    if (data.tagIds !== undefined) {
      await this.updateWorkshopTags(id, data.tagIds);
    }

    // Handle facilitators update
    if (data.facilitatorIds !== undefined) {
      await this.updateWorkshopFacilitators(id, data.facilitatorIds);
    }

    // Handle locations update
    if (data.locationIds !== undefined) {
      await this.updateWorkshopLocations(
        id,
        data.locationIds,
        data.locationIds[0],
      );
    }

    return updatedWorkshop;
  }

  // Get workshop by ID with relations
  static async getWorkshopById(id: string) {
    const workshop = await db.query.workshops.findFirst({
      where: eq(workshops.id, id),
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        sessions: {
          // Note: orderBy removed - 'order' field doesn't exist on sessions
          with: {
            modules: {
              // Note: orderBy removed - 'order' field doesn't exist on modules
            },
          },
        },
        workshopTags: {
          with: {
            tag: true,
          },
        },
        workshopFacilitators: {
          with: {
            facilitator: {
              with: {
                user: {
                  columns: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        // Note: workshopLocations relation doesn't exist in schema
        enrollments: {
          with: {
            participant: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return workshop;
  }

  // Get workshop by slug with relations
  static async getWorkshopBySlug(slug: string) {
    const workshop = await db.query.workshops.findFirst({
      where: eq(workshops.slug, slug),
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        sessions: {
          // Note: orderBy removed - 'order' field doesn't exist
          with: {
            modules: {
              // Note: orderBy removed - 'order' field doesn't exist
            },
          },
        },
        workshopTags: {
          with: {
            tag: true,
          },
        },
        workshopFacilitators: {
          with: {
            facilitator: {
              with: {
                user: {
                  columns: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        // Note: workshopLocations relation doesn't exist in schema
      },
    });

    return workshop;
  }

  // List workshops with filtering and pagination
  static async listWorkshops(filter: WorkshopFilter) {
    const {
      page,
      limit,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      templateTheme,
      language,
      tagIds,
      facilitatorIds,
      startDateFrom,
      startDateTo,
      search,
    } = filter;

    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];

    if (status) {
      conditions.push(eq(workshops.status, status));
    }

    if (templateTheme) {
      conditions.push(eq(workshops.templateTheme, templateTheme));
    }

    if (language) {
      conditions.push(eq(workshops.language, language));
    }

    if (startDateFrom) {
      conditions.push(gte(workshops.startDate, new Date(startDateFrom)));
    }

    if (startDateTo) {
      conditions.push(lte(workshops.startDate, new Date(startDateTo)));
    }

    // Note: Search disabled - fields are i18n (titleI18n, etc.) and require JSONB queries
    // TODO: Implement proper i18n search using JSONB operators
    if (search) {
      // Temporary: search by slug only
      conditions.push(like(workshops.slug, `%${search}%`));
    }

    // Get workshop IDs by tags
    if (tagIds && tagIds.length > 0) {
      const tagWorkshops = await db
        .select({ workshopId: workshopTags.workshopId })
        .from(workshopTags)
        .where(inArray(workshopTags.tagId, tagIds));

      const workshopIdsByTags = tagWorkshops.map(tw => tw.workshopId);
      conditions.push(inArray(workshops.id, workshopIdsByTags));
    }

    // Get workshop IDs by facilitators
    if (facilitatorIds && facilitatorIds.length > 0) {
      const facilitatorWorkshops = await db
        .select({ workshopId: workshopFacilitators.workshopId })
        .from(workshopFacilitators)
        .where(inArray(workshopFacilitators.facilitatorId, facilitatorIds));

      const workshopIdsByFacilitators = facilitatorWorkshops.map(
        fw => fw.workshopId,
      );
      conditions.push(inArray(workshops.id, workshopIdsByFacilitators));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Build order clause - validate sortBy to avoid index errors
    const sortByMapping = {
      createdAt: workshops.createdAt,
      updatedAt: workshops.updatedAt,
      slug: workshops.slug,
      status: workshops.status,
      publishedAt: workshops.publishedAt,
    } as const;

    const sortColumn = sortByMapping[sortBy as keyof typeof sortByMapping] ?? workshops.createdAt;
    const orderClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Get total count
    const [totalCountResult] = await db
      .select({ count: count() })
      .from(workshops)
      .where(whereClause);

    const total = totalCountResult.count;

    // Get workshops
    const workshopList = await db.query.workshops.findMany({
      where: whereClause,
      orderBy: [orderClause],
      limit,
      offset,
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
          },
        },
        workshopTags: {
          with: {
            tag: true,
          },
        },
        workshopFacilitators: {
          with: {
            facilitator: {
              with: {
                user: {
                  columns: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        // Note: _count is not supported in this query builder version
      },
    });

    return {
      workshops: workshopList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Publish workshop
  static async publishWorkshop(id: string, userId: string, publishDate?: Date) {
    const workshop = await this.getWorkshopById(id);
    if (!workshop) {
      throw new Error('Workshop not found');
    }

    if (workshop.createdBy !== userId) {
      throw new Error('Permission denied');
    }

    // Validate required fields (i18n fields)
    if (!workshop.titleI18n || !workshop.descriptionI18n) {
      throw new Error('Title and description are required to publish workshop');
    }

    const [publishedWorkshop] = await db
      .update(workshops)
      .set({
        status: 'published',
        publishedAt: publishDate || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workshops.id, id))
      .returning();

    return publishedWorkshop;
  }

  // Archive workshop
  static async archiveWorkshop(id: string, userId: string) {
    const workshop = await this.getWorkshopById(id);
    if (!workshop) {
      throw new Error('Workshop not found');
    }

    if (workshop.createdBy !== userId) {
      throw new Error('Permission denied');
    }

    const [archivedWorkshop] = await db
      .update(workshops)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(workshops.id, id))
      .returning();

    return archivedWorkshop;
  }

  // Delete workshop
  static async deleteWorkshop(id: string, userId: string) {
    const workshop = await this.getWorkshopById(id);
    if (!workshop) {
      throw new Error('Workshop not found');
    }

    if (workshop.createdBy !== userId) {
      throw new Error('Permission denied');
    }

    // Check if workshop has enrollments
    const [enrollmentCount] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(eq(enrollments.workshopId, id));

    if (enrollmentCount.count > 0) {
      throw new Error('Cannot delete workshop with enrollments');
    }

    await db.delete(workshops).where(eq(workshops.id, id));

    return { success: true };
  }

  // Duplicate workshop
  static async duplicateWorkshop(id: string, userId: string, newTitle: string) {
    const originalWorkshop = await this.getWorkshopById(id);
    if (!originalWorkshop) {
      throw new Error('Workshop not found');
    }

    const newWorkshopId = uuidv4();
    const newSlug = slugify(newTitle, { lower: true, strict: true });

    // Create duplicate workshop (using i18n fields)
    const [duplicateWorkshop] = await db
      .insert(workshops)
      .values({
        id: newWorkshopId,
        titleI18n: { ...originalWorkshop.titleI18n as object, [originalWorkshop.language]: newTitle },
        slug: newSlug,
        subtitleI18n: originalWorkshop.subtitleI18n,
        descriptionI18n: originalWorkshop.descriptionI18n,
        shortDescriptionI18n: originalWorkshop.shortDescriptionI18n,
        startDate: null, // Reset dates for duplicate
        endDate: null,
        seatLimit: originalWorkshop.seatLimit,
        enableWaitingList: originalWorkshop.enableWaitingList,
        templateTheme: originalWorkshop.templateTheme,
        language: originalWorkshop.language,
        price: originalWorkshop.price,
        currency: originalWorkshop.currency,
        imageUrl: originalWorkshop.imageUrl,
        gallery: originalWorkshop.gallery,
        requirementsI18n: originalWorkshop.requirementsI18n,
        objectivesI18n: originalWorkshop.objectivesI18n,
        materials: originalWorkshop.materials,
        createdBy: userId,
        status: 'draft',
      })
      .returning();

    // Duplicate sessions and modules
    if (originalWorkshop.sessions && originalWorkshop.sessions.length > 0) {
      for (const session of originalWorkshop.sessions) {
        const newSessionId = uuidv4();

        await db.insert(sessions).values({
          id: newSessionId,
          workshopId: newWorkshopId,
          titleI18n: session.titleI18n,
          descriptionI18n: session.descriptionI18n,
          startTime: session.startTime ?? new Date(), // Use existing or current timestamp
          endTime: session.endTime ?? new Date(),
          duration: session.duration,
          locationId: session.locationId,
          materials: session.materials,
          isRequired: session.isRequired,
          maxParticipants: session.maxParticipants,
          // Note: 'order' field doesn't exist in sessions schema
        });

        // Duplicate modules
        if (session.modules && session.modules.length > 0) {
          for (const module of session.modules) {
            await db.insert(modules).values({
              id: uuidv4(),
              sessionId: newSessionId,
              titleI18n: module.titleI18n,
              type: module.type,
              contentI18n: module.contentI18n,
              duration: module.duration,
              // Note: 'order' field doesn't exist in modules schema
              isRequired: module.isRequired,
              resources: module.resources,
              settings: module.settings,
            });
          }
        }
      }
    }

    // Copy tags
    if (originalWorkshop.workshopTags && originalWorkshop.workshopTags.length > 0) {
      const tagIds = originalWorkshop.workshopTags.map((wt: any) => wt.tagId);
      await this.addWorkshopTags(newWorkshopId, tagIds);
    }

    // Copy facilitators
    if (originalWorkshop.workshopFacilitators && originalWorkshop.workshopFacilitators.length > 0) {
      const facilitatorIds = originalWorkshop.workshopFacilitators.map(
        (wf: any) => wf.facilitatorId,
      );
      await this.addWorkshopFacilitators(newWorkshopId, facilitatorIds);
    }

    // Note: workshopLocations relation doesn't exist in schema - skipping location duplication

    return duplicateWorkshop;
  }

  // Helper methods
  private static async addWorkshopTags(workshopId: string, tagIds: any[]) {
    const values = tagIds.map((tagId: string) => ({
      workshopId,
      tagId,
      createdAt: new Date(),
    }));

    await db.insert(workshopTags).values(values);
  }

  private static async updateWorkshopTags(
    workshopId: string,
    tagIds: any[],
  ) {
    // Remove existing tags
    await db
      .delete(workshopTags)
      .where(eq(workshopTags.workshopId, workshopId));

    // Add new tags
    if (tagIds.length > 0) {
      await this.addWorkshopTags(workshopId, tagIds);
    }
  }

  private static async addWorkshopFacilitators(
    workshopId: string,
    facilitatorIds: any[],
    role: 'lead' | 'assistant' | 'guest' = 'assistant',
  ) {
    const values = facilitatorIds.map((facilitatorId: string, index: number) => ({
      workshopId,
      facilitatorId,
      role: index === 0 ? 'lead' : role, // First facilitator is lead
      createdAt: new Date(),
    }));

    await db.insert(workshopFacilitators).values(values);
  }

  private static async updateWorkshopFacilitators(
    workshopId: string,
    facilitatorIds: any[],
  ) {
    // Remove existing facilitators
    await db
      .delete(workshopFacilitators)
      .where(eq(workshopFacilitators.workshopId, workshopId));

    // Add new facilitators
    if (facilitatorIds.length > 0) {
      await this.addWorkshopFacilitators(workshopId, facilitatorIds);
    }
  }

  // Note: workshopLocations relation doesn't exist in the database schema
  // These methods are commented out until the schema is updated
  /*
  private static async addWorkshopLocations(
    workshopId: string,
    locationIds: number[],
    primaryLocationId?: number,
  ) {
    // TODO: Implement when workshopLocations table/relation is added to schema
  }

  private static async updateWorkshopLocations(
    workshopId: string,
    locationIds: number[],
    primaryLocationId?: number,
  ) {
    // TODO: Implement when workshopLocations table/relation is added to schema
  }
  */

  // Placeholder methods to avoid compilation errors
  private static async addWorkshopLocations(
    workshopId: string,
    locationIds: any[],
    primaryLocationId?: any,
  ): Promise<void> {
    // No-op: workshopLocations table doesn't exist yet
    console.warn('addWorkshopLocations called but workshopLocations table does not exist');
  }

  private static async updateWorkshopLocations(
    workshopId: string,
    locationIds: any[],
    primaryLocationId?: any,
  ): Promise<void> {
    // No-op: workshopLocations table doesn't exist yet
    console.warn('updateWorkshopLocations called but workshopLocations table does not exist');
  }
}
