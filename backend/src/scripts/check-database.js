import 'dotenv/config';
import pool from '../config/database.js';

const requiredTables = [
  'users',
  'candidate_profiles',
  'hr_profiles',
  'job_offers',
  'applications',
  'interviews',
  'analysis_jobs',
  'audit_logs',
  'notifications',
  'email_jobs',
];
const requiredColumns = {
  job_offers: ['description', 'requirements', 'skills', 'status'],
  applications: ['consent_given_at', 'final_score', 'semantic_component', 'skill_component', 'scoring_version'],
};

try {
  const tableResult = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [requiredTables],
  );
  const existingTables = new Set(tableResult.rows.map((row) => row.table_name));
  const missingTables = requiredTables.filter((table) => !existingTables.has(table));
  if (missingTables.length) throw new Error(`Tables absentes : ${missingTables.join(', ')}`);

  for (const [table, columns] of Object.entries(requiredColumns)) {
    const columnResult = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = ANY($2::text[])`,
      [table, columns],
    );
    const existingColumns = new Set(columnResult.rows.map((row) => row.column_name));
    const missingColumns = columns.filter((column) => !existingColumns.has(column));
    if (missingColumns.length) throw new Error(`Colonnes absentes dans ${table} : ${missingColumns.join(', ')}`);
  }

  await pool.query('SELECT 1');
  console.log('PostgreSQL et le schéma applicatif sont prêts.');
} catch (error) {
  console.error('Vérification PostgreSQL impossible :', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
