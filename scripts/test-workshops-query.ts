import 'dotenv/config';
import { db, withRLS } from '../src/config/postgresql-database';
import { workshops, sessions, questionnaires, users } from '../src/models/postgresql-schema';
import { eq, and, desc, count, isNull } from 'drizzle-orm';

async function run() {
    console.log('Running test query...');
    try {
        // 1. Basic select
        console.log('1. Basic select...');
        const basic = await db.select().from(workshops).limit(1);
        console.log('Basic select success:', basic.length);

        // 2. With Join
        console.log('2. With Join...');
        const withJoin = await db.select()
            .from(workshops)
            .leftJoin(users, eq(workshops.createdBy, users.id))
            .limit(1);
        console.log('With Join success');

        // 3. With Count
        console.log('3. With Count...');
        const withCount = await db.select({
            id: workshops.id,
            sessionCount: count(sessions.id)
        })
            .from(workshops)
            .leftJoin(sessions, eq(workshops.id, sessions.workshopId))
            .groupBy(workshops.id)
            .limit(1);
        console.log('With Count success');

        // 4. Full Query (simplified)
        console.log('4. Full Query...');
        const conditions = [isNull(workshops.deletedAt)];
        const full = await db
            .select({
                id: workshops.id,
                sessionCount: count(sessions.id),
                questionnaireCount: count(questionnaires.id),
                creatorId: users.id,
            })
            .from(workshops)
            .leftJoin(sessions, eq(workshops.id, sessions.workshopId))
            .leftJoin(questionnaires, eq(workshops.id, questionnaires.workshopId))
            .leftJoin(users, eq(workshops.createdBy, users.id))
            .where(and(...conditions))
            .groupBy(workshops.id, users.id)
            .orderBy(desc(workshops.createdAt))
            .limit(10);
        console.log('Full Query success');

        // 5. With RLS
        console.log('5. With RLS...');
        await withRLS('c4e4df85-89ff-46af-ade7-5d1a4737a531', 'participant', false, async () => {
            const fullRLS = await db
                .select({ id: workshops.id })
                .from(workshops)
                .limit(1);
            console.log('With RLS success');
            return fullRLS;
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

run();
