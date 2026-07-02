const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'auth_service',
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database migrations...');
    
    // Create migrations table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        description VARCHAR(255),
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Get executed migrations
    const { rows: executedMigrations } = await client.query(
      'SELECT version FROM migrations ORDER BY version'
    );
    const executedVersions = new Set(executedMigrations.map(m => m.version));
    
    // Read migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    // Execute pending migrations
    for (const file of files) {
      const version = file.replace('.sql', '');
      
      if (executedVersions.has(version)) {
        console.log(`✓ Migration ${version} already executed`);
        continue;
      }
      
      console.log(`Running migration ${version}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (version, description) VALUES ($1, $2)',
          [version, file]
        );
        await client.query('COMMIT');
        console.log(`✓ Migration ${version} completed`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
