const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Checking categories...");
        const categories = await prisma.evaluation_categories.findMany();
        console.log("Categories:", categories);

        console.log("Checking forms...");
        const forms = await prisma.evaluation_forms.findMany();
        console.log("Forms:", forms.map(f => ({ id: f.id, name: f.form_name })));

        console.log("Running raw query from service...");
        const res = await prisma.$queryRawUnsafe(`
            SELECT f.id FROM evaluation_forms f
            JOIN evaluation_categories t ON f.category_id = t.id
            WHERE t.target_type = 'subject'
            LIMIT 1
        `);
        console.log("Raw query result:", res);
    } catch(e) {
        console.error("Error:", e);
    }
}
main().finally(() => prisma.$disconnect());
