import assert from 'node:assert/strict';
import test from 'node:test';
import { referenceCandidates, referenceJudgments, referenceOffers } from '../src/evaluation/reference-cases.js';
import { evaluateReferenceSet } from '../src/services/ai-evaluation.service.js';

test('le jeu de référence contient dix offres et trente CV cohérents', () => {
  assert.equal(referenceOffers.length, 10);
  assert.equal(referenceCandidates.length, 30);
  assert.equal(new Set(referenceCandidates.map((candidate) => candidate.id)).size, 30);
  for (const offer of referenceOffers) {
    assert.ok(referenceCandidates.some((candidate) => candidate.id === offer.expectedCandidateId));
  }
  assert.equal(referenceJudgments.length, 300);
  assert.equal(referenceJudgments.filter((judgment) => judgment.relevance === 3).length, 10);
});

test('l evaluation calcule le classement Top-1 et le rang reciproque moyen', async () => {
  const offers = [
    { id: 'frontend', title: 'Frontend', expectedCandidateId: 'front', skills: [] },
    { id: 'data', title: 'Data', expectedCandidateId: 'data', skills: [] },
  ];
  const candidates = [
    { id: 'front', label: 'CV front', text: 'front', skills: [] },
    { id: 'data', label: 'CV data', text: 'data', skills: [] },
  ];
  const scores = {
    'frontend:front': 91,
    'frontend:data': 35,
    'data:front': 42,
    'data:data': 88,
  };
  const matcher = {
    async compare({ cvText, offer }) {
      return { score: scores[`${offer.id}:${cvText}`] };
    },
  };

  const result = await evaluateReferenceSet({ matcher, offers, candidates });

  assert.equal(result.offerCount, 2);
  assert.equal(result.top1Correct, 2);
  assert.equal(result.top1Accuracy, 100);
  assert.equal(result.top3Correct, 2);
  assert.equal(result.top3Accuracy, 100);
  assert.equal(result.meanReciprocalRank, 1);
  assert.equal(result.cases[0].margin, 56);
  assert.equal(result.meanMargin, 51);
});

test('l evaluation gere une offre sans candidat attendu', async () => {
  const matcher = {
    async compare() {
      return { score: 50 };
    },
  };

  const result = await evaluateReferenceSet({
    matcher,
    offers: [{ id: 'offer', title: 'Offre', expectedCandidateId: 'missing', skills: [] }],
    candidates: [{ id: 'candidate', label: 'CV', text: 'cv', skills: [] }],
  });

  assert.equal(result.top1Accuracy, 0);
  assert.equal(result.top3Accuracy, 0);
  assert.equal(result.meanReciprocalRank, 0);
  assert.equal(result.meanMargin, 0);
  assert.equal(result.cases[0].expectedScore, null);
});
