const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const student_id = 14;
    const [student, activeSemester] = await Promise.all([
            (prisma.students).findUnique({
                where: { id: student_id },
                include: {
                    name_prefixes: true,
                    classroom_students: {
                        include: { classrooms: true },
                        orderBy: { academic_year: 'desc' },
                        take: 1
                    },
                },
            }),
            prisma.semesters.findFirst({
                where: { is_active: true },
                include: { academic_years: true },
                orderBy: { id: 'desc' },
            }),
        ]);

    console.log("Student Data:", JSON.stringify(student, null, 2));
    console.log("Classroom Student 0:", JSON.stringify(student.classroom_students?.[0], null, 2));
    const class_level = student.classroom_students?.[0]?.classrooms?.room_name || '';
    console.log("Extracted level:", class_level);

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
