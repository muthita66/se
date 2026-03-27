const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Attendance Records Statuses ---');
        const counts = await prisma.attendance_records.groupBy({
            by: ['status'],
            _count: {
                status: true
            }
        });
        console.log('Existing statuses in attendance_records:', counts);

        // Try to insert a dummy record to see the error/success if it's empty
        // No, let's just check the table's records first.

        const samples = await prisma.attendance_records.findMany({ take: 5 });
        console.log('Sample records:', samples);

    } catch (e) {
        console.error('Error querying attendance_records:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
