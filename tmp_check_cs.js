const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCS() {
    try {
        const count = await prisma.classroom_students.count();
        console.log('Classroom Students Count:', count);
        
        const sample = await prisma.classroom_students.findMany({ take: 5 });
        console.log('Sample CS Records:', JSON.stringify(sample, null, 2));

        const activeYear = await prisma.academic_years.findFirst({ where: { is_active: true } });
        console.log('Active Year:', activeYear?.year_name);

        if (count > 0) {
           const years = await prisma.classroom_students.groupBy({
               by: ['academic_year'],
               _count: true
           });
           console.log('CS Years:', JSON.stringify(years, null, 2));
        }

    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkCS();
