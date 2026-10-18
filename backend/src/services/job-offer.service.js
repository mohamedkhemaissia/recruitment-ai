export function createJobOfferService(databasePool) {
  return {
    async listForUser({ userId, role, search = '', employmentType = '', workplaceType = '', status = '' }) {
      const values = [];
      const conditions = [];
      const addValue = (value) => {
        values.push(value);
        return `$${values.length}`;
      };

      if (role === 'hr') {
        conditions.push(`o.hr_user_id = ${addValue(userId)}`);
      } else {
        values.push(userId);
        conditions.push("o.status = 'published'");
      }

      if (search) {
        const placeholder = addValue(`%${search}%`);
        conditions.push(`(o.title ILIKE ${placeholder} OR o.department ILIKE ${placeholder} OR o.location ILIKE ${placeholder})`);
      }
      if (employmentType) {
        conditions.push(`o.employment_type = ${addValue(employmentType)}`);
      }
      if (workplaceType) {
        conditions.push(`o.workplace_type = ${addValue(workplaceType)}`);
      }
      if (role === 'hr' && status) {
        conditions.push(`o.status = ${addValue(status)}`);
      }

      const result = await databasePool.query(
        `SELECT o.id, o.hr_user_id, o.title, o.department, o.location,
                o.employment_type, o.workplace_type, o.description,
                o.requirements, o.skills, o.status, o.published_at, o.created_at,
                o.updated_at, COALESCE(NULLIF(p.company_name, ''), '') AS company_name,
                ${role === 'candidate' ? 'EXISTS (SELECT 1 FROM applications a WHERE a.job_offer_id = o.id AND a.candidate_user_id = $1) AS already_applied' : 'false AS already_applied'}
         FROM job_offers o
         LEFT JOIN hr_profiles p ON p.user_id = o.hr_user_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY COALESCE(o.published_at, o.created_at) DESC, o.id DESC`,
        values,
      );

      return result.rows;
    },

    async create(data) {
      const result = await databasePool.query(
        `INSERT INTO job_offers (
           hr_user_id, title, department, location, employment_type,
           workplace_type, description, requirements, skills
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         RETURNING id, hr_user_id, title, department, location, employment_type,
                   workplace_type, description, requirements, skills, status, created_at, updated_at`,
        [
          data.hrUserId,
          data.title,
          data.department,
          data.location,
          data.employmentType,
          data.workplaceType,
          data.description,
          data.requirements,
          JSON.stringify(data.skills),
        ],
      );

      return result.rows[0];
    },

    async updateStatus({ id, hrUserId, status }) {
      const result = await databasePool.query(
        `UPDATE job_offers
         SET status = $1::varchar(20),
             published_at = CASE
               WHEN $1::varchar(20) = 'published' THEN NOW()
               WHEN $1::varchar(20) = 'closed' THEN published_at
               ELSE NULL
             END,
             updated_at = NOW()
         WHERE id = $2 AND hr_user_id = $3
         RETURNING id, hr_user_id, title, department, location, employment_type,
                   workplace_type, description, requirements, skills, status, published_at,
                   created_at, updated_at`,
        [status, id, hrUserId],
      );

      return result.rows[0] || null;
    },

    async update({ id, hrUserId, ...data }) {
      const result = await databasePool.query(
        `UPDATE job_offers
         SET title = $1, department = $2, location = $3, employment_type = $4,
             workplace_type = $5, description = $6, requirements = $7,
             skills = $8::jsonb, updated_at = NOW()
         WHERE id = $9 AND hr_user_id = $10
         RETURNING id, hr_user_id, title, department, location, employment_type,
                   workplace_type, description, requirements, skills, status, published_at,
                   created_at, updated_at`,
        [
          data.title,
          data.department,
          data.location,
          data.employmentType,
          data.workplaceType,
          data.description,
          data.requirements,
          JSON.stringify(data.skills),
          id,
          hrUserId,
        ],
      );

      return result.rows[0] || null;
    },

    async remove({ id, hrUserId }) {
      const applications = await databasePool.query(
        `SELECT 1
         FROM applications a
         JOIN job_offers o ON o.id = a.job_offer_id
         WHERE o.id = $1 AND o.hr_user_id = $2
         LIMIT 1`,
        [id, hrUserId],
      );
      if (applications.rowCount > 0) {
        const error = new Error('OFFER_HAS_APPLICATIONS');
        error.code = 'OFFER_HAS_APPLICATIONS';
        throw error;
      }

      const result = await databasePool.query(
        `DELETE FROM job_offers
         WHERE id = $1 AND hr_user_id = $2
         RETURNING id`,
        [id, hrUserId],
      );

      return Boolean(result.rows[0]);
    },
  };
}
