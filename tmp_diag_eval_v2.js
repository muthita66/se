const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Database Diagnostics ---');
    try {
        const count = await prisma.evaluation_responses.count();
        console.log('Total evaluation_responses:', count);
        
        if (count > 0) {
            const sample = await prisma.evaluation_responses.findMany({
                take: 10,
                include: {
                    semesters: { include: { academic_years: true } }
                }
            });
            console.log('Sample Data Structure:');
            sample.forEach(r => {
                console.log(`ID: ${r.id}, Year: ${r.semesters?.academic_years?.year_name}, Sem: ${r.semesters?.semester_number}, SubjectID: ${r.target_subject_id}, TeacherID: ${r.target_teacher_id}, StudentID: ${r.target_student_id}`);
            });
            
            const groupYear = await prisma.$queryRaw`
                SELECT ay.year_name, s.semester_number, COUNT(*) as count
                FROM evaluation_responses er
                LEFT JOIN semesters s ON er.semester_id = s.id
                LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
                GROUP BY ay.year_name, s.semester_number
            `;
            console.log('Data by Year/Semester:', groupYear);
        }
    } catch (e) {
        console.error('Diagnostic error:', e);
    } finally {
        await prisma.$disconnect();
        process.exit();
    }
}

// Timeout after 10s
setTimeout(() => {
    console.error('Timed out');
    process.exit(1);
}, 10000);

main();
