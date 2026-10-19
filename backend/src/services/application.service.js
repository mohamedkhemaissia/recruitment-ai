export function createApplicationService(databasePool) {
  return {
    async listForHr(hrUserId, { page = 1, limit = 20, status = '', search = '', sort = 'score' } = {}) {
      const offset = (page - 1) * limit;
      const values = [hrUserId];
      const filters = ['o.hr_user_id = $1'];

      if (status) {
        values.push(status);
        filters.push(`a.status = $${values.length}`);
      }
      if (search) {
        values.push(`%${search}%`);
        filters.push(`(
          u.first_name ILIKE $${values.length}
          OR u.last_name ILIKE $${values.length}
          OR CONCAT_WS(' ', u.first_name, u.last_name) ILIKE $${values.length}
          OR u.email ILIKE $${values.length}
          OR o.title ILIKE $${values.length}
        )`);
      }

      const whereClause = filters.join(' AND ');
      const orderBy = sort === 'date'
        ? 'a.created_at DESC, a.id DESC'
        : 'CASE WHEN a.ai_status = \'completed\' THEN 0 ELSE 1 END, a.final_score DESC NULLS LAST, a.semantic_score DESC NULLS LAST, a.created_at DESC, a.id DESC';
      const countResult = await databasePool.query(
        `SELECT COUNT(*)::integer AS total
         FROM applications a
         JOIN job_offers o ON o.id = a.job_offer_id
         JOIN users u ON u.id = a.candidate_user_id
         WHERE ${whereClause}`,
        values,
      );
      const result = await databasePool.query(
        `SELECT a.id, a.job_offer_id, a.candidate_user_id, a.status, a.created_at,
                a.cv_extraction_status, a.cv_skills, a.ai_status,
                a.semantic_score, a.final_score, a.semantic_component,
                a.skill_component, a.matched_skills, a.missing_skills,
                a.scoring_version,
                a.cv_original_name, o.title, o.department,
                i.id AS interview_id, i.scheduled_at AS interview_scheduled_at,
                i.duration_minutes AS interview_duration_minutes,
                i.meeting_type AS interview_meeting_type,
                i.details AS interview_details, i.status AS interview_status,
                i.evaluation_score AS interview_evaluation_score,
                i.evaluation_notes AS interview_evaluation_notes,
                i.evaluated_at AS interview_evaluated_at,
                u.first_name, u.last_name, u.email,
                COALESCE(cp.professional_title, '') AS professional_title,
                COALESCE(cp.location, '') AS candidate_location
         FROM applications a
         JOIN job_offers o ON o.id = a.job_offer_id
         JOIN users u ON u.id = a.candidate_user_id
         LEFT JOIN interviews i ON i.application_id = a.id
         LEFT JOIN candidate_profiles cp ON cp.user_id = u.id
         WHERE ${whereClause}
         ORDER BY ${orderBy}
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset],
      );

      return {
        rows: result.rows,
        total: countResult.rows[0].total,
        page,
        limit,
      };
    },

    async listForCandidate(candidateUserId) {
      const result = await databasePool.query(
        `SELECT a.id, a.job_offer_id, a.candidate_user_id, a.status, a.created_at,
                o.title, o.department, o.location, o.employment_type, o.workplace_type,
                i.id AS interview_id, i.scheduled_at AS interview_scheduled_at,
                i.duration_minutes AS interview_duration_minutes,
                i.meeting_type AS interview_meeting_type,
                i.details AS interview_details, i.status AS interview_status,
                COALESCE(NULLIF(p.company_name, ''), '') AS company_name
         FROM applications a
         JOIN job_offers o ON o.id = a.job_offer_id
         LEFT JOIN interviews i ON i.application_id = a.id
         LEFT JOIN hr_profiles p ON p.user_id = o.hr_user_id
         WHERE a.candidate_user_id = $1
         ORDER BY a.created_at DESC, a.id DESC`,
        [candidateUserId],
      );

      return result.rows;
    },

    async findPublishedOffer(id) {
      const result = await databasePool.query(
        `SELECT id, title, description, requirements, skills
         FROM job_offers
         WHERE id = $1 AND status = 'published'`,
        [id],
      );

      return result.rows[0] || null;
    },

    async create({ candidateUserId, jobOfferId, originalFileName, storedFileName, fileSize, cvText, extractionStatus, cvSkills, aiStatus, consentGivenAt }) {
      const result = await databasePool.query(
        `INSERT INTO applications (
           job_offer_id, candidate_user_id, cv_original_name,
           cv_stored_name, cv_mime_type, cv_size, cv_text,
           cv_extraction_status, cv_extracted_at, cv_skills, ai_status, consent_given_at
         )
         SELECT id, $1, $2, $3, 'application/pdf', $4, $5, $6, NOW(), $7::jsonb, $8, $9
         FROM job_offers
         WHERE id = $10 AND status = 'published'
         RETURNING id, job_offer_id, candidate_user_id, status, cv_extraction_status, cv_skills,
                   ai_status, semantic_score, matched_skills, missing_skills, created_at`,
        [candidateUserId, originalFileName, storedFileName, fileSize, cvText, extractionStatus, JSON.stringify(cvSkills), aiStatus, consentGivenAt, jobOfferId],
      );

      return result.rows[0] || null;
    },

    async saveAnalysis({
      id,
      aiStatus,
      score = null,
      semanticScore = null,
      skillScore = null,
      matchedSkills = [],
      missingSkills = [],
      model = '',
      scoringVersion = '',
    }) {
      const result = await databasePool.query(
        `UPDATE applications
         SET ai_status = $1::varchar(20), semantic_score = $2, final_score = $3,
             semantic_component = $4, skill_component = $5, matched_skills = $6::jsonb,
             missing_skills = $7::jsonb, ai_model = $8, scoring_version = $9,
             analyzed_at = CASE WHEN $1::varchar(20) = 'completed' THEN NOW() ELSE NULL END,
             updated_at = NOW()
         WHERE id = $10
         RETURNING id, job_offer_id, candidate_user_id, status, cv_extraction_status, cv_skills,
                   ai_status, semantic_score, final_score, semantic_component, skill_component,
                   matched_skills, missing_skills, scoring_version, created_at`,
        [
          aiStatus,
          score,
          score,
          semanticScore,
          skillScore,
          JSON.stringify(matchedSkills),
          JSON.stringify(missingSkills),
          model,
          scoringVersion,
          id,
        ],
      );

      return result.rows[0] || null;
    },

    async findAnalysisInput(applicationId) {
      const result = await databasePool.query(
        `SELECT a.id, a.cv_text, a.cv_skills,
                o.id AS offer_id, o.title, o.description, o.requirements, o.skills
         FROM applications a
         JOIN job_offers o ON o.id = a.job_offer_id
         WHERE a.id = $1`,
        [applicationId],
      );

      const row = result.rows[0];
      if (!row) return null;

      return {
        applicationId: row.id,
        cvText: row.cv_text,
        cvSkills: row.cv_skills,
        offer: {
          id: row.offer_id,
          title: row.title,
          description: row.description,
          requirements: row.requirements,
          skills: row.skills,
        },
      };
    },

    async findAnalysisStatus({ id, userId, role }) {
      const ownershipCondition = role === 'hr'
        ? 'o.hr_user_id = $2'
        : 'a.candidate_user_id = $2';
      const result = await databasePool.query(
        `SELECT a.id AS application_id, a.ai_status,
                j.id AS job_id, j.status AS job_status, j.attempts,
                j.error_message, j.started_at, j.completed_at,
                j.created_at AS job_created_at, j.updated_at AS job_updated_at
         FROM applications a
         JOIN job_offers o ON o.id = a.job_offer_id
         LEFT JOIN analysis_jobs j ON j.application_id = a.id
         WHERE a.id = $1 AND ${ownershipCondition}`,
        [id, userId],
      );

      return result.rows[0] || null;
    },

    async updateStatus({ id, hrUserId, status }) {
      const result = await databasePool.query(
        `UPDATE applications a
         SET status = $1, updated_at = NOW()
         FROM job_offers o
         WHERE a.id = $2 AND a.job_offer_id = o.id AND o.hr_user_id = $3
         RETURNING a.id, a.job_offer_id, a.candidate_user_id, a.status, a.cv_extraction_status, a.cv_skills, a.created_at`,
        [status, id, hrUserId],
      );

      return result.rows[0] || null;
    },

    async findCvForHr({ id, hrUserId }) {
      const result = await databasePool.query(
        `SELECT a.cv_stored_name, a.cv_original_name, a.cv_mime_type
         FROM applications a
         JOIN job_offers o ON o.id = a.job_offer_id
         WHERE a.id = $1 AND o.hr_user_id = $2`,
        [id, hrUserId],
      );

      return result.rows[0] || null;
    },

    async findForCandidate({ id, candidateUserId }) {
      const result = await databasePool.query(
        `SELECT id, cv_stored_name, status
         FROM applications
         WHERE id = $1 AND candidate_user_id = $2`,
        [id, candidateUserId],
      );
      return result.rows[0] || null;
    },

    async remove({ id, candidateUserId }) {
      const result = await databasePool.query(
        `DELETE FROM applications
         WHERE id = $1 AND candidate_user_id = $2
         RETURNING id, cv_stored_name, status`,
        [id, candidateUserId],
      );
      return result.rows[0] || null;
    },
  };
}
