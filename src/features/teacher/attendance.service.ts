import { prisma } from '@/lib/prisma';

type AttendanceRecordInput = { enrollment_id: number | null; student_id?: number | null; status: string; remark?: string };
type UiAttendanceRecordInput = { student_id: number; section_id: number; date: string; status: string; remark?: string };

const mapStatusToDb = (status: string) => {
    const s = String(status || "").toLowerCase();
    const map: Record<string, string> = {
        'present': 'มา',
        'absent': 'ขาด',
        'late': 'สาย',
        'leave': 'ลา'
    };
    return map[s] || s;
};

const mapStatusFromDb = (status: string | null) => {
    if (!status) return null;
    const s = String(status).trim();
    const map: Record<string, string> = {
        'มา': 'present',
        'ขาด': 'absent',
        'สาย': 'late',
        'ลา': 'leave'
    };
    return map[s] || s;
};

export const TeacherAttendanceService = {
    async getAttendanceList(teacher_id: number, teaching_assignment_id: number, date: string) {
        // 1. Get the teaching assignment to find classroom_id
        const assignment = await prisma.teaching_assignments.findUnique({
            where: { id: teaching_assignment_id },
            select: { classroom_id: true }
        });

        if (!assignment || !assignment.classroom_id) {
            return [];
        }

        // 2. Resolve students from the classroom associated with this assignment
        // and link them to enrollments if they exist (left join)
        const students: any[] = await prisma.$queryRaw`
            SELECT 
                s.id as student_id,
                s.student_code,
                s.first_name,
                s.last_name,
                p.prefix_name as prefix,
                e.id as enrollment_id
            FROM "classroom_students" cs
            JOIN "students" s ON cs.student_id = s.id
            LEFT JOIN "name_prefixes" p ON s.prefix_id = p.id
            LEFT JOIN "enrollments" e ON (e.student_id = s.id AND e.teaching_assignment_id = ${teaching_assignment_id})
            WHERE cs.classroom_id = ${assignment.classroom_id}
            ORDER BY s.student_code ASC
        `;

        // Find or create attendance session for this date
        let session = await prisma.attendance_sessions.findFirst({
            where: {
                teaching_assignment_id,
                session_date: new Date(date),
            }
        });

        // Get existing records if session exists
        let existingRecords: any[] = [];
        if (session) {
            existingRecords = await prisma.attendance_records.findMany({
                where: { attendance_session_id: session.id }
            });
        }

        return students.map(e => {
            const record = e.enrollment_id ? existingRecords.find(r => r.enrollment_id === e.enrollment_id) : null;
            return {
                enrollment_id: e.enrollment_id, // Could be null if not yet enrolled
                student_id: e.student_id,
                student_code: e.student_code,
                prefix: e.prefix || '',
                first_name: e.first_name,
                last_name: e.last_name,
                status: mapStatusFromDb(record?.status),
                remark: record?.remark || '',
                record_id: record?.id || null,
            };
        });
    },

    async saveAttendance(
        teaching_assignment_id: number | UiAttendanceRecordInput[],
        date?: string,
        records?: AttendanceRecordInput[]
    ): Promise<{ success: boolean; count?: number }> {
        if (Array.isArray(teaching_assignment_id)) {
            const uiRecords = teaching_assignment_id;
            if (uiRecords.length === 0) return { success: true, count: 0 };

            const first = uiRecords[0];
            const sectionId = Number(first.section_id);
            const sessionDate = String(first.date || '').trim();
            if (!sectionId || Number.isNaN(sectionId)) throw new Error('section_id required');
            if (!sessionDate) throw new Error('date required');

            const enrollments = await prisma.enrollments.findMany({
                where: {
                    teaching_assignment_id: sectionId,
                    student_id: { in: uiRecords.map((r) => Number(r.student_id)).filter((n) => Number.isFinite(n)) },
                },
                select: { id: true, student_id: true },
            });
            const enrollmentMap = new Map<number, number>();
            enrollments.forEach((e) => enrollmentMap.set(e.student_id, e.id));

            const normalizedRecords: AttendanceRecordInput[] = [];
            uiRecords.forEach((r) => {
                    const enrollment_id = enrollmentMap.get(Number(r.student_id));
                    normalizedRecords.push({
                        enrollment_id: enrollment_id || null,
                        student_id: Number(r.student_id),
                        status: String(r.status || 'present'),
                        remark: r.remark,
                    });
                });

            return this.saveAttendance(sectionId, sessionDate, normalizedRecords);
        }

        const taId = Number(teaching_assignment_id);
        if (!taId || Number.isNaN(taId)) throw new Error('teaching_assignment_id required');
        if (!date) throw new Error('date required');
        const normalized = Array.isArray(records) ? records : [];
        return this.saveAttendanceByEnrollment(taId, date, normalized as any);
    },

    async saveAttendanceByEnrollment(
        teaching_assignment_id: number,
        date: string,
        records: { enrollment_id: number | null; student_id?: number | null; status: string; remark: string }[]
    ) {
        // Find or create session
        let session = await prisma.attendance_sessions.findFirst({
            where: {
                teaching_assignment_id,
                session_date: new Date(date),
            }
        });

        if (!session) {
            session = await prisma.attendance_sessions.create({
                data: {
                    teaching_assignment_id,
                    session_date: new Date(date),
                }
            });
        }

        const sessionId = session.id;

        // Upsert records
        for (const rec of records) {
            let enrollmentId = rec.enrollment_id;

            // If enrollmentId is missing, find or create it
            if (!enrollmentId && rec.student_id) {
                const existing = await prisma.enrollments.findFirst({
                    where: {
                        student_id: Number(rec.student_id),
                        teaching_assignment_id,
                    }
                });

                if (existing) {
                    enrollmentId = existing.id;
                } else {
                    const created = await prisma.enrollments.create({
                        data: {
                            student_id: Number(rec.student_id),
                            teaching_assignment_id,
                            status: 'registered'
                        }
                    });
                    enrollmentId = created.id;
                }
            }

            if (!enrollmentId) continue;

            const existing = await prisma.attendance_records.findFirst({
                where: {
                    attendance_session_id: sessionId,
                    enrollment_id: enrollmentId,
                }
            });

            if (existing) {
                await prisma.attendance_records.update({
                    where: { id: existing.id },
                    data: { status: mapStatusToDb(rec.status), remark: rec.remark || null }
                });
            } else {
                await prisma.attendance_records.create({
                    data: {
                        attendance_session_id: sessionId,
                        enrollment_id: enrollmentId,
                        status: mapStatusToDb(rec.status),
                        remark: rec.remark || null,
                    }
                });
            }
        }

        return { success: true };
    },
};
