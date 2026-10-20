import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { auditBenchmark, buildReviewPacket, applyHumanReview } from '../src/evaluation/benchmark-protocol.js';

const original = JSON.parse(readFileSync(new URL('../data/ai-benchmark-dataset.json', import.meta.url), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const fingerprint = 'fixture-only-fingerprint';
function completedFixture() {
  // Artificial labels exercise validation only; never saved as human judgments.
  const packet = buildReviewPacket(original, fingerprint);
  packet.reviewer = 'unit-test-fixture';
  packet.reviewedAt = '2026-10-20T00:00:00Z';
  packet.judgments.forEach((row, index) => {
    row.relevance = index % 3 === 0 ? 3 : 0;
    row.reason = 'Artificial unit-test fixture, not a human annotation.';
  });
  return packet;
}
test('corpus : 24 offres, 72 CV et 600 couples séparés', () => {
  assert.deepEqual(auditBenchmark(original).counts, {
    train: { offers: 10, candidates: 30, pairs: 300 },
    validation: { offers: 6, candidates: 18, pairs: 108 },
    test: { offers: 8, candidates: 24, pairs: 192 },
  });
});
test('un CV dupliqué sous un autre identifiant est rejeté', () => {
  const data = clone(original);
  data.candidates.find((row) => row.split === 'test').text = data.candidates[0].text;
  assert.throws(() => auditBenchmark(data), /DUPLICATE_CV_TEXT/);
});
test('une offre copiée entre jeux est rejetée', () => {
  const data = clone(original);
  Object.assign(data.offers.find((row) => row.split === 'test'), {
    title: data.offers[0].title, description: data.offers[0].description, requirements: data.offers[0].requirements,
  });
  assert.throws(() => auditBenchmark(data), /DUPLICATE_OFFER_TEXT/);
});
test('un couple entre deux jeux est rejeté', () => {
  const data = clone(original);
  data.judgments[0].candidateId = data.candidates.find((row) => row.split === 'test').id;
  assert.throws(() => auditBenchmark(data), /CROSS_SPLIT_PAIR/);
});
test('une annotation absente ne devient jamais un négatif', () => {
  const data = clone(original);
  data.judgments.pop();
  assert.throws(() => auditBenchmark(data), /PAIR_MISSING/);
  const missingGrade = clone(original);
  delete missingGrade.judgments[0].relevance;
  assert.throws(() => auditBenchmark(missingGrade), /LABEL_INVALID/);
});
test('les doublons de couples sont rejetés', () => {
  const data = clone(original);
  data.judgments.push(data.judgments[0]);
  assert.throws(() => auditBenchmark(data), /DUPLICATE_PAIR/);
});
test('le paquet humain est sans prédictions et sans notes préremplies', () => {
  const packet = buildReviewPacket(original, fingerprint);
  assert.equal(packet.judgments.length, 192);
  assert.ok(packet.judgments.every((row) => row.relevance === null && row.reason === ''));
  assert.ok(!JSON.stringify(packet).includes('"score"'));
  assert.throws(() => applyHumanReview(original, packet, fingerprint), /REVIEWER_REQUIRED/);
});
test('les annotations sont liées à une version exacte du corpus', () => {
  assert.throws(() => applyHumanReview(original, completedFixture(), 'different'), /DATASET_MISMATCH/);
});
test('une seule note ou justification manquante bloque le test', () => {
  const packet = completedFixture();
  packet.judgments[0].relevance = null;
  assert.throws(() => applyHumanReview(original, packet, fingerprint), /REVIEW_INCOMPLETE/);
  packet.judgments[0].relevance = 3;
  packet.judgments[0].reason = ' ';
  assert.throws(() => applyHumanReview(original, packet, fingerprint), /REVIEW_REASON_REQUIRED/);
});
test('une note hors grille ou un couple inconnu bloque le test', () => {
  const packet = completedFixture();
  packet.judgments[0].relevance = 4;
  assert.throws(() => applyHumanReview(original, packet, fingerprint), /REVIEW_INCOMPLETE/);
  packet.judgments[0].relevance = 3;
  packet.judgments[0].candidateId = 'unknown';
  assert.throws(() => applyHumanReview(original, packet, fingerprint), /REVIEW_PAIR_INVALID/);
});
test('un jeu de test entièrement hors sujet est signalé', () => {
  const packet = completedFixture();
  packet.judgments.forEach((row) => { row.relevance = 0; });
  assert.throws(() => applyHumanReview(original, packet, fingerprint), /TEST_NO_LABEL_CONTRAST/);
});
test('une revue complète est appliquée sans modifier le corpus source', () => {
  const labels = applyHumanReview(original, completedFixture(), fingerprint);
  assert.equal(labels.filter((row) => row.source === 'human-review').length, 192);
  assert.equal(original.judgments.filter((row) => row.relevance === null).length, 192);
});
