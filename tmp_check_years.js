const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkYears() {
    try {
        const years = await prisma.academic_years.findMany({
            include: { semesters: true }
        });
        console.log('All Academic Years:', JSON.stringify(years, null, 2));

        const activeYear = await prisma.academic_years.findFirst({
            where: { is_active: true },
            include: { semesters: { where: { is_active: true } } }
        });
        console.log('Active Year from Prisma findFirst:', JSON.stringify(activeYear, null, 2));

    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkYears();
