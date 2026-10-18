const jobStatuses = new Set(['pending', 'processing', 'completed', 'failed']);
export const maximumAttempts = 3;

function assertStatus(status) {
  if (!jobStatuses.has(status)) {
    throw new Error(`Statut de job IA invalide : ${status}`);
  }
}

export function createAiAnalysisJobService(databasePool) {
  return {
    async enqueue(applicationId) {
      const result = await databasePool.query(
        `INSERT INTO analysis_jobs (application_id)
         VALUES ($1)
         ON CONFLICT (application_id) DO UPDATE
         SET status = 'pending', attempts = 0, error_message = '',
             started_at = NULL, completed_at = NULL, updated_at = NOW()
         RETURNING id, application_id, status, attempts, error_message,
                   started_at, completed_at, created_at, updated_at`,
        [applicationId],
      );

      return result.rows[0];
    },

    async enqueueMissing() {
      const result = await databasePool.query(
        `INSERT INTO analysis_jobs (application_id)
         SELECT a.id
         FROM applications a
         LEFT JOIN analysis_jobs j ON j.application_id = a.id
         WHERE a.ai_status = 'pending'
           AND a.cv_extraction_status = 'completed'
           AND j.id IS NULL
         ON CONFLICT (application_id) DO NOTHING
         RETURNING id, application_id, status, attempts`,
      );
      return result.rows;
    },

    async claimNext() {
      const result = await databasePool.query(
        `WITH next_job AS (
           SELECT id
           FROM analysis_jobs
           WHERE status = 'pending'
           ORDER BY created_at, id
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE analysis_jobs AS job
         SET status = 'processing', attempts = job.attempts + 1,
             started_at = NOW(), updated_at = NOW()
         FROM next_job
         WHERE job.id = next_job.id
         RETURNING job.id, job.application_id, job.status, job.attempts,
                   job.error_message, job.started_at, job.completed_at,
                   job.created_at, job.updated_at`,
      );

      return result.rows[0] || null;
    },

    async recoverStaleProcessing(timeoutMinutes = 15) {
      const result = await databasePool.query(
        `UPDATE analysis_jobs
         SET status = CASE WHEN attempts >= $1 THEN 'failed' ELSE 'pending' END,
             error_message = CASE WHEN attempts >= $1 THEN error_message ELSE 'Worker interrompu avant la fin du traitement.' END,
             completed_at = CASE WHEN attempts >= $1 THEN COALESCE(completed_at, NOW()) ELSE NULL END,
             updated_at = NOW()
         WHERE status = 'processing'
           AND started_at < NOW() - ($2 * INTERVAL '1 minute')
         RETURNING id, application_id, status, attempts, error_message,
                   started_at, completed_at, created_at, updated_at`,
        [maximumAttempts, timeoutMinutes],
      );

      return result.rows;
    },

    async updateStatus({ id, status, errorMessage = '' }) {
      assertStatus(status);
      const result = await databasePool.query(
        `UPDATE analysis_jobs
         SET status = CASE WHEN $1 = 'failed' AND attempts < $4 THEN 'pending' ELSE $1 END,
             error_message = $2,
             completed_at = CASE
               WHEN ($1 = 'failed' AND attempts >= $4) OR $1 = 'completed' THEN NOW()
               ELSE NULL
             END,
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, application_id, status, attempts, error_message,
                   started_at, completed_at, created_at, updated_at`,
        [status, errorMessage.slice(0, 1000), id, maximumAttempts],
      );

      return result.rows[0] || null;
    },
  };
}
