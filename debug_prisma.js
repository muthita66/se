
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'student_daily_health_records'
      );
    `;
    console.log('Table existence check:', JSON.stringify(result));
    
    // Also check available models on the client
    console.log('Models on prisma client:', Object.keys(prisma).filter(k => !k.startsWith('_')));
  } catch (e) {
    console.error('Error checking:', e.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

check();
