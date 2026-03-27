import { DirectorDashboardService } from './src/features/director/dashboard.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    try {
        console.log('Testing DirectorDashboardService.getFullDashboard()...');
        const data = await DirectorDashboardService.getFullDashboard({});
        console.log('Success! Data keys:', Object.keys(data));
        console.log('Summary:', JSON.stringify(data.summary, null, 2));
    } catch (e: any) {
        console.error('Failed!', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
