const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const student = await prisma.students.findFirst({
            include: {
                name_prefixes: true,
                genders: true,
                student_statuses: true,
                classroom_students: {
                    include: { classrooms: true }
                }
            }
        });
        console.log('--- STUDENT SAMPLE ---');
        console.log(JSON.stringify(student, null, 2));

        const prefixes = await prisma.name_prefixes.findMany();
        console.log('--- PREFIXES ---');
        console.log(prefixes.map(p => p.prefix_name).join(', '));

        const genders = await prisma.genders.findMany();
        console.log('--- GENDER NAMES ---');
        console.log(genders.map(g => g.name).join(', '));

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
