import { prisma } from '@/lib/prisma';
import { ScheduleService } from '@/features/student/schedule.service';

const NUMERIC_TO_LETTER_GRADE: Record<string, string> = {
    '4': 'A',
    '3.5': 'B+',
    '3': 'B',
    '2.5': 'C+',
    '2': 'C',
    '1.5': 'D+',
    '1': 'D',
    '0': 'F',
};

type GradeRow = {
    subject_code: string;
    subject: string;
    credit: number;
    total: number | null;
    grade: string | null;
    grade_raw: unknown;
    grade_point: number | null;
    year: string;
    semester: number;
    category: string;
};

export const GradesService = {
    async getGrades(student_id: number, year?: number, semester?: number) {
        if (!student_id) return [];

        const enrollmentWhere: Record<string, unknown> = { student_id };

        if (year || semester) {
            enrollmentWhere.teaching_assignments = {
                semesters: {
                    ...(year ? { academic_years: { year_name: String(year) } } : {}),
                    ...(semester ? { semester_number: semester } : {}),
                }
            };
        }

        const enrollments = await (prisma.enrollments as any).findMany({
            where: enrollmentWhere,
            include: {
                teaching_assignments: {
                    include: {
                        subjects: {
                            include: { subject_categories: true }
                        },
                        semesters: {
                            include: { academic_years: true }
                        },
                        grade_categories: {
                            include: {
                                assessment_items: {
                                    include: {
                                        student_scores: {
                                            where: { enrollments: { student_id } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                final_grades: {
                    include: { grade_scales: true }
                }
            }
        });

        const uniqueSubjects = new Map<string, GradeRow>();

        enrollments.forEach((enrollment: any) => {
            const row = buildEnrollmentGradeRow(enrollment);
            if (!row) return;
            uniqueSubjects.set(row.subject_code, row);
        });

        if (year && semester) {
            const scheduledRows = await this.getScheduledSubjectRows(student_id, year, semester);
            scheduledRows.forEach((row) => {
                if (!uniqueSubjects.has(row.subject_code)) {
                    uniqueSubjects.set(row.subject_code, row);
                }
            });
        }

        return Array.from(uniqueSubjects.values()).sort((a, b) => {
            const orderA = getCategoryRank(a.category);
            const orderB = getCategoryRank(b.category);

            if (orderA !== orderB) return orderA - orderB;
            return a.subject_code.localeCompare(b.subject_code);
        });
    },

    async getScheduledSubjectRows(student_id: number, year: number, semester: number): Promise<GradeRow[]> {
        const classScheduleRows = await ScheduleService.getClassSchedule(student_id, year, semester);
        const scheduledFromClassRows = mapScheduleRowsToGradeRows(classScheduleRows, year, semester);
        if (scheduledFromClassRows.length > 0) return scheduledFromClassRows;

        const classroomStudent = await ScheduleService.resolveStudentClassroom(student_id, year);
        if (!classroomStudent?.classroom_id) return [];

        const semesterData = await prisma.semesters.findFirst({
            where: {
                semester_number: Number(semester),
                academic_years: {
                    year_name: String(year),
                },
            },
            select: {
                id: true,
                semester_number: true,
                academic_years: {
                    select: {
                        year_name: true,
                    },
                },
            },
        });

        if (!semesterData?.id) return [];

        const assignments = await prisma.teaching_assignments.findMany({
            where: {
                classroom_id: classroomStudent.classroom_id,
                semester_id: semesterData.id,
            },
            include: {
                subjects: {
                    include: {
                        subject_categories: true,
                    },
                },
            },
        });

        const rows: Array<GradeRow | null> = assignments.map((assignment) => {
                const subject = assignment.subjects;
                if (!subject?.subject_code) return null;

                return {
                    subject_code: subject.subject_code,
                    subject: subject.subject_name || '',
                    credit: Number(subject.credit || 0),
                    total: null,
                    grade: null,
                    grade_raw: null,
                    grade_point: null,
                    year: semesterData.academic_years?.year_name || String(year),
                    semester: semesterData.semester_number || Number(semester),
                    category: subject.subject_categories?.category_name || '',
                };
            });

        return rows.filter((row): row is GradeRow => row !== null);
    },
};

function buildEnrollmentGradeRow(enrollment: any): GradeRow | null {
    const ta = enrollment?.teaching_assignments;
    const subject = ta?.subjects;
    if (!subject) return null;

    let totalScore = 0;

    (ta.grade_categories || []).forEach((cat: any) => {
        (cat.assessment_items || []).forEach((item: any) => {
            const studentScore = item.student_scores?.[0];
            if (studentScore) {
                totalScore += Number(studentScore.score || 0);
            }
        });
    });

    const finalGrade = enrollment.final_grades;
    const normalizedGrade = normalizeGradeLabel(finalGrade?.letter_grade);
    const gradePoint = resolveGradePoint(normalizedGrade, finalGrade?.grade_point, finalGrade?.letter_grade);

    return {
        subject_code: subject.subject_code,
        subject: subject.subject_name,
        credit: Number(subject.credit || 0),
        total: finalGrade?.total_score != null ? Number(finalGrade.total_score) : totalScore,
        grade: normalizedGrade,
        grade_raw: finalGrade?.letter_grade ?? null,
        grade_point: gradePoint,
        year: ta.semesters?.academic_years?.year_name || '',
        semester: ta.semesters?.semester_number || 0,
        category: subject.subject_categories?.category_name || '',
    };
}

function getCategoryRank(cat: string): number {
    if (!cat) return 99;
    if (cat.includes('à¸žà¸·à¹‰à¸™à¸à¸²à¸™')) return 1;
    if (cat.includes('à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡')) return 2;
    if (cat.includes('à¸à¸´à¸ˆà¸à¸£à¸£à¸¡')) return 3;
    return 99;
}

function normalizeGradeLabel(rawGrade: unknown): string | null {
    const raw = String(rawGrade ?? '').trim().toUpperCase();
    if (!raw) return null;

    if (raw in NUMERIC_TO_LETTER_GRADE) return NUMERIC_TO_LETTER_GRADE[raw];

    if (['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'].includes(raw)) {
        return raw;
    }

    return null;
}

function resolveGradePoint(normalizedGrade: string | null, rawGradePoint: unknown, rawGradeLabel: unknown): number | null {
    const parsedGradePoint = Number(rawGradePoint);
    if (rawGradePoint != null && rawGradePoint !== '' && Number.isFinite(parsedGradePoint)) {
        return parsedGradePoint;
    }

    const label = normalizedGrade ?? normalizeGradeLabel(rawGradeLabel);
    if (!label) return null;

    const map: Record<string, number> = {
        A: 4,
        'B+': 3.5,
        B: 3,
        'C+': 2.5,
        C: 2,
        'D+': 1.5,
        D: 1,
        F: 0,
    };

    return map[label] ?? null;
}

function mapScheduleRowsToGradeRows(rows: any[], year: number, semester: number): GradeRow[] {
    const deduped = new Map<string, any>();

    rows.forEach((row: any) => {
        const subjectCode = String(row?.subject_code || '').trim();
        if (!subjectCode || deduped.has(subjectCode)) return;
        deduped.set(subjectCode, row);
    });

    return Array.from(deduped.entries()).map(([subjectCode, row]) => ({
        subject_code: subjectCode,
        subject: String(row?.subject_name || ''),
        credit: Number(row?.credit || 0),
        total: null,
        grade: null,
        grade_raw: null,
        grade_point: null,
        year: String(row?.year || year),
        semester: Number(row?.semester || semester),
        category: '',
    }));
}
