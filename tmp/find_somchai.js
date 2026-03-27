const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Searching for Teacher: นาย สมชาย ใจดี ---');
  
  const teachers = await prisma.teachers.findMany({
    where: {
      OR: [
        { first_name: 'สมชาย' },
        { first_name: { contains: 'สมชาย' } }
      ]
    },
    include: {
      teaching_assignments: {
        include: {
          subjects: true,
          classrooms: true,
          enrollments: true
        }
      }
    }
  });

  console.log(`Found ${teachers.length} teachers matching "Somchai"`);
  
  for (const t of teachers) {
    console.log(`\nTeacher ID: ${t.id}`);
    console.log(`Name: ${t.first_name} ${t.last_name}`);
    console.log(`Assignments count: ${t.teaching_assignments.length}`);
    
    for (const ta of t.teaching_assignments) {
      console.log(`  - Assignment ID: ${ta.id}`);
      console.log(`    Subject: ${ta.subjects?.subject_code} - ${ta.subjects?.subject_name}`);
      console.log(`    Classroom: ${ta.classrooms?.room_name}`);
      console.log(`    Enrollments: ${ta.enrollments.length}`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
