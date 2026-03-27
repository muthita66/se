const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const statuses = ['present', 'absent', 'late', 'leave', 'sick', 'personal', 'มา', 'ขาด', 'สาย', 'ลา'];
    for (const s of statuses) {
        try {
            console.log(`Testing status: ${s}`);
            // We need a valid session and enrollment id for a real insert, but we can just use a transaction that rolls back or look for errors.
            // Better: just try to find if ANY record exists with that status.
            const count = await prisma.attendance_records.count({ where: { status: s } });
            console.log(`  Count for '${s}': ${count}`);
        } catch (e) {
            console.log(`  Error checking '${s}': ${e.message}`);
        }
    }
    await prisma.$disconnect();
}
main();
