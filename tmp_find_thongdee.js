const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const students = await prisma.students.findMany({
      where: {
        last_name: { contains: 'ทองดี' }
      },
      include: {
        classroom_students: {
          include: { classrooms: true }
        }
      }
    });
    console.log("Students found:", students.length);
    students.forEach(s => {
      console.log(`ID: ${s.id}, Name: ${s.first_name} ${s.last_name}, Code: ${s.student_code}`);
      console.log(`Classrooms:`, s.classroom_students.map(cs => `${cs.academic_year}: ${cs.classrooms?.room_name || 'N/A'}`));
    });
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
