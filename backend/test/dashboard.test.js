import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import { createApp } from '../src/app.js';
import { createDashboardService } from '../src/services/dashboard.service.js';

async function startApp() {
  const passwordHash = await bcrypt.hash('Dashboard123', 4);
  const users = [
    { id: 51, first_name: 'Candidat', last_name: 'Test', email: 'candidate-dashboard@example.com', password_hash: passwordHash, role: 'candidate' },
    { id: 52, first_name: 'RH', last_name: 'Test', email: 'hr-dashboard@example.com', password_hash: passwordHash, role: 'hr' },
  ];
  const dashboardCalls = [];
  const userService = {
    async findByEmail(email) {
      return users.find((user) => user.email === email) || null;
    },
    async findPublicById(id) {
      return users.find((user) => user.id === id) || null;
    },
  };
  const dashboardService = {
    async getForHr(hrUserId, options) {
      assert.equal(hrUserId, 52);
      dashboardCalls.push(options);
      return {
        summary: {
          totalOffers: 4,
          publishedOffers: 2,
          totalApplications: 12,
          submittedApplications: 4,
          reviewedApplications: 2,
          shortlistedApplications: 3,
          rejectedApplications: 3,
          analyzedApplications: 10,
          upcomingInterviews: 2,
          completedInterviews: 5,
        },
        pipeline: [
          { status: 'submitted', count: 4 },
          { status: 'reviewed', count: 2 },
          { status: 'shortlisted', count: 3 },
          { status: 'rejected', count: 3 },
        ],
        offers: [{ id: 4, title: 'Développeur React', status: 'published', applicationCount: 12, shortlistedCount: 3 }],
        selectedOfferId: options.offerId || 4,
        ranking: [{ id: 7, score: 91, status: 'shortlisted', candidateName: 'Sami Ben Ali', offerTitle: 'Développeur React' }],
        priorityApplications: [{ id: 8, status: 'submitted', createdAt: new Date().toISOString(), aiStatus: 'completed', score: 88, candidateName: 'Amira Test', offerTitle: 'Développeur React' }],
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
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, server, dashboardCalls };
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

test('le RH consulte les priorités, le classement par offre et les entretiens', async (context) => {
  const { baseUrl, server, dashboardCalls } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'hr-dashboard@example.com');

  const response = await fetch(`${baseUrl}/api/dashboard?offerId=4`, { headers: { Cookie: cookie } });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.dashboard.summary.totalApplications, 12);
  assert.equal(body.dashboard.summary.submittedApplications, 4);
  assert.equal(body.dashboard.ranking[0].score, 91);
  assert.equal(body.dashboard.priorityApplications.length, 1);
  assert.equal(body.dashboard.upcomingInterviews.length, 1);
  assert.equal(dashboardCalls[0].offerId, 4);
});

test('le tableau de bord refuse un identifiant d’offre invalide', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'hr-dashboard@example.com');
  assert.equal((await fetch(`${baseUrl}/api/dashboard?offerId=abc`, { headers: { Cookie: cookie } })).status, 400);
});

test('le service calcule un pipeline et limite le classement à l’offre sélectionnée', async () => {
  const calls = [];
  const databasePool = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes('AS total_offers')) {
        return { rows: [{
          total_offers: 2,
          published_offers: 1,
          total_applications: 6,
          submitted_applications: 2,
          reviewed_applications: 1,
          shortlisted_applications: 2,
          rejected_applications: 1,
          analyzed_applications: 5,
          upcoming_interviews: 1,
          completed_interviews: 2,
        }] };
      }
      if (sql.includes('GROUP BY o.id')) {
        return { rows: [
          { id: '3', title: 'Data Analyst', status: 'published', application_count: 4, shortlisted_count: 2 },
          { id: '4', title: 'Développeur React', status: 'closed', application_count: 2, shortlisted_count: 0 },
        ] };
      }
      if (sql.includes("a.ai_status = 'completed'")) {
        return { rows: [{ id: '9', final_score: '91.5', status: 'shortlisted', first_name: 'Sami', last_name: 'Ben Ali', title: 'Développeur React' }] };
      }
      if (sql.includes("a.status IN ('submitted', 'reviewed')")) {
        return { rows: [{ id: '10', status: 'submitted', created_at: '2026-10-19T08:00:00.000Z', ai_status: 'completed', final_score: '84', first_name: 'Amira', last_name: 'Test', title: 'Data Analyst' }] };
      }
      return { rows: [{ id: '12', scheduled_at: '2026-10-20T09:00:00.000Z', duration_minutes: 45, meeting_type: 'video', first_name: 'Sami', last_name: 'Ben Ali', title: 'Développeur React' }] };
    },
  };

  const dashboard = await createDashboardService(databasePool).getForHr(52, { offerId: 4 });
  assert.equal(dashboard.selectedOfferId, 4);
  assert.equal(dashboard.pipeline[0].count, 2);
  assert.equal(dashboard.priorityApplications[0].score, 84);
  assert.equal(dashboard.ranking[0].score, 91.5);
  const rankingCall = calls.find((call) => call.sql.includes("a.ai_status = 'completed'") && call.values.length === 2);
  assert.deepEqual(rankingCall.values, [52, '4']);
});
