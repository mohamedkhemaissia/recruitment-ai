export function createUserService(databasePool) {
  return {
    async create({ firstName, lastName, email, passwordHash, role }) {
      const result = await databasePool.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, first_name, last_name, email, role, created_at`,
        [firstName, lastName, email, passwordHash, role],
      );

      return result.rows[0];
    },

    async findByEmail(email) {
      const result = await databasePool.query(
        `SELECT id, first_name, last_name, email, password_hash, role, created_at
         FROM users
         WHERE email = $1`,
        [email],
      );

      return result.rows[0] || null;
    },

    async findPublicById(id) {
      const result = await databasePool.query(
        `SELECT id, first_name, last_name, email, role, created_at
         FROM users
         WHERE id = $1`,
        [id],
      );

      return result.rows[0] || null;
    },
  };
}

