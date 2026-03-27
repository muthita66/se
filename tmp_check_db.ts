import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
const prisma = new PrismaClient();

async function main() {
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
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
