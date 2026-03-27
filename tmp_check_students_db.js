const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const prefixes = await prisma.name_prefixes.findMany();
        const genders = await prisma.genders.findMany();
        const statuses = await prisma.student_statuses.findMany();
        const classrooms = await prisma.classrooms.findMany({ take: 10 });
        
        console.log('--- Name Prefixes ---');
        console.log(JSON.stringify(prefixes, null, 2));
        
        console.log('--- Genders ---');
        console.log(JSON.stringify(genders, null, 2));
        
        console.log('--- Statuses ---');
        console.log(JSON.stringify(statuses, null, 2));
        
        console.log('--- Sample Classrooms ---');
        console.log(JSON.stringify(classrooms, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
