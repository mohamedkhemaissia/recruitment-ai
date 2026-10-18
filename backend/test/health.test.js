import assert from 'node:assert/strict';
import test from 'node:test';
import session from 'express-session';
import { createApp } from '../src/app.js';

test('GET /api/health confirme le backend et PostgreSQL', async (context) => {
  const databasePool = {
    query: async () => ({ rows: [{ database_time: new Date() }] }),
  };
  const app = createApp({
    databasePool,
    sessionMiddleware: session({
      secret: 'test-secret-long-enough',
      resave: false,
      saveUninitialized: false,
    }),
    userService: {},
  });
  const server = app.listen(0);
  context.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  const body = await response.json();
  const obsoleteEndpointResponse = await fetch(`http://127.0.0.1:${port}/api/health/live`);

  assert.equal(response.status, 200);
  assert.equal(body.backend, 'connected');
  assert.equal(body.database, 'connected');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('content-security-policy'), "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  assert.equal(obsoleteEndpointResponse.status, 404);
});
