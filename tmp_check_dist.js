const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkClassDistribution() {
    try {
        const studentWhere = {}; // No filters
        
        const classRaw = await prisma.students.findMany({
            where: studentWhere,
            include: {
                classroom_students: {
                    include: { classrooms: true },
                    orderBy: { academic_year: 'desc' },
                    take: 1
                }
            }
        });
        
        console.log('ClassRaw length:', classRaw.length);
        
        const allClassrooms = await prisma.classrooms.findMany();
        console.log('AllClassrooms length:', allClassrooms.length);

        const classLevelMap = new Map();
        classRaw.forEach(s => {
            const cs = s.classroom_students?.[0];
            const room = cs?.classrooms;
            if (room) {
                const roomWithLevels = allClassrooms.find(c => c.id === room.id);
                if (roomWithLevels) {
                    const name = roomWithLevels.room_name ? roomWithLevels.room_name.split('/')[0] : '';
                    if (name) {
                        classLevelMap.set(name, (classLevelMap.get(name) || 0) + 1);
                    }
                }
            } else {
                // No room assignment for this student
            }
        });
        
        console.log('ClassLevelMap:', JSON.stringify(Object.fromEntries(classLevelMap), null, 2));

    } catch (e) {
        console.error('Check failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

checkClassDistribution();
