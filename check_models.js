
console.log('--- MODELS ON PRISMACLIENT PROTOTYPE ---');
try {
    const { PrismaClient } = require('@prisma/client');
    const models = Object.keys(PrismaClient.prototype).filter(k => !k.startsWith('$') && k !== 'constructor');
    console.log(JSON.stringify(models));
} catch (e) {
    console.error('Error fetching models:', e.message);
}
