import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { datasetFingerprints, matchesDatasetFingerprint } from '../src/evaluation/benchmark-fingerprint.js';
import { applyReview } from '../src/evaluation/benchmark-protocol.js';

const raw = readFileSync(new URL('../data/ai-benchmark-dataset.json', import.meta.url), 'utf8');
const lf = raw.replace(/\r\n/gu, '\n');
const crlf = lf.replace(/\n/gu, '\r\n');
const sha = (text) => createHash('sha256').update(text).digest('hex');
const review = JSON.parse(readFileSync(new URL('../src/evaluation/ai-benchmark-review-assisted.json', import.meta.url), 'utf8'));

test('les fichiers LF et CRLF ont la même identité JSON', () => {
  assert.notEqual(sha(lf), sha(crlf));
  assert.equal(datasetFingerprints(lf).canonical, datasetFingerprints(crlf).canonical);
});
test('indentation, BOM et ordre des clés ne changent pas le corpus', () => {
  const data = JSON.parse(raw);
  const reordered = Object.fromEntries(Object.entries(data).reverse());
  const text = '\uFEFF' + JSON.stringify(reordered, null, 4);
  assert.equal(datasetFingerprints(raw).canonical, datasetFingerprints(text).canonical);
});
test('un changement réel du texte du CV reste détecté', () => {
  const data = JSON.parse(raw);
  data.candidates[0].text += ' Compétence ajoutée.';
  assert.notEqual(datasetFingerprints(raw).canonical, datasetFingerprints(JSON.stringify(data)).canonical);
});
test('l ordre des tableaux reste protégé', () => {
  const data = JSON.parse(raw);
  data.candidates.reverse();
  assert.notEqual(datasetFingerprints(raw).canonical, datasetFingerprints(JSON.stringify(data)).canonical);
});
test('les anciennes empreintes de modèles Windows et Linux sont reconnues', () => {
  for (const text of [lf, crlf]) {
    const binding = datasetFingerprints(text);
    assert.ok(matchesDatasetFingerprint(binding, sha(lf)));
    assert.ok(matchesDatasetFingerprint(binding, sha(crlf)));
  }
});
test('un ancien modèle associé à un autre corpus reste refusé', () => {
  const data = JSON.parse(raw);
  data.offers[0].requirements += ' Compétence supplémentaire.';
  const binding = datasetFingerprints(JSON.stringify(data));
  assert.ok(!matchesDatasetFingerprint(binding, sha(lf)));
  assert.ok(!matchesDatasetFingerprint(binding, sha(crlf)));
  assert.ok(!matchesDatasetFingerprint(binding, review.datasetFingerprint));
});
test('les 192 annotations fournies fonctionnent avec un checkout Windows', () => {
  const binding = datasetFingerprints(crlf);
  assert.ok(matchesDatasetFingerprint(binding, review.datasetFingerprint));
  const labels = applyReview(binding.dataset, review, binding.canonical);
  assert.equal(labels.filter((row) => row.source === 'ai-assisted-review').length, 192);
});
test('une ancienne revue peut être réassociée après vérification de son empreinte LF/CRLF', () => {
  const binding = datasetFingerprints(crlf);
  const oldReview = { ...review, datasetFingerprint: sha(lf) };
  assert.ok(matchesDatasetFingerprint(binding, oldReview.datasetFingerprint));
  const labels = applyReview(binding.dataset, { ...oldReview, datasetFingerprint: binding.canonical }, binding.canonical);
  assert.equal(labels.filter((row) => row.source === 'ai-assisted-review').length, 192);
});
test('une empreinte inconnue ou manquante reste refusée', () => {
  const binding = datasetFingerprints(raw);
  for (const value of [undefined, null, '', 'incorrect']) assert.ok(!matchesDatasetFingerprint(binding, value));
});
