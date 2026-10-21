import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { auditBenchmark, buildReviewPacket, applyReview } from '../evaluation/benchmark-protocol.js';
import { buildRankingFeatures } from '../services/ai-ranking-features.service.js';
import { evaluateRankingSamples } from '../services/ranking-evaluation.service.js';
import { trainPairwiseRanker, scoreWithArtifact } from '../services/pairwise-ranker-training.service.js';
import { createSemanticMatcher } from '../services/semantic-matcher.service.js';
import { createSkillExtractor } from '../services/skill-extractor.service.js';
import { createSkillTaxonomy } from '../services/skill-taxonomy.service.js';

const dataDirectory = new URL('../../data/', import.meta.url);
const datasetUrl = new URL('ai-benchmark-dataset.json', dataDirectory);
const modelUrl = new URL('ai-benchmark-model.json', dataDirectory);
const reviewUrl = new URL('ai-benchmark-review.json', dataDirectory);
const hash = (text) => createHash('sha256').update(text).digest('hex');
const pairKey = (offerId, candidateId) => JSON.stringify([offerId, candidateId]);

async function buildSamples(dataset, judgments, selectedSplits) {
  const matcher = createSemanticMatcher();
  const extractor = createSkillExtractor();
  const taxonomy = createSkillTaxonomy();
  const relevance = new Map(judgments.map((row) => [pairKey(row.offerId, row.candidateId), row.relevance]));
  const samples = [];
  for (const rawOffer of dataset.offers.filter((row) => selectedSplits.includes(row.split))) {
    const offer = { ...rawOffer, skills: extractor.extract([rawOffer.title, rawOffer.description, rawOffer.requirements].join('\n')) };
    // Sequential traversal bounds memory usage; the semantic service caches representations.
    for (const candidate of dataset.candidates.filter((row) => row.split === offer.split)) {
      const cvSkills = extractor.extract(candidate.text);
      const semantic = await matcher.compare({ cvText: candidate.text, cvSkills, offer });
      const featureSet = buildRankingFeatures({ cvText: candidate.text, cvSkills, offer, semanticScore: semantic.semanticScore, taxonomy });
      if (!featureSet.vector.every(Number.isFinite)) throw new Error('BENCHMARK_FEATURES_INVALID');
      const grade = relevance.get(pairKey(offer.id, candidate.id));
      if (!Number.isInteger(grade)) throw new Error('BENCHMARK_LABEL_MISSING');
      samples.push({
        offerId: offer.id,
        candidateId: candidate.id,
        split: offer.split,
        relevance: grade,
        features: featureSet.vector,
        baselineScore: Math.round((0.65 * featureSet.values.semanticSimilarity + 0.35 * featureSet.values.requiredSkillCoverage) * 10000) / 100,
      });
    }
    console.log('Caractéristiques : ' + offer.title);
  }
  return samples;
}

async function main() {
  const phase = process.argv[2];
  if (!['prepare', 'train', 'test'].includes(phase)) throw new Error('Usage: node src/scripts/benchmark-ai.js prepare|train|test [fichier-annotations.json]');
  const rawDataset = await readFile(datasetUrl, 'utf8');
  const dataset = JSON.parse(rawDataset);
  const audit = auditBenchmark(dataset);
  const datasetFingerprint = hash(rawDataset);
  await mkdir(dataDirectory, { recursive: true });

  if (phase === 'prepare') {
    const packet = buildReviewPacket(dataset, datasetFingerprint);
    // Never overwrite annotations already entered.
    await writeFile(reviewUrl, JSON.stringify(packet, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    console.log(JSON.stringify(audit, null, 2));
    console.log('Annotations à remplir : ' + fileURLToPath(reviewUrl));
    return;
  }

  if (phase === 'train') {
    // Test texts and test grades are not used to select the model.
    const samples = await buildSamples(dataset, dataset.judgments, ['train', 'validation']);
    const training = samples.filter((row) => row.split === 'train');
    const validation = samples.filter((row) => row.split === 'validation');
    const experiments = [0.001, 0.002, 0.01].map((regularization) => {
      const artifact = trainPairwiseRanker(training, { regularization });
      return { regularization, artifact, validation: evaluateRankingSamples(validation, (row) => scoreWithArtifact(row.features, artifact).probability) };
    });
    experiments.sort((a, b) => b.validation.ndcgAt5 - a.validation.ndcgAt5 || b.validation.recallAt5 - a.validation.recallAt5 || a.regularization - b.regularization);
    const selected = experiments[0];
    const artifact = {
      ...selected.artifact,
      benchmarkProtocol: dataset.protocol,
      datasetFingerprint,
      baseEncoder: 'onnx-community/paraphrase-multilingual-MiniLM-L12-v2-ONNX',
      split: Object.fromEntries(['train', 'validation', 'test'].map((split) => [split, {
        offerIds: dataset.offers.filter((row) => row.split === split).map((row) => row.id),
        candidateIds: dataset.candidates.filter((row) => row.split === split).map((row) => row.id),
      }])),
      selection: {
        criterion: 'validation NDCG@5, then Recall@5; no test-based acceptance threshold',
        labelSource: 'provisional synthetic validation labels',
        regularization: selected.regularization,
        experiments: experiments.map(({ regularization, validation }) => ({ regularization, validation })),
      },
    };
    await writeFile(modelUrl, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
    console.log('Modèle expérimental écrit ; le modèle de l’application est inchangé.');
    return;
  }

  const rawReview = await readFile(process.argv[3] || reviewUrl, 'utf8');
  const review = JSON.parse(rawReview);
  // Fail before inference if a single judgment or justification is missing.
  const judgments = applyReview(dataset, review, datasetFingerprint);
  const rawArtifact = await readFile(modelUrl, 'utf8');
  const artifact = JSON.parse(rawArtifact);
  if (artifact.datasetFingerprint !== datasetFingerprint || artifact.benchmarkProtocol !== dataset.protocol) throw new Error('BENCHMARK_MODEL_DATASET_MISMATCH');
  for (const split of ['train', 'validation', 'test']) {
    const expected = {
      offerIds: dataset.offers.filter((row) => row.split === split).map((row) => row.id),
      candidateIds: dataset.candidates.filter((row) => row.split === split).map((row) => row.id),
    };
    if (JSON.stringify(artifact.split?.[split]) !== JSON.stringify(expected)) throw new Error('BENCHMARK_MODEL_SPLIT_MISMATCH');
  }
  const samples = await buildSamples(dataset, judgments, ['test']);
  const baseline = evaluateRankingSamples(samples, (row) => row.baselineScore);
  const learnedRanker = evaluateRankingSamples(samples, (row) => scoreWithArtifact(row.features, artifact).probability);
  const baselineCases = new Map(baseline.cases.map((row) => [row.offerId, row]));
  const comparisonByOffer = learnedRanker.cases.map((row) => {
    const previous = baselineCases.get(row.offerId);
    return { offerId: row.offerId, baselineNdcgAt5: previous.ndcgAtK, rankerNdcgAt5: row.ndcgAtK, difference: row.ndcgAtK - previous.ndcgAtK, rankerBestRank: row.bestRank };
  });
  const report = {
    generatedAt: new Date().toISOString(),
    protocol: dataset.protocol,
    datasetFingerprint,
    artifactFingerprint: hash(rawArtifact),
    reviewFingerprint: hash(rawReview),
    annotation: { reviewerType: review.reviewerType, reviewer: review.reviewer, reviewedAt: review.reviewedAt, method: review.method || null, count: samples.length },
    dataProvenance: dataset.provenance,
    counts: audit.counts,
    metrics: { baseline, learnedRanker },
    comparisonByOffer,
    errorsToInspect: comparisonByOffer.filter((row) => row.rankerBestRank > 1 || row.difference < 0),
    limitations: [
      'Synthetic CVs and offers; no claim of production performance.',
      review.reviewerType === 'ai-assisted'
        ? 'AI-generated annotations, not human validation; the assistant also prepared the synthetic corpus. No claim of an independent reference.'
        : 'One human review is not inter-rater agreement or an expert consensus.',
      'Eight test offers give a limited estimate of generalization.',
      'Train and validation labels remain provisional synthetic references.',
      'A lower V2 score is an observed result, not a reason to discard the test.',
    ],
  };
  const directory = new URL('ai-benchmark-runs/', dataDirectory);
  await mkdir(directory, { recursive: true });
  const destination = new URL(Date.now() + '-' + report.artifactFingerprint.slice(0, 12) + '.json', directory);
  await writeFile(destination, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  console.log('Rapport expérimental : ' + fileURLToPath(destination));
  console.log(JSON.stringify({ annotationType: review.reviewerType, baselineNdcgAt5: baseline.ndcgAt5, rankerNdcgAt5: learnedRanker.ndcgAt5, offers: learnedRanker.offerCount }, null, 2));
}

main().catch((error) => {
  console.error(error.code === 'EEXIST' ? 'Le fichier existe déjà : les annotations ou résultats sont conservés.' : error.message);
  process.exitCode = 1;
});
