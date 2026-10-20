import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRankingFeatures } from '../src/services/ai-ranking-features.service.js';
import { createLearnedRanker } from '../src/services/learned-ranker.service.js';
import { trainPairwiseRanker } from '../src/services/pairwise-ranker-training.service.js';
import { evaluateRankingSamples } from '../src/services/ranking-evaluation.service.js';
import { createRecruitmentMatcher } from '../src/services/recruitment-matcher.service.js';

const featureNames = [
  'semanticSimilarity',
  'requiredSkillCoverage',
  'relatedSkillCoverage',
  'titleAlignment',
  'skillSpecificity',
];

test('les caractéristiques de ranking restent explicables', () => {
  const features = buildRankingFeatures({
    cvText: 'Développeur React et TypeScript spécialisé frontend.',
    cvSkills: ['React', 'TypeScript'],
    offer: {
      title: 'Développeur frontend React',
      skills: ['React', 'TypeScript', 'Docker'],
    },
    semanticScore: 84,
  });

  assert.deepEqual(features.names, featureNames);
  assert.equal(features.values.semanticSimilarity, 0.84);
  assert.equal(features.values.requiredSkillCoverage, 2 / 3);
  assert.deepEqual(features.matchedSkills, ['React', 'TypeScript']);
  assert.deepEqual(features.missingSkills, ['Docker']);
});

test('le ranker pairwise apprend à placer le profil pertinent en premier', () => {
  const samples = [
    { offerId: 'one', candidateId: 'best', relevance: 3, baselineScore: 0.9, features: [0.9, 1, 1, 1, 1] },
    { offerId: 'one', candidateId: 'middle', relevance: 2, baselineScore: 0.8, features: [0.8, 0.6, 0.7, 0.5, 0.6] },
    { offerId: 'one', candidateId: 'wrong', relevance: 0, baselineScore: 0.85, features: [0.85, 0, 0.2, 0, 0] },
    { offerId: 'two', candidateId: 'best-two', relevance: 3, baselineScore: 0.88, features: [0.88, 1, 1, 0.8, 1] },
    { offerId: 'two', candidateId: 'wrong-two', relevance: 0, baselineScore: 0.82, features: [0.82, 0.1, 0.2, 0, 0.1] },
  ];
  const artifact = trainPairwiseRanker(samples, { epochs: 300 });
  const ranker = createLearnedRanker({ artifact });
  const predict = (sample) => ranker.predict({
    vector: sample.features,
    values: Object.fromEntries(featureNames.map((name, index) => [name, sample.features[index]])),
  });
  const score = (sample) => predict(sample).score;

  assert.ok(score(samples[0]) > score(samples[2]));
  assert.ok(score(samples[3]) > score(samples[4]));
  assert.equal(predict(samples[0]).confidence, undefined);
  assert.equal(artifact.training.hardNegativePairCount, 3);
  assert.ok(artifact.weights.some((weight) => Math.abs(weight) > 0.01));
  assert.ok(artifact.weights.every((weight) => weight >= 0));
  assert.equal(artifact.constraints.nonNegativeWeights, true);
});

test('le matching V2 combine le modèle sémantique, le ranker et les preuves', async () => {
  const matcher = createRecruitmentMatcher({
    semanticMatcher: {
      async compare() {
        return {
          score: 75,
          semanticScore: 80,
          skillScore: 66,
          model: 'encoder-test',
          matchedSkills: ['React'],
          missingSkills: ['Docker'],
        };
      },
    },
    ranker: {
      version: 'ranker-test',
      predict(featureSet) {
        return {
          score: 87,
          contributions: featureSet.names.map((name) => ({
            name,
            label: name,
            value: featureSet.values[name],
            contribution: 1,
          })),
        };
      },
    },
  });

  const result = await matcher.compare({
    cvText: 'Développement de plusieurs interfaces React.',
    cvSkills: ['React'],
    offer: { title: 'Développeur React', skills: ['React', 'Docker'] },
  });

  assert.equal(result.score, 87);
  assert.equal(result.confidence, null);
  assert.equal(result.scoringVersion, 'ranker-test');
  assert.equal(result.model, 'encoder-test+ranker-test');
  assert.equal(result.explanation.status, 'high');
  assert.equal(result.explanation.factors[0].effect, 'positive');
  assert.equal(result.explanation.evidence[0].criterion, 'React');
});

test('l évaluation de ranking calcule NDCG, MRR et Recall@5', () => {
  const samples = [
    { offerId: 'one', candidateId: 'a', relevance: 3, score: 0.9 },
    { offerId: 'one', candidateId: 'b', relevance: 2, score: 0.8 },
    { offerId: 'one', candidateId: 'c', relevance: 0, score: 0.1 },
  ];
  const metrics = evaluateRankingSamples(samples, (sample) => sample.score);

  assert.equal(metrics.top1Accuracy, 100);
  assert.equal(metrics.meanReciprocalRank, 1);
  assert.equal(metrics.recallAt5, 1);
  assert.equal(metrics.ndcgAt5, 1);
});
