const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const students = await prisma.students.findMany({
        where: { last_name: 'ทองดี' }
    });
    console.log("Students with last name ทองดี:", students);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
