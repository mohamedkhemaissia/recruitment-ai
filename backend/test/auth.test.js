import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import { createApp } from '../src/app.js';

function createFakeUserService() {
  const users = [];

  return {
    users,
    async create(data) {
      if (users.some((user) => user.email === data.email)) {
        const error = new Error('duplicate');
        error.code = '23505';
        throw error;
      }

      const user = {
        id: users.length + 1,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        password_hash: data.passwordHash,
        role: data.role,
        created_at: new Date().toISOString(),
      };
      users.push(user);
      return user;
    },
    async findByEmail(email) {
      return users.find((user) => user.email === email) || null;
    },
    async findPublicById(id) {
      return users.find((user) => user.id === id) || null;
    },
  };
}

function startTestApp() {
  const userService = createFakeUserService();
  const app = createApp({
    databasePool: { query: async () => ({ rows: [{ database_time: new Date() }] }) },
    sessionMiddleware: session({
      secret: 'test-secret-long-enough',
      resave: false,
      saveUninitialized: false,
    }),
    userService,
  });
  const server = app.listen(0);
  const { port } = server.address();

  return { baseUrl: `http://127.0.0.1:${port}`, server, userService };
}

async function request(baseUrl, path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
}

test('inscription, session et déconnexion', async (context) => {
  const { baseUrl, server, userService } = startTestApp();
  context.after(() => server.close());

  const registerResponse = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Sarra',
      lastName: 'Ben Ali',
      email: 'SARRA@example.com',
      password: 'MotDePasse123',
      role: 'hr',
    }),
  });
  const registerBody = await registerResponse.json();
  const cookie = registerResponse.headers.get('set-cookie').split(';')[0];

  assert.equal(registerResponse.status, 201);
  assert.equal(registerBody.user.email, 'sarra@example.com');
  assert.equal(registerBody.user.role, 'candidate');
  assert.equal(registerBody.user.passwordHash, undefined);
  assert.equal(await bcrypt.compare('MotDePasse123', userService.users[0].password_hash), true);

  const meResponse = await request(baseUrl, '/api/auth/me', {
    headers: { Cookie: cookie },
  });
  assert.equal(meResponse.status, 200);

  const logoutResponse = await request(baseUrl, '/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  assert.equal(logoutResponse.status, 204);

  const protectedResponse = await request(baseUrl, '/api/auth/me', {
    headers: { Cookie: cookie },
  });
  assert.equal(protectedResponse.status, 401);
});

test('connexion valide et refus des identifiants incorrects', async (context) => {
  const { baseUrl, server } = startTestApp();
  context.after(() => server.close());

  await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Amine',
      lastName: 'Trabelsi',
      email: 'amine@example.com',
      password: 'Secret123',
    }),
  });

  const badResponse = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'amine@example.com', password: 'incorrect' }),
  });
  assert.equal(badResponse.status, 401);

  const loginResponse = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'amine@example.com', password: 'Secret123' }),
  });
  const loginBody = await loginResponse.json();

  assert.equal(loginResponse.status, 200);
  assert.equal(loginBody.user.role, 'candidate');
  assert.match(loginResponse.headers.get('set-cookie'), /HttpOnly/);
});

test('validation des données d’inscription', async (context) => {
  const { baseUrl, server } = startTestApp();
  context.after(() => server.close());

  const response = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Test',
      lastName: 'Court',
      email: 'adresse-invalide',
      password: '123',
    }),
  });

  assert.equal(response.status, 400);
});

test('limite les tentatives répétées de connexion', async (context) => {
  const { baseUrl, server } = startTestApp();
  context.after(() => server.close());

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'unknown@example.com', password: 'incorrect' }),
    });
    assert.equal(response.status, 401);
  }

  const blockedResponse = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'unknown@example.com', password: 'incorrect' }),
  });
  assert.equal(blockedResponse.status, 429);
  assert.match(blockedResponse.headers.get('retry-after'), /^\d+$/);
});
