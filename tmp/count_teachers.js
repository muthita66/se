const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.teachers.count()
  .then(c => { console.log('Count:', c); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
