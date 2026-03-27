import { DirectorDashboardService } from './src/features/director/dashboard.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
    const filters = {};
    console.log('--- Starting Dashboard Diagnosis ---');
    
    const steps = [
        { name: 'Filter Options', fn: () => DirectorDashboardService.getFilterOptions() },
        { name: 'Full Dashboard', fn: () => DirectorDashboardService.getFullDashboard(filters) }
    ];

    for (const step of steps) {
        try {
            console.log(`Testing ${step.name}...`);
            const start = Date.now();
            await step.fn();
            console.log(`✅ ${step.name} passed in ${Date.now() - start}ms`);
        } catch (e: any) {
            console.error(`❌ ${step.name} FAILED:`, e.message);
            if (e.stack) console.error(e.stack);
        }
    }
}

diagnose().then(() => prisma.$disconnect());
