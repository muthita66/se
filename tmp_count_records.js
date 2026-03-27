const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function countAll() {
    try {
        const [students, teachers, subjects, attendance, enrollments, health, years] = await Promise.all([
            prisma.students.count(),
            prisma.teachers.count(),
            prisma.subjects.count(),
            prisma.attendance_records.count(),
            prisma.enrollments.count(),
            prisma.student_health_checkups.count(),
            prisma.academic_years.count()
        ]);
        console.log('Record Counts:');
        console.log(`- Students: ${students}`);
        console.log(`- Teachers: ${teachers}`);
        console.log(`- Subjects: ${subjects}`);
        console.log(`- Attendance Records: ${attendance}`);
        console.log(`- Enrollments: ${enrollments}`);
        console.log(`- Health Checkups: ${health}`);
        console.log(`- Academic Years: ${years}`);

        const activeYear = await prisma.academic_years.findFirst({ where: { is_active: true } });
        console.log('Active Academic Year:', JSON.stringify(activeYear, null, 2));

    } catch (e) {
        console.error('Count failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

countAll();
