import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import { createApp } from '../src/app.js';

async function startProfileApp(role) {
  const user = {
    id: role === 'hr' ? 20 : 10,
    first_name: 'Nour',
    last_name: 'Test',
    email: `${role}@example.com`,
    password_hash: await bcrypt.hash('Profil123', 4),
    role,
    created_at: new Date().toISOString(),
  };
  let profile = {
    ...user,
    phone: '',
    bio: '',
    location: '',
    professional_title: '',
    company_name: '',
    job_title: '',
  };
  const profileService = {
    async getByUserId(id) {
      return id === user.id ? profile : null;
    },
    async update(id, data) {
      if (id !== user.id) return null;
      profile = {
        ...profile,
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        bio: data.bio,
        location: data.location || '',
        professional_title: data.professionalTitle || '',
        company_name: data.companyName || '',
        job_title: data.jobTitle || '',
      };
      return profile;
    },
  };
  const userService = {
    async findByEmail(email) {
      return email === user.email ? user : null;
    },
    async findPublicById(id) {
      return id === user.id ? user : null;
    },
  };
  const app = createApp({
    databasePool: { query: async () => ({ rows: [{ database_time: new Date() }] }) },
    sessionMiddleware: session({
      secret: 'profile-test-secret',
      resave: false,
      saveUninitialized: false,
    }),
    userService,
    profileService,
  });
  const server = app.listen(0);

  return { baseUrl: `http://127.0.0.1:${server.address().port}`, server, user };
}

async function authenticate(baseUrl, user) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: 'Profil123' }),
  });

  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

test('le profil exige une authentification', async (context) => {
  const { baseUrl, server } = await startProfileApp('candidate');
  context.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/profile`);
  assert.equal(response.status, 401);
});

for (const role of ['candidate', 'hr']) {
  test(`consultation et modification du profil ${role}`, async (context) => {
    const { baseUrl, server, user } = await startProfileApp(role);
    context.after(() => server.close());
    const cookie = await authenticate(baseUrl, user);

    const initialResponse = await fetch(`${baseUrl}/api/profile`, {
      headers: { Cookie: cookie },
    });
    assert.equal(initialResponse.status, 200);

    const body = role === 'candidate'
      ? {
          firstName: 'Nour',
          lastName: 'Ben Salem',
          phone: '20111222',
          location: 'Tunis',
          professionalTitle: 'Développeuse React',
          bio: 'Profil candidat.',
          companyName: 'Champ interdit',
        }
      : {
          firstName: 'Nour',
          lastName: 'Ben Salem',
          phone: '20111222',
          companyName: 'Entreprise Test',
          jobTitle: 'Responsable RH',
          bio: 'Profil RH.',
          professionalTitle: 'Champ interdit',
        };
    const updateResponse = await fetch(`${baseUrl}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(body),
    });
    const result = await updateResponse.json();

    assert.equal(updateResponse.status, 200);
    assert.equal(result.profile.lastName, 'Ben Salem');
    assert.equal(result.profile.role, role);
    if (role === 'candidate') {
      assert.equal(result.profile.professionalTitle, 'Développeuse React');
      assert.equal(result.profile.companyName, undefined);
    } else {
      assert.equal(result.profile.companyName, 'Entreprise Test');
      assert.equal(result.profile.professionalTitle, undefined);
    }
  });
}
