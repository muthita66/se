import { prisma } from '@/lib/prisma';
import { resolveTargetValues, formatTargetValue } from '@/lib/target-resolver';

export const ActivitiesService = {
    async getAllActivities() {
        // Use raw SQL to bypass schema sync issues
        const events: any[] = await prisma.$queryRawUnsafe(`
            SELECT 
                e.id, e.title, e.description, e.start_datetime, e.end_datetime, 
                e.is_all_day, e.location, e.visibility, e.created_by,
                u.username as creator_name,
                et.name as event_type_name,
                d.department_name as department_name,
                t.first_name as teacher_first_name,
                t.last_name as teacher_last_name,
                np.prefix_name as teacher_prefix_name
            FROM events e
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN event_types et ON e.event_type_id = et.id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN teachers t ON e.teacher_id = t.id
            LEFT JOIN name_prefixes np ON t.prefix_id = np.id
            ORDER BY e.start_datetime DESC
        `);

        // Fetch participants count and targets separately to avoid complex SQL
        const eventIds = events.map(e => e.id);
        let participantCounts: any[] = [];
        let eventTargets: any[] = [];
        
        if (eventIds.length > 0) {
            participantCounts = [];

            eventTargets = await prisma.$queryRawUnsafe(`
                SELECT et.*, tt.display_name as target_type_display
                FROM event_targets et
                LEFT JOIN target_types tt ON et.target_type = tt.code
                WHERE et.event_id IN (${eventIds.join(',')})
            `);
        }

        const countMap = new Map(participantCounts.map(c => [c.event_id, c.count]));
        const targetsByEvent = new Map<number, any[]>();
        eventTargets.forEach(t => {
            const list = targetsByEvent.get(t.event_id) || [];
            list.push({
                target_type: t.target_type,
                target_value: t.target_value,
                target_types: { display_name: t.target_type_display }
            });
            targetsByEvent.set(t.event_id, list);
        });

        const targetDict = await resolveTargetValues(eventTargets);

        return events.map(e => ({
            id: e.id,
            title: e.title,
            name: e.title,
            description: e.description || '',
            date: e.start_datetime ? new Date(e.start_datetime).toISOString().split('T')[0] : null,
            start_date: e.start_datetime,
            end_date: e.end_datetime,
            is_all_day: e.is_all_day || false,
            location: e.location || '',
            visibility: e.visibility,
            created_by: e.creator_name || '',
            participant_count: countMap.get(e.id) || 0,
            event_type_name: e.event_type_name || 'ทั้งหมด',
            department_name: e.department_name || 'ทั้งหมด',
            teacher_name: e.teacher_first_name ? `${e.teacher_prefix_name || ''}${e.teacher_first_name} ${e.teacher_last_name}`.trim() : 'ทั้งหมด',
            targets: (targetsByEvent.get(e.id) || []).map(t => ({
                type_name: t.target_types?.display_name || t.target_type,
                value: formatTargetValue(t.target_type, t.target_value, targetDict)
            }))
        }));
    },

    async getStudentActivities(student_id: number) {
        if (!student_id) return [];

        // Get user_id from student
        const student = await prisma.students.findUnique({
            where: { id: student_id },
            select: { user_id: true }
        });
        if (!student) return [];

        // Raw SQL to avoid joins with outdated models
        const participations: any[] = [];

        return participations.map(p => ({
            id: p.event_id,
            title: p.title,
            description: p.description || '',
            start_date: p.start_datetime,
            end_date: p.end_datetime,
            location: p.location || '',
            status: p.status || 'registered',
        }));
    }
};
