import 'dotenv/config';
import pool from '../config/database.js';
import { createCvStorage } from '../services/cv-storage.service.js';

const retentionDays = Number(process.env.CV_RETENTION_DAYS || 730);

if (!Number.isInteger(retentionDays) || retentionDays < 30) {
  throw new Error('CV_RETENTION_DAYS doit être un entier supérieur ou égal à 30.');
}

const storage = createCvStorage();
const client = await pool.connect();
const stagedRemovals = [];

try {
  await client.query('BEGIN');
  const { rows } = await client.query(
    `SELECT a.id, a.cv_stored_name
     FROM applications a
     WHERE a.status = 'rejected'
       AND a.updated_at < NOW() - ($1 * INTERVAL '1 day')
     FOR UPDATE`,
    [retentionDays],
  );

  for (const application of rows) {
    stagedRemovals.push(await storage.stageRemoval(application.cv_stored_name));
  }

  if (rows.length > 0) {
    await client.query(
      'DELETE FROM applications WHERE id = ANY($1::bigint[])',
      [rows.map((application) => application.id)],
    );
  }

  await client.query('COMMIT');
  for (const stagedRemoval of stagedRemovals) {
    await stagedRemoval.commit().catch((error) => {
      process.exitCode = 1;
      console.error('Nettoyage définitif d’un CV impossible :', error.message);
    });
  }
  console.log(`${rows.length} CV conservé(s) supprimé(s).`);
} catch (error) {
  await client.query('ROLLBACK');
  for (const stagedRemoval of stagedRemovals.reverse()) {
    await stagedRemoval.rollback().catch(() => {});
  }
  console.error('Purge des CV impossible :', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
