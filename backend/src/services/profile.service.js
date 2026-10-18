export function createProfileService(databasePool) {
  const getByUserId = async (userId) => {
    const result = await databasePool.query(
      `SELECT
         u.id, u.first_name, u.last_name, u.email, u.role,
         COALESCE(cp.phone, hp.phone, '') AS phone,
         COALESCE(cp.bio, hp.bio, '') AS bio,
         COALESCE(cp.location, '') AS location,
         COALESCE(cp.professional_title, '') AS professional_title,
         COALESCE(hp.company_name, '') AS company_name,
         COALESCE(hp.job_title, '') AS job_title
       FROM users u
       LEFT JOIN candidate_profiles cp ON cp.user_id = u.id AND u.role = 'candidate'
       LEFT JOIN hr_profiles hp ON hp.user_id = u.id AND u.role = 'hr'
       WHERE u.id = $1`,
      [userId],
    );

    return result.rows[0] || null;
  };

  return {
    getByUserId,

    async update(userId, data) {
      const client = await databasePool.connect();

      try {
        await client.query('BEGIN');
        const userResult = await client.query(
          `UPDATE users
           SET first_name = $2, last_name = $3, updated_at = NOW()
           WHERE id = $1
           RETURNING role`,
          [userId, data.firstName, data.lastName],
        );

        const user = userResult.rows[0];
        if (!user) {
          await client.query('ROLLBACK');
          return null;
        }

        if (user.role === 'candidate') {
          await client.query(
            `INSERT INTO candidate_profiles (user_id, phone, location, professional_title, bio)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO UPDATE SET
               phone = EXCLUDED.phone,
               location = EXCLUDED.location,
               professional_title = EXCLUDED.professional_title,
               bio = EXCLUDED.bio,
               updated_at = NOW()`,
            [userId, data.phone, data.location, data.professionalTitle, data.bio],
          );
        } else {
          await client.query(
            `INSERT INTO hr_profiles (user_id, phone, company_name, job_title, bio)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO UPDATE SET
               phone = EXCLUDED.phone,
               company_name = EXCLUDED.company_name,
               job_title = EXCLUDED.job_title,
               bio = EXCLUDED.bio,
               updated_at = NOW()`,
            [userId, data.phone, data.companyName, data.jobTitle, data.bio],
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      return getByUserId(userId);
    },
  };
}

