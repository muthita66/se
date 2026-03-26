import { prisma } from './prisma';

async function resolveClassroomTarget(targetValue: string | number | null) {
    if (targetValue === null || targetValue === undefined || targetValue === '') {
        return null;
    }

    const prismaAny = prisma as any;
    const classroomsDelegate = prismaAny?.classrooms;

    if (!classroomsDelegate?.findUnique) {
        return { id: targetValue, name: String(targetValue) };
    }

    const classroom = await classroomsDelegate.findUnique({
        where: { id: Number(targetValue) },
        select: { room_name: true, grade_level_id: true }
    });

    return classroom
        ? { id: targetValue, name: classroom.room_name, levelId: classroom.grade_level_id }
        : null;
}

/**
 * Resolves target values from the database
 * Builds a dictionary keyed by target_type:target_value
 */
export async function resolveTargetValues(targets: any[]): Promise<Record<string, any>> {
    if (!targets || targets.length === 0) return {};

    const dict: Record<string, any> = {};

    for (const target of targets) {
        const key = `${target.target_type}:${target.target_value}`;
        
        try {
            if (target.target_type === 'classroom') {
                dict[key] = await resolveClassroomTarget(target.target_value);
            } else if (target.target_type === 'program') {
                const program = await prisma.programs.findUnique({
                    where: { id: Number(target.target_value) },
                    select: { name: true }
                });
                dict[key] = program ? { id: target.target_value, name: program.name } : null;
            } else if (target.target_type === 'level') {
                const level = await prisma.levels.findUnique({
                    where: { id: Number(target.target_value) },
                    select: { name: true }
                });
                dict[key] = level ? { id: target.target_value, name: level.name } : null;
            } else if (target.target_type === 'department') {
                const dept = await prisma.departments.findUnique({
                    where: { id: Number(target.target_value) },
                    select: { department_name: true }
                });
                dict[key] = dept ? { id: target.target_value, name: dept.department_name } : null;
            } else {
                dict[key] = { id: target.target_value, name: target.target_value };
            }
        } catch (error) {
            console.error(`Error resolving target ${key}:`, error);
            dict[key] = { id: target.target_value, name: target.target_value };
        }
    }

    return dict;
}

/**
 * Formats a target value for display
 */
export function formatTargetValue(
    targetType: string,
    targetValue: string | number | null,
    targetDict: Record<string, any>
): string {
    if (!targetValue) return 'N/A';

    const key = `${targetType}:${targetValue}`;
    const resolved = targetDict[key];

    if (resolved?.name) {
        return resolved.name;
    }

    // Fallback display
    return String(targetValue);
}

/**
 * Get target type display name
 */
export function getTargetTypeLabel(targetType: string): string {
    const labels: Record<string, string> = {
        classroom: 'ห้อง',
        program: 'โปรแกรม',
        level: 'ชั้น',
        department: 'แผนก',
        teacher: 'ครู',
        student: 'นักเรียน'
    };
    return labels[targetType] || targetType;
}
