
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const result = await prisma.$queryRaw`
            SELECT
                conname AS constraint_name,
                pg_get_constraintdef(oid) AS constraint_definition
            FROM
                pg_constraint
            WHERE
                conname = 'attendance_records_status_check';
        `;
        console.log('Constraint Definition:', JSON.stringify(result, null, 2));

        const sample = await prisma.$queryRaw`
            SELECT status, count(*) 
            FROM attendance_records 
            GROUP BY status;
        `;
        console.log('Existing Statuses:', JSON.stringify(sample, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
