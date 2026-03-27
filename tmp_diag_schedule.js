const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // 1. Get student 1 (from screenshot "เด็กชาย เมธ ทองดี" - usually student_code starts with 68...)
    // Let's find student with code '6801001' from previous interaction
    const student = await prisma.students.findFirst({
        where: { student_code: '6801001' }
    });
    console.log("Student:", student);
    if (!student) return;

    // 2. Check classroom_students for 2568
    const cs = await prisma.classroom_students.findMany({
        where: { student_id: student.id, academic_year: 2568 },
        include: { classrooms: true }
    });
    console.log("Classroom Student entries for 2568:", cs);

    // 3. Find semester 1/2568
    const semester = await prisma.semesters.findFirst({
        where: { 
            semester_number: 1,
            academic_years: { year_name: '2568' }
        }
    });
    console.log("Semester 1/2568:", semester);

    if (cs.length > 0 && semester) {
        const classroomId = cs[0].classroom_id;
        // 4. Find teaching_assignments for this classroom and semester
        const assignments = await prisma.teaching_assignments.findMany({
            where: {
                classroom_id: classroomId,
                semester_id: semester.id
            },
            include: { subjects: true, class_schedules: true }
        });
        console.log(`Teaching Assignments for Class ${classroomId}, Sem ${semester.id}:`, assignments.length);
        assignments.forEach(a => {
            console.log(`- ${a.subjects.subject_name} (${a.class_schedules.length} schedules)`);
        });
        
        // 5. Check enrollments
        const enrollments = await prisma.enrollments.findMany({
            where: { student_id: student.id, teaching_assignments: { semester_id: semester.id } }
        });
        console.log("Student Enrollments for this semester:", enrollments.length);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
