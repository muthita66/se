const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRooms() {
    try {
        const rooms = await prisma.classrooms.findMany();
        console.log('Rooms:', JSON.stringify(rooms, null, 2));
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkRooms();
