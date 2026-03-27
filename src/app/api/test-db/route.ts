import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const years = await prisma.academic_years.findMany();
        const students = await prisma.students.findMany({ take: 2, include: { users: true }});
        const events = await (prisma as any).events.findMany({ take: 5 });
        const semesters = await prisma.semesters.findMany();

        
        return NextResponse.json({
            years,
            students: students.map(s => ({ id: s.id, user_id: s.user_id, username: s.users?.username })),
            events: events.map((e: any) => ({ id: e.id, title: e.title, start_datetime: e.start_datetime, semester_id: e.semester_id, participants: 0 })),
            semesters
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
