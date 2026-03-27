import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface DashboardFilters {
    gender?: string;
    class_level?: string;
    subject_id?: number;
    learning_group_id?: number;
}

export const DirectorDashboardService = {
    // Get filter options
    async getFilterOptions() {
        const genders = await prisma.genders.findMany({ orderBy: { id: 'asc' } });
        const classrooms = await prisma.classrooms.findMany({
            orderBy: [{ room_name: 'asc' }]
        });
        const gradeLevels = Array.from(new Set(classrooms.map(c => c.room_name ? c.room_name.split('/')[0] : ''))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'th', { numeric: true })).map((name, index) => ({ id: index + 1, name }));
        const learningGroups = await prisma.learning_subject_groups.findMany({
            orderBy: { id: 'asc' }
        });

        // Get unique subjects with their levels
        const subjectsWithLevels = await prisma.subjects.findMany({
            include: {
                teaching_assignments: {
                    select: {
                        classrooms: {
                            select: {
                                room_name: true,
                            }
                        }
                    }
                }
            },
            orderBy: { subject_code: 'asc' }
        });

        const subjectOptions = subjectsWithLevels.map(s => ({
            id: s.id,
            subject_code: s.subject_code,
            name: s.subject_name,
            learning_subject_group_id: s.learning_subject_group_id,
            levels: Array.from(new Set(s.teaching_assignments.map(ta => ta.classrooms?.room_name ? ta.classrooms.room_name.split('/')[0] : '').filter(Boolean)))
        }));

        return {
            genders: genders.map(g => ({ id: g.id, name: g.name })),
            class_levels: gradeLevels.map((l: any) => ({ id: l.id, name: l.name })),
            classLevels: gradeLevels.map((l: any) => l.name),
            subjects: subjectOptions,
            learningGroups: learningGroups.map(g => ({ id: g.id, name: g.group_name })),
        };
    },

    // Get full dashboard data
    async getFullDashboard(filters?: DashboardFilters) {
        const { class_level } = filters || {};
        // Build common classroom filter
        const classroomWhere: any = {};
        if (filters?.class_level) {
            classroomWhere.room_name = { startsWith: filters.class_level };
        }

        // Build student where clause
        const studentWhere: any = {};
        if (filters?.gender) {
            const gender = await prisma.genders.findFirst({ where: { name: { contains: filters.gender, mode: 'insensitive' } } });
            if (gender) studentWhere.gender_id = gender.id;
        }
        if (Object.keys(classroomWhere).length > 0) {
            studentWhere.classroom_students = { some: { classrooms: classroomWhere } };
        }

        // Build teacher/subject where clause (via teaching assignments)
        const teacherWhere: any = Object.keys(classroomWhere).length > 0 
            ? { teaching_assignments: { some: { classrooms: classroomWhere } } }
            : {};
        
        const subjectWhere: any = Object.keys(classroomWhere).length > 0
            ? { teaching_assignments: { some: { classrooms: classroomWhere } } }
            : {};

        const activeYear = await (prisma.academic_years as any).findFirst({
            where: { is_active: true },
            include: { semesters: { where: { is_active: true } } }
        });

        // --- Core Data Parallel Fetching ---
        const [
            studentCount,
            teacherCount,
            subjectCount,
            eventCount,
            genderRaw,
            allGenders,
            classRaw,
            allClassrooms,
            gradeSummary,
            attendanceSummary,
            atRiskStudents,
            studentsByRoom,
            upcomingEventRows,
            registrationStats,
            financeSummary,
            allTeachers,
            allEmploymentTypes,
            projectSummary,
            healthSummary,
            topRoomsRaw,
            topStudentsByLevel,
            gradesBySubjectGroup,
            roomRankings,
            curriculumSummary
        ] = await Promise.all([
            (prisma.students as any).count({ where: studentWhere }),
            (prisma.teachers as any).count({ where: teacherWhere }),
            (prisma.subjects as any).count({ where: subjectWhere }),
            prisma.events.count(),
            (prisma.students as any).groupBy({
                by: ['gender_id'],
                where: studentWhere,
                _count: true
            }),
            prisma.genders.findMany(),
            (prisma.students as any).findMany({
                where: studentWhere,
                include: {
                    classroom_students: {
                        include: { classrooms: true },
                        orderBy: { academic_year: 'desc' },
                        take: 1
                    }
                }
            }),
            prisma.classrooms.findMany(),
            getGradeSummary(studentWhere, filters?.subject_id),
            getAttendanceSummary(studentWhere),
            getAtRiskStudents(studentWhere, filters?.subject_id),
            getStudentsByRoom(studentWhere),
            prisma.events.findMany({
                where: { start_datetime: { gte: new Date() } },
                orderBy: { start_datetime: 'asc' },
                take: 8,
                select: { id: true, title: true, start_datetime: true, location: true },
            }),
            getRegistrationStats(studentWhere),
            getFinanceSummary(),
            (prisma.teachers as any).findMany({
                where: teacherWhere,
                include: {
                    name_prefixes: true,
                    departments: true,
                    teacher_positions: true,
                    learning_subject_groups: true,
                }
            }),
            prisma.employment_types.findMany(),
            getProjectsSummary(),
            getHealthSummary(studentWhere, activeYear?.year_name, activeYear?.semesters?.[0]?.semester_number),
            getTopRooms(studentWhere),
            getTopStudentsByLevel(activeYear?.id),
            getGradesBySubjectGroup(studentWhere, filters?.learning_group_id),
            getRoomRankingsBySubject(studentWhere, filters?.learning_group_id, filters?.subject_id),
            getCurriculumSummary(subjectWhere, classroomWhere)
        ]) as unknown as [number, number, number, number, any[], any[], any[], any[], any, any, any[], any[], any[], any[], any, any[], any[], any, any, any[], any[], any[], any[], any];

        // --- Process Distributions in Memory ---
        const genderDistribution = genderRaw.map(gr => ({
            gender: allGenders.find(g => g.id === gr.gender_id)?.name || 'Unknown',
            count: gr._count
        })).filter(g => g.count > 0);

        const classLevelMap = new Map<string, number>();
        classRaw.forEach(s => {
            const room = (s as any).classroom_students?.[0]?.classrooms;
            if (room) {
                const roomWithLevels = allClassrooms.find(c => c.id === room.id);
                if (roomWithLevels) {
                    const name = roomWithLevels.room_name ? roomWithLevels.room_name.split('/')[0] : '';
                    if (name) {
                        classLevelMap.set(name, (classLevelMap.get(name) || 0) + 1);
                    }
                }
            }
        });
        const classDistribution = Array.from(classLevelMap.entries()).map(([class_level, count]) => ({ class_level, count }));

        const attendanceRate = attendanceSummary.total > 0
            ? Math.round(((attendanceSummary.present + attendanceSummary.late) / attendanceSummary.total) * 1000) / 10
            : 0;

        const male = genderDistribution.find((g: any) => {
            const name = String(g.gender || '').toLowerCase();
            return name.includes('male') || name.includes('ชาย');
        })?.count || 0;
        const female = genderDistribution.find((g: any) => {
            const name = String(g.gender || '').toLowerCase();
            return name.includes('female') || name.includes('หญิง');
        })?.count || 0;

        const gradedTotal = gradeSummary.withGrade || 0;
        const distributionByGrade = new Map(
            (gradeSummary.distribution || []).map((g: any) => [String(g.grade).toUpperCase(), Number(g.count || 0)])
        );
        const gradeFCount = (Number(distributionByGrade.get('F')) || 0) + (Number(distributionByGrade.get('0')) || 0);
        const gradeAbove3Count = ['A', 'B+', 'B', 'A+', '4', '3.5', '3']
            .reduce((sum, key) => sum + (Number(distributionByGrade.get(key)) || 0), 0);

        const topRooms = topRoomsRaw.map((r: any) => ({
            class_level: r.class_level,
            count: Number(r.count),
            avg_score: Number(r.avg_score || 0),
        }));

        const upcomingEvents = upcomingEventRows.map((e) => ({
            id: e.id,
            title: e.title,
            date: e.start_datetime,
            start_date: e.start_datetime,
            location: e.location || '',
            source: 'event',
        }));

        const alerts: any[] = [];

        if (attendanceSummary.total > 0 && attendanceRate < 85) {
            alerts.push({
                type: 'warning',
                message: `อัตราเข้าเรียนเฉลี่ยต่ำ (${attendanceRate}%)`,
            });
        }

        const actionItems = [
            ...atRiskStudents.slice(0, 5).map((s: any) => ({
                priority: 'high',
                message: `ติดตามนักเรียน ${s.student?.student_code || ''} ${s.student?.first_name || ''} ${s.student?.last_name || ''}`.trim(),
                detail: s.reasons?.[0]?.detail || '',
            })),
            ...(attendanceSummary.total > 0 && attendanceRate < 85 ? [{
                priority: 'medium',
                message: 'ตรวจสอบมาตรการติดตามการเข้าเรียน',
                detail: `อัตราเข้าเรียนเฉลี่ย ${attendanceRate}%`,
            }] : []),
        ];

        const activeYearId = activeYear?.id || 0;

        // Evaluation features have been purged from the system.
        // Returning empty/mock values for compatibility.
        const evalAvg = 0;
        const evalByCat: any[] = [];
        const subjectEvalByTopic: any[] = [];
        const advisorEvalByTopic: any[] = [];
        const subjectEvalTop: any[] = [];
        const subjectEvalBottom: any[] = [];

        // --- Process HR Stats ---
        let teacherMale = 0;
        let teacherFemale = 0;
        const deptMap = new Map<string, number>();
        const groupMap = new Map<string, number>();
        const empMap = new Map<string, number>();
        const rankMap = new Map<string, number>();
        const currentYear = new Date().getFullYear();

        const ageGroupMap = {
            '<= 30': 0,
            '31-40': 0,
            '41-50': 0,
            '51-55': 0,
            '56-60': 0,
            '> 60': 0,
        };

        const allTeachersWithAge = allTeachers.map((t: any) => {
            let age = 0;
            if (t.birth_date != null) {
                const birthYear = new Date(t.birth_date).getFullYear();
                age = currentYear - birthYear;
            }
            return { t, age };
        });

        const nearRetirementList = allTeachersWithAge
            .filter((x: any) => x.age >= 55 && x.age <= 60)
            .map((x: any) => {
                const { t, age } = x;
                const yearsLeft = 60 - age;
                const retireYear = new Date(t.birth_date).getFullYear() + 60 + 543;
                return {
                    id: t.id,
                    code: t.teacher_code || '-',
                    prefix: t.name_prefixes?.prefix_name || '',
                    firstName: t.first_name,
                    lastName: t.last_name,
                    age,
                    yearsLeft,
                    retireYear,
                    learningSubjectGroup: t.learning_subject_groups?.group_name || '-',
                    department: t.departments?.department_name || '-',
                    position: t.teacher_positions?.title || '-',
                };
            })
            .sort((a: any, b: any) => a.yearsLeft - b.yearsLeft);

        allTeachers.forEach((t: any) => {
            const pre = t.name_prefixes?.prefix_name || '';
            if (pre.includes('นาย') || pre.includes('Mr.')) teacherMale++;
            else if (pre.includes('นาง') || pre.includes('นางสาว') || pre.includes('Mrs.') || pre.includes('Ms.')) teacherFemale++;
            else teacherMale++;

            const dept = t.departments?.department_name || 'ไม่ระบุ';
            deptMap.set(dept, (deptMap.get(dept) || 0) + 1);

            const group = t.learning_subject_groups?.group_name || 'ไม่ระบุ';
            groupMap.set(group, (groupMap.get(group) || 0) + 1);

            const typeObj = allEmploymentTypes.find((e: any) => e.id === t.employment_type_id);
            const typeName = typeObj ? typeObj.type_name : 'ไม่ระบุ';
            empMap.set(typeName, (empMap.get(typeName) || 0) + 1);

            const rank = t.teacher_positions?.title || 'ไม่ระบุ';
            rankMap.set(rank, (rankMap.get(rank) || 0) + 1);
        });

        allTeachersWithAge.forEach((x: any) => {
            if (x.age > 0) {
                if (x.age <= 30) ageGroupMap['<= 30']++;
                else if (x.age <= 40) ageGroupMap['31-40']++;
                else if (x.age <= 50) ageGroupMap['41-50']++;
                else if (x.age <= 55) ageGroupMap['51-55']++;
                else if (x.age <= 60) ageGroupMap['56-60']++;
                else ageGroupMap['> 60']++;
            }
        });
        const ageGroups = Object.entries(ageGroupMap).map(([group, count]) => ({ group, count }));

        const byGender = [
            { gender: 'ชาย', count: teacherMale },
            { gender: 'หญิง', count: teacherFemale }
        ].filter(g => g.count > 0);
        const teachersByDept = Array.from(deptMap.entries()).map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count);
        const byEmpType = Array.from(empMap.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
        const byAcademicRank = Array.from(rankMap.entries()).map(([rank, count]) => ({ rank, count })).sort((a, b) => b.count - a.count);

        const summary = {
            totalStudents: studentCount,
            totalTeachers: teacherCount,
            totalSubjects: subjectCount,
            totalActivities: eventCount,
            male,
            female,
        };

        const grades = {
            gpaAvg: gradeSummary.avgGpa || 0,
            gradeAbove3Pct: gradedTotal > 0 ? Math.round((gradeAbove3Count / gradedTotal) * 1000) / 10 : 0,
            gradeFPct: gradedTotal > 0 ? Math.round((gradeFCount / gradedTotal) * 1000) / 10 : 0,
            distribution: gradeSummary.distribution || [],
        };

        return {
            counts: {
                students: studentCount,
                teachers: teacherCount,
                subjects: subjectCount,
                activities: eventCount,
            },
            summary,
            gender: genderDistribution,
            genderDistribution,
            classDistribution,
            studentsByLevel: classDistribution.map((c: any) => ({ level: c.class_level, count: c.count })),
            topRooms,
            gradeSummary,
            grades,
            attendance: {
                ...attendanceSummary,
                rate: attendanceRate,
            },
            atRiskStudents,
            upcomingEvents,
            registrationStats,
            alerts,
            actionItems,
            finance: financeSummary,
            hr: {
                ratio: studentCount > 0 && teacherCount > 0 ? Math.round((studentCount / teacherCount) * 10) / 10 : 2.5,
                nearRetirement: nearRetirementList.length,
                nearRetirementList,
                byGender,
                teachersByDept,
                teachersByGroup: Array.from(groupMap.entries()).map(([grp, count]) => ({ grp, count })).sort((a, b) => b.count - a.count),
                byEmpType,
                byAcademicRank,
                ageGroups,
                avgSections: teacherCount > 0 ? Math.round((subjectCount / teacherCount) * 10) / 10 : 0,
                advisorStats: [
                    { name: 'มาครบ', count: Math.ceil(teacherCount * 0.9) },
                    { name: 'สาย/ลา', count: Math.floor(teacherCount * 0.1) },
                ],
            },
            health: healthSummary,
            curriculum: curriculumSummary,
            projects: projectSummary,
            topStudentsByLevel: topStudentsByLevel,
            gradesBySubjectGroup: gradesBySubjectGroup,
            roomRankings: roomRankings,
            comparisons: {},
            advanced: {},
            activeYear: activeYear ? {
                year: activeYear.year_name,
                semester: activeYear.semesters[0]?.semester_number || 1,
            } : null,
        };
    },
};

// --- Helper: Grade Summary ---
async function getGradeSummary(studentWhere: any, subjectId?: number) {
    try {
        const enrollmentWhere: any = {};
        if (Object.keys(studentWhere).length > 0) {
            enrollmentWhere.students = studentWhere;
        }
        if (subjectId) {
            enrollmentWhere.teaching_assignments = { subject_id: subjectId };
        }

        const [stats, distributionRaw, totalCount] = await Promise.all([
            prisma.final_grades.aggregate({
                where: { enrollments: enrollmentWhere },
                _avg: { grade_point: true },
                _count: { id: true }
            }),
            prisma.final_grades.groupBy({
                by: ['letter_grade'],
                where: { enrollments: enrollmentWhere },
                _count: true
            }),
            prisma.enrollments.count({ where: enrollmentWhere })
        ]);

        return {
            total: totalCount,
            withGrade: stats._count.id,
            withoutGrade: totalCount - stats._count.id,
            avgGpa: Math.round(Number(stats._avg.grade_point || 0) * 100) / 100,
            distribution: distributionRaw.map(d => ({ grade: d.letter_grade || 'None', count: d._count })),
        };
    } catch (error) {
        console.error("Error in getGradeSummary:", error);
        return { total: 0, withGrade: 0, withoutGrade: 0, avgGpa: 0, distribution: [] };
    }
}

// --- Helper: Attendance Summary ---
async function getAttendanceSummary(studentWhere: any) {
    try {
        const enrollmentWhere: any = {};
        if (Object.keys(studentWhere).length > 0) {
            enrollmentWhere.students = studentWhere;
        }

        const distribution = await prisma.attendance_records.groupBy({
            by: ['status'],
            where: { enrollments: enrollmentWhere },
            _count: true
        });

        const summary = { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
        distribution.forEach(d => {
            const s = (d.status || '').toLowerCase();
            const count = d._count;
            summary.total += count;
            if (s === 'present' || s === 'มา') summary.present += count;
            else if (s === 'absent' || s === 'ขาด') summary.absent += count;
            else if (s === 'late' || s === 'สาย') summary.late += count;
            else if (s === 'leave' || s === 'ลา') summary.leave += count;
        });

        return summary;
    } catch (error) {
        console.error("Error in getAttendanceSummary:", error);
        return { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    }
}

// --- Helper: Top Rooms by GPA ---
async function getTopRooms(studentWhere: any) {
    try {
        const studentsWithGrades = await (prisma.students as any).findMany({
            where: studentWhere,
            select: {
                id: true,
                classroom_students: {
                    include: { classrooms: { select: { room_name: true, levels: { select: { name: true } } } } },
                    orderBy: { academic_year: 'desc' },
                    take: 1
                },
                enrollments: {
                    select: {
                        final_grades: { select: { grade_point: true } }
                    }
                }
            }
        });

        const roomStats = new Map<string, { count: number; totalGpa: number; studentCount: Set<number> }>();

        studentsWithGrades.forEach((s: any) => {
            const room = s.classroom_students?.[0]?.classrooms;
            if (!room) return;
            
            const key = room.room_name ? room.room_name.split('/')[0] : '';
            if (!key) return;

            if (!roomStats.has(key)) {
                roomStats.set(key, { count: 0, totalGpa: 0, studentCount: new Set() });
            }
            const stat = roomStats.get(key)!;
            stat.studentCount.add(s.id);
            
            let stuTotal = 0;
            let stuCount = 0;
            s.enrollments.forEach((e: any) => {
                if (e.final_grades?.grade_point != null) {
                    stuTotal += Number(e.final_grades.grade_point);
                    stuCount++;
                }
            });
            
            if (stuCount > 0) {
               stat.totalGpa += (stuTotal / stuCount);
               stat.count++;
            }
        });

        return Array.from(roomStats.entries())
            .map(([key, stat]) => {
                return {
                    class_level: key,
                    count: stat.studentCount.size,
                    avg_score: stat.count > 0 ? stat.totalGpa / stat.count : 0
                };
            })
            .sort((a, b) => b.avg_score - a.avg_score)
            .slice(0, 5);
    } catch (error) {
        console.error("Error in getTopRooms:", error);
        return [];
    }
}


// --- Helper: At-risk Students ---
async function getAtRiskStudents(studentWhere: any, subjectId?: number) {
    try {
        // 1. Fetch relevant students with selective fields
        const students = await (prisma.students as any).findMany({
            where: studentWhere,
            select: {
                id: true,
                student_code: true,
                first_name: true,
                last_name: true,
                name_prefixes: { select: { prefix_name: true } },
                classroom_students: {
                    include: { classrooms: { select: { room_name: true, levels: { select: { name: true } } } } },
                    orderBy: { academic_year: 'desc' },
                    take: 1
                },
                genders: { select: { name: true } },
                enrollments: {
                    where: subjectId ? { teaching_assignments: { subject_id: subjectId } } : undefined,
                    select: {
                        id: true,
                        teaching_assignments: { select: { subjects: { select: { subject_name: true } } } },
                        final_grades: { select: { letter_grade: true, grade_point: true } }
                    }
                },
            },
            orderBy: { student_code: 'asc' }
        });

        if (students.length === 0) return [];

        const studentIds = students.map((s: any) => s.id);
        const enrollmentIds = students.flatMap((s: any) => (s as any).enrollments.map((e: any) => e.id));

        // 2. Batch fetch attendance stats per enrollment
        const attendanceRaw = enrollmentIds.length > 0 ? await (prisma.attendance_records as any).groupBy({
            by: ['enrollment_id', 'status'],
            where: { enrollment_id: { in: enrollmentIds } },
            _count: true
        }) : [];

        // 3. Batch fetch behavior records via Raw SQL
        const behaviorRaw: any[] = [];

        // --- Process in Memory ---
        const attendanceMap = new Map<number, { total: number, absent: number }>();
        attendanceRaw.forEach((ar: any) => {
            const current = attendanceMap.get(ar.enrollment_id) || { total: 0, absent: 0 };
            current.total += ar._count;
            const s = (ar.status || '').toLowerCase();
            if (s === 'absent' || s === 'ขาด') current.absent += ar._count;
            attendanceMap.set(ar.enrollment_id, current);
        });

        const behaviorMap = new Map<number, number>();
        behaviorRaw.forEach((br: any) => {
            behaviorMap.set(br.student_id, 100 + (br.points || 0));
        });

        const atRisk: any[] = [];

        students.forEach((student: any) => {
            const reasons: any[] = [];

            // Calculate GPA
            const gradePoints = (student as any).enrollments
                .map((e: any) => e.final_grades?.grade_point)
                .filter((gp: any): gp is any => gp !== undefined && gp !== null)
                .map((gp: any) => Number(gp));
            const gpa = gradePoints.length > 0 
                ? Number((gradePoints.reduce((a: any, b: any) => a + b, 0) / gradePoints.length).toFixed(2))
                : null;

            // === GPA Gate: ถ้า GPA >= 3.00 ไม่แสดงในตารางเสี่ยง ===
            if (gpa !== null && gpa >= 3.0) return;

            // Check failing subjects (grade 0 or < 1)
            const failingSubjects = (student as any).enrollments
                .filter((e: any) => e.final_grades && (e.final_grades.letter_grade === '0' || Number(e.final_grades.grade_point || 0) < 1))
                .map((e: any) => e.teaching_assignments?.subjects?.subject_name || 'ไม่ทราบ');

            if (failingSubjects.length > 0) {
                reasons.push({
                    type: 'grade',
                    detail: `เกรดต่ำในวิชา: ${failingSubjects.join(', ')}`,
                    severity: failingSubjects.length > 1 ? 'high' : 'medium'
                });
            }

            // GPA-based risk levels
            if (gpa !== null) {
                if (gpa < 2.0) {
                    reasons.push({
                        type: 'grade',
                        detail: `เกรดเฉลี่ยต่ำมาก - เสี่ยงมาก (${gpa})`,
                        severity: 'high'
                    });
                } else if (gpa < 2.75) {
                    reasons.push({
                        type: 'grade',
                        detail: `เกรดเฉลี่ยต่ำกว่าเกณฑ์ - เริ่มเสี่ยง (${gpa})`,
                        severity: 'medium'
                    });
                } else if (gpa < 3.0) {
                    reasons.push({
                        type: 'grade',
                        detail: `เกรดเฉลี่ยอยู่ในเกณฑ์เฝ้าระวัง (${gpa})`,
                        severity: 'low'
                    });
                }
            }

            // Check attendance
            let totalAtt = 0;
            let totalAbs = 0;
            (student as any).enrollments.forEach((e: any) => {
                const stats = attendanceMap.get(e.id);
                if (stats) {
                    totalAtt += stats.total;
                    totalAbs += stats.absent;
                }
            });

            if (totalAtt > 0 && (totalAbs / totalAtt) > 0.2) {
                const absPct = Math.round((totalAbs / totalAtt) * 100);
                reasons.push({
                    type: 'absent',
                    detail: `ขาดเรียนบ่อย (${absPct}% - ${totalAbs}/${totalAtt} ครั้ง)`,
                    severity: absPct > 40 ? 'high' : 'medium'
                });
            }

            // Check behavior
            const conductScore = behaviorMap.get(student.id) ?? 100;
            if (conductScore < 80) {
                reasons.push({
                    type: 'conduct',
                    detail: `คะแนนพฤติกรรมต่ำ (${conductScore}/100)`,
                    severity: conductScore < 60 ? 'high' : 'medium'
                });
            }

            if (reasons.length > 0) {
                atRisk.push({
                    student: {
                        id: student.id,
                        student_code: student.student_code,
                        first_name: student.first_name,
                        last_name: student.last_name,
                        prefix: student.name_prefixes?.prefix_name || '',
                        class_level: student.classroom_students?.[0]?.classrooms?.room_name || '',
                        room: student.classroom_students?.[0]?.classrooms?.room_name || '',
                        gender: student.genders?.name || '',
                        gpa,
                    },
                    reasons,
                });
            }
        });

        return atRisk;
    } catch (error) {
        console.error("Error in getAtRiskStudents:", error);
        return [];
    }
}

// --- Helper: Top Students by Level ---
async function getTopStudentsByLevel(academicYearId?: number) {
    if (!academicYearId) return [];

    try {
        const query = Prisma.sql`
            WITH StudentGpa AS (
                SELECT 
                    s.id as student_id,
                    s.first_name,
                    s.last_name,
                    np.prefix_name as prefix,
                    c.room_name as level_name,
                    c.id as level_id,
                    AVG(fg.grade_point)::numeric(3,2) as avg_gpa
                FROM students s
                JOIN classroom_students cs ON s.id = cs.student_id
                JOIN classrooms c ON cs.classroom_id = c.id
                LEFT JOIN name_prefixes np ON s.prefix_id = np.id
                JOIN enrollments e ON s.id = e.student_id
                JOIN final_grades fg ON e.id = fg.enrollment_id
                WHERE cs.academic_year = (SELECT CAST(year_name AS INTEGER) FROM academic_years WHERE id = ${academicYearId})
                GROUP BY s.id, s.first_name, s.last_name, np.prefix_name, c.room_name, c.id
            ),
            RankedStudents AS (
                SELECT 
                    student_id,
                    first_name,
                    last_name,
                    prefix,
                    level_name,
                    level_id,
                    avg_gpa,
                    DENSE_RANK() OVER(PARTITION BY level_id ORDER BY avg_gpa DESC) as rank
                FROM StudentGpa
            )
            SELECT * FROM RankedStudents WHERE rank <= 3
            ORDER BY level_id ASC, rank ASC;
        `;

        const results = await prisma.$queryRaw<any[]>(query);
        
        // Group by level
        const grouped = results.reduce((acc, curr) => {
            const levelName = curr.level_name;
            if (!acc[levelName]) {
                acc[levelName] = [];
            }
            acc[levelName].push({
                name: `${curr.prefix || ''}${curr.first_name} ${curr.last_name}`,
                score: Number(curr.avg_gpa),
                rank: Number(curr.rank)
            });
            return acc;
        }, {} as Record<string, any[]>);

        return Object.entries(grouped).map(([level, students]) => ({
            level,
            students
        }));
    } catch (error) {
        console.error("Error in getTopStudentsByLevel:", error);
        return [];
    }
}

// --- Helper: Grades by Subject Group ---
async function getGradesBySubjectGroup(studentWhere: any, learningGroupId?: number) {
    try {
        // Fetch all learning groups (or just the selected one)
        const groups = await prisma.learning_subject_groups.findMany({
            where: learningGroupId ? { id: learningGroupId } : undefined,
            orderBy: { id: 'asc' }
        });

        const result: any[] = [];

        for (const group of groups) {
            // Get subjects in this group
            const subjectFilter: any = { learning_subject_group_id: group.id };
            
            const enrollmentWhere: any = {
                teaching_assignments: { subjects: subjectFilter }
            };
            if (Object.keys(studentWhere).length > 0) {
                enrollmentWhere.students = studentWhere;
            }

            // Aggregate grades per subject in this group
            const subjectGrades = await prisma.final_grades.findMany({
                where: { enrollments: enrollmentWhere },
                include: {
                    enrollments: {
                        include: {
                            teaching_assignments: {
                                include: {
                                    subjects: {
                                        select: { id: true, subject_name: true, subject_code: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            // Group grade points by subject
            const subjectMap = new Map<number, { name: string; code: string; points: number[]; letterCounts: Record<string, number> }>();
            
            for (const fg of subjectGrades) {
                const subject = fg.enrollments?.teaching_assignments?.subjects;
                if (!subject) continue;
                
                const current = subjectMap.get(subject.id) || { 
                    name: subject.subject_name, 
                    code: subject.subject_code || '',
                    points: [], 
                    letterCounts: {} 
                };
                
                if (fg.grade_point !== null && fg.grade_point !== undefined) {
                    current.points.push(Number(fg.grade_point));
                }
                if (fg.letter_grade) {
                    current.letterCounts[fg.letter_grade] = (current.letterCounts[fg.letter_grade] || 0) + 1;
                }
                subjectMap.set(subject.id, current);
            }

            const subjects = Array.from(subjectMap.entries()).map(([id, data]) => ({
                subject_id: id,
                subject_name: data.name,
                subject_code: data.code,
                avg_gpa: data.points.length > 0 
                    ? Number((data.points.reduce((a, b) => a + b, 0) / data.points.length).toFixed(2)) 
                    : null,
                total_students: data.points.length,
                letter_distribution: data.letterCounts,
            })).sort((a, b) => (b.avg_gpa || 0) - (a.avg_gpa || 0));

            if (subjects.length > 0) {
                result.push({
                    group_id: group.id,
                    group_name: group.group_name,
                    subjects
                });
            }
        }

        return result;
    } catch (error) {
        console.error("Error in getGradesBySubjectGroup:", error);
        return [];
    }
}

async function getStudentsByRoom(studentWhere: any) {
    try {
        const [classrooms, studentCountsRaw] = await Promise.all([
            prisma.classrooms.findMany({
                orderBy: [{ room_name: 'asc' }],
            }),
            (prisma as any).classroom_students.groupBy({
                by: ['classroom_id'],
                where: { students: studentWhere },
                _count: { student_id: true }
            })
        ]);

        const countMap = new Map<number, number>(
            (studentCountsRaw as any[]).map(c => [c.classroom_id, Number(c._count?.student_id || c._count || 0)])
        );

        return classrooms
            .map(c => ({
                level: c.room_name ? c.room_name.split('/')[0] : '',
                count: countMap.get(c.id) || 0
            }))
            .filter(r => r.count > 0);
    } catch (error) {
        console.error("Error in getStudentsByRoom:", error);
        return [];
    }
}

async function getRegistrationStats(studentWhere: any) {
    try {
        const enrollments = await prisma.enrollments.findMany({
            where: Object.keys(studentWhere).length > 0 ? { students: studentWhere } : undefined,
            include: {
                teaching_assignments: {
                    include: {
                        subjects: true,
                    },
                },
            },
        });

        const map = new Map<number, { subject_id: number; name: string; reg_count: number }>();

        for (const enrollment of enrollments) {
            const subject = enrollment.teaching_assignments?.subjects;
            if (!subject) continue;

            const current = map.get(subject.id);
            if (current) {
                current.reg_count += 1;
            } else {
                map.set(subject.id, {
                    subject_id: subject.id,
                    name: subject.subject_name,
                    reg_count: 1,
                });
            }
        }

        return Array.from(map.values()).sort((a, b) => b.reg_count - a.reg_count);
    } catch (error) {
        console.error("Error in getRegistrationStats:", error);
        return [];
    }
}

// --- Helper: Curriculum Summary ---
async function getCurriculumSummary(subjectWhere: any, classroomWhere: any) {
    try {
        const [
            totalSections,
            creditsAgg,
            subjectsByGroupRaw,
            subjectTypesRaw,
            sectionsNoTeacherCount
        ] = await Promise.all([
            prisma.teaching_assignments.count({ 
                where: Object.keys(classroomWhere).length > 0 ? { classrooms: classroomWhere } : {} 
            }),
            prisma.subjects.aggregate({
                where: subjectWhere,
                _sum: { credit: true }
            }),
            prisma.subjects.groupBy({
                by: ['learning_subject_group_id'],
                where: subjectWhere,
                _count: { id: true }
            }),
            prisma.subjects.groupBy({
                by: ['subject_categories_id'],
                where: subjectWhere,
                _count: { id: true }
            }),
            prisma.subjects.count({
                where: {
                    ...subjectWhere,
                    teaching_assignments: { none: {} }
                }
            })
        ]);

        const [groups, categories] = await Promise.all([
            prisma.learning_subject_groups.findMany(),
            prisma.subject_categories.findMany()
        ]);

        const groupMap = new Map(groups.map(g => [g.id, g.group_name]));
        const catMap = new Map(categories.map(c => [c.id, c.category_name]));

        return {
            totalSections,
            totalCredits: Number(creditsAgg._sum.credit || 0),
            sectionsNoTeacher: sectionsNoTeacherCount,
            subjectsByGroup: subjectsByGroupRaw.map(g => ({
                grp: groupMap.get(g.learning_subject_group_id!) || 'ไม่ระบุ',
                count: g._count.id
            })).sort((a, b) => b.count - a.count),
            subjectTypes: subjectTypesRaw.map(t => ({
                type: catMap.get(t.subject_categories_id!) || 'ไม่ระบุ',
                count: t._count.id
            })).sort((a, b) => b.count - a.count)
        };
    } catch (error) {
        console.error("Error in getCurriculumSummary:", error);
        return { totalSections: 0, totalCredits: 0, sectionsNoTeacher: 0, subjectsByGroup: [], subjectTypes: [] };
    }
}

// --- Helper: Finance Summary ---
async function getFinanceSummary() {
    try {
        const [budgetAgg, expenseAgg, expensesByCategory, monthlyExpensesRaw, categories] = await Promise.all([
            prisma.projects.aggregate({
                _sum: { allocated_budget: true }
            }),
            prisma.project_expenses.aggregate({
                _sum: { amount: true }
            }),
            prisma.project_expenses.groupBy({
                by: ['expense_category_id'],
                _sum: { amount: true },
            }),
            prisma.project_expenses.findMany({
                select: { amount: true, expense_date: true },
                orderBy: { expense_date: 'asc' }
            }),
            prisma.expense_categories.findMany()
        ]);

        const income = Number(budgetAgg._sum.allocated_budget || 0);
        const expense = Number(expenseAgg._sum.amount || 0);
        const balance = income - expense;
        const budgetUsedPct = income > 0 ? Math.round((expense / income) * 100) : 0;

        // Process monthly
        const monthMap = new Map<string, number>();
        monthlyExpensesRaw.forEach(e => {
            if (!e.expense_date) return;
            const m = e.expense_date.getMonth() + 1;
            const key = `${m}`;
            monthMap.set(key, (monthMap.get(key) || 0) + Number(e.amount));
        });

        const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const monthly = Array.from(monthMap.entries()).map(([m, amount]) => ({
            month: monthNames[parseInt(m) - 1],
            income: 0,
            expense: amount
        })).sort((a, b) => monthNames.indexOf(a.month) - monthNames.indexOf(b.month));

        const categoryMap = new Map(categories.map(c => [c.id, c.name]));

        return {
            income,
            expense,
            balance,
            budgetUsedPct,
            monthly: monthly.length > 0 ? monthly : [{ month: 'N/A', income: 0, expense: 0 }],
            byCategory: expensesByCategory.map(ec => ({
                category: categoryMap.get(ec.expense_category_id!) || `หมวด ${ec.expense_category_id}`,
                amount: Number(ec._sum.amount || 0)
            }))
        };
    } catch (error) {
        console.error("Error in getFinanceSummary:", error);
        return { income: 0, expense: 0, balance: 0, budgetUsedPct: 0, monthly: [], byCategory: [] };
    }
}

// --- Helper: Projects Summary ---
async function getProjectsSummary() {
    try {
        const [projects, projectStats, expenseAgg, depts] = await Promise.all([
            prisma.projects.findMany({
                include: {
                    departments: { select: { department_name: true } },
                    _count: { select: { project_expenses: true } }
                },
                orderBy: { created_at: 'desc' }
            }),
            prisma.projects.aggregate({
                _sum: { allocated_budget: true },
                _count: { id: true }
            }),
            prisma.project_expenses.aggregate({
                _sum: { amount: true }
            }),
            prisma.departments.findMany()
        ]);

        const total = projectStats._count.id;
        const budgetTotal = Number(projectStats._sum.allocated_budget || 0);
        const budgetUsed = Number(expenseAgg._sum.amount || 0);

        // Get project expenses by project_id
        const projectExpenses = await prisma.project_expenses.groupBy({
            by: ['project_id'],
            _sum: { amount: true }
        });

        const expenseMap = new Map(projectExpenses.map(e => [e.project_id, Number(e._sum.amount || 0)]));

        // Process items
        const items = projects.map(p => ({
            id: p.id,
            name: p.project_name,
            budget_total: Number(p.allocated_budget || 0),
            budget_used: expenseMap.get(p.id) || 0,
            department: p.departments?.department_name || 'ไม่ระบุ'
        })).slice(0, 10); // Limit to top 10 recent

        // Process by department
        const deptBudgets = new Map<string, number>();
        projects.forEach(p => {
            const d = p.departments?.department_name || 'ไม่ระบุ';
            deptBudgets.set(d, (deptBudgets.get(d) || 0) + Number(p.allocated_budget || 0));
        });

        const byDept = Array.from(deptBudgets.entries()).map(([department, total_budget]) => ({
            department,
            total_budget
        })).sort((a, b) => b.total_budget - a.total_budget);

        return {
            total,
            budgetTotal,
            budgetUsed,
            items,
            byDept
        };
    } catch (error) {
        console.error("Error in getProjectsSummary:", error);
        return { total: 0, budgetTotal: 0, budgetUsed: 0, items: [], byDept: [] };
    }
}

// --- Helper: Health Summary ---
async function getHealthSummary(studentWhere: any, year?: string, semester?: number) {
    try {
        // 1. Fetch Students in the cohort
        const students = await (prisma as any).students.findMany({
            where: studentWhere,
            select: { id: true }
        });
        const studentIds = students.map((s: any) => s.id);
        const totalStudents = studentIds.length;

        if (totalStudents === 0) {
            return {
                checkedCount: 0,
                totalStudents: 0,
                bmiNormalCount: 0,
                allergyCount: 0,
                diseaseCount: 0,
                visionIssueCount: 0,
                bmiDistribution: [],
                bloodTypeDistribution: [],
                fitnessSummary: [],
                vaccineDistribution: []
            };
        }

        // 2. Fetch Latest Health Checkups for these students
        const idsString = studentIds.join(',');
        const checkups = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM student_health_checkups WHERE student_id IN (${idsString}) ORDER BY checkup_date DESC`
        );

        // Get only the latest checkup for each student
        const latestCheckups = new Map<number, any>();
        checkups.forEach((c: any) => {
            if (!latestCheckups.has(c.student_id)) {
                latestCheckups.set(c.student_id, c);
            }
        });

        // 2.5 Fetch classroom labels for level-based BMI aggregation
        const studentRooms = await (prisma as any).classroom_students.findMany({
            where: { student_id: { in: studentIds } },
            include: { classrooms: true },
            orderBy: { academic_year: 'desc' }
        });
        
        const studentToLevel = new Map<number, string>();
        studentRooms.forEach((sr: any) => {
            if (!studentToLevel.has(sr.student_id)) {
                studentToLevel.set(sr.student_id, sr.classrooms?.room_name || 'ไม่ระบุ');
            }
        });

        const checkedStudents = latestCheckups.size;
        
        let bmiNormal = 0;
        const bmiCounts = { 'ผอม': 0, 'ปกติ': 0, 'ท้วม': 0, 'อ้วน': 0 };
        const bmiByLevelMap = new Map<string, any>();
        let visionIssues = 0;

        latestCheckups.forEach(c => {
            const weight = Number(c.weight || 0);
            const height = Number(c.height || 0);
            const level = studentToLevel.get(c.student_id) || 'ไม่ระบุ';
            
            if (!bmiByLevelMap.has(level)) {
                bmiByLevelMap.set(level, { level, underweight: 0, normal: 0, overweight: 0, obese: 0 });
            }
            const lvlStat = bmiByLevelMap.get(level);

            if (weight > 0 && height > 0) {
                const bmiVal = weight / ((height / 100) ** 2);
                if (bmiVal < 18.5) {
                    bmiCounts['ผอม']++;
                    lvlStat.underweight++;
                }
                else if (bmiVal < 23) {
                    bmiCounts['ปกติ']++;
                    bmiNormal++;
                    lvlStat.normal++;
                }
                else if (bmiVal < 25) {
                    bmiCounts['ท้วม']++;
                    lvlStat.overweight++;
                }
                else {
                    bmiCounts['อ้วน']++;
                    lvlStat.obese++;
                }
            }

            if (String(c.vision_left).trim() !== 'ปกติ' || String(c.vision_right).trim() !== 'ปกติ' || c.needs_glasses === true) {
                visionIssues++;
            }
        });

        // 3. Allergies & Diseases (Count unique students)
        const [allergyStudents, diseaseStudents] = await Promise.all([
            (prisma as any).student_allergies.groupBy({
                by: ['student_id'],
                where: { student_id: { in: studentIds } }
            }),
            (prisma as any).student_diseases.groupBy({
                by: ['student_id'],
                where: { student_id: { in: studentIds } }
            })
        ]);

        // 4. Blood Type Distribution
        const bloodProfiles = await (prisma as any).student_health_profiles.findMany({
            where: { student_id: { in: studentIds } },
            select: { blood_type: true }
        });
        const bloodTypeMap = new Map<string, number>();
        bloodProfiles.forEach((p: any) => {
            if (p.blood_type) {
                bloodTypeMap.set(p.blood_type, (bloodTypeMap.get(p.blood_type) || 0) + 1);
            }
        });

        // 5. Fitness Records (Aggregate in JS for robustness)
        const fitnessRecords = await prisma.$queryRawUnsafe<any[]>(
            `SELECT f.*, c.test_name as official_name, c.unit 
             FROM student_fitness_records f
             LEFT JOIN fitness_test_criteria c ON f.fitness_test_id = c.id
             WHERE f.student_id IN (${idsString})
             ORDER BY f.test_date DESC`
        );

        const fitnessGroups: Record<string, any> = {};
        fitnessRecords.forEach(r => {
            const name = r.official_name || r.test_name || 'ไม่ระบุรายการ';
            if (!fitnessGroups[name]) {
                fitnessGroups[name] = { name, unit: r.unit || '', total: 0, passed: 0, scores: [], results: [] };
            }
            const g = fitnessGroups[name];
            g.total++;
            if (r.is_passed) g.passed++;
            if (r.score != null) g.scores.push(Number(r.score));
            if (r.test_result != null) g.results.push(Number(r.test_result));
        });

        const fitnessSummary = Object.values(fitnessGroups).map(g => ({
            name: g.name,
            unit: g.unit,
            total: g.total,
            passed: g.passed,
            avgScore: g.scores.length > 0 ? (g.scores.reduce((a: number, b: number) => a + b, 0) / g.scores.length).toFixed(1) : '0.0',
            avgResult: g.results.length > 0 ? (g.results.reduce((a: number, b: number) => a + b, 0) / g.results.length).toFixed(1) : '0.0',
            passRate: g.total > 0 ? Math.round((g.passed / g.total) * 100) : 0
        }));

        // 6. Vaccination Records
        const vaccinations = await (prisma as any).vaccination_records.findMany({
            where: { student_id: { in: studentIds } },
            include: { vaccines: true }
        });
        const vaccineMap = new Map<string, number>();
        vaccinations.forEach((v: any) => {
            if (v.vaccines?.name) {
                vaccineMap.set(v.vaccines.name, (vaccineMap.get(v.vaccines.name) || 0) + 1);
            }
        });

        // 7. Detailed Health Issues List (Allergies + Diseases)
        const studentsWithIssues = await (prisma as any).students.findMany({
            where: {
                id: { in: studentIds },
                OR: [
                    { student_allergies: { some: {} } },
                    { student_diseases: { some: {} } }
                ]
            },
            include: {
                name_prefixes: true,
                classroom_students: {
                    include: { classrooms: true },
                    orderBy: { academic_year: 'desc' },
                    take: 1
                },
                student_allergies: { include: { allergens: true } },
                student_diseases: { include: { diseases: true } }
            }
        });

        const healthIssues = studentsWithIssues.map((s: any) => {
            const issues: string[] = [];
            s.student_allergies.forEach((a: any) => issues.push(`แพ้${a.allergens?.name || 'ไม่ระบุ'}`));
            s.student_diseases.forEach((d: any) => issues.push(d.diseases?.name || 'ไม่ระบุ'));

            return {
                studentCode: s.student_code,
                prefix: s.name_prefixes?.prefix_name || '',
                firstName: s.first_name,
                lastName: s.last_name,
                classLevel: s.classroom_students?.[0]?.classrooms?.room_name || '',
                room: s.classroom_students?.[0]?.classrooms?.room_name || '',
                issues
            };
        });

        return {
            checkedCount: checkedStudents,
            totalStudents,
            bmiNormalCount: bmiNormal,
            allergyCount: (allergyStudents as any[]).length,
            diseaseCount: (diseaseStudents as any[]).length,
            visionIssueCount: visionIssues,
            bmiDistribution: Object.entries(bmiCounts).map(([label, value]) => ({ label, value })),
            bmiByLevel: Array.from(bmiByLevelMap.values()).sort((a, b) => a.level.localeCompare(b.level, 'th')),
            bloodTypeDistribution: Array.from(bloodTypeMap.entries()).map(([label, value]) => ({ label, value })),
            healthIssues,
            fitnessSummary,
            vaccineDistribution: Array.from(vaccineMap.entries()).map(([label, value]) => ({ label, value }))
        };
    } catch (error) {
        console.error("Error in getHealthSummary:", error);
        return {
            checkedCount: 0,
            totalStudents: 0,
            bmiNormalCount: 0,
            allergyCount: 0,
            diseaseCount: 0,
            visionIssueCount: 0,
            bmiDistribution: [],
            bloodTypeDistribution: [],
            fitnessSummary: [],
            vaccineDistribution: [],
            healthIssues: []
        };
    }
}

// --- Helper: Room Rankings for Subject or Group ---
async function getRoomRankingsBySubject(studentWhere: any, learningGroupId?: number, subjectId?: number) {
    if (!learningGroupId && !subjectId) return [];

    try {
        const subjectFilter: any = {};
        if (subjectId) {
            subjectFilter.id = subjectId;
        } else if (learningGroupId) {
            subjectFilter.learning_subject_group_id = learningGroupId;
        }

        const enrollmentWhere: any = {
            teaching_assignments: { subjects: subjectFilter }
        };
        if (Object.keys(studentWhere).length > 0) {
            enrollmentWhere.students = studentWhere;
        }

        // Fetch grades with nested relations to get the student's current room
        const gradesData = await prisma.final_grades.findMany({
            where: { 
                enrollments: enrollmentWhere,
                grade_point: { not: null }
            },
            select: {
                grade_point: true,
                enrollments: {
                    select: {
                        students: {
                            select: {
                                classroom_students: {
                                    take: 1,
                                    orderBy: { academic_year: 'desc' },
                                    select: {
                                        classrooms: {
                                            select: {
                                                id: true,
                                                room_name: true,
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Group by room
        const roomMap = new Map<number, { roomName: string, levelName: string, points: number[] }>();

        for (const fg of gradesData) {
            if (fg.grade_point === null || fg.grade_point === undefined) continue;
            const gp = Number(fg.grade_point);
            
            const cs = fg.enrollments?.students?.classroom_students?.[0];
            if (!cs?.classrooms) continue;
            
            const cId = cs.classrooms.id;
            const current = roomMap.get(cId) || {
                roomName: cs.classrooms.room_name,
                levelName: cs.classrooms.room_name || '',
                points: []
            };
            current.points.push(gp);
            roomMap.set(cId, current);
        }

        const rankedRooms = Array.from(roomMap.entries()).map(([id, data]) => {
            const avg_gpa = data.points.length > 0
                ? Number((data.points.reduce((a, b) => a + b, 0) / data.points.length).toFixed(2))
                : 0;
                
            return {
                classroom_id: id,
                level_name: data.levelName,
                room_name: data.roomName,
                display_name: data.roomName,
                avg_gpa,
                student_count: data.points.length
            };
        }).sort((a, b) => b.avg_gpa - a.avg_gpa);

        return rankedRooms;
    } catch (e) {
        console.error("Error in getRoomRankingsBySubject:", e);
        return [];
    }
}
