const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking Teaching Assignments and Enrollments ---');
  
  const assignments = await prisma.teaching_assignments.findMany({
    where: {
      subjects: {
        subject_code: 'ค21101'
      }
    },
    include: {
      subjects: true,
      classrooms: true,
      enrollments: {
        include: {
          students: true
        }
      }
    }
  });

  console.log(`Found ${assignments.length} assignments for ค21101`);
  
  for (const ta of assignments) {
    console.log(`\nAssignment ID: ${ta.id}`);
    console.log(`Subject: ${ta.subjects?.subject_code} - ${ta.subjects?.subject_name}`);
    console.log(`Classroom: ${ta.classrooms?.room_name}`);
    console.log(`Enrollments count: ${ta.enrollments.length}`);
    
    if (ta.enrollments.length > 0) {
      console.log('Students in this assignment:');
      ta.enrollments.forEach((e, idx) => {
        console.log(`  ${idx + 1}. ${e.students?.first_name} ${e.students?.last_name} (${e.students?.student_code})`);
      });
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
