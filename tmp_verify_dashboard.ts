import { DirectorDashboardService } from './src/features/director/dashboard.service';

async function verify() {
    console.log('--- Director Dashboard Service Verification ---');
    const studentWhere = {};
    const filters = {};

    const tests = [
        { name: 'getFullDashboard', fn: () => DirectorDashboardService.getFullDashboard(filters) },
        { name: 'getGradeSummary', fn: () => (DirectorDashboardService as any).getGradeSummary(studentWhere) },
        { name: 'getAttendanceSummary', fn: () => (DirectorDashboardService as any).getAttendanceSummary(studentWhere) },
        { name: 'getAtRiskStudents', fn: () => (DirectorDashboardService as any).getAtRiskStudents(studentWhere) },
        { name: 'getTopRooms', fn: () => (DirectorDashboardService as any).getTopRooms(studentWhere) },
        { name: 'getTopStudentsByLevel', fn: () => (DirectorDashboardService as any).getTopStudentsByLevel(1) }, // Testing with academic_year_id 1
        { name: 'getCurriculumSummary', fn: () => (DirectorDashboardService as any).getCurriculumSummary({}, {}) }
    ];

    for (const test of tests) {
        try {
            console.log(`Testing ${test.name}...`);
            const result = await test.fn();
            console.log(`✅ ${test.name} RESOLVED`);
            if (test.name === 'getTopStudentsByLevel') {
                console.log(`   Top Students Count: ${Array.isArray(result) ? result.length : 'N/A'}`);
            }
        } catch (error: any) {
            console.error(`❌ ${test.name} REJECTED:`, error.message);
        }
    }
}

verify().then(() => console.log('--- Verification Finished ---'));
