import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function check() {
    const years = await prisma.academic_years.findMany();
    console.log('Academic Years:', years);
    const cs = await prisma.classroom_students.findFirst();
    console.log('Sample classroom_students:', cs);
    await prisma.$disconnect();
}
check();
