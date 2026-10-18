export function createInterviewService(databasePool) {
  return {
    async create({ applicationId, hrUserId, scheduledAt, durationMinutes, meetingType, details }) {
      const result = await databasePool.query(
        `INSERT INTO interviews (application_id, scheduled_at, duration_minutes, meeting_type, details)
         SELECT a.id, $1, $2, $3, $4
         FROM applications a
         JOIN job_offers o ON o.id = a.job_offer_id
         WHERE a.id = $5 AND o.hr_user_id = $6 AND a.status <> 'rejected'
         RETURNING id, application_id, scheduled_at, duration_minutes, meeting_type,
                   details, status, evaluation_score, evaluation_notes, evaluated_at,
                   created_at, updated_at`,
        [scheduledAt, durationMinutes, meetingType, details, applicationId, hrUserId],
      );

      return result.rows[0] || null;
    },

    async update({ id, hrUserId, scheduledAt, durationMinutes, meetingType, details }) {
      const result = await databasePool.query(
        `UPDATE interviews i
         SET scheduled_at = $1, duration_minutes = $2, meeting_type = $3,
             details = $4, updated_at = NOW()
         FROM applications a
         JOIN job_offers o ON o.id = a.job_offer_id
         WHERE i.id = $5 AND i.application_id = a.id AND o.hr_user_id = $6
           AND i.status = 'scheduled'
         RETURNING i.id, i.application_id, i.scheduled_at, i.duration_minutes,
                   i.meeting_type, i.details, i.status, i.evaluation_score,
                   i.evaluation_notes, i.evaluated_at, i.created_at, i.updated_at`,
        [scheduledAt, durationMinutes, meetingType, details, id, hrUserId],
      );

      return result.rows[0] || null;
    },

    async updateStatus({ id, hrUserId, status }) {
      const result = await databasePool.query(
        `UPDATE interviews i
         SET status = $1::varchar(20), updated_at = NOW()
         FROM applications a
         JOIN job_offers o ON o.id = a.job_offer_id
         WHERE i.id = $2 AND i.application_id = a.id AND o.hr_user_id = $3
           AND i.status = 'scheduled'
         RETURNING i.id, i.application_id, i.scheduled_at, i.duration_minutes,
                   i.meeting_type, i.details, i.status, i.evaluation_score,
                   i.evaluation_notes, i.evaluated_at, i.created_at, i.updated_at`,
        [status, id, hrUserId],
      );

      return result.rows[0] || null;
    },

    async evaluate({ id, hrUserId, score, notes }) {
      const result = await databasePool.query(
        `UPDATE interviews i
         SET evaluation_score = $1, evaluation_notes = $2, evaluated_at = NOW(), updated_at = NOW()
         FROM applications a
         JOIN job_offers o ON o.id = a.job_offer_id
         WHERE i.id = $3 AND i.application_id = a.id AND o.hr_user_id = $4
           AND i.status = 'completed'
         RETURNING i.id, i.application_id, i.scheduled_at, i.duration_minutes,
                   i.meeting_type, i.details, i.status, i.evaluation_score,
                   i.evaluation_notes, i.evaluated_at, i.created_at, i.updated_at`,
        [score, notes, id, hrUserId],
      );

      return result.rows[0] || null;
    },
  };
}
