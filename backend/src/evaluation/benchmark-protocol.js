const splits = new Set(['train', 'validation', 'test']);
const keyFor = (offerId, candidateId) => JSON.stringify([offerId, candidateId]);
const normalizeText = (value) => value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
const validGrade = (value) => Number.isInteger(value) && value >= 0 && value <= 3;
function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}
function indexRows(rows, kind) {
  requireCondition(Array.isArray(rows) && rows.length > 0, 'BENCHMARK_' + kind + '_EMPTY');
  const indexed = new Map();
  const texts = new Map();
  for (const row of rows) {
    requireCondition(row && typeof row.id === 'string' && row.id.trim() && splits.has(row.split), 'BENCHMARK_' + kind + '_INVALID');
    requireCondition(!indexed.has(row.id), 'BENCHMARK_DUPLICATE_' + kind + '_ID');
    const text = kind === 'OFFER'
      ? [row.title, row.description, row.requirements]
      : [row.text];
    requireCondition(text.every((item) => typeof item === 'string' && item.trim()), 'BENCHMARK_' + kind + '_TEXT_INVALID');
    const normalized = normalizeText(text.join('\n'));
    requireCondition(!texts.has(normalized), 'BENCHMARK_DUPLICATE_' + kind + '_TEXT');
    indexed.set(row.id, row);
    texts.set(normalized, row.id);
  }
  return indexed;
}

// Every pair is explicit. Missing labels must never silently become zero.
export function auditBenchmark(dataset) {
  requireCondition(dataset?.version === 3, 'BENCHMARK_VERSION_INVALID');
  const offers = indexRows(dataset.offers, 'OFFER');
  const candidates = indexRows(dataset.candidates, 'CV');
  requireCondition(Array.isArray(dataset.judgments), 'BENCHMARK_JUDGMENTS_INVALID');
  const pairs = new Map();
  for (const row of dataset.judgments) {
    const offer = offers.get(row.offerId);
    const candidate = candidates.get(row.candidateId);
    requireCondition(offer && candidate, 'BENCHMARK_UNKNOWN_PAIR');
    requireCondition(offer.split === candidate.split, 'BENCHMARK_CROSS_SPLIT_PAIR');
    const key = keyFor(row.offerId, row.candidateId);
    requireCondition(!pairs.has(key), 'BENCHMARK_DUPLICATE_PAIR');
    requireCondition(offer.split === 'test' ? row.relevance === null : validGrade(row.relevance), 'BENCHMARK_LABEL_INVALID');
    pairs.set(key, row);
  }
  const counts = {};
  for (const split of splits) {
    const selectedOffers = dataset.offers.filter((row) => row.split === split);
    const selectedCandidates = dataset.candidates.filter((row) => row.split === split);
    requireCondition(selectedOffers.length > 0 && selectedCandidates.length >= 6, 'BENCHMARK_SPLIT_TOO_SMALL');
    if (split === 'test') requireCondition(selectedOffers.length >= 6, 'BENCHMARK_TEST_OFFERS_TOO_FEW');
    for (const offer of selectedOffers) {
      for (const candidate of selectedCandidates) {
        requireCondition(pairs.has(keyFor(offer.id, candidate.id)), 'BENCHMARK_PAIR_MISSING');
      }
      if (split !== 'test') {
        const grades = selectedCandidates.map((candidate) => pairs.get(keyFor(offer.id, candidate.id)).relevance);
        requireCondition(grades.some((grade) => grade >= 2) && grades.some((grade) => grade < 2), 'BENCHMARK_NO_LABEL_CONTRAST');
      }
    }
    counts[split] = { offers: selectedOffers.length, candidates: selectedCandidates.length, pairs: selectedOffers.length * selectedCandidates.length };
  }
  return { protocol: dataset.protocol, counts, testAnnotationStatus: 'pending-human-review' };
}

export function buildReviewPacket(dataset, datasetFingerprint) {
  auditBenchmark(dataset);
  const offers = new Map(dataset.offers.map((row) => [row.id, row]));
  const candidates = new Map(dataset.candidates.map((row) => [row.id, row]));
  return {
    version: 1,
    datasetFingerprint,
    reviewer: '',
    reviewedAt: '',
    rubric: {
      0: 'Hors sujet ou aucune aptitude pertinente démontrée.',
      1: 'Correspondance faible : activité voisine, exigences principales non démontrées.',
      2: 'Correspondance partielle : compétences utiles, plusieurs exigences à vérifier.',
      3: 'Correspondance forte : exigences principales étayées par le parcours décrit.',
    },
    instructions: 'Lire le CV et les exigences. Choisir 0 à 3 et justifier. Aucun score IA ne doit être consulté avant cette annotation. Les données sont fictives ; la grille évalue leur contenu, pas une personne réelle.',
    judgments: dataset.judgments.filter((row) => offers.get(row.offerId).split === 'test').map((row) => {
      const offer = offers.get(row.offerId);
      return {
        offerId: row.offerId,
        candidateId: row.candidateId,
        offer: { title: offer.title, description: offer.description, requirements: offer.requirements },
        cvText: candidates.get(row.candidateId).text,
        relevance: null,
        reason: '',
      };
    }),
  };
}

export function applyHumanReview(dataset, review, expectedFingerprint) {
  auditBenchmark(dataset);
  requireCondition(review?.version === 1 && review.datasetFingerprint === expectedFingerprint, 'BENCHMARK_REVIEW_DATASET_MISMATCH');
  requireCondition(typeof review.reviewer === 'string' && review.reviewer.trim(), 'BENCHMARK_REVIEWER_REQUIRED');
  requireCondition(typeof review.reviewedAt === 'string' && Number.isFinite(Date.parse(review.reviewedAt)), 'BENCHMARK_REVIEW_DATE_REQUIRED');
  const offers = new Map(dataset.offers.map((row) => [row.id, row]));
  const expected = new Set(dataset.judgments.filter((row) => offers.get(row.offerId).split === 'test').map((row) => keyFor(row.offerId, row.candidateId)));
  requireCondition(Array.isArray(review.judgments), 'BENCHMARK_REVIEW_INVALID');
  const annotations = new Map();
  for (const row of review.judgments) {
    const key = keyFor(row.offerId, row.candidateId);
    requireCondition(expected.has(key) && !annotations.has(key), 'BENCHMARK_REVIEW_PAIR_INVALID');
    requireCondition(validGrade(row.relevance), 'BENCHMARK_REVIEW_INCOMPLETE');
    requireCondition(typeof row.reason === 'string' && row.reason.trim(), 'BENCHMARK_REVIEW_REASON_REQUIRED');
    annotations.set(key, row);
  }
  requireCondition(annotations.size === expected.size, 'BENCHMARK_REVIEW_INCOMPLETE');
  for (const offer of dataset.offers.filter((row) => row.split === 'test')) {
    const rows = [...annotations.values()].filter((row) => row.offerId === offer.id);
    requireCondition(rows.some((row) => row.relevance >= 2) && rows.some((row) => row.relevance < 2), 'BENCHMARK_TEST_NO_LABEL_CONTRAST');
  }
  return dataset.judgments.map((row) => {
    const annotation = annotations.get(keyFor(row.offerId, row.candidateId));
    return annotation ? { offerId: row.offerId, candidateId: row.candidateId, relevance: annotation.relevance, source: 'human-review', reason: annotation.reason } : { ...row };
  });
}
