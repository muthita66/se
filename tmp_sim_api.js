const { ScheduleService } = require('./src/features/student/schedule.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const student_id = 14;
    const year = 2568;
    const semester = 1;

    console.log(`--- Calling getClassSchedule(${student_id}, ${year}, ${semester}) ---`);
    const data = await ScheduleService.getClassSchedule(student_id, year, semester);
    console.log("Result length:", data.length);
    if (data.length > 0) {
        console.log("First item sample:", JSON.stringify(data[0], null, 2));
    } else {
        console.log("Empty result.");
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
