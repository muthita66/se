const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const classroomId = 4;
    const semesterId = 1;

    const classroomSubjects = await prisma.classroom_subjects.findMany({
        where: {
            classroom_id: classroomId,
            semester_id: semesterId
        },
        include: { subjects: true }
    });
    console.log(`Classroom Subjects for Class ${classroomId}, Sem ${semesterId}:`, classroomSubjects.length);
    classroomSubjects.forEach(cs => {
        console.log(`- ${cs.subjects.subject_name}`);
    });

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
