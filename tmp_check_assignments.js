const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const teacher_id = 1; // Assuming the logged in teacher is 1. We can test with 1
    console.log(`Checking assignments for teacher_id: ${teacher_id}`);

    const rawAssignments = await prisma.teaching_assignments.findMany({
        where: { teacher_id },
        include: {
            subjects: true,
            classrooms: true,
            semesters: { include: { academic_years: true } },
        }
    });

    console.log(`Raw assignments count: ${rawAssignments.length}`);
    if (rawAssignments.length > 0) {
        console.log("Sample assignment:");
        console.dir(rawAssignments[0], { depth: null });
    }

    const year = 2568;
    const semester = 1;

    // Simulate getTeachingEvaluation
    const assignments = rawAssignments.filter(ta => {
        const taYear = Number(ta.semesters?.academic_years?.year_name);
        const taSemester = ta.semesters?.semester_number;
        
        const matchYear = !year || taYear === year || String(taYear) === String(year);
        const matchSemester = !semester || taSemester === semester;
        console.log(`Comparing ${taYear} vs ${year} (${matchYear}), ${taSemester} vs ${semester} (${matchSemester})`);
        return matchYear && matchSemester;
    });

    const finalAssignments = assignments.length > 0 ? assignments : rawAssignments;
    console.log(`Final assignments count: ${finalAssignments.length}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
