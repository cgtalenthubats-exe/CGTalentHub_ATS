const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
        console.error("❌ No POSTGRES_URL or DATABASE_URL found in .env.local");
        return;
    }

    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("✅ Connected to Database");

        const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260213_create_search_job_status.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Running Migration...");
        await client.query(sql);
        console.log("✅ Migration applied successfully!");

    } catch (err) {
        console.error("❌ Migration Failed:", err.message);
    } finally {
        await client.end();
    }
}

runMigration();
