import { db } from '../config/postgresql-database';
import { designs, InsertDesign } from '../models/postgresql-schema';
import { eq, desc } from 'drizzle-orm';
import { DesignParams } from './simulation-engine';

export class DesignService {
    /**
     * Create a new design
     */
    async createDesign(data: {
        name: string;
        description?: string;
        parameters: DesignParams;
        thumbnailUrl?: string;
        isPublic?: boolean;
        createdBy?: string;
    }) {
        const [design] = await db.insert(designs).values({
            name: data.name,
            description: data.description,
            parameters: data.parameters,
            thumbnailUrl: data.thumbnailUrl,
            isPublic: data.isPublic || false,
            createdBy: data.createdBy,
        }).returning();
        return design;
    }

    /**
     * Get all designs (optionally filtered by user)
     */
    async getDesigns(userId?: string) {
        if (userId) {
            return await db.select().from(designs)
                .where(eq(designs.createdBy, userId))
                .orderBy(desc(designs.updatedAt));
        }
        // For now, return all public designs or all designs if no user specified (MVP)
        return await db.select().from(designs)
            .orderBy(desc(designs.updatedAt));
    }

    /**
     * Get a specific design by ID
     */
    async getDesignById(id: string) {
        const [design] = await db.select().from(designs).where(eq(designs.id, id));
        return design;
    }

    /**
     * Update a design
     */
    async updateDesign(id: string, data: Partial<InsertDesign>) {
        const [updated] = await db.update(designs)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(designs.id, id))
            .returning();
        return updated;
    }

    /**
     * Delete a design
     */
    async deleteDesign(id: string) {
        await db.delete(designs).where(eq(designs.id, id));
        return true;
    }
}

export default new DesignService();
