import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { successResponse, errorResponse } from "@/lib/api-response";

const prisma = new PrismaClient();

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
    try {
        const { type } = await params;
        console.log("OPTIONS API TYPE:", type);

        if (type === "grades") {
            const classrooms = await prisma.classrooms.findMany({
                orderBy: { room_name: 'asc' },
                select: { id: true, room_name: true }
            });
            const labels = Array.from(
                new Set(
                    classrooms
                        .map((room: any) => String(room.room_name || '').trim())
                        .filter(Boolean)
                )
            );
            return successResponse(labels.map((label, index) => ({ id: String(index + 1), label })));
        }

        if (type === "classrooms") {
            const classrooms = await prisma.classrooms.findMany({
                orderBy: { room_name: 'asc' }
            });
            const data = classrooms.map((c: any) => ({
                id: c.id,
                label: c.room_name.trim(),
                level: ''
            }));
            return successResponse(data);
        }

        if (type === "subjects") {
            const subjects = await prisma.subjects.findMany({
                orderBy: { subject_code: 'asc' },
                select: { id: true, subject_code: true, subject_name: true }
            });
            const data = subjects.map((s: any) => ({
                id: s.id,
                label: `${s.subject_code} ${s.subject_name}`,
            }));
            return successResponse(data);
        }

        if (type === "learning-groups") {
            const groups = await prisma.learning_subject_groups.findMany({
                orderBy: { group_name: 'asc' },
                select: { id: true, group_name: true }
            });
            const data = groups.map((g: any) => ({
                id: g.id,
                label: g.group_name,
            }));
            return successResponse(data);
        }

        if (type === "buildings") {
            const buildings = await prisma.buildings.findMany({
                orderBy: { building_name: 'asc' },
            });
            const data = buildings.map((b: any) => ({
                id: b.id,
                label: b.building_name,
            }));
            return successResponse(data);
        }

        if (type === "rooms") {
            const { searchParams } = new URL(req.url);
            const buildingId = searchParams.get("buildingId");
            const where = buildingId ? { building_id: Number(buildingId) } : {};
            const rooms = await prisma.rooms.findMany({
                where,
                orderBy: { room_name: 'asc' },
            });
            const data = rooms.map((r: any) => ({
                id: r.id,
                label: r.room_name,
            }));
            return successResponse(data);
        }

        if (type === "target-types") {
            const targetTypes = await prisma.target_types.findMany({
                where: { is_active: true },
                orderBy: { display_name: 'asc' }
            });
            return successResponse(targetTypes);
        }

        if (type === "targets") {
            const { searchParams } = new URL(req.url);
            const targetType = searchParams.get("targetType");
            
            if (!targetType) return errorResponse("targetType is required", 400);

            const config = await prisma.target_types.findUnique({ where: { code: targetType } });
            if (!config) return errorResponse("Invalid target type", 400);

            if (config.input_type === 'none') return successResponse([]);

            let optionsType = "";
            switch (targetType) {
                case 'grade_level': optionsType = 'grades'; break;
                case 'classroom': optionsType = 'classrooms'; break;
                case 'learning_group': optionsType = 'learning-groups'; break;
                case 'teaching_assignment': optionsType = 'subjects'; break;
                default: optionsType = targetType; 
            }

            if (optionsType === 'grades') {
                const classrooms = await prisma.classrooms.findMany({
                    orderBy: { room_name: 'asc' },
                    select: { id: true, room_name: true }
                });
                const labels = Array.from(
                    new Set(
                        classrooms
                            .map((room: any) => String(room.room_name || '').trim())
                            .filter(Boolean)
                    )
                );
                return successResponse(labels.map((label, index) => ({ id: String(index + 1), label })));
            }
            if (optionsType === 'classrooms') {
                const classrooms = await prisma.classrooms.findMany({
                    orderBy: { room_name: 'asc' }
                });
                return successResponse(classrooms.map((c: any) => ({
                    id: String(c.id),
                    label: c.room_name.trim()
                })));
            }
            if (optionsType === 'learning-groups') {
                const groups = await prisma.learning_subject_groups.findMany({
                    orderBy: { group_name: 'asc' },
                    select: { id: true, group_name: true }
                });
                return successResponse(groups.map((g: any) => ({
                    id: String(g.id),
                    label: g.group_name,
                })));
            }
            if (optionsType === 'subjects') {
                const subjects = await prisma.subjects.findMany({
                    orderBy: { subject_code: 'asc' },
                    select: { id: true, subject_code: true, subject_name: true }
                });
                return successResponse(subjects.map((s: any) => ({
                    id: String(s.id),
                    label: `${s.subject_code} ${s.subject_name}`,
                })));
            }

            if (targetType === 'all') return successResponse([{ id: 'all', label: 'ทุกคน' }]);

            return successResponse([]);
        }

        return errorResponse("Unknown option type", 400);

    } catch (e: any) {
        return errorResponse("Failed to fetch options", 500, e.message);
    }
}
