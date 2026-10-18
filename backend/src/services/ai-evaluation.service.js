function round(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

export async function evaluateReferenceSet({ matcher, offers, candidates }) {
  const cases = [];

  for (const offer of offers) {
    const rankings = await Promise.all(candidates.map(async (candidate) => {
      const analysis = await matcher.compare({
        cvText: candidate.text,
        cvSkills: candidate.skills,
        offer,
      });
      return {
        candidateId: candidate.id,
        candidateLabel: candidate.label,
        score: analysis.score,
      };
    }));
    rankings.sort((left, right) => right.score - left.score);

    const expectedRank = rankings.findIndex((item) => item.candidateId === offer.expectedCandidateId) + 1;
    const expectedResult = rankings[expectedRank - 1];
    const bestOther = rankings.find((item) => item.candidateId !== offer.expectedCandidateId);
    cases.push({
      offerId: offer.id,
      offerTitle: offer.title,
      expectedCandidateId: offer.expectedCandidateId,
      expectedRank,
      expectedScore: expectedResult?.score ?? null,
      margin: expectedResult && bestOther ? round(expectedResult.score - bestOther.score) : null,
      rankings,
    });
  }

  const top1Correct = cases.filter((item) => item.expectedRank === 1).length;
  const top3Correct = cases.filter((item) => item.expectedRank >= 1 && item.expectedRank <= 3).length;
  const rankedCases = cases.filter((item) => item.expectedRank >= 1);
  const meanReciprocalRank = rankedCases.length
    ? rankedCases.reduce((sum, item) => sum + (1 / item.expectedRank), 0) / rankedCases.length
    : 0;
  const scoredMargins = cases.filter((item) => item.margin !== null);

  return {
    offerCount: cases.length,
    candidateCount: candidates.length,
    top1Correct,
    top1Accuracy: cases.length ? round((top1Correct / cases.length) * 100) : 0,
    top3Correct,
    top3Accuracy: cases.length ? round((top3Correct / cases.length) * 100) : 0,
    meanReciprocalRank: round(meanReciprocalRank, 3),
    meanMargin: scoredMargins.length
      ? round(scoredMargins.reduce((sum, item) => sum + item.margin, 0) / scoredMargins.length)
      : 0,
    cases,
  };
}
