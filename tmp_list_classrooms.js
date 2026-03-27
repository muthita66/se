const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const classrooms = await prisma.classrooms.findMany();
    console.log("Classrooms:", JSON.stringify(classrooms, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
