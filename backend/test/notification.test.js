import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import { createApp } from '../src/app.js';

async function startApp() {
  const passwordHash = await bcrypt.hash('Notification123', 4);
  const users = [
    { id: 1, first_name: 'Candidat', last_name: 'Test', email: 'candidate-notification@example.com', password_hash: passwordHash, role: 'candidate' },
    { id: 2, first_name: 'RH', last_name: 'Test', email: 'hr-notification@example.com', password_hash: passwordHash, role: 'hr' },
  ];
  const notifications = [{
    id: 10,
    application_id: 7,
    type: 'application_shortlisted',
    title: 'Candidature présélectionnée',
    message: 'Votre candidature a été présélectionnée.',
    read_at: null,
    created_at: new Date().toISOString(),
  }];
  const userService = {
    async findByEmail(email) {
      return users.find((user) => user.email === email) || null;
    },
    async findPublicById(id) {
      return users.find((user) => user.id === id) || null;
    },
  };
  const notificationService = {
    async listForUser(userId) {
      const rows = userId === 1 ? notifications : [];
      return { notifications: rows, unreadCount: rows.filter((item) => !item.read_at).length };
    },
    async markRead({ id, userId }) {
      if (userId !== 1) return null;
      const notification = notifications.find((item) => item.id === id);
      if (!notification) return null;
      notification.read_at ||= new Date().toISOString();
      return notification;
    },
    async markAllRead(userId) {
      if (userId !== 1) return 0;
      let updated = 0;
      for (const notification of notifications) {
        if (!notification.read_at) {
          notification.read_at = new Date().toISOString();
          updated += 1;
        }
      }
      return updated;
    },
  };
  const app = createApp({
    databasePool: { query: async () => ({ rows: [{ database_time: new Date() }] }) },
    sessionMiddleware: session({ secret: 'notification-test-secret', resave: false, saveUninitialized: false }),
    userService,
    profileService: {},
    jobOfferService: {},
    applicationService: {},
    interviewService: {},
    notificationService,
  });
  const server = app.listen(0);
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, server };
}

async function login(baseUrl, email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Notification123' }),
  });
  return response.headers.get('set-cookie').split(';')[0];
}

test('seul le candidat authentifié consulte ses notifications', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());

  assert.equal((await fetch(`${baseUrl}/api/notifications`)).status, 401);
  const hrCookie = await login(baseUrl, 'hr-notification@example.com');
  assert.equal((await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: hrCookie } })).status, 403);

  const candidateCookie = await login(baseUrl, 'candidate-notification@example.com');
  const response = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: candidateCookie } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.unreadCount, 1);
  assert.equal(body.notifications[0].applicationId, 7);
});

test('le candidat marque une notification ou toutes les notifications comme lues', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'candidate-notification@example.com');

  const readResponse = await fetch(`${baseUrl}/api/notifications/10/read`, {
    method: 'PATCH',
    headers: { Cookie: cookie },
  });
  assert.equal(readResponse.status, 200);
  assert.ok((await readResponse.json()).notification.readAt);
  assert.equal((await fetch(`${baseUrl}/api/notifications/99/read`, { method: 'PATCH', headers: { Cookie: cookie } })).status, 404);

  const allResponse = await fetch(`${baseUrl}/api/notifications/read-all`, {
    method: 'PATCH',
    headers: { Cookie: cookie },
  });
  assert.equal(allResponse.status, 200);
  assert.equal((await allResponse.json()).updated, 0);
});
