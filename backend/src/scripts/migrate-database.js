import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import pool from '../config/database.js';
import { createSkillExtractor } from '../services/skill-extractor.service.js';

const databaseDirectory = fileURLToPath(new URL('../../../database/', import.meta.url));
const migrationsDirectory = join(databaseDirectory, 'migrations');

async function loadMigrations() {
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+-.*\.sql$/i.test(file))
    .sort();
  const legacySchema = await readFile(join(databaseDirectory, 'init.sql'), 'utf8');

  return [
    { version: '001-initial-schema', sql: legacySchema },
    ...(await Promise.all(migrationFiles.map(async (file) => ({
      version: file.replace(/\.sql$/i, ''),
      sql: await readFile(join(migrationsDirectory, file), 'utf8'),
    })))),
  ];
}

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL est absent. Configurez backend/.env avant la migration.');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const skillExtractor = createSkillExtractor();
  for (const migration of await loadMigrations()) {
    const existing = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [migration.version]);
    if (existing.rowCount > 0) continue;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration.version]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${migration.version} impossible : ${error.message}`, { cause: error });
    } finally {
      client.release();
    }
    console.log(`Migration ${migration.version} appliquée.`);
  }

  const offers = await pool.query("SELECT id, title, description, requirements FROM job_offers WHERE skills = '[]'::jsonb");
  for (const offer of offers.rows) {
    const skills = skillExtractor.extract(`${offer.title}\n${offer.description}\n${offer.requirements}`);
    await pool.query('UPDATE job_offers SET skills = $1::jsonb WHERE id = $2', [JSON.stringify(skills), offer.id]);
  }

  const applications = await pool.query("SELECT id, cv_text FROM applications WHERE cv_skills = '[]'::jsonb AND cv_text <> ''");
  for (const application of applications.rows) {
    const skills = skillExtractor.extract(application.cv_text);
    await pool.query('UPDATE applications SET cv_skills = $1::jsonb WHERE id = $2', [JSON.stringify(skills), application.id]);
  }
}

try {
  await migrate();
  console.log('Base de données migrée.');
} catch (error) {
  console.error('Migration impossible :', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
