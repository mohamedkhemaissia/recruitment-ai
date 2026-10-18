import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSessionMiddleware } from '../src/config/session.js';
import { createCsrfOriginGuard } from '../src/middleware/csrf-origin.js';
import { createCvStorage } from '../src/services/cv-storage.service.js';

test('la production refuse un secret de session absent ou faible', () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousSecret = process.env.SESSION_SECRET;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;
    assert.throws(() => createSessionMiddleware({}), /SESSION_SECRET/);

    process.env.SESSION_SECRET = 'secret-trop-court';
    assert.throws(() => createSessionMiddleware({}), /SESSION_SECRET/);

    process.env.SESSION_SECRET = 'un-secret-aleatoire-de-production-123456789';
    assert.doesNotThrow(() => createSessionMiddleware({}));
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  }
});

test('le stockage des CV refuse les chemins et noms non generes', async () => {
  const storage = createCvStorage();
  await assert.rejects(() => storage.read('../.env'), { code: 'INVALID_CV_FILE' });
  await assert.rejects(() => storage.remove('cv.pdf'), { code: 'INVALID_CV_FILE' });
  const missingFile = await storage.stageRemoval('00000000-0000-4000-8000-000000000000.pdf');
  await assert.doesNotReject(() => missingFile.commit());
});

test('la suppression préparée d un CV peut être annulée ou confirmée', async () => {
  const previousPath = process.env.CV_STORAGE_PATH;
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'recruitment-cv-test-'));
  process.env.CV_STORAGE_PATH = temporaryDirectory;

  try {
    const storage = createCvStorage();
    const content = Buffer.from('%PDF-1.4\nCV test');
    const storedFileName = await storage.store(content);

    const firstRemoval = await storage.stageRemoval(storedFileName);
    await assert.rejects(() => storage.read(storedFileName), { code: 'ENOENT' });
    await firstRemoval.rollback();
    assert.deepEqual(await storage.read(storedFileName), content);

    const secondRemoval = await storage.stageRemoval(storedFileName);
    await secondRemoval.commit();
    await assert.rejects(() => storage.read(storedFileName), { code: 'ENOENT' });
  } finally {
    if (previousPath === undefined) delete process.env.CV_STORAGE_PATH;
    else process.env.CV_STORAGE_PATH = previousPath;
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('la protection CSRF refuse les origines absentes ou inconnues en production', () => {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    const guard = createCsrfOriginGuard({ frontendUrl: 'https://frontend.example.com' });
    const createRequest = (origin) => ({
      method: 'POST',
      session: { userId: 12 },
      get: (header) => (header === 'origin' ? origin : undefined),
    });
    const next = () => {};

    let responseStatus;
    let responseBody;
    const response = {
      status(value) {
        responseStatus = value;
        return this;
      },
      json(value) {
        responseBody = value;
      },
    };

    guard(createRequest('https://malicious.example.com'), response, next);
    assert.equal(responseStatus, 403);
    assert.equal(responseBody.message, 'Origine de requête non autorisée.');

    responseStatus = undefined;
    guard(createRequest('https://frontend.example.com'), response, next);
    assert.equal(responseStatus, undefined);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});
