import { rankingFeatureNames } from './ai-ranking-features.service.js';

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function sigmoid(value) {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function canonicalNumber(value, precision = 6) {
  const rounded = Math.round(value * (10 ** precision)) / (10 ** precision);
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizer(samples) {
  const count = samples.length || 1;
  const mean = rankingFeatureNames.map((_, index) => (
    samples.reduce((sum, sample) => sum + sample.features[index], 0) / count
  ));
  const standardDeviation = rankingFeatureNames.map((_, index) => {
    const variance = samples.reduce((sum, sample) => (
      sum + ((sample.features[index] - mean[index]) ** 2)
    ), 0) / count;
    return Math.max(0.05, Math.sqrt(variance));
  });
  return { mean, standardDeviation };
}

function normalize(features, statistics) {
  return features.map((value, index) => (
    (value - statistics.mean[index]) / statistics.standardDeviation[index]
  ));
}

function buildPairs(samples) {
  const byOffer = new Map();
  for (const sample of samples) {
    const group = byOffer.get(sample.offerId) || [];
    group.push(sample);
    byOffer.set(sample.offerId, group);
  }

  const pairs = [];
  for (const group of byOffer.values()) {
    const maximumRelevance = Math.max(...group.map((sample) => sample.relevance));
    const hardNegatives = new Set(group
      .filter((sample) => sample.relevance < maximumRelevance)
      .sort((left, right) => right.baselineScore - left.baselineScore)
      .slice(0, 5));
    for (const preferred of group) {
      for (const other of group) {
        if (preferred.relevance <= other.relevance) continue;
        const hardNegative = preferred.relevance === maximumRelevance && hardNegatives.has(other);
        pairs.push({
          preferred,
          other,
          hardNegative,
          weight: Math.max(1, preferred.relevance - other.relevance) * (hardNegative ? 2 : 1),
        });
      }
    }
  }
  return pairs;
}

function trainCalibration(samples, normalized, weights, iterations = 600) {
  let scale = 1;
  let bias = 0;
  const learningRate = 0.03;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let scaleGradient = 0;
    let biasGradient = 0;
    for (const sample of samples) {
      const raw = dot(weights, normalized.get(sample));
      const target = sample.relevance / 3;
      const probability = sigmoid((scale * raw) + bias);
      const error = probability - target;
      scaleGradient += error * raw;
      biasGradient += error;
    }
    scale -= learningRate * (scaleGradient / samples.length);
    bias -= learningRate * (biasGradient / samples.length);
    scale = Math.max(0.05, Math.min(10, scale));
  }

  return { scale, bias };
}

export function trainPairwiseRanker(samples, {
  epochs = 800,
  learningRate = 0.025,
  regularization = 0.002,
} = {}) {
  if (!Array.isArray(samples) || samples.length < 2) {
    throw new Error('RANKER_DATASET_TOO_SMALL');
  }
  for (const sample of samples) {
    if (!Array.isArray(sample.features) || sample.features.length !== rankingFeatureNames.length) {
      throw new Error('RANKER_FEATURES_INVALID');
    }
  }

  const rawStatistics = normalizer(samples);
  const statistics = {
    mean: rawStatistics.mean.map((value) => canonicalNumber(value)),
    standardDeviation: rawStatistics.standardDeviation.map((value) => canonicalNumber(value)),
  };
  const normalized = new Map(samples.map((sample) => [sample, normalize(sample.features, statistics)]));
  const pairs = buildPairs(samples);
  if (!pairs.length) throw new Error('RANKER_PAIRS_UNAVAILABLE');

  const weights = rankingFeatureNames.map(() => 0);
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / (1 + (epoch / epochs));
    for (const pair of pairs) {
      const difference = normalized.get(pair.preferred)
        .map((value, index) => value - normalized.get(pair.other)[index]);
      const incorrectProbability = sigmoid(-dot(weights, difference));
      for (let index = 0; index < weights.length; index += 1) {
        const gradient = (-incorrectProbability * difference[index] * pair.weight)
          + (regularization * weights[index]);
        // Les cinq caractéristiques décrivent des signaux favorables.
        // Une projection monotone empêche le modèle d'apprendre qu'une
        // meilleure correspondance doit pénaliser un candidat.
        weights[index] = Math.max(0, weights[index] - (rate * gradient));
      }
    }
  }

  const canonicalWeights = weights.map((weight) => canonicalNumber(weight));
  const rawCalibration = trainCalibration(samples, normalized, canonicalWeights);
  const calibration = {
    scale: canonicalNumber(rawCalibration.scale),
    bias: canonicalNumber(rawCalibration.bias),
  };
  const totalAbsoluteWeight = canonicalWeights.reduce((sum, weight) => sum + Math.abs(weight), 0) || 1;
  return {
    version: 'learned-ranking-v2',
    algorithm: 'pairwise-logistic-ranking',
    featureNames: rankingFeatureNames,
    normalization: statistics,
    weights: canonicalWeights,
    featureImportance: Object.fromEntries(rankingFeatureNames.map((name, index) => [name, {
      direction: canonicalWeights[index] >= 0 ? 'positive' : 'negative',
      importance: Math.round((Math.abs(canonicalWeights[index]) / totalAbsoluteWeight) * 10000) / 10000,
    }])),
    calibration,
    constraints: {
      nonNegativeWeights: true,
    },
    training: {
      sampleCount: samples.length,
      pairCount: pairs.length,
      offerCount: new Set(samples.map((sample) => sample.offerId)).size,
      epochs,
      learningRate,
      regularization,
      hardNegativePairCount: pairs.filter((pair) => pair.hardNegative).length,
    },
  };
}

export function scoreWithArtifact(features, artifact) {
  const normalized = normalize(features, artifact.normalization);
  const rawScore = dot(artifact.weights, normalized);
  const probability = sigmoid((artifact.calibration.scale * rawScore) + artifact.calibration.bias);
  return { rawScore, probability, normalized };
}
