import { prisma } from '@/lib/prisma';

export const ScheduleService = {
    async resolveStudentClassroom(student_id: number, year?: number) {
        if (!student_id) return null;

        let classroomStudent = await prisma.classroom_students.findFirst({
            where: {
                student_id,
                ...(year ? { academic_year: Number(year) } : {}),
            },
            include: {
                classrooms: true,
            },
            orderBy: { academic_year: 'desc' },
        });

        if (!classroomStudent) {
            classroomStudent = await prisma.classroom_students.findFirst({
                where: { student_id },
                include: {
                    classrooms: true,
                },
                orderBy: { academic_year: 'desc' },
            });
        }

        return classroomStudent;
    },

    async getClassSchedule(student_id: number, year?: number, semester?: number) {
        if (!student_id) return [];

        const classroomStudent = await this.resolveStudentClassroom(student_id, year);
        if (!classroomStudent?.classroom_id) return [];

        const semesterData = await prisma.semesters.findFirst({
            where: {
                ...(year ? { academic_years: { year_name: String(year) } } : {}),
                ...(semester ? { semester_number: Number(semester) } : {}),
            },
            select: { id: true }
        });

        const assignments = await prisma.teaching_assignments.findMany({
            where: {
                classroom_id: classroomStudent.classroom_id,
                ...(semesterData ? { semester_id: semesterData.id } : {}),
            },
            include: {
                subjects: true,
                teachers: {
                    include: {
                        name_prefixes: true,
                    },
                },
                classrooms: true,
                semesters: {
                    include: { academic_years: true },
                },
                class_schedules: {
                    include: {
                        day_of_weeks: true,
                        periods: true,
                        rooms: true,
                    },
                },
            },
        });

        // Flatten into schedule entries
        const scheduleItems: any[] = [];
        for (const ta of assignments) {
            const subject = ta.subjects;
            const teacher = ta.teachers;
            const teacherPrefix = teacher?.name_prefixes?.prefix_name || '';
            const teacherName = [teacherPrefix, teacher?.first_name, teacher?.last_name].filter(Boolean).join(' ');

            for (const cs of ta.class_schedules) {
                scheduleItems.push({
                    id: cs.id,
                    section_id: ta.id,
                    subject_code: subject?.subject_code || '',
                    subject_name: subject?.subject_name || '',
                    credit: subject?.credit ? Number(subject.credit) : 0,
                    teacher_name: teacherName,
                    teacher_code: teacher?.teacher_code || '',
                    day: cs.day_of_weeks?.day_name_th || '',
                    day_en: cs.day_of_weeks?.day_name_en || '',
                    day_short: cs.day_of_weeks?.short_name || '',
                    day_id: cs.day_id || 0,
                    period: cs.periods?.period_name || '',
                    start_time: cs.periods?.start_time,
                    end_time: cs.periods?.end_time,
                    room_name: cs.rooms?.room_name || '',
                    room: cs.rooms?.room_name || '',
                    class_level: ta.classrooms?.room_name || '',
                    classroom: ta.classrooms?.room_name || '',
                    year: ta.semesters?.academic_years?.year_name || '',
                    semester: ta.semesters?.semester_number || 0,
                });
            }
        }

        // Sort by day_id then start_time
        scheduleItems.sort((a, b) => {
            if (a.day_id !== b.day_id) return a.day_id - b.day_id;
            if (a.start_time && b.start_time) return a.start_time < b.start_time ? -1 : 1;
            return 0;
        });

        return scheduleItems;
    },

    async getExamSchedule(student_id: number, year?: number, semester?: number) {
        if (!student_id) return [];

        const classroomStudent = await this.resolveStudentClassroom(student_id, year);
        if (!classroomStudent?.classroom_id) return [];

        const whereSemester: any = {};
        if (year) {
            whereSemester.academic_years = {
                year_name: String(year)
            };
        }
        if (semester) {
            whereSemester.semester_number = Number(semester);
        }

        const semesterData = await prisma.semesters.findFirst({
            where: whereSemester,
            select: { id: true }
        });

        if (!semesterData) return [];

        const assignments = await prisma.teaching_assignments.findMany({
            where: {
                classroom_id: classroomStudent.classroom_id,
                semester_id: semesterData.id,
            },
            select: {
                id: true,
                subject_id: true,
                subjects: {
                    select: {
                        subject_code: true,
                        subject_name: true,
                    },
                },
            },
        });

        // 3. Create a subject map for lookup
        const subjectMap = new Map<number, { section_id: number, subject_code: string, subject_name: string }>();
        assignments.forEach((ta) => {
            if (ta.subjects) {
                subjectMap.set(ta.subject_id, {
                    section_id: ta.id,
                    subject_code: ta.subjects.subject_code || '',
                    subject_name: ta.subjects.subject_name || '',
                });
            }
        });

        const subjectIds = Array.from(subjectMap.keys());
        if (subjectIds.length === 0) return [];

        const classSchedule = await ScheduleService.getClassSchedule(student_id, year, semester);
        const regularRooms = classSchedule.map((cs: any) => cs.room).filter(Boolean);
        const regularRoomSet = new Set(regularRooms);

        const exams = await prisma.exam_schedules.findMany({
            where: {
                semester_id: semesterData.id,
                subject_id: { in: subjectIds }
            },
            include: { subjects: true }
        });

        return exams.map(exam => {
            const roomNames = '-';
            
            const formatTime = (date: Date | null) => {
                if (!date) return '';
                const d = new Date(date);
                const hours = String(d.getHours()).padStart(2, '0');
                const mins = String(d.getMinutes()).padStart(2, '0');
                return `${hours}:${mins}`;
            };

            const startTime = formatTime(exam.start_time);
            const endTime = formatTime(exam.end_time);
            
            const subjInfo = subjectMap.get(exam.subject_id);

            return {
                id: exam.id,
                section_id: subjInfo?.section_id || null,
                subject_code: subjInfo?.subject_code || '',
                subject_name: subjInfo?.subject_name || '',
                exam_type: exam.exam_type,
                exam_date: exam.exam_date,
                time_range: startTime && endTime ? `${startTime}-${endTime}` : '',
                room: roomNames || '-',
                class_level: '', 
            };
        });
    }
};
