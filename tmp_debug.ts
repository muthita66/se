import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debug() {
    console.log('--- Debugging Dashboard Data ---');
    
    // 1. Check active year
    const activeYear = await (prisma as any).academic_years.findFirst({
        where: { is_active: true },
        include: { semesters: { where: { is_active: true } } }
    });
    console.log('Active Year:', JSON.stringify(activeYear, null, 2));

    // 2. Check classroom_students sample
    const cs = await (prisma as any).classroom_students.findFirst({
        orderBy: { academic_year: 'desc' }
    });
    console.log('Sample classroom_students:', JSON.stringify(cs, null, 2));

    if (activeYear && cs) {
        console.log('Match Check: activeYear.id (' + activeYear.id + ') vs cs.academic_year (' + cs.academic_year + ')');
        console.log('Match Check: activeYear.year_name (' + activeYear.year_name + ') vs cs.academic_year (' + cs.academic_year + ')');
    }

    // 3. Check for any students
    const studentCount = await (prisma as any).students.count();
    console.log('Total Students:', studentCount);

    // 4. Check for any semesters
    const semesterCount = await (prisma as any).semesters.count({ where: { is_active: true } });
    console.log('Active Semesters:', semesterCount);

    await prisma.$disconnect();
}

debug();
