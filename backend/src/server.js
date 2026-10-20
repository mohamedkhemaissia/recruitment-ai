import 'dotenv/config';
import createApp from './app.js';
import pool from './config/database.js';
import { createAiAnalysisJobService } from './services/ai-analysis-job.service.js';
import { createApplicationService } from './services/application.service.js';
import { createRecruitmentMatcher } from './services/recruitment-matcher.service.js';
import { createEmailJobService } from './services/email-job.service.js';
import { createEmailSender } from './services/email-sender.service.js';
import { createAiAnalysisWorker } from './workers/ai-analysis.worker.js';
import { createEmailWorker } from './workers/email.worker.js';

const port = Number(process.env.PORT) || 3000;
const pollIntervalMs = Number(process.env.AI_WORKER_POLL_INTERVAL_MS || 3000);
const emailPollIntervalMs = Number(process.env.EMAIL_WORKER_POLL_INTERVAL_MS || 5000);
const jobService = createAiAnalysisJobService(pool);
const app = createApp({ analysisJobService: jobService });
const applicationService = createApplicationService(pool);
const semanticMatcher = createRecruitmentMatcher();
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
      confidence: analysis.confidence,
      explanation: analysis.explanation,
    });
    if (!saved) throw new Error('ANALYSIS_SAVE_FAILED');
  },
  async onFailure(job, failedJob) {
    if (failedJob?.status !== 'failed') return;
    await applicationService.saveAnalysis({ id: job.application_id, aiStatus: 'failed' });
  },
});
const emailJobService = createEmailJobService(pool);
const emailSender = createEmailSender();
const emailWorker = createEmailWorker({ jobService: emailJobService, emailSender });

let stopping = false;
let workerTimer;
let workerTask = Promise.resolve();
let emailWorkerTimer;
let emailWorkerTask = Promise.resolve();

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

async function startWorker() {
  try {
    await worker.recoverInterrupted();
  } catch (error) {
    console.error('Récupération des analyses interrompues impossible :', error.message);
  }

  if (!stopping) await runWorkerCycle();
}

async function runEmailWorkerCycle() {
  let nextDelay = emailPollIntervalMs;
  try {
    const job = await emailWorker.processNext();
    if (job) nextDelay = 0;
  } catch (error) {
    console.error('Envoi d’e-mail échoué, une nouvelle tentative sera effectuée :', error.message);
  } finally {
    if (!stopping && emailSender.configured) {
      emailWorkerTimer = setTimeout(() => {
        emailWorkerTask = runEmailWorkerCycle();
      }, nextDelay);
    }
  }
}

async function startEmailWorker() {
  if (!emailSender.configured) return;
  try {
    await emailJobService.recoverInterrupted(0);
  } catch (error) {
    console.error('Récupération des e-mails interrompus impossible :', error.message);
  }
  if (!stopping) await runEmailWorkerCycle();
}

const server = app.listen(port, () => {
  console.log(`API disponible sur http://localhost:${port}`);
  workerTask = startWorker();
  emailWorkerTask = startEmailWorker();
});

const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  clearTimeout(workerTimer);
  clearTimeout(emailWorkerTimer);
  server.close(async () => {
    await Promise.all([workerTask.catch(() => {}), emailWorkerTask.catch(() => {})]);
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
