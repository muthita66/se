import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DailyHealthFeature } from '@/features/teacher/components/DailyHealthFeature';

export default async function TeacherDailyHealth() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <DailyHealthFeature session={session} />;
}
