
import { prisma } from './src/lib/prisma';

async function check() {
  console.log('Available models on prisma client:');
  const keys = Object.keys(prisma).filter(k => !k.startsWith('_'));
  console.log(keys);
  console.log('Is student_daily_health_records available?', !!(prisma as any).student_daily_health_records);
  process.exit(0);
}

check();
