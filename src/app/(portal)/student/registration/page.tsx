import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function RegistrationPage() {
    const session = await getSession() as { role?: string } | null;
    if (!session || session.role !== 'student') {
        redirect('/login');
    }

    redirect('/student/schedule');
}
