import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
    const enrollCount = await p.enrollments.count();
    const itemCount = await p.assessment_items.count();
    const catCount = await p.grade_categories.count();
    
    console.log('Enrollments:', enrollCount);
    console.log('Assessment items:', itemCount);
    console.log('Grade categories:', catCount);

    // Check enrollment statuses
    const statuses = await p.enrollments.groupBy({
        by: ['status'],
        _count: true
    });
    console.log('\nEnrollment statuses:', JSON.stringify(statuses, null, 2));

    // Check a sample assignment
    const sampleAssignment = await p.teaching_assignments.findFirst({
        include: {
            grade_categories: { include: { assessment_items: true } },
            enrollments: { take: 3 },
            teachers: true,
            subjects: true
        }
    });
    if (sampleAssignment) {
        console.log('\nSample assignment:', sampleAssignment.id);
        console.log('  Teacher:', sampleAssignment.teachers?.first_name, sampleAssignment.teachers?.last_name);
        console.log('  Subject:', sampleAssignment.subjects?.subject_name);
        console.log('  Categories:', sampleAssignment.grade_categories.length);
        console.log('  Items:', sampleAssignment.grade_categories.reduce((sum, c) => sum + c.assessment_items.length, 0));
        console.log('  Enrollments:', sampleAssignment.enrollments.length);
        console.log('  Enrollment statuses:', sampleAssignment.enrollments.map(e => e.status));
    }
}

main().catch(console.error).finally(() => p['$disconnect']());
