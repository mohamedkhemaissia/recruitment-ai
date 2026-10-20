function round(value, precision = 4) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function discountedCumulativeGain(relevances, limit) {
  return relevances.slice(0, limit).reduce((sum, relevance, index) => (
    sum + (((2 ** relevance) - 1) / Math.log2(index + 2))
  ), 0);
}

export function evaluateRankingSamples(samples, scoreForSample, { limit = 5 } = {}) {
  const byOffer = new Map();
  for (const sample of samples) {
    const group = byOffer.get(sample.offerId) || [];
    group.push({ ...sample, predictedScore: scoreForSample(sample) });
    byOffer.set(sample.offerId, group);
  }

  const cases = [];
  for (const [offerId, group] of byOffer) {
    const ranking = [...group].sort((left, right) => right.predictedScore - left.predictedScore);
    const ideal = [...group].sort((left, right) => right.relevance - left.relevance);
    const maximumRelevance = ideal[0]?.relevance || 0;
    const bestRank = ranking.findIndex((sample) => sample.relevance === maximumRelevance) + 1;
    const relevantCount = group.filter((sample) => sample.relevance >= 2).length;
    const relevantInTopK = ranking.slice(0, limit).filter((sample) => sample.relevance >= 2).length;
    const idealDcg = discountedCumulativeGain(ideal.map((sample) => sample.relevance), limit);
    const actualDcg = discountedCumulativeGain(ranking.map((sample) => sample.relevance), limit);

    cases.push({
      offerId,
      bestRank,
      reciprocalRank: bestRank ? 1 / bestRank : 0,
      recallAtK: relevantCount ? relevantInTopK / relevantCount : 0,
      ndcgAtK: idealDcg ? actualDcg / idealDcg : 0,
      ranking: ranking.map(({ candidateId, relevance, predictedScore }) => ({
        candidateId,
        relevance,
        score: round(predictedScore),
      })),
    });
  }

  const count = cases.length || 1;
  return {
    offerCount: cases.length,
    sampleCount: samples.length,
    top1Accuracy: round((cases.filter((item) => item.bestRank === 1).length / count) * 100, 2),
    meanReciprocalRank: round(cases.reduce((sum, item) => sum + item.reciprocalRank, 0) / count),
    recallAt5: round(cases.reduce((sum, item) => sum + item.recallAtK, 0) / count),
    ndcgAt5: round(cases.reduce((sum, item) => sum + item.ndcgAtK, 0) / count),
    cases,
  };
}
