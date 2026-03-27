const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log("Teacher 110 Assignments:");
    const assignments = await prisma.teaching_assignments.findMany({
        where: { teacher_id: 110 },
        select: { id: true, subject_id: true }
    });
    console.log(assignments);
    console.log("\nEnrollments for teacher 110:");
    const enrollments = await prisma.enrollments.findMany({
        where: { teaching_assignment_id: { in: assignments.map(a => a.id) } },
        take: 5
    });
    console.log(enrollments);
}
main().catch(console.error).finally(() => prisma.$disconnect());
