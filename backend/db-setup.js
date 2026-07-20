import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from the root .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

let dbHost = process.env.POSTGRES_HOST || '127.0.0.1';
// If running directly on the host (not inside a container), host.docker.internal won't resolve on Linux
if (dbHost === 'host.docker.internal') {
    dbHost = '127.0.0.1';
}

const client = new Client({
    host: dbHost,
    port: process.env.POSTGRES_PORT || 54322,
    user: (process.env.POSTGRES_USER || 'postgres') + '.your-tenant-id',
    password: process.env.POSTGRES_PASSWORD || 'your-super-secret-and-long-postgres-password',
    database: process.env.POSTGRES_DB || 'postgres'
});

async function setupDatabase() {
    try {
        console.log("Connecting to the database...");
        await client.connect();
        
        console.log("Creating 'posts' table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                topic TEXT NOT NULL,
                text TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Draft',
                image_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        
        console.log("Creating 'system_settings' table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                description TEXT
            );
        `);

        // Insert initial system settings if they don't exist
        console.log("Seeding 'system_settings' table...");
        await client.query(`
            INSERT INTO system_settings (key, value, description)
            VALUES 
                ('prompt_template', 'Generate a gamified post...', 'Main prompt'),
                ('target_audience', 'Loksewa aspirants', 'Target audience'),
                ('tone', 'Professional yet engaging', 'Tone of the generated content')
            ON CONFLICT (key) DO NOTHING;
        `);

        console.log("Setting up permissions...");
        await client.query(`
            GRANT ALL ON TABLE posts TO anon, authenticated, service_role;
            GRANT ALL ON TABLE system_settings TO anon, authenticated, service_role;
        `);

        console.log("Database tables created and seeded successfully! 🎉");
    } catch (err) {
        console.error("Error setting up database:", err);
    } finally {
        await client.end();
    }
}

setupDatabase();
