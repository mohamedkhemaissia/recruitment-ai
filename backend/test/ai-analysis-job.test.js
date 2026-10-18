import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiAnalysisWorker } from '../src/workers/ai-analysis.worker.js';

test('le worker traite un job et le marque comme termine', async () => {
  const calls = [];
  const worker = createAiAnalysisWorker({
    jobService: {
      async recoverStaleProcessing() {},
      async claimNext() {
        return { id: 12, application_id: 8, attempts: 1 };
      },
      async updateStatus(data) {
        calls.push(data);
        return { ...data, status: data.status };
      },
    },
    async analyze(job) {
      calls.push({ analyzed: job.application_id });
    },
  });

  const result = await worker.processNext();

  assert.equal(result.status, 'completed');
  assert.deepEqual(calls, [
    { analyzed: 8 },
    { id: 12, status: 'completed' },
  ]);
});

test('le worker marque un job en echec et propage l erreur', async () => {
  const statuses = [];
  const worker = createAiAnalysisWorker({
    jobService: {
      async recoverStaleProcessing() {},
      async claimNext() {
        return { id: 12, application_id: 8, attempts: 1 };
      },
      async updateStatus(data) {
        statuses.push(data);
      },
    },
    async analyze() {
      throw new Error('MODELE_INDISPONIBLE');
    },
  });

  await assert.rejects(() => worker.processNext(), /MODELE_INDISPONIBLE/);
  assert.deepEqual(statuses, [{
    id: 12,
    status: 'failed',
    errorMessage: 'MODELE_INDISPONIBLE',
  }]);
});

test('le worker recrée les jobs manquants et récupère les jobs bloqués', async () => {
  const calls = [];
  const worker = createAiAnalysisWorker({
    jobService: {
      async enqueueMissing() {
        calls.push('enqueue');
      },
      async recoverStaleProcessing() {
        calls.push('recover');
      },
      async claimNext() {
        calls.push('claim');
        return null;
      },
    },
    async analyze() {},
  });

  assert.equal(await worker.processNext(), null);
  assert.deepEqual(calls, ['enqueue', 'recover', 'claim']);
});
