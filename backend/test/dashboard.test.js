import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import { createApp } from '../src/app.js';

async function startApp() {
  const passwordHash = await bcrypt.hash('Dashboard123', 4);
  const users = [
    { id: 51, first_name: 'Candidat', last_name: 'Test', email: 'candidate-dashboard@example.com', password_hash: passwordHash, role: 'candidate' },
    { id: 52, first_name: 'RH', last_name: 'Test', email: 'hr-dashboard@example.com', password_hash: passwordHash, role: 'hr' },
  ];
  const userService = {
    async findByEmail(email) {
      return users.find((user) => user.email === email) || null;
    },
    async findPublicById(id) {
      return users.find((user) => user.id === id) || null;
    },
  };
  const dashboardService = {
    async getForHr(hrUserId) {
      assert.equal(hrUserId, 52);
      return {
        summary: {
          totalOffers: 4,
          publishedOffers: 2,
          totalApplications: 12,
          shortlistedApplications: 3,
          analyzedApplications: 10,
          averageAiScore: 72.5,
          upcomingInterviews: 2,
          completedInterviews: 5,
        },
        ranking: [{ id: 7, score: 91, status: 'shortlisted', candidateName: 'Sami Ben Ali', offerTitle: 'Développeur React' }],
        upcomingInterviews: [{ id: 3, scheduledAt: new Date().toISOString(), durationMinutes: 45, meetingType: 'video', candidateName: 'Sami Ben Ali', offerTitle: 'Développeur React' }],
      };
    },
  };
  const app = createApp({
    databasePool: { query: async () => ({ rows: [{ database_time: new Date() }] }) },
    sessionMiddleware: session({ secret: 'dashboard-test-secret', resave: false, saveUninitialized: false }),
    userService,
    profileService: {},
    jobOfferService: {},
    applicationService: {},
    interviewService: {},
    dashboardService,
  });
  const server = app.listen(0);
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, server };
}

async function login(baseUrl, email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Dashboard123' }),
  });
  return response.headers.get('set-cookie').split(';')[0];
}

test('le tableau de bord exige une session RH', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());

  assert.equal((await fetch(`${baseUrl}/api/dashboard`)).status, 401);
  const candidateCookie = await login(baseUrl, 'candidate-dashboard@example.com');
  assert.equal((await fetch(`${baseUrl}/api/dashboard`, { headers: { Cookie: candidateCookie } })).status, 403);
});

test('le RH consulte les indicateurs, le classement IA et les entretiens', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'hr-dashboard@example.com');

  const response = await fetch(`${baseUrl}/api/dashboard`, { headers: { Cookie: cookie } });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.dashboard.summary.totalApplications, 12);
  assert.equal(body.dashboard.ranking[0].score, 91);
  assert.equal(body.dashboard.upcomingInterviews.length, 1);
});
