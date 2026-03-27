const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const student_id = 14; // เมฆ ทองดี
    const year = 2568;
    const semester = 1;

    // Reproduce resolveStudentClassroom
    let classroomStudent = await prisma.classroom_students.findFirst({
        where: {
            student_id,
            academic_year: Number(year),
        },
        include: { classrooms: true }
    });
    console.log("Classroom Student:", classroomStudent ? classroomStudent.classroom_id : "not found");

    if (!classroomStudent) return;

    // Reproduce assignmentWhere
    const assignmentWhere = {
        classroom_id: classroomStudent.classroom_id,
        semesters: {
            academic_years: { year_name: String(year) },
            semester_number: Number(semester),
        }
    };
    console.log("Querying with assignmentWhere:", JSON.stringify(assignmentWhere, null, 2));

    const assignments = await prisma.teaching_assignments.findMany({
        where: assignmentWhere,
        include: {
            subjects: true,
            class_schedules: true
        }
    });

    console.log("Assignments found:", assignments.length);
    if (assignments.length > 0) {
        console.log("First assignment schedules count:", assignments[0].class_schedules.length);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
