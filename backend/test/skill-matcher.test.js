import assert from 'node:assert/strict';
import test from 'node:test';
import { createSkillMatcher } from '../src/services/skill-matcher.service.js';

test('le matching par competences calcule un score explicable', async () => {
  const matcher = createSkillMatcher();
  const result = await matcher.compare({
    cvSkills: ['React', 'JavaScript'],
    offer: { skills: ['React', 'JavaScript', 'Docker'] },
  });

  assert.equal(result.score, 66.67);
  assert.deepEqual(result.matchedSkills, ['React', 'JavaScript']);
  assert.deepEqual(result.missingSkills, ['Docker']);
});
