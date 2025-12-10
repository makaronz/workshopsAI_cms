import { Request } from 'express';
import { eq, and, desc, asc, sql, isNull } from 'drizzle-orm';
import { db, withRLS, RLSHelper } from '../config/postgresql-database';
import {
  workshops,
  sessions,
  modules,
  auditLogs,
  Workshop,
  Session,
  Module,
} from '../models/postgresql-schema';

// Types
export interface CreateSessionData {
  titleI18n: Record<string, string>;
  descriptionI18n?: Record<string, string>;
  startTime: Date;
  endTime: Date;
  duration?: number;
  locationId?: string;
  materials?: Array<{ name: string; url: string; type: string }>;
  isRequired?: boolean;
}

export interface UpdateSessionData extends Partial<CreateSessionData> {}

export interface CreateModuleData {
  titleI18n?: Record<string, string>;
  type: 'text' | 'video' | 'quiz' | 'exercise' | 'discussion' | 'presentation' | 'file' | 'questionnaire';
  contentI18n: Record<string, any>;
  duration?: number;
  isRequired?: boolean;
  resources?: Array<{ name: string; url: string; type: string }>;
  settings?: Record<string, any>;
}

export interface UpdateModuleData extends Partial<CreateModuleData> {}

export interface ReorderSessionsData {
  sessionOrders: Array<{ id: string; order: number }>;
}

export interface ReorderModulesData {
  moduleOrders: Array<{ id: string; order: number }>;
}

/**
 * Session and Module CRUD Service
 */
export class SessionModuleService {
  /**
   * Get all sessions for a workshop
   */
  static async getSessions(
    workshopId: string,
    request?: Request,
  ): Promise<Session[]> {
    const userId = request?.user?.id;
    const userRole = request?.user?.role;
    const isAdmin = userRole === 'admin';

    // For public access, no RLS context needed
    const executeQuery = async () => {
      // Check if workshop exists
      const workshopCheck = await db
        .select()
        .from(workshops)
        .where(and(eq(workshops.id, workshopId), isNull(workshops.deletedAt)))
        .limit(1);

      if (workshopCheck.length === 0) {
        throw new Error('Workshop not found');
      }

      const workshop = workshopCheck[0];

      // Simple permission check: workshop owner or admin can access
      if (!isAdmin && workshop.createdBy !== userId) {
        throw new Error('Access denied');
      }

      // Get sessions with order
      const sessionList = await db
        .select()
        .from(sessions)
        .where(eq(sessions.workshopId, workshopId))
        .orderBy(asc(sessions.orderIndex));

      return sessionList.map(session => this.transformSessionToAPI(session));
    };

    if (userId) {
      return withRLS(userId, userRole || 'participant', isAdmin, executeQuery);
    } else {
      return executeQuery();
    }
  }

  /**
   * Create a new session
   */
  static async createSession(
    workshopId: string,
    data: CreateSessionData,
    request?: Request,
  ): Promise<Session> {
    const userId = request?.user?.id;
    const userRole = request?.user?.role;
    const isAdmin = userRole === 'admin';

    if (!userId) {
      throw new Error('User authentication required');
    }

    const executeQuery = async () => {
      // Check if workshop exists and user owns it
      const workshopCheck = await db
        .select()
        .from(workshops)
        .where(and(eq(workshops.id, workshopId), isNull(workshops.deletedAt)))
        .limit(1);

      if (workshopCheck.length === 0) {
        throw new Error('Workshop not found');
      }

      const workshop = workshopCheck[0];

      // Simple permission check: workshop owner or admin can create sessions
      if (!isAdmin && workshop.createdBy !== userId) {
        throw new Error('Insufficient permissions');
      }

      // Get the highest orderIndex for this workshop
      const lastOrder = await db
        .select({ orderIndex: sessions.orderIndex })
        .from(sessions)
        .where(eq(sessions.workshopId, workshopId))
        .orderBy(desc(sessions.orderIndex))
        .limit(1);

      const nextOrder = lastOrder.length > 0 ? Number(lastOrder[0].orderIndex) + 1 : 0;

      // Create session
      const [newSession] = await db
        .insert(sessions)
        .values({
          workshopId,
          titleI18n: data.titleI18n,
          descriptionI18n: data.descriptionI18n || {},
          startTime: data.startTime,
          endTime: data.endTime,
          duration: data.duration ? data.duration.toString() : null,
          orderIndex: nextOrder.toString(),
          locationId: data.locationId || null,
          materials: data.materials || [],
          isRequired: data.isRequired ?? true,
        })
        .returning();

      return this.transformSessionToAPI(newSession);
    };

    return withRLS(userId, userRole || 'participant', isAdmin, executeQuery);
  }

  /**
   * Update a session
   */
  static async updateSession(
    sessionId: string,
    data: UpdateSessionData,
    request?: Request,
    workshopId?: string,
  ): Promise<Session> {
    const userId = request?.user?.id;
    const userRole = request?.user?.role;
    const isAdmin = userRole === 'admin';

    if (!userId) {
      throw new Error('User authentication required');
    }

    const executeQuery = async () => {
      // Check if session exists and get workshop for permission check
      const sessionCheck = await db
        .select({
          session: sessions,
          workshop: workshops,
        })
        .from(sessions)
        .leftJoin(workshops, eq(sessions.workshopId, workshops.id))
        .where(eq(sessions.id, sessionId))
        .limit(1);

      if (sessionCheck.length === 0) {
        throw new Error('Session not found');
      }

      const sessionData = sessionCheck[0];
      const workshop = sessionData.workshop;

      if (!workshop) {
        throw new Error('Associated workshop not found');
      }

      // Simple permission check: workshop owner or admin can update sessions
      if (!isAdmin && workshop.createdBy !== userId) {
        throw new Error('Insufficient permissions');
      }

      // Update session
      const updateData: any = {};
      if (data.titleI18n) updateData.titleI18n = data.titleI18n;
      if (data.descriptionI18n !== undefined) updateData.descriptionI18n = data.descriptionI18n;
      if (data.startTime) updateData.startTime = data.startTime;
      if (data.endTime) updateData.endTime = data.endTime;
      if (data.duration !== undefined) updateData.duration = data.duration ? data.duration.toString() : null;
      if (data.locationId !== undefined) updateData.locationId = data.locationId || null;
      if (data.materials !== undefined) updateData.materials = data.materials;
      if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;

      const [updatedSession] = await db
        .update(sessions)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId))
        .returning();

      return this.transformSessionToAPI(updatedSession);
    };

    return withRLS(userId, userRole || 'participant', isAdmin, executeQuery);
  }

  /**
   * Delete a session
   */
  static async deleteSession(
    sessionId: string,
    request?: Request,
    workshopId?: string,
  ): Promise<void> {
    const userId = request?.user?.id;
    const userRole = request?.user?.role;
    const isAdmin = userRole === 'admin';

    const executeWithRLS = async () => {
      // Check if session exists and get workshop for permission check
      const sessionCheck = await db
        .select({
          session: sessions,
          workshop: workshops,
        })
        .from(sessions)
        .leftJoin(workshops, eq(sessions.workshopId, workshops.id))
        .where(eq(sessions.id, sessionId))
        .limit(1);

      if (sessionCheck.length === 0) {
        throw new Error('Session not found');
      }

      const sessionData = sessionCheck[0];
      const workshop = sessionData.workshop;

      if (!workshop) {
        throw new Error('Associated workshop not found');
      }

      // Check edit permissions
      if (!isAdmin && workshop.createdBy !== userId) {
        const hasPermission = await RLSHelper.checkWorkshopAccess(
          workshop.id,
          userId || '',
          userRole || 'participant',
        );
        if (!hasPermission || !['sociologist-editor', 'admin'].includes(userRole || '')) {
          throw new Error('Insufficient permissions');
        }
      }

      // Delete session (modules will be cascade deleted)
      await db.delete(sessions).where(eq(sessions.id, sessionId));

      // Log audit
      await this.logAudit('DELETE', 'session', sessionId, userId || null);
    };

    return withRLS(userId || null, userRole || 'participant', isAdmin, executeWithRLS);
  }

  /**
   * Reorder sessions
   */
  static async reorderSessions(
    workshopId: string,
    data: ReorderSessionsData,
    request?: Request,
  ): Promise<Session[]> {
    const userId = request?.user?.id;
    const userRole = request?.user?.role;
    const isAdmin = userRole === 'admin';

    const executeWithRLS = async () => {
      // Check workshop permissions
      const workshopCheck = await db
        .select()
        .from(workshops)
        .where(eq(workshops.id, workshopId))
        .limit(1);

      if (workshopCheck.length === 0) {
        throw new Error('Workshop not found');
      }

      const workshop = workshopCheck[0];

      // Check edit permissions
      if (!isAdmin && workshop.createdBy !== userId) {
        const hasPermission = await RLSHelper.checkWorkshopAccess(
          workshopId,
          userId || '',
          userRole || 'participant',
        );
        if (!hasPermission || !['sociologist-editor', 'admin'].includes(userRole || '')) {
          throw new Error('Insufficient permissions');
        }
      }

      // Validate all session IDs belong to this workshop
      const sessionIds = data.sessionOrders.map(order => order.id);
      const sessionCheck = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.workshopId, workshopId),
            sql`${sessions.id} = ANY(${sessionIds})`
          )
        );

      if (sessionCheck.length !== sessionIds.length) {
        throw new Error('Some sessions do not belong to this workshop');
      }

      // Update orders in a transaction
      await db.transaction(async (tx) => {
        for (const { id, order } of data.sessionOrders) {
          await tx
            .update(sessions)
            .set({
              orderIndex: order.toString(),
              updatedAt: new Date()
            })
            .where(eq(sessions.id, id));
        }
      });

      // Return updated sessions
      const updatedSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.workshopId, workshopId))
        .orderBy(asc(sessions.orderIndex));

      return updatedSessions.map(session => this.transformSessionToAPI(session));
    };

    return withRLS(userId || null, userRole || 'participant', isAdmin, executeWithRLS);
  }

  /**
   * Get all modules for a session
   */
  static async getModules(
    sessionId: string,
    request?: Request,
  ): Promise<Module[]> {
    const userId = request?.user?.id;
    const userRole = request?.user?.role;
    const isAdmin = userRole === 'admin';

    const executeWithRLS = async () => {
      // Check if session exists and user has access
      const sessionCheck = await db
        .select({
          session: sessions,
          workshop: workshops,
        })
        .from(sessions)
        .leftJoin(workshops, eq(sessions.workshopId, workshops.id))
        .where(eq(sessions.id, sessionId))
        .limit(1);

      if (sessionCheck.length === 0) {
        throw new Error('Session not found');
      }

      const sessionData = sessionCheck[0];
      const workshop = sessionData.workshop;

      if (!workshop) {
        throw new Error('Associated workshop not found');
      }

      // Check access permissions
      if (!isAdmin && workshop.createdBy !== userId) {
        const hasPermission = await RLSHelper.checkWorkshopAccess(
          workshop.id,
          userId || '',
          userRole || 'participant',
        );
        if (!hasPermission) {
          throw new Error('Access denied');
        }
      }

      // Get modules with order
      const moduleList = await db
        .select()
        .from(modules)
        .where(eq(modules.sessionId, sessionId))
        .orderBy(asc(modules.orderIndex));

      return moduleList.map(module => this.transformModuleToAPI(module));
    };

    return withRLS(userId || null, userRole || 'participant', isAdmin, executeWithRLS);
  }

  /**
   * Create a new module
   */
  static async createModule(
    sessionId: string,
    data: CreateModuleData,
    request?: Request,
  ): Promise<Module> {
    const userId = request?.user?.id;
    const userRole = request?.user?.role;
    const isAdmin = userRole === 'admin';

    const executeWithRLS = async () => {
      // Check if session exists and user has edit permissions
      const sessionCheck = await db
        .select({
          session: sessions,
          workshop: workshops,
        })
        .from(sessions)
        .leftJoin(workshops, eq(sessions.workshopId, workshops.id))
        .where(eq(sessions.id, sessionId))
        .limit(1);

      if (sessionCheck.length === 0) {
        throw new Error('Session not found');
      }

      const sessionData = sessionCheck[0];
      const workshop = sessionData.workshop;

      if (!workshop) {
        throw new Error('Associated workshop not found');
      }

      // Check edit permissions
      if (!isAdmin && workshop.createdBy !== userId) {
        const hasPermission = await RLSHelper.checkWorkshopAccess(
          workshop.id,
          userId || '',
          userRole || 'participant',
        );
        if (!hasPermission || !['sociologist-editor', 'admin'].includes(userRole || '')) {
          throw new Error('Insufficient permissions');
        }
      }

      // Get the highest orderIndex for this session
      const lastOrder = await db
        .select({ orderIndex: modules.orderIndex })
        .from(modules)
        .where(eq(modules.sessionId, sessionId))
        .orderBy(desc(modules.orderIndex))
        .limit(1);

      const nextOrder = lastOrder.length > 0 ? Number(lastOrder[0].orderIndex) + 1 : 0;

      // Create module
      const [newModule] = await db
        .insert(modules)
        .values({
          sessionId,
          titleI18n: data.titleI18n || {},
          type: data.type,
          contentI18n: data.contentI18n,
          duration: data.duration ? data.duration.toString() : null,
          orderIndex: nextOrder.toString(),
          isRequired: data.isRequired ?? true,
          resources: data.resources || [],
          settings: data.settings || {},
        })
        .returning();

      // Log audit
      await this.logAudit('CREATE', 'module', newModule.id, userId || null);

      return this.transformModuleToAPI(newModule);
    };

    return withRLS(userId || null, userRole || 'participant', isAdmin, executeWithRLS);
  }

  /**
   * Update a module
   */
  static async updateModule(
    moduleId: string,
    data: UpdateModuleData,
    request?: Request,
    sessionId?: string,
  ): Promise<Module> {
    const userId = request?.user?.id;
    const userRole = request?.user?.role;
    const isAdmin = userRole === 'admin';

    const executeWithRLS = async () => {
      // Check if module exists and get session/workshop for permission check
      const moduleCheck = await db
        .select({
          module: modules,
          session: sessions,
          workshop: workshops,
        })
        .from(modules)
        .leftJoin(sessions, eq(modules.sessionId, sessions.id))
        .leftJoin(workshops, eq(sessions.workshopId, workshops.id))
        .where(eq(modules.id, moduleId))
        .limit(1);

      if (moduleCheck.length === 0) {
        throw new Error('Module not found');
      }

      const moduleData = moduleCheck[0];
      const workshop = moduleData.workshop;

      if (!workshop) {
        throw new Error('Associated workshop not found');
      }

      // Check edit permissions
      if (!isAdmin && workshop.createdBy !== userId) {
        const hasPermission = await RLSHelper.checkWorkshopAccess(
          workshop.id,
          userId || '',
          userRole || 'participant',
        );
        if (!hasPermission || !['sociologist-editor', 'admin'].includes(userRole || '')) {
          throw new Error('Insufficient permissions');
        }
      }

      // Update module
      const updateData: any = {};
      if (data.titleI18n !== undefined) updateData.titleI18n = data.titleI18n;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.contentI18n !== undefined) updateData.contentI18n = data.contentI18n;
      if (data.duration !== undefined) updateData.duration = data.duration ? data.duration.toString() : null;
      if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;
      if (data.resources !== undefined) updateData.resources = data.resources;
      if (data.settings !== undefined) updateData.settings = data.settings;

      const [updatedModule] = await db
        .update(modules)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(modules.id, moduleId))
        .returning();

      // Log audit
      await this.logAudit('UPDATE', 'module', moduleId, userId || null);

      return this.transformModuleToAPI(updatedModule);
    };

    return withRLS(userId || null, userRole || 'participant', isAdmin, executeWithRLS);
  }

  /**
   * Delete a module
   */
  static async deleteModule(
    moduleId: string,
    request?: Request,
    sessionId?: string,
  ): Promise<void> {
    const userId = request?.user?.id;
    const userRole = request?.user?.role;
    const isAdmin = userRole === 'admin';

    const executeWithRLS = async () => {
      // Check if module exists and get session/workshop for permission check
      const moduleCheck = await db
        .select({
          module: modules,
          session: sessions,
          workshop: workshops,
        })
        .from(modules)
        .leftJoin(sessions, eq(modules.sessionId, sessions.id))
        .leftJoin(workshops, eq(sessions.workshopId, workshops.id))
        .where(eq(modules.id, moduleId))
        .limit(1);

      if (moduleCheck.length === 0) {
        throw new Error('Module not found');
      }

      const moduleData = moduleCheck[0];
      const workshop = moduleData.workshop;

      if (!workshop) {
        throw new Error('Associated workshop not found');
      }

      // Check edit permissions
      if (!isAdmin && workshop.createdBy !== userId) {
        const hasPermission = await RLSHelper.checkWorkshopAccess(
          workshop.id,
          userId || '',
          userRole || 'participant',
        );
        if (!hasPermission || !['sociologist-editor', 'admin'].includes(userRole || '')) {
          throw new Error('Insufficient permissions');
        }
      }

      // Delete module
      await db.delete(modules).where(eq(modules.id, moduleId));

      // Log audit
      await this.logAudit('DELETE', 'module', moduleId, userId || null);
    };

    return withRLS(userId || null, userRole || 'participant', isAdmin, executeWithRLS);
  }

  /**
   * Reorder modules
   */
  static async reorderModules(
    sessionId: string,
    data: ReorderModulesData,
    request?: Request,
  ): Promise<Module[]> {
    const userId = request?.user?.id;
    const userRole = request?.user?.role;
    const isAdmin = userRole === 'admin';

    const executeWithRLS = async () => {
      // Check if session exists and get workshop for permission check
      const sessionCheck = await db
        .select({
          session: sessions,
          workshop: workshops,
        })
        .from(sessions)
        .leftJoin(workshops, eq(sessions.workshopId, workshops.id))
        .where(eq(sessions.id, sessionId))
        .limit(1);

      if (sessionCheck.length === 0) {
        throw new Error('Session not found');
      }

      const sessionData = sessionCheck[0];
      const workshop = sessionData.workshop;

      if (!workshop) {
        throw new Error('Associated workshop not found');
      }

      // Check edit permissions
      if (!isAdmin && workshop.createdBy !== userId) {
        const hasPermission = await RLSHelper.checkWorkshopAccess(
          workshop.id,
          userId || '',
          userRole || 'participant',
        );
        if (!hasPermission || !['sociologist-editor', 'admin'].includes(userRole || '')) {
          throw new Error('Insufficient permissions');
        }
      }

      // Validate all module IDs belong to this session
      const moduleIds = data.moduleOrders.map(order => order.id);
      const moduleCheck = await db
        .select()
        .from(modules)
        .where(
          and(
            eq(modules.sessionId, sessionId),
            sql`${modules.id} = ANY(${moduleIds})`
          )
        );

      if (moduleCheck.length !== moduleIds.length) {
        throw new Error('Some modules do not belong to this session');
      }

      // Update orders in a transaction
      await db.transaction(async (tx) => {
        for (const { id, order } of data.moduleOrders) {
          await tx
            .update(modules)
            .set({
              orderIndex: order.toString(),
              updatedAt: new Date()
            })
            .where(eq(modules.id, id));
        }
      });

      // Return updated modules
      const updatedModules = await db
        .select()
        .from(modules)
        .where(eq(modules.sessionId, sessionId))
        .orderBy(asc(modules.orderIndex));

      return updatedModules.map(module => this.transformModuleToAPI(module));
    };

    return withRLS(userId || null, userRole || 'participant', isAdmin, executeWithRLS);
  }

  /**
   * Transform session data for API compatibility (frontend expects 'title', 'description', 'order')
   */
  private static transformSessionToAPI(session: any): Session {
    // Assuming Polish as default language, but could be made dynamic
    const defaultLanguage = 'pl';

    return {
      ...session,
      title: session.titleI18n?.[defaultLanguage] || Object.values(session.titleI18n || {})[0] || '',
      description: session.descriptionI18n?.[defaultLanguage] || '',
      order: Number(session.orderIndex || 0),
      duration: session.duration ? Number(session.duration) : undefined,
      location: session.locationId || null,
    };
  }

  /**
   * Transform module data for API compatibility (frontend expects 'title', 'content', 'order')
   */
  private static transformModuleToAPI(module: any): Module {
    // Assuming Polish as default language, but could be made dynamic
    const defaultLanguage = 'pl';

    return {
      ...module,
      title: module.titleI18n?.[defaultLanguage] || '',
      content: module.contentI18n?.[defaultLanguage] || {},
      order: Number(module.orderIndex || 0),
      duration: module.duration ? Number(module.duration) : undefined,
    };
  }

  /**
   * Log audit trail
   */
  private static async logAudit(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: 'session' | 'module',
    entityId: string,
    userId: string | null,
  ): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        userId,
        tableName: entityType,
        recordId: entityId,
        operation: action,
        timestamp: new Date(),
        ipAddress: null, // Could be extracted from request
        userAgent: null, // Could be extracted from request
      });
    } catch (error) {
      console.error('Failed to log audit:', error);
      // Don't throw error for audit logging failure
    }
  }
}