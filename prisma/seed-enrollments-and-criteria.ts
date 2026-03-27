import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🎯 Starting enrollments and criteria seeding...\n');

    const assignments = await prisma.teaching_assignments.findMany({
        include: {
            classrooms: {
                include: {
                    classroom_students: {
                        include: { students: true }
                    }
                }
            },
            grade_categories: {
                include: { assessment_items: true }
            },
            enrollments: true
        }
    });

    console.log(`📚 Found ${assignments.length} teaching assignments\n`);

    let enrollmentsCreated = 0;
    let categoriesCreated = 0;
    let itemsCreated = 0;

    for (const assignment of assignments) {
        // 1. Create Enrollments
        const classroom = assignment.classrooms;
        if (classroom && classroom.classroom_students.length > 0) {
            const existingStudentIds = new Set(assignment.enrollments.map(e => e.student_id));
            
            for (const rel of classroom.classroom_students) {
                if (!existingStudentIds.has(rel.student_id)) {
                    await prisma.enrollments.create({
                        data: {
                            teaching_assignment_id: assignment.id,
                            student_id: rel.student_id,
                            status: 'enrolled'
                        }
                    });
                    enrollmentsCreated++;
                }
            }
        }

        // 2. Create Criteria and Assessment Items if none exist
        if (assignment.grade_categories.length === 0) {
            // Get predefined category types
            const types = await prisma.grade_category_types.findMany();
            const workType = types.find(t => t.type_name === 'ชิ้นงาน/ภาระงาน');
            const midType = types.find(t => t.type_name === 'สอบกลางภาค');
            const finalType = types.find(t => t.type_name === 'สอบปลายภาค');

            const templates = [
                { name: 'คะแนนชิ้นงาน', weight: 40, typeId: workType?.id || null, items: [{ name: 'ใบงานที่ 1', max: 10 }, { name: 'ใบงานที่ 2', max: 10 }, { name: 'สมุด', max: 20 }] },
                { name: 'คะแนนสอบกลางภาค', weight: 30, typeId: midType?.id || null, items: [{ name: 'สอบกลางภาค', max: 30 }] },
                { name: 'คะแนนสอบปลายภาค', weight: 30, typeId: finalType?.id || null, items: [{ name: 'สอบปลายภาค', max: 30 }] }
            ];

            for (const tpl of templates) {
                const cat = await prisma.grade_categories.create({
                    data: {
                        teaching_assignment_id: assignment.id,
                        name: tpl.name,
                        weight_percent: tpl.weight,
                        category_type_id: tpl.typeId
                    }
                });
                categoriesCreated++;

                for (const itemTpl of tpl.items) {
                    await prisma.assessment_items.create({
                        data: {
                            grade_category_id: cat.id,
                            name: itemTpl.name,
                            max_score: itemTpl.max
                        }
                    });
                    itemsCreated++;
                }
            }
        }
    }

    console.log('═══════════════════════════════════════');
    console.log(`✅ Prep Seeding Done!`);
    console.log(`   Enrollments Created: ${enrollmentsCreated}`);
    console.log(`   Categories Created: ${categoriesCreated}`);
    console.log(`   Assessment Items Created: ${itemsCreated}`);
    console.log('═══════════════════════════════════════');
}

main()
    .catch(e => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
