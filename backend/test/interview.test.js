import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import { createApp } from '../src/app.js';

async function startApp() {
  const passwordHash = await bcrypt.hash('Entretien123', 4);
  const users = [
    { id: 41, first_name: 'Candidat', last_name: 'Test', email: 'candidate-interview@example.com', password_hash: passwordHash, role: 'candidate' },
    { id: 42, first_name: 'RH', last_name: 'Test', email: 'hr-interview@example.com', password_hash: passwordHash, role: 'hr' },
  ];
  const interviews = [];
  const notifications = [];
  const userService = {
    async findByEmail(email) {
      return users.find((user) => user.email === email) || null;
    },
    async findPublicById(id) {
      return users.find((user) => user.id === id) || null;
    },
  };
  const interviewService = {
    async create(data) {
      if (data.applicationId !== 7 || data.hrUserId !== 42) return null;
      if (interviews.some((item) => item.application_id === data.applicationId)) {
        const error = new Error('duplicate');
        error.code = '23505';
        throw error;
      }
      const interview = {
        id: interviews.length + 1,
        application_id: data.applicationId,
        scheduled_at: data.scheduledAt,
        duration_minutes: data.durationMinutes,
        meeting_type: data.meetingType,
        details: data.details,
        status: 'scheduled',
        evaluation_score: null,
        evaluation_notes: '',
        evaluated_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      interviews.push(interview);
      return interview;
    },
    async update(data) {
      const interview = interviews.find((item) => item.id === data.id && data.hrUserId === 42 && item.status === 'scheduled');
      if (!interview) return null;
      Object.assign(interview, {
        scheduled_at: data.scheduledAt,
        duration_minutes: data.durationMinutes,
        meeting_type: data.meetingType,
        details: data.details,
        updated_at: new Date().toISOString(),
      });
      return interview;
    },
    async updateStatus({ id, hrUserId, status }) {
      const interview = interviews.find((item) => item.id === id && hrUserId === 42 && item.status === 'scheduled');
      if (!interview) return null;
      interview.status = status;
      interview.updated_at = new Date().toISOString();
      return interview;
    },
    async evaluate({ id, hrUserId, score, notes }) {
      const interview = interviews.find((item) => item.id === id && hrUserId === 42 && item.status === 'completed');
      if (!interview) return null;
      interview.evaluation_score = score;
      interview.evaluation_notes = notes;
      interview.evaluated_at = new Date().toISOString();
      interview.updated_at = new Date().toISOString();
      return interview;
    },
  };
  const app = createApp({
    databasePool: { query: async () => ({ rows: [{ database_time: new Date() }] }) },
    sessionMiddleware: session({ secret: 'interview-test-secret', resave: false, saveUninitialized: false }),
    userService,
    profileService: {},
    jobOfferService: {},
    applicationService: {},
    interviewService,
    notificationService: {
      async notifyCandidate(data) {
        notifications.push(data);
        return data;
      },
    },
  });
  const server = app.listen(0);
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, server, interviews, notifications };
}

async function login(baseUrl, email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Entretien123' }),
  });
  return response.headers.get('set-cookie').split(';')[0];
}

function interviewBody(overrides = {}) {
  return {
    applicationId: 7,
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 45,
    meetingType: 'video',
    details: 'https://meet.example.test/entretien',
    ...overrides,
  };
}

async function schedule(baseUrl, cookie, body = interviewBody()) {
  return fetch(`${baseUrl}/api/interviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

async function updateInterview(baseUrl, cookie, id, body = interviewBody()) {
  const { applicationId, ...scheduleData } = body;
  return fetch(`${baseUrl}/api/interviews/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(scheduleData),
  });
}

async function updateInterviewStatus(baseUrl, cookie, id, status) {
  return fetch(`${baseUrl}/api/interviews/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ status }),
  });
}

async function evaluateInterview(baseUrl, cookie, id, score, notes) {
  return fetch(`${baseUrl}/api/interviews/${id}/evaluation`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ score, notes }),
  });
}

test('la planification exige une session RH', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());

  assert.equal((await schedule(baseUrl, null)).status, 401);
  const candidateCookie = await login(baseUrl, 'candidate-interview@example.com');
  assert.equal((await schedule(baseUrl, candidateCookie)).status, 403);
});

test('le RH planifie un entretien futur pour sa candidature', async (context) => {
  const { baseUrl, server, interviews } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'hr-interview@example.com');

  const response = await schedule(baseUrl, cookie);
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.interview.applicationId, 7);
  assert.equal(body.interview.durationMinutes, 45);
  assert.equal(body.interview.status, 'scheduled');
  assert.equal(interviews.length, 1);
});

test('une date passee, une candidature inaccessible et un doublon sont refuses', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'hr-interview@example.com');

  const pastResponse = await schedule(baseUrl, cookie, interviewBody({ scheduledAt: new Date(Date.now() - 1000).toISOString() }));
  assert.equal(pastResponse.status, 400);
  const missingResponse = await schedule(baseUrl, cookie, interviewBody({ applicationId: 99 }));
  assert.equal(missingResponse.status, 404);
  assert.equal((await schedule(baseUrl, cookie)).status, 201);
  assert.equal((await schedule(baseUrl, cookie)).status, 409);
});

test('le RH modifie un entretien programme puis le marque comme realise', async (context) => {
  const { baseUrl, server, notifications } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'hr-interview@example.com');
  await schedule(baseUrl, cookie);

  const updateResponse = await updateInterview(baseUrl, cookie, 1, interviewBody({ durationMinutes: 60, meetingType: 'onsite', details: 'Bureau RH, deuxième étage' }));
  const updateBody = await updateResponse.json();
  assert.equal(updateResponse.status, 200);
  assert.equal(updateBody.interview.durationMinutes, 60);
  assert.equal(updateBody.interview.meetingType, 'onsite');

  const statusResponse = await updateInterviewStatus(baseUrl, cookie, 1, 'completed');
  const statusBody = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(statusBody.interview.status, 'completed');
  assert.deepEqual(
    notifications.map((notification) => notification.type),
    ['interview_scheduled', 'interview_updated', 'interview_completed'],
  );
  assert.equal((await updateInterview(baseUrl, cookie, 1)).status, 404);
});

test('le RH annule un entretien et les statuts invalides sont refuses', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'hr-interview@example.com');
  await schedule(baseUrl, cookie);

  assert.equal((await updateInterviewStatus(baseUrl, cookie, 1, 'scheduled')).status, 400);
  const response = await updateInterviewStatus(baseUrl, cookie, 1, 'cancelled');
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.interview.status, 'cancelled');
});

test('le RH evalue un entretien realise et peut modifier son evaluation', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'hr-interview@example.com');
  await schedule(baseUrl, cookie);
  await updateInterviewStatus(baseUrl, cookie, 1, 'completed');

  const response = await evaluateInterview(baseUrl, cookie, 1, 4, 'Bon niveau technique et communication claire.');
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.interview.evaluationScore, 4);
  assert.equal(body.interview.evaluationNotes, 'Bon niveau technique et communication claire.');
  assert.ok(body.interview.evaluatedAt);

  const updatedResponse = await evaluateInterview(baseUrl, cookie, 1, 5, 'Très bonne maîtrise des compétences attendues.');
  const updatedBody = await updatedResponse.json();
  assert.equal(updatedResponse.status, 200);
  assert.equal(updatedBody.interview.evaluationScore, 5);
});

test('une evaluation invalide ou avant realisation est refusee', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'hr-interview@example.com');
  await schedule(baseUrl, cookie);

  assert.equal((await evaluateInterview(baseUrl, cookie, 1, 6, 'Commentaire valide')).status, 400);
  assert.equal((await evaluateInterview(baseUrl, cookie, 1, 4, 'Commentaire valide')).status, 404);
});
