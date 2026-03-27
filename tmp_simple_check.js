const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('--- Database Check ---');
  try {
    const years = await prisma.academic_years.findMany();
    console.log('Academic Years:', JSON.stringify(years, null, 2));
    
    const activeYear = years.find(y => y.is_active);
    if (activeYear) {
      const semesters = await prisma.semesters.findMany({
        where: { academic_year_id: activeYear.id }
      });
      console.log('Semesters for Active Year:', JSON.stringify(semesters, null, 2));
    } else {
      console.log('NO ACTIVE YEAR FOUND');
    }

    const students = await prisma.students.count();
    console.log('Student Count:', students);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
