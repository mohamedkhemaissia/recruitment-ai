import { referenceCandidates, referenceOffers } from '../evaluation/reference-cases.js';
import { evaluateReferenceSet } from '../services/ai-evaluation.service.js';
import { createSemanticMatcher } from '../services/semantic-matcher.service.js';
import { createSkillMatcher } from '../services/skill-matcher.service.js';
import { createSkillExtractor } from '../services/skill-extractor.service.js';

const skillExtractor = createSkillExtractor();
const candidates = referenceCandidates.map((candidate) => ({
  ...candidate,
  skills: skillExtractor.extract(candidate.text),
}));
const offers = referenceOffers.map((offer) => ({
  ...offer,
  skills: skillExtractor.extract(`${offer.title}\n${offer.description}\n${offer.requirements}`),
}));

try {
  const evaluations = [
    ['Baseline competences', createSkillMatcher()],
    ['Matching hybride IA', createSemanticMatcher()],
  ];

  for (const [label, matcher] of evaluations) {
    const startedAt = performance.now();
    const evaluation = await evaluateReferenceSet({ matcher, offers, candidates });
    const durationSeconds = Math.round((performance.now() - startedAt) / 10) / 100;
    console.log(`\n${label} : ${evaluation.offerCount} offres, ${evaluation.candidateCount} CV fictifs`);
    console.log(`Precision Top-1 : ${evaluation.top1Accuracy}% (${evaluation.top1Correct}/${evaluation.offerCount})`);
    console.log(`Precision Top-3 : ${evaluation.top3Accuracy}% (${evaluation.top3Correct}/${evaluation.offerCount})`);
    console.log(`Rang reciproque moyen : ${evaluation.meanReciprocalRank}`);
    console.log(`Marge moyenne : ${evaluation.meanMargin} points`);
    console.log(`Durée : ${durationSeconds} s`);

    if (label === 'Matching hybride IA' && (evaluation.top1Accuracy < 90 || evaluation.top3Accuracy < 100)) {
      const failedOffers = evaluation.cases
        .filter((item) => item.expectedRank !== 1)
        .map((item) => `${item.offerTitle} (rang ${item.expectedRank || 'absent'})`)
        .join(', ');
      throw new Error(`Régression du classement IA : ${failedOffers}`);
    }
  }
} catch (error) {
  console.error('Evaluation IA impossible :', error.message);
  process.exitCode = 1;
}
