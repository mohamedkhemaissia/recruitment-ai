import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildRankingFeatures } from '../services/ai-ranking-features.service.js';
import { evaluateRankingSamples } from '../services/ranking-evaluation.service.js';
import { scoreWithArtifact, trainPairwiseRanker } from '../services/pairwise-ranker-training.service.js';
import { createSemanticMatcher } from '../services/semantic-matcher.service.js';
import { createSkillExtractor } from '../services/skill-extractor.service.js';
import { createSkillTaxonomy } from '../services/skill-taxonomy.service.js';

const artifactUrl = new URL('../ai/models/recruitment-ranker-v2.json', import.meta.url);
const reportUrl = new URL('../../data/ai-ranking-report.json', import.meta.url);
const datasetUrl = new URL('../../data/ai-evaluation-dataset.json', import.meta.url);

function splitForOffer(index) {
  if (index < 7) return 'train';
  if (index === 7) return 'validation';
  return 'test';
}

function baselineScoreForFeatures(featureSet) {
  const semanticScore = featureSet.values.semanticSimilarity * 100;
  const skillScore = featureSet.values.requiredSkillCoverage * 100;
  return Math.round(((semanticScore * 0.65) + (skillScore * 0.35)) * 100) / 100;
}

async function buildSamples({ offers, candidates, judgments }) {
  const semanticMatcher = createSemanticMatcher();
  const skillExtractor = createSkillExtractor();
  const taxonomy = createSkillTaxonomy();
  const relevanceByPair = new Map(judgments.map((judgment) => [
    `${judgment.offerId}:${judgment.candidateId}`,
    judgment.relevance,
  ]));
  const samples = [];

  for (const [offerIndex, rawOffer] of offers.entries()) {
    const offer = {
      ...rawOffer,
      skills: skillExtractor.extract(`${rawOffer.title}\n${rawOffer.description}\n${rawOffer.requirements}`),
    };
    const offerSamples = await Promise.all(candidates.map(async (candidate) => {
      const cvSkills = skillExtractor.extract(candidate.text);
      const semantic = await semanticMatcher.compare({ cvText: candidate.text, cvSkills, offer });
      const featureSet = buildRankingFeatures({
        cvText: candidate.text,
        cvSkills,
        offer,
        semanticScore: semantic.semanticScore,
        taxonomy,
      });
      return {
        offerId: offer.id,
        candidateId: candidate.id,
        relevance: relevanceByPair.get(`${offer.id}:${candidate.id}`) || 0,
        split: splitForOffer(offerIndex),
        features: featureSet.vector,
        baselineScore: baselineScoreForFeatures(featureSet),
      };
    }));
    samples.push(...offerSamples);
    process.stdout.write(`Caractéristiques calculées pour ${offer.title}.\n`);
  }
  return samples;
}

function metricsForSplit(samples, artifact, split) {
  const selected = samples.filter((sample) => sample.split === split);
  return {
    baseline: evaluateRankingSamples(selected, (sample) => sample.baselineScore),
    learnedRanker: evaluateRankingSamples(selected, (sample) => (
      scoreWithArtifact(sample.features, artifact).probability
    )),
  };
}

function ablationStudy(samples) {
  return Object.fromEntries(samples[0].features.map((_, removedIndex) => {
    const modified = samples.map((sample) => ({
      ...sample,
      features: sample.features.map((value, index) => (index === removedIndex ? 0 : value)),
    }));
    const artifact = trainPairwiseRanker(modified.filter((sample) => sample.split === 'train'));
    const metrics = metricsForSplit(modified, artifact, 'test').learnedRanker;
    return [artifact.featureNames[removedIndex], {
      top1Accuracy: metrics.top1Accuracy,
      meanReciprocalRank: metrics.meanReciprocalRank,
      recallAt5: metrics.recallAt5,
      ndcgAt5: metrics.ndcgAt5,
    }];
  }));
}

async function main() {
  const dataset = JSON.parse(await readFile(datasetUrl, 'utf8'));
  if (
    dataset.version !== 2
    || !Array.isArray(dataset.offers)
    || !Array.isArray(dataset.candidates)
    || !Array.isArray(dataset.judgments)
  ) {
    throw new Error('RANKER_DATASET_INVALID');
  }
  const samples = await buildSamples({
    offers: dataset.offers,
    candidates: dataset.candidates,
    judgments: dataset.judgments,
  });
  const trainingSamples = samples.filter((sample) => sample.split === 'train');
  const artifact = trainPairwiseRanker(trainingSamples);
  artifact.baseEncoder = 'onnx-community/paraphrase-multilingual-MiniLM-L12-v2-ONNX';
  artifact.datasetVersion = 2;
  artifact.split = {
    trainOfferIds: dataset.offers.slice(0, 7).map(({ id }) => id),
    validationOfferIds: dataset.offers.slice(7, 8).map(({ id }) => id),
    testOfferIds: dataset.offers.slice(8).map(({ id }) => id),
  };
  const detailedMetrics = {
    train: metricsForSplit(samples, artifact, 'train'),
    validation: metricsForSplit(samples, artifact, 'validation'),
    test: metricsForSplit(samples, artifact, 'test'),
  };
  const ablations = ablationStudy(samples);
  artifact.metrics = Object.fromEntries(Object.entries(detailedMetrics).map(([split, evaluations]) => [
    split,
    Object.fromEntries(Object.entries(evaluations).map(([name, metrics]) => [name, {
      top1Accuracy: metrics.top1Accuracy,
      meanReciprocalRank: metrics.meanReciprocalRank,
      recallAt5: metrics.recallAt5,
      ndcgAt5: metrics.ndcgAt5,
    }])),
  ]));
  const test = artifact.metrics.test;
  if (
    test.learnedRanker.top1Accuracy < 90
    || test.learnedRanker.ndcgAt5 < test.baseline.ndcgAt5
    || test.learnedRanker.recallAt5 < test.baseline.recallAt5
  ) {
    throw new Error('RANKER_HELD_OUT_REGRESSION');
  }

  await mkdir(new URL('../ai/models/', import.meta.url), { recursive: true });
  await mkdir(new URL('../../data/', import.meta.url), { recursive: true });
  await writeFile(fileURLToPath(artifactUrl), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  await writeFile(fileURLToPath(reportUrl), `${JSON.stringify({
    generatedAt: 'reproducible',
    datasetVersion: artifact.datasetVersion,
    split: artifact.split,
    metrics: detailedMetrics,
    ablations,
  }, null, 2)}\n`, 'utf8');

  console.log(`\nBaseline test NDCG@5: ${test.baseline.ndcgAt5}`);
  console.log(`Ranker test NDCG@5: ${test.learnedRanker.ndcgAt5}`);
  console.log(`Artefact écrit dans ${fileURLToPath(artifactUrl)}`);
}

main().catch((error) => {
  console.error('Entraînement du ranker impossible :', error);
  process.exitCode = 1;
});
