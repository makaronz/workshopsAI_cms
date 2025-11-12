import { db } from "../config/database";
import {
  workshops,
  sessions,
  modules,
  users,
  workshopTags,
  workshopFacilitators,
  workshopLocations,
  tags,
  facilitators,
  locations,
  enrollments,
} from "../models/schema";
import { eq, and, or, desc, asc, like, count, gte, lte, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";
import type {
  CreateWorkshopInput,
  UpdateWorkshopInput,
  WorkshopFilter,
} from "../types/validation";

export class WorkshopService {
  // Create workshop
  static async createWorkshop(userId: number, data: CreateWorkshopInput) {
    const workshopId = uuidv4();

    // Create workshop with slug if not provided
    const slug = data.slug || slugify(data.title, { lower: true, strict: true });

    const [workshop] = await db.insert(workshops).values({
      id: workshopId,
      title: data.title,
      slug,
      subtitle: data.subtitle,
      description: data.description,
      shortDescription: data.shortDescription,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      seatLimit: data.seatLimit,
      enableWaitingList: data.enableWaitingList,
      templateTheme: data.templateTheme,
      language: data.language,
      price: data.price.toString(),
      currency: data.currency,
      imageUrl: data.imageUrl || null,
      gallery: data.gallery,
      requirements: data.requirements,
      objectives: data.objectives,
      materials: data.materials,
      createdBy: userId,
      status: "draft",
    }).returning();

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
      await this.addWorkshopLocations(workshopId, data.locationIds, data.locationIds[0]);
    }

    return workshop;
  }

  // Update workshop
  static async updateWorkshop(id: string, userId: number, data: UpdateWorkshopInput) {
    // Check if workshop exists and user has permission
    const workshop = await this.getWorkshopById(id);
    if (!workshop) {
      throw new Error("Workshop not found");
    }

    // Check if user is creator or admin
    if (workshop.createdBy !== userId) {
      throw new Error("Permission denied");
    }

    // Update slug if title changed and slug not provided
    let updateData = { ...data };
    if (data.title && !data.slug) {
      updateData.slug = slugify(data.title, { lower: true, strict: true });
    }

    const [updatedWorkshop] = await db
      .update(workshops)
      .set({
        ...updateData,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        price: data.price?.toString(),
        updatedAt: new Date(),
      })
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
      await this.updateWorkshopLocations(id, data.locationIds, data.locationIds[0]);
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
          orderBy: [asc(sessions.order)],
          with: {
            modules: {
              orderBy: [asc(modules.order)],
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
        workshopLocations: {
          with: {
            location: true,
          },
        },
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
          orderBy: [asc(sessions.order)],
          with: {
            modules: {
              orderBy: [asc(modules.order)],
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
        workshopLocations: {
          with: {
            location: true,
          },
        },
      },
    });

    return workshop;
  }

  // List workshops with filtering and pagination
  static async listWorkshops(filter: WorkshopFilter) {
    const {
      page,
      limit,
      sortBy = "createdAt",
      sortOrder = "desc",
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

    if (search) {
      conditions.push(
        or(
          like(workshops.title, `%${search}%`),
          like(workshops.description, `%${search}%`),
          like(workshops.subtitle, `%${search}%`)
        )
      );
    }

    // Get workshop IDs by tags
    if (tagIds && tagIds.length > 0) {
      const tagWorkshops = await db
        .select({ workshopId: workshopTags.workshopId })
        .from(workshopTags)
        .where(inArray(workshopTags.tagId, tagIds));

      const workshopIdsByTags = tagWorkshops.map((tw) => tw.workshopId);
      conditions.push(inArray(workshops.id, workshopIdsByTags));
    }

    // Get workshop IDs by facilitators
    if (facilitatorIds && facilitatorIds.length > 0) {
      const facilitatorWorkshops = await db
        .select({ workshopId: workshopFacilitators.workshopId })
        .from(workshopFacilitators)
        .where(inArray(workshopFacilitators.facilitatorId, facilitatorIds));

      const workshopIdsByFacilitators = facilitatorWorkshops.map((fw) => fw.workshopId);
      conditions.push(inArray(workshops.id, workshopIdsByFacilitators));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Build order clause
    const orderClause = sortOrder === "asc" ? asc(workshops[sortBy]) : desc(workshops[sortBy]);

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
        _count: {
          enrollments: true,
        },
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
  static async publishWorkshop(id: string, userId: number, publishDate?: Date) {
    const workshop = await this.getWorkshopById(id);
    if (!workshop) {
      throw new Error("Workshop not found");
    }

    if (workshop.createdBy !== userId) {
      throw new Error("Permission denied");
    }

    // Validate required fields
    if (!workshop.title || !workshop.description) {
      throw new Error("Title and description are required to publish workshop");
    }

    const [publishedWorkshop] = await db
      .update(workshops)
      .set({
        status: "published",
        publishedAt: publishDate || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workshops.id, id))
      .returning();

    return publishedWorkshop;
  }

  // Archive workshop
  static async archiveWorkshop(id: string, userId: number) {
    const workshop = await this.getWorkshopById(id);
    if (!workshop) {
      throw new Error("Workshop not found");
    }

    if (workshop.createdBy !== userId) {
      throw new Error("Permission denied");
    }

    const [archivedWorkshop] = await db
      .update(workshops)
      .set({
        status: "archived",
        updatedAt: new Date(),
      })
      .where(eq(workshops.id, id))
      .returning();

    return archivedWorkshop;
  }

  // Delete workshop
  static async deleteWorkshop(id: string, userId: number) {
    const workshop = await this.getWorkshopById(id);
    if (!workshop) {
      throw new Error("Workshop not found");
    }

    if (workshop.createdBy !== userId) {
      throw new Error("Permission denied");
    }

    // Check if workshop has enrollments
    const [enrollmentCount] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(eq(enrollments.workshopId, id));

    if (enrollmentCount.count > 0) {
      throw new Error("Cannot delete workshop with enrollments");
    }

    await db.delete(workshops).where(eq(workshops.id, id));

    return { success: true };
  }

  // Duplicate workshop
  static async duplicateWorkshop(id: string, userId: number, newTitle: string) {
    const originalWorkshop = await this.getWorkshopById(id);
    if (!originalWorkshop) {
      throw new Error("Workshop not found");
    }

    const newWorkshopId = uuidv4();
    const newSlug = slugify(newTitle, { lower: true, strict: true });

    // Create duplicate workshop
    const [duplicateWorkshop] = await db
      .insert(workshops)
      .values({
        id: newWorkshopId,
        title: newTitle,
        slug: newSlug,
        subtitle: originalWorkshop.subtitle,
        description: originalWorkshop.description,
        shortDescription: originalWorkshop.shortDescription,
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
        requirements: originalWorkshop.requirements,
        objectives: originalWorkshop.objectives,
        materials: originalWorkshop.materials,
        createdBy: userId,
        status: "draft",
      })
      .returning();

    // Duplicate sessions and modules
    for (const session of originalWorkshop.sessions) {
      const newSessionId = uuidv4();

      await db.insert(sessions).values({
        id: newSessionId,
        workshopId: newWorkshopId,
        title: session.title,
        description: session.description,
        startTime: null, // Reset dates
        endTime: null,
        duration: session.duration,
        location: session.location,
        materials: session.materials,
        isRequired: session.isRequired,
        maxParticipants: session.maxParticipants,
        order: session.order,
      });

      // Duplicate modules
      for (const module of session.modules) {
        await db.insert(modules).values({
          id: uuidv4(),
          sessionId: newSessionId,
          title: module.title,
          type: module.type,
          content: module.content,
          duration: module.duration,
          order: module.order,
          isRequired: module.isRequired,
          resources: module.resources,
          settings: module.settings,
        });
      }
    }

    // Copy tags
    const tagIds = originalWorkshop.workshopTags.map((wt) => wt.tagId);
    if (tagIds.length > 0) {
      await this.addWorkshopTags(newWorkshopId, tagIds);
    }

    // Copy facilitators
    const facilitatorIds = originalWorkshop.workshopFacilitators.map((wf) => wf.facilitatorId);
    if (facilitatorIds.length > 0) {
      await this.addWorkshopFacilitators(newWorkshopId, facilitatorIds);
    }

    // Copy locations
    const locationIds = originalWorkshop.workshopLocations.map((wl) => wl.locationId);
    if (locationIds.length > 0) {
      await this.addWorkshopLocations(newWorkshopId, locationIds, locationIds[0]);
    }

    return duplicateWorkshop;
  }

  // Helper methods
  private static async addWorkshopTags(workshopId: string, tagIds: number[]) {
    const values = tagIds.map((tagId) => ({
      workshopId,
      tagId,
    }));

    await db.insert(workshopTags).values(values);
  }

  private static async updateWorkshopTags(workshopId: string, tagIds: number[]) {
    // Remove existing tags
    await db.delete(workshopTags).where(eq(workshopTags.workshopId, workshopId));

    // Add new tags
    if (tagIds.length > 0) {
      await this.addWorkshopTags(workshopId, tagIds);
    }
  }

  private static async addWorkshopFacilitators(
    workshopId: string,
    facilitatorIds: number[],
    role: "lead" | "assistant" | "guest" = "assistant"
  ) {
    const values = facilitatorIds.map((facilitatorId, index) => ({
      workshopId,
      facilitatorId,
      role: index === 0 ? "lead" : role, // First facilitator is lead
    }));

    await db.insert(workshopFacilitators).values(values);
  }

  private static async updateWorkshopFacilitators(
    workshopId: string,
    facilitatorIds: number[]
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

  private static async addWorkshopLocations(
    workshopId: string,
    locationIds: number[],
    primaryLocationId?: number
  ) {
    const values = locationIds.map((locationId) => ({
      workshopId,
      locationId,
      isPrimary: locationId === primaryLocationId,
    }));

    await db.insert(workshopLocations).values(values);
  }

  private static async updateWorkshopLocations(
    workshopId: string,
    locationIds: number[],
    primaryLocationId?: number
  ) {
    // Remove existing locations
    await db
      .delete(workshopLocations)
      .where(eq(workshopLocations.workshopId, workshopId));

    // Add new locations
    if (locationIds.length > 0) {
      await this.addWorkshopLocations(workshopId, locationIds, primaryLocationId);
    }
  }
}