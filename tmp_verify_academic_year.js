const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    console.log('--- Academic Year Verification ---');
    try {
        const years = await prisma.academic_years.findMany();
        console.log('Academic Years in Database:', JSON.stringify(years, null, 2));
        
        const students = await (prisma as any).classroom_students.findFirst();
        console.log('Classroom Student Sample:', JSON.stringify(students, null, 2));

        if (years.length > 0 && students) {
            console.log(`Academic Year ${years[0].id} has year name ${years[0].year_name}`);
            console.log(`Classroom Student has academic_year ${students.academic_year}`);
        }
    } catch (e) {
        console.error('Verification failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
