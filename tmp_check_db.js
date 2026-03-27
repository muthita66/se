const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Academic Years ---');
        const years = await prisma.academic_years.findMany();
        console.log(JSON.stringify(years, null, 2));

        console.log('\n--- Semesters ---');
        const semesters = await prisma.semesters.findMany({
            include: { academic_years: true }
        });
        console.log(JSON.stringify(semesters, null, 2));

        console.log('\n--- Teaching Assignments Count ---');
        const count = await prisma.teaching_assignments.count();
        console.log('Total:', count);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
