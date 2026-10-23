import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import { createApp } from '../src/app.js';
import { createAiAnalysisWorker } from '../src/workers/ai-analysis.worker.js';

async function startApp({
  extractionFails = false,
  analysisFails = false,
  extractedText = 'Sami Ben Ali\nDeveloppeur React\nJavaScript SQL',
  analysisJobService = null,
  auditService = null,
  notificationService = null,
} = {}) {
  const passwordHash = await bcrypt.hash('Candidat123', 4);
  const users = [
    { id: 41, first_name: 'Candidat', last_name: 'Test', email: 'candidate-application@example.com', password_hash: passwordHash, role: 'candidate', created_at: new Date().toISOString() },
    { id: 42, first_name: 'RH', last_name: 'Test', email: 'hr-application@example.com', password_hash: passwordHash, role: 'hr', created_at: new Date().toISOString() },
  ];
  const applications = [];
  const storedFiles = [];
  const removedFiles = [];
  const notifications = [];
  const userService = {
    async findByEmail(email) {
      return users.find((user) => user.email === email) || null;
    },
    async findPublicById(id) {
      return users.find((user) => user.id === id) || null;
    },
  };
  const applicationService = {
    async listForHr(hrUserId) {
      if (hrUserId !== 42) return [];
      return applications.map((application) => ({
        ...application,
        cv_original_name: application.cv_original_name,
        title: 'Développeur React',
        department: 'Technologie',
        first_name: 'Candidat',
        last_name: 'Test',
        email: 'candidate-application@example.com',
        professional_title: 'Développeur frontend',
        candidate_location: 'Tunis',
      }));
    },
    async listForCandidate(candidateUserId) {
      return applications
        .filter((application) => application.candidate_user_id === candidateUserId)
        .map((application) => ({
          ...application,
          title: 'Développeur React',
          department: 'Technologie',
          location: 'Tunis',
          employment_type: 'full_time',
          workplace_type: 'hybrid',
          company_name: 'Bee Coders',
          interview_id: 91,
          interview_scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
          interview_duration_minutes: 45,
          interview_meeting_type: 'video',
          interview_details: 'https://meet.example.test/candidat',
          interview_status: 'scheduled',
          interview_evaluation_score: 5,
          interview_evaluation_notes: 'Note interne confidentielle',
        }));
    },
    async findPublishedOffer(id) {
      return id === 7 ? { id: 7, title: 'Développeur React' } : null;
    },
    async findAnalysisStatus({ id, userId, role }) {
      const application = applications.find((item) => item.id === id);
      if (!application || (role === 'candidate' && application.candidate_user_id !== userId)
        || (role === 'hr' && userId !== 42)) return null;
      return {
        application_id: application.id,
        ai_status: application.ai_status,
        job_id: null,
        job_status: null,
        attempts: 0,
        error_message: '',
        started_at: null,
        completed_at: null,
        job_created_at: null,
        job_updated_at: null,
      };
    },
    async create(data) {
      if (applications.some((item) => item.job_offer_id === data.jobOfferId)) {
        const error = new Error('duplicate');
        error.code = '23505';
        throw error;
      }
      const application = {
        id: applications.length + 1,
        job_offer_id: data.jobOfferId,
        candidate_user_id: data.candidateUserId,
        status: 'submitted',
        cv_original_name: data.originalFileName,
        cv_stored_name: data.storedFileName,
        cv_mime_type: 'application/pdf',
        cv_text: data.cvText,
        cv_extraction_status: data.extractionStatus,
        cv_skills: data.cvSkills,
        ai_status: data.aiStatus,
        semantic_score: null,
        semantic_component: null,
        final_score: null,
        skill_component: null,
        scoring_version: '',
        matched_skills: [],
        missing_skills: [],
        created_at: new Date().toISOString(),
      };
      applications.push(application);
      return application;
    },
    async saveAnalysis({
      id,
      aiStatus,
      score = null,
      semanticScore = null,
      skillScore = null,
      scoringVersion = '',
      matchedSkills = [],
      missingSkills = [],
    }) {
      const application = applications.find((item) => item.id === id);
      if (!application) return null;
      application.ai_status = aiStatus;
      application.semantic_score = score;
      application.semantic_component = semanticScore;
      application.final_score = score;
      application.skill_component = skillScore;
      application.scoring_version = scoringVersion;
      application.matched_skills = matchedSkills;
      application.missing_skills = missingSkills;
      return application;
    },
    async findAnalysisInput(applicationId) {
      const application = applications.find((item) => item.id === applicationId);
      return application ? {
        applicationId: application.id,
        cvText: application.cv_text,
        cvSkills: application.cv_skills,
        offer: {
          id: application.job_offer_id,
          title: 'Développeur React',
          description: 'Développer une application web.',
          requirements: 'React, JavaScript, SQL',
          skills: ['React', 'JavaScript', 'SQL'],
        },
      } : null;
    },
    async updateStatus({ id, hrUserId, status }) {
      if (hrUserId !== 42) return null;
      const application = applications.find((item) => item.id === id);
      if (!application) return null;
      application.status = status;
      return application;
    },
    async findForCandidate({ id, candidateUserId }) {
      return applications.find((item) => item.id === id && item.candidate_user_id === candidateUserId) || null;
    },
    async remove({ id, candidateUserId }) {
      const index = applications.findIndex((item) => item.id === id && item.candidate_user_id === candidateUserId);
      if (index < 0) return null;
      return applications.splice(index, 1)[0];
    },
    async findCvForHr({ id, hrUserId }) {
      if (hrUserId !== 42) return null;
      const application = applications.find((item) => item.id === id);
      return application ? {
        cv_stored_name: application.cv_stored_name,
        cv_original_name: application.cv_original_name,
        cv_mime_type: application.cv_mime_type,
      } : null;
    },
  };
  const cvStorage = {
    async store(buffer) {
      const name = `cv-${storedFiles.length + 1}.pdf`;
      storedFiles.push({ name, buffer });
      return name;
    },
    async remove(name) {
      removedFiles.push(name);
    },
    async stageRemoval(name) {
      return {
        async commit() {
          removedFiles.push(name);
        },
        async rollback() {},
      };
    },
    async read(name) {
      return storedFiles.find((file) => file.name === name)?.buffer || null;
    },
  };
  const pdfTextExtractor = {
    async extract() {
      if (extractionFails) throw new Error('extraction failed');
      return extractedText;
    },
  };
  const semanticMatcher = {
    async compare() {
      if (analysisFails) throw new Error('analysis failed');
      return {
        score: 84.5,
        semanticScore: 82,
        skillScore: 75,
        matchedSkills: ['React', 'JavaScript', 'SQL'],
        missingSkills: ['PostgreSQL'],
        model: 'test-model',
        scoringVersion: 'hybrid-v1',
      };
    },
  };
  const app = createApp({
    databasePool: { query: async () => ({ rows: [{ database_time: new Date() }] }) },
    sessionMiddleware: session({ secret: 'application-test-secret', resave: false, saveUninitialized: false }),
    userService,
    profileService: {},
    jobOfferService: {},
    applicationService,
    cvStorage,
    pdfTextExtractor,
    semanticMatcher,
    analysisJobService,
    auditService,
    notificationService: notificationService || {
      async notifyCandidate(data) {
        notifications.push(data);
        return data;
      },
    },
  });
  const server = app.listen(0);

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    server,
    applications,
    storedFiles,
    removedFiles,
    applicationService,
    notifications,
  };
}

async function login(baseUrl, email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Candidat123' }),
  });
  return response.headers.get('set-cookie').split(';')[0];
}

function applicationForm({ jobOfferId = '7', content = '%PDF-1.4\nCV de test', type = 'application/pdf' } = {}) {
  const form = new FormData();
  form.set('jobOfferId', jobOfferId);
  form.set('consent', 'true');
  form.set('cv', new Blob([content], { type }), 'cv-test.pdf');
  return form;
}

test('le dépôt d’une candidature exige une session candidat', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());

  const anonymousResponse = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    body: applicationForm(),
  });
  assert.equal(anonymousResponse.status, 401);

  const hrCookie = await login(baseUrl, 'hr-application@example.com');
  const hrResponse = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: hrCookie },
    body: applicationForm(),
  });
  assert.equal(hrResponse.status, 403);
});

test('un candidat postule à une offre publiée avec un PDF valide', async (context) => {
  const { baseUrl, server, applications, storedFiles } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'candidate-application@example.com');

  const response = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: applicationForm(),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.application.status, 'submitted');
  assert.equal('cvExtractionStatus' in body.application, false);
  assert.equal('cvSkills' in body.application, false);
  assert.equal('aiStatus' in body.application, false);
  assert.equal(applications[0].candidate_user_id, 41);
  assert.match(applications[0].cv_text, /JavaScript SQL/);
  assert.deepEqual(applications[0].cv_skills, ['React', 'JavaScript', 'SQL']);
  assert.equal(applications[0].ai_status, 'completed');
  assert.equal(applications[0].semantic_score, 84.5);
  assert.equal(applications[0].semantic_component, 82);
  assert.equal(applications[0].final_score, 84.5);
  assert.equal(applications[0].skill_component, 75);
  assert.equal(applications[0].scoring_version, 'hybrid-v1');
  assert.deepEqual(applications[0].missing_skills, ['PostgreSQL']);
  assert.equal(storedFiles.length, 1);
});

test('un echec d extraction du texte ne bloque pas la candidature', async (context) => {
  const { baseUrl, server, applications } = await startApp({ extractionFails: true });
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'candidate-application@example.com');

  const response = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: applicationForm(),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal('cvExtractionStatus' in body.application, false);
  assert.equal('cvSkills' in body.application, false);
  assert.equal(applications[0].cv_text, '');
  assert.equal(applications[0].ai_status, 'unavailable');
});

test('un echec du modele IA ne bloque pas la candidature', async (context) => {
  const { baseUrl, server, applications, storedFiles } = await startApp({ analysisFails: true });
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'candidate-application@example.com');

  const response = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: applicationForm(),
  });

  assert.equal(response.status, 201);
  assert.equal(applications[0].ai_status, 'failed');
  assert.equal(storedFiles.length, 1);
});

test('un faux PDF et une offre indisponible sont refusés', async (context) => {
  const { baseUrl, server, storedFiles } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'candidate-application@example.com');

  const invalidPdfResponse = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: applicationForm({ content: 'pas un PDF' }),
  });
  assert.equal(invalidPdfResponse.status, 400);

  const unavailableResponse = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: applicationForm({ jobOfferId: '99' }),
  });
  assert.equal(unavailableResponse.status, 404);
  assert.equal(storedFiles.length, 0);
});

test('une candidature en double est refusée et le nouveau fichier est supprimé', async (context) => {
  const { baseUrl, server, storedFiles, removedFiles } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'candidate-application@example.com');

  await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: applicationForm(),
  });
  const duplicateResponse = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: applicationForm(),
  });

  assert.equal(duplicateResponse.status, 409);
  assert.equal(storedFiles.length, 2);
  assert.deepEqual(removedFiles, ['cv-2.pdf']);
});

test('un CV dépassant 5 Mo est refusé', async (context) => {
  const { baseUrl, server, storedFiles } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'candidate-application@example.com');
  const oversizedPdf = `%PDF-${'0'.repeat(5 * 1024 * 1024)}`;

  const response = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: applicationForm({ content: oversizedPdf }),
  });

  assert.equal(response.status, 400);
  assert.equal(storedFiles.length, 0);
});

test('le candidat consulte uniquement ses candidatures', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const candidateCookie = await login(baseUrl, 'candidate-application@example.com');
  const hrCookie = await login(baseUrl, 'hr-application@example.com');

  await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: candidateCookie },
    body: applicationForm(),
  });

  const response = await fetch(`${baseUrl}/api/applications`, {
    headers: { Cookie: candidateCookie },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.applications.length, 1);
  assert.equal(body.applications[0].offer.title, 'Développeur React');
  assert.equal(body.applications[0].offer.companyName, 'Bee Coders');
  assert.equal(body.applications[0].interview.durationMinutes, 45);
  assert.equal(body.applications[0].interview.meetingType, 'video');
  assert.equal(body.applications[0].interview.details, 'https://meet.example.test/candidat');
  assert.equal('aiStatus' in body.applications[0], false);
  assert.equal('cvExtractionStatus' in body.applications[0], false);
  assert.equal('cvSkills' in body.applications[0], false);
  assert.equal('evaluationScore' in body.applications[0].interview, false);
  assert.equal('evaluationNotes' in body.applications[0].interview, false);

  const hrResponse = await fetch(`${baseUrl}/api/applications`, {
    headers: { Cookie: hrCookie },
  });
  assert.equal(hrResponse.status, 403);
});

test('le RH consulte les candidatures reçues et télécharge leur CV', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const candidateCookie = await login(baseUrl, 'candidate-application@example.com');
  const hrCookie = await login(baseUrl, 'hr-application@example.com');
  await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: candidateCookie },
    body: applicationForm(),
  });

  const response = await fetch(`${baseUrl}/api/applications/hr`, { headers: { Cookie: hrCookie } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.applications[0].candidate.email, 'candidate-application@example.com');
  assert.equal(body.applications[0].aiStatus, 'completed');
  assert.equal(body.applications[0].semanticScore, 82);
  assert.equal(body.applications[0].finalScore, 84.5);
  assert.deepEqual(body.applications[0].matchedSkills, ['React', 'JavaScript', 'SQL']);
  assert.equal(body.applications[0].offer.title, 'Développeur React');
  assert.deepEqual(body.matchingSummary, { all: 1, zero: 0, low: 0, aligned: 1, unavailable: 0 });

  const invalidFilterResponse = await fetch(`${baseUrl}/api/applications/hr?matchBand=invalid`, { headers: { Cookie: hrCookie } });
  assert.equal(invalidFilterResponse.status, 400);

  const cvResponse = await fetch(`${baseUrl}/api/applications/1/cv`, { headers: { Cookie: hrCookie } });
  assert.equal(cvResponse.status, 200);
  assert.equal(cvResponse.headers.get('content-type'), 'application/pdf');
  assert.match(cvResponse.headers.get('content-disposition'), /cv-test\.pdf/);
  assert.match(await cvResponse.text(), /^%PDF-/);
});

test('le RH modifie le statut et le candidat ne peut pas le faire', async (context) => {
  const { baseUrl, server, notifications } = await startApp();
  context.after(() => server.close());
  const candidateCookie = await login(baseUrl, 'candidate-application@example.com');
  const hrCookie = await login(baseUrl, 'hr-application@example.com');
  await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: candidateCookie },
    body: applicationForm(),
  });

  const response = await fetch(`${baseUrl}/api/applications/1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hrCookie },
    body: JSON.stringify({ status: 'shortlisted' }),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.application.status, 'shortlisted');
  assert.deepEqual(
    notifications.map((notification) => notification.type),
    ['application_submitted', 'application_shortlisted'],
  );

  const candidateResponse = await fetch(`${baseUrl}/api/applications/1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: candidateCookie },
    body: JSON.stringify({ status: 'rejected' }),
  });
  assert.equal(candidateResponse.status, 403);

  const invalidResponse = await fetch(`${baseUrl}/api/applications/1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hrCookie },
    body: JSON.stringify({ status: 'invalid' }),
  });
  assert.equal(invalidResponse.status, 400);
});

test('seul le RH consulte le statut technique de l’analyse', async (context) => {
  const { baseUrl, server } = await startApp();
  context.after(() => server.close());
  const candidateCookie = await login(baseUrl, 'candidate-application@example.com');
  const hrCookie = await login(baseUrl, 'hr-application@example.com');

  await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: candidateCookie },
    body: applicationForm(),
  });

  const candidateResponse = await fetch(`${baseUrl}/api/applications/1/analysis-status`, {
    headers: { Cookie: candidateCookie },
  });
  assert.equal(candidateResponse.status, 403);

  const hrResponse = await fetch(`${baseUrl}/api/applications/1/analysis-status`, {
    headers: { Cookie: hrCookie },
  });
  assert.equal(hrResponse.status, 200);
});

test('le dépôt crée un job puis le worker sauvegarde tous les scores', async (context) => {
  const jobs = [];
  const jobService = {
    async enqueue(applicationId) {
      const job = { id: 1, application_id: applicationId, attempts: 1 };
      jobs.push(job);
      return job;
    },
    async enqueueMissing() {},
    async recoverStaleProcessing() {},
    async claimNext() {
      return jobs.shift() || null;
    },
    async updateStatus(data) {
      return { ...data, status: data.status };
    },
  };
  const { baseUrl, server, applications, applicationService } = await startApp({ analysisJobService: jobService });
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'candidate-application@example.com');

  const response = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: applicationForm(),
  });
  assert.equal(response.status, 201);
  assert.equal(applications[0].ai_status, 'pending');
  assert.equal(jobs.length, 1);

  const worker = createAiAnalysisWorker({
    jobService,
    async analyze(job) {
      const input = await applicationService.findAnalysisInput(job.application_id);
      await applicationService.saveAnalysis({
        id: input.applicationId,
        aiStatus: 'completed',
        score: 79.55,
        semanticScore: 82,
        skillScore: 75,
        matchedSkills: ['React', 'JavaScript'],
        missingSkills: ['PostgreSQL'],
        model: 'test-model',
        scoringVersion: 'hybrid-v1',
      });
    },
  });

  await worker.processNext();
  assert.equal(applications[0].ai_status, 'completed');
  assert.equal(applications[0].semantic_score, 79.55);
  assert.equal(applications[0].semantic_component, 82);
  assert.equal(applications[0].final_score, 79.55);
  assert.equal(applications[0].skill_component, 75);
  assert.equal(applications[0].scoring_version, 'hybrid-v1');
  assert.deepEqual(applications[0].matched_skills, ['React', 'JavaScript']);
});

test('un candidat peut supprimer sa candidature et son CV quel que soit le statut', async (context) => {
  const { baseUrl, server, applications, removedFiles } = await startApp();
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'candidate-application@example.com');

  await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: applicationForm(),
  });
  applications[0].status = 'rejected';

  const response = await fetch(`${baseUrl}/api/applications/1`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 200);
  assert.equal(applications.length, 0);
  assert.deepEqual(removedFiles, ['cv-1.pdf']);
});

test('une panne de file ou d audit ne bloque pas le dépôt de candidature', async (context) => {
  context.mock.method(console, 'error', () => {});
  const { baseUrl, server, applications } = await startApp({
    analysisJobService: {
      async enqueue() { throw new Error('QUEUE_UNAVAILABLE'); },
    },
    auditService: {
      async record() { throw new Error('AUDIT_UNAVAILABLE'); },
    },
  });
  context.after(() => server.close());
  const cookie = await login(baseUrl, 'candidate-application@example.com');

  const response = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: applicationForm(),
  });

  assert.equal(response.status, 201);
  assert.equal(applications[0].ai_status, 'pending');
});
