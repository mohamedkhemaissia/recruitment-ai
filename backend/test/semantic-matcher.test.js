import assert from 'node:assert/strict';
import test from 'node:test';
import { createSemanticMatcher, sanitizeForMatching } from '../src/services/semantic-matcher.service.js';

test('les informations personnelles sensibles sont exclues du texte compare', () => {
  const sanitized = sanitizeForMatching(`
    Sami Ben Ali
    sami@example.com
    +216 22 333 444
    Nationalite : tunisienne
    Date de naissance : 10/10/1998
    Developpeur React et Node.js
  `);

  assert.doesNotMatch(sanitized, /example\.com|216|Nationalite|naissance/i);
  assert.match(sanitized, /Developpeur React et Node\.js/);
});

test('le score provient de la similarite des embeddings et les competences restent explicables', async () => {
  const matcher = createSemanticMatcher({
    model: 'test-model',
    revision: 'test-revision',
    pipelineFactory: () => async () => ({
      tolist: () => [
        [1, 0],
        [0.82, Math.sqrt(1 - (0.82 ** 2))],
      ],
    }),
  });

  const result = await matcher.compare({
    cvText: 'Developpeur React, JavaScript et SQL.',
    cvSkills: ['React', 'JavaScript', 'SQL'],
    offer: {
      title: 'Developpeur full stack',
      description: 'Developper une application web.',
      requirements: 'React, JavaScript, PostgreSQL et SQL.',
      skills: ['React', 'JavaScript', 'PostgreSQL', 'SQL'],
    },
  });

  assert.equal(result.score, 79.55);
  assert.equal(result.semanticScore, 82);
  assert.equal(result.skillScore, 75);
  assert.equal(result.semanticContribution, 53.3);
  assert.equal(result.skillContribution, 26.25);
  assert.equal(result.scoringVersion, 'hybrid-v1');
  assert.deepEqual(result.matchedSkills, ['React', 'JavaScript', 'SQL']);
  assert.deepEqual(result.missingSkills, ['PostgreSQL']);
  assert.equal(result.model, 'test-model@test-revision');
});

test('les informations sensibles de l offre ne sont pas envoyées au modèle', async () => {
  let receivedInputs;
  const matcher = createSemanticMatcher({
    pipelineFactory: () => async (inputs) => {
      receivedInputs = inputs;
      return { tolist: () => [[1, 0], [1, 0]] };
    },
  });

  await matcher.compare({
    cvText: 'Développeur React',
    cvSkills: ['React'],
    offer: {
      title: 'Développeur React',
      description: 'Créer une interface web.',
      requirements: 'React\nAge : moins de 30 ans\nNationalité : tunisienne',
      skills: ['React'],
    },
  });

  assert.doesNotMatch(receivedInputs[0], /moins de 30|tunisienne|nationalit/i);
  assert.match(receivedInputs[0], /React/);
});
