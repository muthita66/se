import { NextResponse } from 'next/server';
import { TeacherFitnessService } from '@/features/teacher/fitness.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teacher_id = Number(searchParams.get('teacher_id'));
        const class_level = searchParams.get('class_level') || '';
        const room = searchParams.get('room') || '';
        const action = searchParams.get('action');

        if (action === 'years') {
            const years = await TeacherFitnessService.getAcademicYears();
            return successResponse(years);
        }

        if (action === 'advisor-classes') {
            if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);
            const classes = await TeacherFitnessService.getAdvisorClasses(teacher_id);
            return successResponse(classes);
        }

        if (action === 'criteria') {
            const test_name = searchParams.get('test_name') || '';
            const grade_level = searchParams.get('class_level') || '';
            const year = Number(searchParams.get('year'));
            const gender = searchParams.get('gender');
            
            // Always return an array so frontend can properly match criteria to students
            const criteria = await TeacherFitnessService.getFitnessCriteria({
                test_name,
                grade_level,
                year: year || undefined,
                gender: gender || undefined
            });
            return successResponse(criteria);
        }

        if (action === 'students') {
            if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);
            if (!class_level) return errorResponse('class_level required', 400);

            const year = Number(searchParams.get('year')) || undefined;
            const semester = Number(searchParams.get('semester')) || undefined;

            const data = await TeacherFitnessService.getStudentsForTest(teacher_id, class_level, room, year, semester);
            return successResponse(data);
        }

        if (action === 'dropdown-options') {
            const { prisma } = await import('@/lib/prisma');

            // Fetch test names + units from existing criteria
            const allCriteria = await prisma.fitness_test_criteria.findMany({
                select: { test_name: true, unit: true },
            });
            const testNameMap = new Map<string, string>();
            allCriteria.forEach((c: any) => { if (!testNameMap.has(c.test_name)) testNameMap.set(c.test_name, c.unit); });
            const testNames = Array.from(testNameMap.entries()).map(([test_name, unit]) => ({ test_name, unit }));

            // Fetch grade levels from actual classrooms table
            const allClassrooms = await prisma.classrooms.findMany({
                select: { room_name: true },
            });
            const levelSet = new Set<string>();
            allClassrooms.forEach((c: any) => {
                if (c.room_name) {
                    const level = c.room_name.split('/')[0]?.trim();
                    if (level) levelSet.add(level);
                }
            });
            const levels = Array.from(levelSet).sort().map((name, i) => ({ id: i + 1, name }));

            return successResponse({ testNames, levels });
        }

        if (action === 'list-all-criteria') {
            const test_name = searchParams.get('test_name') || undefined;
            const grade_level = searchParams.get('class_level') || undefined;
            const year = Number(searchParams.get('year')) || undefined;
            
            const data = await TeacherFitnessService.getFitnessCriteria({ test_name, grade_level, year });
            return successResponse(data);
        }

        if (action === 'daily-health') {
            const t_id = Number(searchParams.get('teacher_id'));
            console.log("DEBUG: API action=daily-health", { t_id, year: searchParams.get('year'), sem: searchParams.get('semester'), record_date: searchParams.get('record_date') });
            if (!t_id || Number.isNaN(t_id)) return errorResponse('teacher_id required', 400);
            const year = Number(searchParams.get('year'));
            const sem = Number(searchParams.get('semester'));
            const record_date = searchParams.get('record_date') || undefined;
            const student_ids = searchParams.get('student_ids');
            
            // Resolve semesterId
            let semesterId: number | null = null;
            if (year && sem) {
                const { prisma } = await import('@/lib/prisma');
                const semRow = await prisma.semesters.findFirst({
                    where: {
                        semester_number: Number(sem),
                        academic_years: {
                            year_name: String(year)
                        }
                    },
                    select: { id: true }
                });
                if (semRow) semesterId = semRow.id;
            }
            
            if (!semesterId) return successResponse([]);
            
            const ids = student_ids ? student_ids.split(',').map(Number).filter(n => !isNaN(n)) : [];
            const data = await TeacherFitnessService.getDailyHealthRecords(ids, semesterId, record_date);
            return successResponse(data);
        }

        return errorResponse('Invalid or missing action parameter', 400);


    } catch (error: any) {
        return errorResponse('Failed', 500, error.message);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, ...payload } = body;

        if (action === 'upsert-criteria') {
            const data = await TeacherFitnessService.upsertFitnessCriteria(payload);
            return successResponse(data);
        }

        if (action === 'delete-criteria') {
            const data = await TeacherFitnessService.deleteFitnessCriteria(payload.id);
            return successResponse(data);
        }

        if (action === 'save-daily-health') {
            // Resolve semester_id from year + semester
            const { prisma } = await import('@/lib/prisma');
            const semRow = await prisma.semesters.findFirst({
                where: {
                    semester_number: Number(payload.semester),
                    academic_years: {
                        year_name: String(payload.year)
                    }
                },
                select: { id: true }
            });
            if (!semRow) {
                return errorResponse('ไม่พบข้อมูลปีการศึกษา/ภาคเรียน', 400);
            }
            const data = await TeacherFitnessService.saveDailyHealthRecord({
                ...payload,
                semester_id: semRow.id,
            });
            return successResponse(data);
        }

        const data = await TeacherFitnessService.saveFitnessTest(body);
        return successResponse(data);
    } catch (error: any) {
        console.error("FITNESS SAVE ERROR:", error);
        return errorResponse('Failed to process request', 500, error.message);
    }
}
