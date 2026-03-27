const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Ensuring Year 2568 and Semester 1 ---');
    
    // 1. Ensure Academic Year 2568
    const year = await prisma.academic_years.upsert({
        where: { year_name: '2568' },
        update: {},
        create: {
            year_name: '2568',
            is_active: true
        }
    });
    console.log('Year:', year);

    // 2. Ensure Semester 1 for Year 2568
    const semester = await prisma.semesters.upsert({
        where: { 
            semester_number_academic_year_id: {
                semester_number: 1,
                academic_year_id: year.id
            }
        },
        update: { is_active: true },
        create: {
            semester_number: 1,
            academic_year_id: year.id,
            is_active: true
        }
    });
    console.log('Semester:', semester);

    // 3. Deactivate other semesters for Year 2568 (optional but cleaner)
    await prisma.semesters.updateMany({
        where: {
            academic_year_id: year.id,
            id: { not: semester.id }
        },
        data: { is_active: false }
    });

    console.log('Done.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
