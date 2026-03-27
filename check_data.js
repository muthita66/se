const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const teacher = await prisma.teachers.findFirst({
      where: {
        first_name: 'สมชาย',
        last_name: 'ใจดี'
      }
    });

    if (!teacher) {
      console.log('Teacher Somchai Jaidee not found');
      return;
    }

    console.log(`Teacher found: ID=${teacher.id}, Code=${teacher.teacher_code}`);

    const assignments = await prisma.teaching_assignments.findMany({
      where: { teacher_id: teacher.id },
      include: {
        subjects: true,
        class_schedules: {
          include: {
            day_of_weeks: true,
            periods: true
          }
        }
      }
    });

    console.log(`Found ${assignments.length} assignments`);
    for (const a of assignments) {
      console.log(`Assignment ID ${a.id}: Subject=${a.subjects.subject_name}`);
      console.log(`  Schedules: ${a.class_schedules.length}`);
      for (const s of a.class_schedules) {
        console.log(`    - ${s.day_of_weeks?.day_name_en} Period ${s.period_id}`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
