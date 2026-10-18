import 'dotenv/config';
import createApp from './app.js';
import pool from './config/database.js';
import { createAiAnalysisJobService } from './services/ai-analysis-job.service.js';
import { createApplicationService } from './services/application.service.js';
import { createSemanticMatcher } from './services/semantic-matcher.service.js';
import { createAiAnalysisWorker } from './workers/ai-analysis.worker.js';

const port = Number(process.env.PORT) || 3000;
const pollIntervalMs = Number(process.env.AI_WORKER_POLL_INTERVAL_MS || 3000);
const jobService = createAiAnalysisJobService(pool);
const app = createApp({ analysisJobService: jobService });
const applicationService = createApplicationService(pool);
const semanticMatcher = createSemanticMatcher();
const worker = createAiAnalysisWorker({
  jobService,
  async analyze(job) {
    const input = await applicationService.findAnalysisInput(job.application_id);
    if (!input) throw new Error('APPLICATION_NOT_FOUND');

    const analysis = await semanticMatcher.compare({
      cvText: input.cvText,
      cvSkills: input.cvSkills,
      offer: input.offer,
    });
    const saved = await applicationService.saveAnalysis({
      id: input.applicationId,
      aiStatus: 'completed',
      score: analysis.score,
      semanticScore: analysis.semanticScore,
      skillScore: analysis.skillScore,
      matchedSkills: analysis.matchedSkills,
      missingSkills: analysis.missingSkills,
      model: analysis.model,
      scoringVersion: analysis.scoringVersion,
    });
    if (!saved) throw new Error('ANALYSIS_SAVE_FAILED');
  },
  async onFailure(job, failedJob) {
    if (failedJob?.status !== 'failed') return;
    await applicationService.saveAnalysis({ id: job.application_id, aiStatus: 'failed' });
  },
});

let stopping = false;
let workerTimer;
let workerTask = Promise.resolve();

async function runWorkerCycle() {
  let nextDelay = pollIntervalMs;
  try {
    const job = await worker.processNext();
    if (job) nextDelay = 0;
  } catch (error) {
    console.error('Analyse IA échouée, le traitement continue :', error.message);
  } finally {
    if (!stopping) {
      workerTimer = setTimeout(() => {
        workerTask = runWorkerCycle();
      }, nextDelay);
    }
  }
}

const server = app.listen(port, () => {
  console.log(`API disponible sur http://localhost:${port}`);
  workerTask = runWorkerCycle();
});

const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  clearTimeout(workerTimer);
  server.close(async () => {
    await workerTask.catch(() => {});
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
