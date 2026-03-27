require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Debugging Enrollments for ค21101 ---');
  try {
    const subjects = await prisma.$queryRaw`SELECT id, subject_code, subject_name FROM "subjects" WHERE "subject_code" = 'ค21101'`;
    console.log('Subjects found:', subjects);

    if (subjects.length > 0) {
      const subjectId = subjects[0].id;
      const assignments = await prisma.$queryRaw`
        SELECT ta.id, ta.teacher_id, ta.classroom_id, t.first_name, t.last_name, c.room_name
        FROM "teaching_assignments" ta
        JOIN "teachers" t ON ta.teacher_id = t.id
        LEFT JOIN "classrooms" c ON ta.classroom_id = c.id
        WHERE ta.subject_id = ${subjectId}
      `;
      console.log('Assignments found:', assignments.length);

      for (const ta of assignments) {
        const enrollments = await prisma.$queryRaw`
          SELECT COUNT(*)::int as count FROM "enrollments"
          WHERE "teaching_assignment_id" = ${ta.id}
        `;
        console.log(`- TA ID ${ta.id}: Teacher ${ta.first_name} ${ta.last_name}, Room ${ta.room_name} -> Enrollments: ${enrollments[0].count}`);
        
        if (enrollments[0].count > 0) {
            const students = await prisma.$queryRaw`
                SELECT s.student_code, s.first_name, s.last_name
                FROM "enrollments" e
                JOIN "students" s ON e.student_id = s.id
                WHERE e.teaching_assignment_id = ${ta.id}
                LIMIT 5
            `;
            console.log('  Samples:', students.map(s => `${s.student_code} ${s.first_name}`).join(', '));
        }
      }
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
