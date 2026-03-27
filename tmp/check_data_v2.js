require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Connection Check ---');
  try {
    const count = await prisma.teachers.count();
    console.log('Connection successful. Teachers count:', count);
    
    const somchai = await prisma.teachers.findFirst({
      where: { first_name: { contains: 'สมชาย' } }
    });
    
    if (somchai) {
      console.log('Found teacher Somchai:', somchai.id);
      const assignments = await prisma.teaching_assignments.findMany({
        where: { teacher_id: somchai.id },
        include: { subjects: true, classrooms: true }
      });
      console.log('Assignments for Somchai:', assignments.length);
      for (const ta of assignments) {
        const enrollments = await prisma.enrollments.count({
          where: { teaching_assignment_id: ta.id }
        });
        console.log(`- Assignment ID ${ta.id}: ${ta.subjects?.subject_code} ${ta.subjects?.subject_name} (${ta.classrooms?.room_name}) -> Enrollments: ${enrollments}`);
      }
    } else {
      console.log('Teacher Somchai not found.');
    }
  } catch (e) {
    console.error('Database connection failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
