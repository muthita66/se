import { prisma } from '@/lib/prisma';

export const TeacherFitnessService = {
    // --- Academic Years ---
    async getAcademicYears() {
        return prisma.academic_years.findMany({
            orderBy: { year_name: 'desc' }
        });
    },

    // --- Advisor Classes ---
    async getAdvisorClasses(teacher_id: number) {
        const advisors = await prisma.classroom_advisors.findMany({
            where: { teacher_id: Number(teacher_id) },
            include: {
                classrooms: true
            }
        });

        return advisors.map(a => ({
            id: a.classrooms.id,
            room_name: a.classrooms.room_name,
            class_level: a.classrooms.room_name.split('/')[0],
            room: a.classrooms.room_name.split('/')[1] || ''
        }));
    },

    // --- Fitness Criteria ---
    async getFitnessCriteriaForClass(test_name: string, grade_level: string, year?: number) {
        const levelNum = extractLevelNumber(grade_level);
        return prisma.fitness_test_criteria.findFirst({
            where: {
                test_name: { contains: test_name, mode: 'insensitive' },
                OR: [
                    { grade_level: { contains: grade_level, mode: 'insensitive' } },
                    { grade_level: { contains: levelNum, mode: 'insensitive' } }
                ],
                academic_year: year ? Number(year) : undefined
            }
        });
    },

    async getFitnessCriteria(filters: { test_name?: string; grade_level?: string; year?: number; gender?: string }) {
        const { test_name, grade_level, year, gender } = filters;
        const conditions: any = {};
        
        if (test_name) conditions.test_name = { contains: test_name, mode: 'insensitive' };
        if (grade_level) {
            const levelNum = extractLevelNumber(grade_level);
            conditions.OR = [
                { grade_level: { contains: grade_level, mode: 'insensitive' } },
                { grade_level: { contains: levelNum, mode: 'insensitive' } }
            ];
        }
        if (year) conditions.academic_year = Number(year);
        if (gender) conditions.gender = gender;

        return prisma.fitness_test_criteria.findMany({
            where: conditions,
            orderBy: [{ test_name: 'asc' }, { grade_level: 'asc' }]
        });
    },

    async upsertFitnessCriteria(data: any) {
        const { id, test_name, grade_level, gender, academic_year, unit, passing_threshold, comparison_type } = data;
        
        const payload: any = {
            test_name,
            unit: unit || 'ครั้ง',
            passing_threshold: passing_threshold ? Number(passing_threshold) : 0,
            comparison_type: comparison_type || '>=',
            grade_level: grade_level || null,
            gender: gender || null,
            academic_year: academic_year ? Number(academic_year) : null
        };

        if (id) {
            return prisma.fitness_test_criteria.update({
                where: { id: Number(id) },
                data: payload
            });
        }
        return prisma.fitness_test_criteria.create({
            data: payload
        });
    },

    async deleteFitnessCriteria(id: number) {
        return prisma.fitness_test_criteria.delete({
            where: { id: Number(id) }
        });
    },

    // --- Student Data ---
    async getStudentsForTest(teacher_id: number, class_level: string, room: string, year?: number, semester?: number) {
        // Find the classroom that matches both level and room
        const classrooms = await prisma.classrooms.findMany({
            where: {
                room_name: { 
                    startsWith: class_level,
                    contains: room
                }
            }
        });

        if (classrooms.length === 0) return [];

        const studentRows = await prisma.classroom_students.findMany({
            where: {
                classroom_id: { in: classrooms.map(c => c.id) },
                academic_year: year ? Number(year) : undefined
            },
            include: {
                students: {
                    include: {
                        name_prefixes: true,
                        genders: true,
                        student_fitness_records: {
                            where: { semester_id: semester ? Number(semester) : undefined }
                        },
                        student_health_checkups: {
                            where: { semester_id: semester ? Number(semester) : undefined },
                            orderBy: { checkup_date: 'desc' },
                            take: 1
                        }
                    }
                },
                classrooms: true
            },
            orderBy: { roll_number: 'asc' }
        });

        return studentRows.map(row => {
            const s = row.students;
            const health = s.student_health_checkups[0];
            const fitness = s.student_fitness_records;

            return {
                id: s.id,
                student_code: s.student_code,
                prefix: s.name_prefixes?.prefix_name || '',
                first_name: s.first_name,
                last_name: s.last_name,
                name: `${s.name_prefixes?.prefix_name || ''}${s.first_name} ${s.last_name}`.trim(),
                gender: s.genders?.name || '',
                roll_number: row.roll_number,
                class_level: row.classrooms.room_name.split('/')[0],
                room: row.classrooms.room_name.split('/')[1] || '',
                weight: health?.weight ? Number(health.weight) : null,
                height: health?.height ? Number(health.height) : null,
                fitness_records: fitness.map(f => ({
                    id: f.id,
                    test_date: f.test_date,
                    test_result: Number(f.test_result),
                    grade: f.grade,
                    fitness_test_id: f.fitness_test_id,
                    is_passed: f.is_passed
                }))
            };
        });
    },

    // --- Save Records ---
    async saveFitnessTest(data: any) {
        const { items, teacher_id, year, semester } = data;

        if (!items || !Array.isArray(items)) {
            throw new Error('Invalid request format: "items" must be an array');
        }
        
        // Resolve semester_id
        const semesterRow = await prisma.semesters.findFirst({
            where: {
                academic_years: { year_name: String(year) },
                semester_number: Number(semester)
            }
        });
        const semesterId = semesterRow?.id;

        for (const item of items) {
            const { student_id, weight, height, fitness_tests } = item;

            // Update weight/height
            if (weight || height) {
                const existing = await prisma.student_health_checkups.findFirst({
                    where: { student_id: Number(student_id), semester_id: semesterId }
                });

                if (existing) {
                    await prisma.student_health_checkups.update({
                        where: { id: existing.id },
                        data: {
                            weight: weight ? Number(weight) : undefined,
                            height: height ? Number(height) : undefined,
                            checkup_date: new Date()
                        }
                    });
                } else {
                    await prisma.student_health_checkups.create({
                        data: {
                            student_id: Number(student_id),
                            semester_id: semesterId,
                            weight: weight ? Number(weight) : 0,
                            height: height ? Number(height) : 0,
                            checkup_date: new Date(),
                            recorded_by: Number(teacher_id)
                        }
                    });
                }
            }

            // Update fitness tests
            if (fitness_tests && Array.isArray(fitness_tests)) {
                for (const ft of fitness_tests) {
                    await prisma.student_fitness_records.upsert({
                        where: {
                            student_id_fitness_test_id_semester_id: {
                                student_id: Number(student_id),
                                fitness_test_id: Number(ft.fitness_test_id),
                                semester_id: semesterId || 0
                            }
                        },
                        update: {
                            test_result: Number(ft.test_result),
                            grade: ft.grade,
                            is_passed: ft.is_passed,
                            test_date: new Date()
                        },
                        create: {
                            student_id: Number(student_id),
                            fitness_test_id: Number(ft.fitness_test_id),
                            semester_id: semesterId,
                            test_result: Number(ft.test_result),
                            grade: ft.grade,
                            is_passed: ft.is_passed,
                            test_date: new Date(),
                            recorded_by: Number(teacher_id)
                        }
                    });
                }
            }
        }

        return { success: true };
    },

    // --- Daily Health ---
    async getDailyHealthRecords(studentIds: number[], semesterId: number, recordDate?: string) {
        // Fallback to raw query if model is undefined on the prisma client
        if (!(prisma as any).student_daily_health_records) {
            console.log("Prisma model 'student_daily_health_records' is undefined, using queryRaw fallback");
            let query = `SELECT * FROM student_daily_health_records WHERE student_id = ANY($1) AND semester_id = $2`;
            const params: any[] = [studentIds.map(id => Number(id)), semesterId];
            
            if (recordDate) {
                const dateObj = new Date(recordDate);
                dateObj.setHours(0, 0, 0, 0);
                query += ` AND record_date = $3`;
                params.push(dateObj);
            }
            
            return prisma.$queryRawUnsafe<any[]>(query, ...params);
        }

        const where: any = {
            student_id: { in: studentIds.map(id => Number(id)) },
            semester_id: semesterId,
        };

        if (recordDate) {
            const dateObj = new Date(recordDate);
            dateObj.setHours(0, 0, 0, 0);
            where.record_date = dateObj;
        }

        return prisma.student_daily_health_records.findMany({ where });
    },

    async saveDailyHealthRecord(data: any) {
        const { student_id, semester_id, record_date, drinks_milk, brushes_teeth, recorded_by } = data;

        const dateObj = new Date(record_date);
        dateObj.setHours(0, 0, 0, 0);

        // Fallback to raw query if model is undefined on the prisma client
        if (!(prisma as any).student_daily_health_records) {
            console.log("Prisma model 'student_daily_health_records' is undefined, using queryRaw for upsert");
            // PostgreSQL specific Upsert (INSERT ... ON CONFLICT)
            const query = `
                INSERT INTO student_daily_health_records 
                (student_id, semester_id, record_date, drinks_milk, brushes_teeth, recorded_by, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (student_id, semester_id, record_date) 
                DO UPDATE SET 
                    drinks_milk = $4,
                    brushes_teeth = $5,
                    recorded_by = $6
                RETURNING *
            `;
            const result = await prisma.$queryRawUnsafe<any[]>(
                query, 
                Number(student_id), 
                Number(semester_id), 
                dateObj, 
                Boolean(drinks_milk), 
                Boolean(brushes_teeth), 
                Number(recorded_by)
            );
            return result[0];
        }

        return prisma.student_daily_health_records.upsert({
            where: {
                student_id_semester_id_record_date: {
                    student_id: Number(student_id),
                    record_date: dateObj,
                    semester_id: Number(semester_id)
                }
            },
            update: {
                drinks_milk: Boolean(drinks_milk),
                brushes_teeth: Boolean(brushes_teeth)
            },
            create: {
                student_id: Number(student_id),
                semester_id: Number(semester_id),
                record_date: dateObj,
                drinks_milk: Boolean(drinks_milk),
                brushes_teeth: Boolean(brushes_teeth),
                recorded_by: Number(recorded_by)
            }
        });
    }
};

function extractLevelNumber(text: string): string {
    const match = text.match(/\d+/);
    return match ? match[0] : text;
}
