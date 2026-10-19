function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createEmailContent({ firstName, offerTitle, title, message }) {
  const greeting = firstName ? `Bonjour ${firstName},` : 'Bonjour,';
  const textBody = `${greeting}\n\n${message}\n\nOffre : ${offerTitle}\n\nConnectez-vous à votre espace candidat pour consulter les détails.\n\nL’équipe Bee Coders`;
  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1f2937">
      <h2 style="color:#2563eb">${escapeHtml(title)}</h2>
      <p>${escapeHtml(greeting)}</p>
      <p>${escapeHtml(message)}</p>
      <p><strong>Offre :</strong> ${escapeHtml(offerTitle)}</p>
      <p>Connectez-vous à votre espace candidat pour consulter les détails.</p>
      <p style="color:#64748b">L’équipe Bee Coders</p>
    </div>`;

  return { textBody, htmlBody };
}

export function createNotificationService(databasePool) {
  return {
    async notifyCandidate({ applicationId, type, title, message, eventKey }) {
      const client = await databasePool.connect();
      try {
        await client.query('BEGIN');
        const contextResult = await client.query(
          `SELECT a.candidate_user_id, u.first_name, u.email, o.title AS offer_title
           FROM applications a
           JOIN users u ON u.id = a.candidate_user_id
           JOIN job_offers o ON o.id = a.job_offer_id
           WHERE a.id = $1`,
          [applicationId],
        );
        const context = contextResult.rows[0];
        if (!context) {
          await client.query('ROLLBACK');
          return null;
        }

        const notificationResult = await client.query(
          `INSERT INTO notifications (user_id, application_id, type, title, message, event_key)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (event_key) DO NOTHING
           RETURNING id, user_id, application_id, type, title, message, read_at, created_at`,
          [context.candidate_user_id, applicationId, type, title, message, eventKey],
        );
        const notification = notificationResult.rows[0];
        if (!notification) {
          await client.query('COMMIT');
          return null;
        }

        const email = createEmailContent({
          firstName: context.first_name,
          offerTitle: context.offer_title,
          title,
          message,
        });
        await client.query(
          `INSERT INTO email_jobs (
             notification_id, recipient_email, subject, text_body, html_body
           ) VALUES ($1, $2, $3, $4, $5)`,
          [notification.id, context.email, title, email.textBody, email.htmlBody],
        );
        await client.query('COMMIT');
        return notification;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },

    async listForUser(userId, limit = 30) {
      const [notificationsResult, unreadResult] = await Promise.all([
        databasePool.query(
          `SELECT id, application_id, type, title, message, read_at, created_at
           FROM notifications
           WHERE user_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT $2`,
          [userId, limit],
        ),
        databasePool.query(
          `SELECT COUNT(1)::integer AS count
           FROM notifications
           WHERE user_id = $1 AND read_at IS NULL`,
          [userId],
        ),
      ]);
      return {
        notifications: notificationsResult.rows,
        unreadCount: unreadResult.rows[0]?.count || 0,
      };
    },

    async markRead({ id, userId }) {
      const result = await databasePool.query(
        `UPDATE notifications
         SET read_at = COALESCE(read_at, NOW())
         WHERE id = $1 AND user_id = $2
         RETURNING id, application_id, type, title, message, read_at, created_at`,
        [id, userId],
      );
      return result.rows[0] || null;
    },

    async markAllRead(userId) {
      const result = await databasePool.query(
        `UPDATE notifications SET read_at = NOW()
         WHERE user_id = $1 AND read_at IS NULL
         RETURNING id`,
        [userId],
      );
      return result.rowCount;
    },
  };
}
