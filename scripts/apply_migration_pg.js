
const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres'
});

async function runMigration() {
    try {
        await client.connect();
        console.log("Connected to DB");

        await client.query(`
            ALTER TABLE "public"."candidate_profile" 
            ADD COLUMN IF NOT EXISTS "date_of_birth" DATE;
        `);

        console.log("Migration applied successfully: Added date_of_birth to candidate_profile");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}

runMigration();
