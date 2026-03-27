const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    try {
        const respCount = await prisma.evaluation_responses.count();
        const ansCount = await prisma.evaluation_answers.count();
        const assignments = await prisma.teaching_assignments.count();
        
        console.log('Counts:', { respCount, ansCount, assignments });
        
        const sampleResp = await prisma.evaluation_responses.findMany({
            take: 5,
            include: {
                semesters: { include: { academic_years: true } }
            }
        });
        console.log('Sample Response:', JSON.stringify(sampleResp, null, 2));
        
        const types = await prisma.evaluation_responses.groupBy({
            by: ['target_subject_id', 'target_teacher_id', 'target_student_id'],
            _count: { id: true }
        });
        console.log('Response Types:', JSON.stringify(types, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
