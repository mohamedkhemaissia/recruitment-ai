export const maximumEmailAttempts = 3;

export function createEmailJobService(databasePool) {
  return {
    async claimNext() {
      const result = await databasePool.query(
        `WITH next_job AS (
           SELECT id FROM email_jobs
           WHERE status = 'pending'
           ORDER BY created_at, id
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE email_jobs AS job
         SET status = 'sending', attempts = job.attempts + 1,
             started_at = NOW(), updated_at = NOW()
         FROM next_job
         WHERE job.id = next_job.id
         RETURNING job.id, job.recipient_email, job.subject, job.text_body,
                   job.html_body, job.status, job.attempts`,
      );
      return result.rows[0] || null;
    },

    async markSent(id) {
      const result = await databasePool.query(
        `UPDATE email_jobs
         SET status = 'sent', sent_at = NOW(), last_error = '', updated_at = NOW()
         WHERE id = $1
         RETURNING id, status, attempts, sent_at`,
        [id],
      );
      return result.rows[0] || null;
    },

    async markFailed({ id, errorMessage }) {
      const result = await databasePool.query(
        `UPDATE email_jobs
         SET status = CASE WHEN attempts >= $3 THEN 'failed' ELSE 'pending' END,
             last_error = $2, updated_at = NOW(),
             started_at = CASE WHEN attempts >= $3 THEN started_at ELSE NULL END
         WHERE id = $1
         RETURNING id, status, attempts, last_error`,
        [id, errorMessage.slice(0, 1000), maximumEmailAttempts],
      );
      return result.rows[0] || null;
    },

    async recoverInterrupted(timeoutMinutes = 10) {
      const result = await databasePool.query(
        `UPDATE email_jobs
         SET status = CASE WHEN attempts >= $1 THEN 'failed' ELSE 'pending' END,
             last_error = 'Envoi interrompu avant sa confirmation.',
             started_at = CASE WHEN attempts >= $1 THEN started_at ELSE NULL END,
             updated_at = NOW()
         WHERE status = 'sending'
           AND started_at < NOW() - ($2 * INTERVAL '1 minute')
         RETURNING id, status, attempts, last_error`,
        [maximumEmailAttempts, timeoutMinutes],
      );
      return result.rows;
    },
  };
}
