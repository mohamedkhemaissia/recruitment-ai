import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiAnalysisJobService, maximumAttempts } from '../src/services/ai-analysis-job.service.js';
import { createApplicationService } from '../src/services/application.service.js';
import { createDashboardService } from '../src/services/dashboard.service.js';
import { createInterviewService } from '../src/services/interview.service.js';
import { createJobOfferService } from '../src/services/job-offer.service.js';
import { createProfileService } from '../src/services/profile.service.js';
import { createUserService } from '../src/services/user.service.js';

test('le service candidature conserve les composantes et le score hybride', async () => {
  let parameters;
  const service = createApplicationService({
    async query(_sql, values) {
      parameters = values;
      return { rows: [{ id: 4 }] };
    },
  });

  await service.saveAnalysis({
    id: 4,
    aiStatus: 'completed',
    score: 79.55,
    semanticScore: 82,
    skillScore: 75,
    matchedSkills: ['React'],
    missingSkills: ['SQL'],
    model: 'model-test',
    scoringVersion: 'hybrid-v1',
  });

  assert.deepEqual(parameters, [
    'completed', 79.55, 79.55, 82, 75, '["React"]', '["SQL"]', 'model-test', 'hybrid-v1', 4,
  ]);
});

test('la liste RH applique les filtres, la pagination et le tri IA', async () => {
  const calls = [];
  const service = createApplicationService({
    async query(sql, values) {
      calls.push({ sql, values });
      return calls.length === 1 ? { rows: [{ total: 21 }] } : { rows: [{ id: 8 }] };
    },
  });

  const result = await service.listForHr(12, {
    page: 2,
    limit: 10,
    status: 'shortlisted',
    search: 'React',
    sort: 'score',
  });

  assert.equal(result.total, 21);
  assert.equal(result.page, 2);
  assert.match(calls[1].sql, /final_score DESC NULLS LAST/);
  assert.match(calls[1].sql, /CONCAT_WS/);
  assert.match(calls[1].sql, /LIMIT \$4 OFFSET \$5/);
  assert.deepEqual(calls[1].values, [12, 'shortlisted', '%React%', 10, 10]);
});

test('la suppression d une candidature reste limitée à son propriétaire', async () => {
  let parameters;
  const service = createApplicationService({
    async query(_sql, values) {
      parameters = values;
      return { rows: [{ id: 7, cv_stored_name: 'cv.pdf', status: 'rejected' }] };
    },
  });

  const removed = await service.remove({ id: 7, candidateUserId: 41 });

  assert.deepEqual(parameters, [7, 41]);
  assert.equal(removed.status, 'rejected');
});

test('le tableau de bord utilise le score final dans un classement par offre', async () => {
  const responses = [
    { rows: [{ total_offers: 2, published_offers: 1, total_applications: 3, submitted_applications: 1, reviewed_applications: 0, shortlisted_applications: 1, rejected_applications: 1, analyzed_applications: 2, upcoming_interviews: 1, completed_interviews: 0 }] },
    { rows: [{ id: '2', title: 'React', status: 'published', application_count: 3, shortlisted_count: 1 }] },
    { rows: [{ id: 5, final_score: '91.25', status: 'shortlisted', first_name: 'Sami', last_name: 'Ben Ali', title: 'React' }] },
    { rows: [] },
    { rows: [] },
  ];
  const service = createDashboardService({ query: async () => responses.shift() });

  const dashboard = await service.getForHr(9);

  assert.equal(dashboard.summary.submittedApplications, 1);
  assert.equal(dashboard.selectedOfferId, 2);
  assert.equal(dashboard.ranking[0].score, 91.25);
  assert.equal(dashboard.ranking[0].candidateName, 'Sami Ben Ali');
});

test('la création d offre enregistre sa description et ses compétences', async () => {
  let parameters;
  const service = createJobOfferService({
    async query(_sql, values) {
      parameters = values;
      return { rows: [{ id: 3 }] };
    },
  });

  await service.create({
    hrUserId: 8,
    title: 'Développeur React',
    department: 'Tech',
    location: 'Tunis',
    employmentType: 'full_time',
    workplaceType: 'hybrid',
    description: 'Développer les interfaces du produit.',
    requirements: 'React et JavaScript.',
    skills: ['React', 'JavaScript'],
  });

  assert.equal(parameters[6], 'Développer les interfaces du produit.');
  assert.equal(parameters[8], '["React","JavaScript"]');
});

test('la liste candidat expose seulement les offres publiées', async () => {
  let query;
  let parameters;
  const service = createJobOfferService({
    async query(sql, values) {
      query = sql;
      parameters = values;
      return { rows: [] };
    },
  });

  await service.listForUser({ userId: 17, role: 'candidate' });

  assert.match(query, /o\.status = 'published'/);
  assert.match(query, /EXISTS \(SELECT 1 FROM applications/);
  assert.deepEqual(parameters, [17]);
});

test('une offre ayant des candidatures ne peut pas être supprimée', async () => {
  const service = createJobOfferService({ query: async () => ({ rowCount: 1, rows: [{ exists: 1 }] }) });
  await assert.rejects(() => service.remove({ id: 2, hrUserId: 8 }), { code: 'OFFER_HAS_APPLICATIONS' });
});

test('un entretien est créé uniquement avec le propriétaire RH attendu', async () => {
  let parameters;
  const service = createInterviewService({
    async query(_sql, values) {
      parameters = values;
      return { rows: [{ id: 11 }] };
    },
  });
  const date = new Date('2027-01-10T09:00:00.000Z');

  const interview = await service.create({ applicationId: 4, hrUserId: 8, scheduledAt: date, durationMinutes: 45, meetingType: 'video', details: 'Lien privé' });

  assert.equal(interview.id, 11);
  assert.deepEqual(parameters, [date, 45, 'video', 'Lien privé', 4, 8]);
});

test('la mise à jour du profil candidat est transactionnelle', async () => {
  const statements = [];
  let released = false;
  const client = {
    async query(sql) {
      statements.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
      if (sql.includes('UPDATE users')) return { rows: [{ role: 'candidate' }] };
      return { rows: [] };
    },
    release() { released = true; },
  };
  const service = createProfileService({
    connect: async () => client,
    query: async () => ({ rows: [{ id: 4, role: 'candidate' }] }),
  });

  const profile = await service.update(4, { firstName: 'Sami', lastName: 'Ben Ali', phone: '', location: 'Tunis', professionalTitle: 'Développeur', bio: '' });

  assert.equal(profile.id, 4);
  assert.deepEqual(statements, ['BEGIN', 'UPDATE users SET', 'INSERT INTO candidate_profiles', 'COMMIT']);
  assert.equal(released, true);
});

test('une erreur de profil déclenche un rollback et libère la connexion', async () => {
  const statements = [];
  let released = false;
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes('UPDATE users')) throw new Error('DB_ERROR');
      return { rows: [] };
    },
    release() { released = true; },
  };
  const service = createProfileService({ connect: async () => client });

  await assert.rejects(() => service.update(4, { firstName: 'Sami', lastName: 'Ben Ali' }), /DB_ERROR/);
  assert.ok(statements.includes('ROLLBACK'));
  assert.equal(released, true);
});

test('le service utilisateur ne renvoie aucun compte absent', async () => {
  const service = createUserService({ query: async () => ({ rows: [] }) });
  assert.equal(await service.findByEmail('absent@example.com'), null);
  assert.equal(await service.findPublicById(999), null);
});

test('les erreurs de job IA sont limitées et les tentatives sont bornées', async () => {
  let parameters;
  const service = createAiAnalysisJobService({
    async query(_sql, values) {
      parameters = values;
      return { rows: [{ id: 5, status: 'failed' }] };
    },
  });

  await service.updateStatus({ id: 5, status: 'failed', errorMessage: 'x'.repeat(1200) });

  assert.equal(parameters[1].length, 1000);
  assert.equal(parameters[3], maximumAttempts);
  await assert.rejects(() => service.updateStatus({ id: 5, status: 'unknown' }), /invalide/);
});
