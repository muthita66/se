const { DirectorDashboardService } = require('./src/features/director/dashboard.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
    const studentWhere = {};
    const classroomWhere = {};
    const filters = {};

    const helpers = [
        { name: 'getGradeSummary', fn: () => DirectorDashboardService.getGradeSummary(studentWhere) },
        { name: 'getAttendanceSummary', fn: () => DirectorDashboardService.getAttendanceSummary(studentWhere) },
        { name: 'getAtRiskStudents', fn: () => DirectorDashboardService.getAtRiskStudents(studentWhere) },
        { name: 'getStudentsByRoom', fn: () => DirectorDashboardService.getStudentsByRoom(studentWhere) },
        { name: 'getRegistrationStats', fn: () => DirectorDashboardService.getRegistrationStats(studentWhere) },
        { name: 'getFinanceSummary', fn: () => DirectorDashboardService.getFinanceSummary() },
        { name: 'getProjectsSummary', fn: () => DirectorDashboardService.getProjectsSummary() },
        { name: 'getHealthSummary', fn: () => DirectorDashboardService.getHealthSummary(studentWhere) },
        { name: 'getTopRooms', fn: () => DirectorDashboardService.getTopRooms(studentWhere) }
    ];

    console.log('--- Granular Helper Diagnosis ---');
    for (const h of helpers) {
        try {
            console.log(`Testing ${h.name}...`);
            await h.fn();
            console.log(`✅ ${h.name} OK`);
        } catch (e) {
            console.error(`❌ ${h.name} FAILED:`, e.message);
        }
    }
}

diagnose().then(() => prisma.$disconnect());
