import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import { createApp } from '../src/app.js';

const validOffer = {
  title: 'Développeur React',
  department: 'Technologie',
  location: 'Tunis',
  employmentType: 'full_time',
  workplaceType: 'hybrid',
  description: 'Concevoir et maintenir les interfaces React de la plateforme.',
  requirements: 'Maîtrise de React, JavaScript et des bonnes pratiques frontend.',
};

async function startApp() {
  const passwordHash = await bcrypt.hash('Offre123', 4);
  const users = [
    { id: 31, first_name: 'Candidat', last_name: 'Test', email: 'candidate-offer@example.com', password_hash: passwordHash, role: 'candidate', created_at: new Date().toISOString() },
    { id: 32, first_name: 'RH', last_name: 'Test', email: 'hr-offer@example.com', password_hash: passwordHash, role: 'hr', created_at: new Date().toISOString() },
  ];
  const created = [];
  const userService = {
    async findByEmail(email) {
      return users.find((user) => user.email === email) || null;
    },
    async findPublicById(id) {
      return users.find((user) => user.id === id) || null;
    },
  };
  const jobOfferService = {
    async listForUser({ userId, role, search, employmentType, workplaceType, status }) {
      const normalizedSearch = search.toLowerCase();
      return created.filter((offer) => {
        const visible = role === 'hr' ? offer.hr_user_id === userId : offer.status === 'published';
        const matchesSearch = !search || [offer.title, offer.department, offer.location]
          .some((value) => value.toLowerCase().includes(normalizedSearch));
        return visible
          && matchesSearch
          && (!employmentType || offer.employment_type === employmentType)
          && (!workplaceType || offer.workplace_type === workplaceType)
          && (!status || offer.status === status);
      });
    },
    async create(data) {
      const offer = {
        id: created.length + 1,
        hr_user_id: data.hrUserId,
        title: data.title,
        department: data.department,
        location: data.location,
        employment_type: data.employmentType,
        workplace_type: data.workplaceType,
        description: data.description,
        requirements: data.requirements,
        skills: data.skills,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      created.push(offer);
      return offer;
    },
    async updateStatus({ id, hrUserId, status }) {
      const offer = created.find((item) => item.id === id && item.hr_user_id === hrUserId);
      if (!offer) return null;

      offer.status = status;
      offer.published_at = status === 'published' ? new Date().toISOString() : null;
      offer.updated_at = new Date().toISOString();
      return offer;
    },
    async update({ id, hrUserId, ...data }) {
      const offer = created.find((item) => item.id === id && item.hr_user_id === hrUserId);
      if (!offer) return null;

      Object.assign(offer, {
        title: data.title,
        department: data.department,
        location: data.location,
        employment_type: data.employmentType,
        workplace_type: data.workplaceType,
        description: data.description,
        requirements: data.requirements,
        skills: data.skills,
        updated_at: new Date().toISOString(),
      });
      return offer;
    },
    async remove({ id, hrUserId }) {
      const index = created.findIndex((item) => item.id === id && item.hr_user_id === hrUserId);
      if (index === -1) return false;
      created.splice(index, 1);
      return true;
    },
  };
  const app = createApp({
    databasePool: { query: async () => ({ rows: [{ database_time: new Date() }] }) },
    sessionMiddleware: session({ secret: 'job-offer-test-secret', resave: false, saveUninitialized: false }),
    userService,
    profileService: {},
    jobOfferService,
  });
  const server = app.listen(0);

  return { baseUrl: `http://127.0.0.1:${server.address().port}`, server, created };
}

async function login(baseUrl, email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Offre123' }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

async function createOffer(baseUrl, cookie, body = validOffer) {
  return fetch(`${baseUrl}/api/job-offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

test('la création d’offre exige une session RH', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());

  const anonymousResponse = await createOffer(baseUrl, null);
  assert.equal(anonymousResponse.status, 401);

  const candidateCookie = await login(baseUrl, 'candidate-offer@example.com');
  const candidateResponse = await createOffer(baseUrl, candidateCookie);
  assert.equal(candidateResponse.status, 403);
});

test('un responsable RH crée une offre en brouillon', async (context) => {
  const { baseUrl, server, created } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'hr-offer@example.com');

  const response = await createOffer(baseUrl, cookie);
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.offer.status, 'draft');
  assert.equal(body.offer.title, validOffer.title);
  assert.equal(body.offer.description, validOffer.description);
  assert.deepEqual(body.offer.skills, ['React', 'JavaScript']);
  assert.equal(created[0].hr_user_id, 32);
});

test('les données invalides d’une offre sont refusées', async (context) => {
  const { baseUrl, server, created } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'hr-offer@example.com');

  const response = await createOffer(baseUrl, cookie, {
    ...validOffer,
    title: 'A',
    description: 'Trop courte',
  });

  assert.equal(response.status, 400);
  assert.equal(created.length, 0);
});

test('la consultation des offres exige une authentification', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/job-offers`);

  assert.equal(response.status, 401);
});

test('le RH consulte ses offres et le candidat uniquement les offres publiées', async (context) => {
  const { baseUrl, server, created } = await startApp();
  context.after(() => server.close());
  const hrCookie = await login(baseUrl, 'hr-offer@example.com');
  const candidateCookie = await login(baseUrl, 'candidate-offer@example.com');

  await createOffer(baseUrl, hrCookie);

  const hrResponse = await fetch(`${baseUrl}/api/job-offers`, { headers: { Cookie: hrCookie } });
  const hrBody = await hrResponse.json();
  assert.equal(hrResponse.status, 200);
  assert.equal(hrBody.offers.length, 1);
  assert.equal(hrBody.offers[0].status, 'draft');

  const candidateEmptyResponse = await fetch(`${baseUrl}/api/job-offers`, { headers: { Cookie: candidateCookie } });
  const candidateEmptyBody = await candidateEmptyResponse.json();
  assert.equal(candidateEmptyResponse.status, 200);
  assert.equal(candidateEmptyBody.offers.length, 0);

  const publishResponse = await fetch(`${baseUrl}/api/job-offers/1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hrCookie },
    body: JSON.stringify({ status: 'published' }),
  });
  assert.equal(publishResponse.status, 200);

  const candidateResponse = await fetch(`${baseUrl}/api/job-offers`, { headers: { Cookie: candidateCookie } });
  const candidateBody = await candidateResponse.json();
  assert.equal(candidateBody.offers.length, 1);
});

test('seul le RH propriétaire publie et remet son offre en brouillon', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const hrCookie = await login(baseUrl, 'hr-offer@example.com');
  const candidateCookie = await login(baseUrl, 'candidate-offer@example.com');
  await createOffer(baseUrl, hrCookie);

  const candidateResponse = await fetch(`${baseUrl}/api/job-offers/1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: candidateCookie },
    body: JSON.stringify({ status: 'published' }),
  });
  assert.equal(candidateResponse.status, 403);

  const archiveResponse = await fetch(`${baseUrl}/api/job-offers/1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hrCookie },
    body: JSON.stringify({ status: 'closed' }),
  });
  const archiveBody = await archiveResponse.json();
  assert.equal(archiveResponse.status, 200);
  assert.equal(archiveBody.offer.status, 'closed');

  const publishResponse = await fetch(`${baseUrl}/api/job-offers/1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hrCookie },
    body: JSON.stringify({ status: 'published' }),
  });
  const publishBody = await publishResponse.json();
  assert.equal(publishBody.offer.status, 'published');

  const draftResponse = await fetch(`${baseUrl}/api/job-offers/1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hrCookie },
    body: JSON.stringify({ status: 'draft' }),
  });
  const draftBody = await draftResponse.json();
  assert.equal(draftBody.offer.status, 'draft');
  assert.equal(draftBody.offer.publishedAt, null);
});

test('le RH propriétaire modifie son offre avec des données valides', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const hrCookie = await login(baseUrl, 'hr-offer@example.com');
  await createOffer(baseUrl, hrCookie);

  const response = await fetch(`${baseUrl}/api/job-offers/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: hrCookie },
    body: JSON.stringify({
      ...validOffer,
      title: 'Développeur React confirmé',
      workplaceType: 'remote',
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.offer.title, 'Développeur React confirmé');
  assert.equal(body.offer.workplaceType, 'remote');
  assert.deepEqual(body.offer.skills, ['React', 'JavaScript']);
  assert.equal(body.offer.status, 'draft');
});

test('un candidat ne peut pas modifier une offre et les données invalides sont refusées', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const hrCookie = await login(baseUrl, 'hr-offer@example.com');
  const candidateCookie = await login(baseUrl, 'candidate-offer@example.com');
  await createOffer(baseUrl, hrCookie);

  const candidateResponse = await fetch(`${baseUrl}/api/job-offers/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: candidateCookie },
    body: JSON.stringify(validOffer),
  });
  assert.equal(candidateResponse.status, 403);

  const invalidResponse = await fetch(`${baseUrl}/api/job-offers/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: hrCookie },
    body: JSON.stringify({ ...validOffer, title: 'A' }),
  });
  assert.equal(invalidResponse.status, 400);
});

test('seul le RH propriétaire peut supprimer son offre', async (context) => {
  const { baseUrl, server, created } = await startApp();
  context.after(() => server.close());
  const hrCookie = await login(baseUrl, 'hr-offer@example.com');
  const candidateCookie = await login(baseUrl, 'candidate-offer@example.com');
  await createOffer(baseUrl, hrCookie);

  const candidateResponse = await fetch(`${baseUrl}/api/job-offers/1`, {
    method: 'DELETE',
    headers: { Cookie: candidateCookie },
  });
  assert.equal(candidateResponse.status, 403);
  assert.equal(created.length, 1);

  const response = await fetch(`${baseUrl}/api/job-offers/1`, {
    method: 'DELETE',
    headers: { Cookie: hrCookie },
  });
  assert.equal(response.status, 204);
  assert.equal(created.length, 0);

  const missingResponse = await fetch(`${baseUrl}/api/job-offers/1`, {
    method: 'DELETE',
    headers: { Cookie: hrCookie },
  });
  assert.equal(missingResponse.status, 404);
});

test('le RH recherche et filtre ses offres', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const hrCookie = await login(baseUrl, 'hr-offer@example.com');
  await createOffer(baseUrl, hrCookie);
  await createOffer(baseUrl, hrCookie, {
    ...validOffer,
    title: 'Data Analyst',
    department: 'Data',
    location: 'Ariana',
    employmentType: 'fixed_term',
    workplaceType: 'remote',
  });

  const response = await fetch(
    `${baseUrl}/api/job-offers?q=data&employmentType=fixed_term&workplaceType=remote&status=draft`,
    { headers: { Cookie: hrCookie } },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.offers.length, 1);
  assert.equal(body.offers[0].title, 'Data Analyst');

  const invalidResponse = await fetch(`${baseUrl}/api/job-offers?status=invalide`, {
    headers: { Cookie: hrCookie },
  });
  assert.equal(invalidResponse.status, 400);
});
