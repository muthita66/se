const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const students = await prisma.students.findMany({
        where: { first_name: { contains: 'เมธ' } }
    });
    console.log("Students with first name containing เมธ:", students);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
