const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function check() {
  try {
    const teachers = await prisma.teachers.findMany({
      where: {
        first_name: { contains: 'สมชาย' }
      }
    });

    console.log(`Found ${teachers.length} teachers with name containing 'สมชาย'`);
    for (const t of teachers) {
      console.log(`- ${t.first_name} ${t.last_name} (ID: ${t.id})`);
      
      const assignments = await prisma.teaching_assignments.findMany({
        where: { teacher_id: t.id },
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
      
      console.log(`  Assignments: ${assignments.length}`);
      for (const a of assignments) {
        console.log(`    Subject: ${a.subjects?.subject_name}`);
        console.log(`    Schedules: ${a.class_schedules.length}`);
        for (const s of a.class_schedules) {
          console.log(`      * Day ${s.day_id} (${s.day_of_weeks?.day_name_en}), Period ${s.period_id}`);
        }
      }
    }

    const days = await prisma.day_of_weeks.findMany();
    console.log('Days of week:', days.map(d => `${d.id}:${d.day_name_en}`).join(', '));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
