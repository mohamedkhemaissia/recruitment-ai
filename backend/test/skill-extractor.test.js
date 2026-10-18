import assert from 'node:assert/strict';
import test from 'node:test';
import { createSkillExtractor } from '../src/services/skill-extractor.service.js';

const extractor = createSkillExtractor();

test('les competences et leurs variantes sont normalisees sans doublon', () => {
  const skills = extractor.extract(`
    Developpement React.js et React, NodeJS, API REST et PostgreSQL.
    Travail en equipe dans un environnement Agile/Scrum.
  `);

  assert.deepEqual(skills, [
    'React',
    'Node.js',
    'PostgreSQL',
    'API REST',
    'Agile',
    'Scrum',
    'Travail en \u00e9quipe',
  ]);
});

test('les noms contenant une competence ne creent pas de faux positif', () => {
  assert.deepEqual(extractor.extract('Experience avec JavaScript et PostgreSQL.'), [
    'JavaScript',
    'PostgreSQL',
  ]);
});
