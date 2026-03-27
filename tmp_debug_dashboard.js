const { DirectorDashboardService } = require('./src/features/director/dashboard.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugDashboard() {
    try {
        const data = await DirectorDashboardService.getFullDashboard();
        console.log('Dashboard Data Keys:', Object.keys(data));
        console.log('Summary:', JSON.stringify(data.summary, null, 2));
        console.log('Attendance:', JSON.stringify(data.attendance, null, 2));
        console.log('Class Distribution:', JSON.stringify(data.classDistribution, null, 2));
        console.log('Students By Level:', JSON.stringify(data.studentsByLevel, null, 2));
        
        const studentsRaw = await prisma.students.findMany({
            take: 5,
            include: {
                classroom_students: {
                    include: { classrooms: true },
                    orderBy: { academic_year: 'desc' },
                    take: 1
                }
            }
        });
        console.log('Sample Students Raw:', JSON.stringify(studentsRaw, null, 2));

    } catch (e) {
        console.error('Debug failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

debugDashboard();
