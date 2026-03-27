const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Database Check Constraints ---');
        // Querying check constraints for attendance_records in PostgreSQL
        const result = await prisma.$queryRaw`
            SELECT
                conname AS constraint_name,
                pg_get_constraintdef(c.oid) AS constraint_definition
            FROM
                pg_constraint c
            JOIN
                pg_namespace n ON n.oid = c.connamespace
            WHERE
                conname = 'attendance_records_status_check';
        `;
        console.log('Constraint definition:', JSON.stringify(result, null, 2));

        // Let's also check if there are ANY records to see what's actually there
        const sample = await prisma.attendance_records.findMany({ take: 5 });
        console.log('Sample records currently in DB:', JSON.stringify(sample, null, 2));

    } catch (e) {
        console.error('Error querying constraint:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
