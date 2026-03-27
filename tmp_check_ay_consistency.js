const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const ay = await prisma.academic_years.findMany();
    console.log("Academic Years table:", ay);
    
    const sem = await prisma.semesters.findMany({
        where: { id: 1 },
        include: { academic_years: true }
    });
    console.log("Semester 1 details:", JSON.stringify(sem, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
