const { StudentDashboardService } = require('./src/features/student/dashboard.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const student_id = 14;
    console.log(`--- Calling getSummary(${student_id}) ---`);
    const data = await StudentDashboardService.getSummary(student_id);
    console.log("Profile:", JSON.stringify(data.profile, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
