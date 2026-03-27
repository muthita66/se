/**
 * Seed Script: Insert student scores for ALL students across ALL teaching assignments.
 * 
 * For each teaching_assignment:
 *   1. Find all enrollments (students)
 *   2. Find all assessment_items (via grade_categories)
 *   3. Generate realistic random scores (60-100% of max_score)
 *   4. Upsert into student_scores
 * 
 * For pass/fail subjects (evaluation_type_id = 2), is_passed is set based on score >= 50%.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function randomScore(maxScore: number): number {
    // Generate a realistic score: 50-100% of max, with a bell curve towards 70-85%
    const rand = Math.random();
    let pct: number;
    if (rand < 0.05) {
        // 5% get low scores (30-50%)
        pct = 0.3 + Math.random() * 0.2;
    } else if (rand < 0.15) {
        // 10% get below average (50-65%)
        pct = 0.5 + Math.random() * 0.15;
    } else if (rand < 0.55) {
        // 40% get average (65-80%)
        pct = 0.65 + Math.random() * 0.15;
    } else if (rand < 0.85) {
        // 30% get good (80-90%)
        pct = 0.8 + Math.random() * 0.1;
    } else {
        // 15% get excellent (90-100%)
        pct = 0.9 + Math.random() * 0.1;
    }
    const raw = maxScore * pct;
    // Round to 1 decimal place
    return Math.round(raw * 10) / 10;
}

async function main() {
    console.log('🎯 Starting student score seeding...\n');

    // Get all teaching assignments with their related data
    const assignments = await prisma.teaching_assignments.findMany({
        include: {
            subjects: {
                include: { evaluation_types: true }
            },
            grade_categories: {
                include: {
                    assessment_items: true
                }
            },
            enrollments: {
                where: { status: 'enrolled' }
            },
            teachers: true,
            semesters: {
                include: { academic_years: true }
            }
        }
    });

    console.log(`📚 Found ${assignments.length} teaching assignments\n`);

    let totalScoresInserted = 0;
    let totalSkipped = 0;
    let assignmentsProcessed = 0;

    for (const assignment of assignments) {
        const enrollments = assignment.enrollments;
        const allItems: { id: number; max_score: number }[] = [];

        // Collect all assessment items from all categories
        for (const cat of assignment.grade_categories) {
            for (const item of cat.assessment_items) {
                allItems.push({
                    id: item.id,
                    max_score: Number(item.max_score)
                });
            }
        }

        if (enrollments.length === 0 || allItems.length === 0) {
            totalSkipped++;
            continue;
        }

        const isPassFail = assignment.subjects?.evaluation_types?.id === 2;
        const teacherName = assignment.teachers
            ? `${assignment.teachers.first_name} ${assignment.teachers.last_name}`
            : 'Unknown';
        const subjectName = assignment.subjects?.subject_name || 'Unknown';
        const yearName = assignment.semesters?.academic_years?.year_name || '?';
        const semNum = assignment.semesters?.semester_number || '?';

        console.log(`📝 ${subjectName} (ครู${teacherName}) - ปี ${yearName} เทอม ${semNum}`);
        console.log(`   ${enrollments.length} students × ${allItems.length} items`);

        const upsertData: {
            assessment_item_id: number;
            enrollment_id: number;
            score: number;
            is_passed: boolean | null;
        }[] = [];

        for (const enrollment of enrollments) {
            for (const item of allItems) {
                const score = randomScore(item.max_score);
                const is_passed = isPassFail ? score >= (item.max_score * 0.5) : null;
                upsertData.push({
                    assessment_item_id: item.id,
                    enrollment_id: enrollment.id,
                    score,
                    is_passed
                });
            }
        }

        // Batch upsert using raw SQL for performance
        // Process in chunks of 500
        const chunkSize = 500;
        for (let i = 0; i < upsertData.length; i += chunkSize) {
            const chunk = upsertData.slice(i, i + chunkSize);
            
            // Use Prisma transactions for upserts
            await prisma.$transaction(
                chunk.map(d =>
                    prisma.student_scores.upsert({
                        where: {
                            assessment_item_id_enrollment_id: {
                                assessment_item_id: d.assessment_item_id,
                                enrollment_id: d.enrollment_id
                            }
                        },
                        update: {
                            score: d.score,
                            is_passed: d.is_passed,
                            is_missing: false,
                            updated_at: new Date()
                        },
                        create: {
                            assessment_item_id: d.assessment_item_id,
                            enrollment_id: d.enrollment_id,
                            score: d.score,
                            is_passed: d.is_passed,
                            is_missing: false,
                        }
                    })
                )
            );
        }

        totalScoresInserted += upsertData.length;
        assignmentsProcessed++;
        console.log(`   ✅ ${upsertData.length} scores inserted\n`);
    }

    console.log('═══════════════════════════════════════');
    console.log(`✅ Done!`);
    console.log(`   Assignments processed: ${assignmentsProcessed}`);
    console.log(`   Assignments skipped (no students/items): ${totalSkipped}`);
    console.log(`   Total scores inserted: ${totalScoresInserted}`);
    console.log('═══════════════════════════════════════');
}

main()
    .catch(e => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
