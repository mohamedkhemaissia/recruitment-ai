import { createSkillTaxonomy, normalizeSkillText } from './skill-taxonomy.service.js';

export const rankingFeatureNames = [
  'semanticSimilarity',
  'requiredSkillCoverage',
  'relatedSkillCoverage',
  'titleAlignment',
  'skillSpecificity',
];

const ignoredTitleTokens = new Set([
  'avec', 'dans', 'des', 'developpeur', 'developpeuse', 'engineer', 'ingenieur',
  'senior', 'junior', 'confirme', 'confirmee', 'logiciel', 'software', 'the', 'and',
]);

function tokens(value) {
  return new Set(normalizeSkillText(value)
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !ignoredTitleTokens.has(token)));
}

function coverage(expected, actual) {
  if (!expected.size) return 0;
  let matches = 0;
  for (const value of expected) {
    if (actual.has(value)) matches += 1;
  }
  return matches / expected.size;
}

function canonicalSemanticSimilarity(semanticScore) {
  const similarity = Math.max(0, Math.min(1, Number(semanticScore || 0) / 100));
  // Les runtimes ONNX peuvent différer de quelques décimales selon l'OS.
  // Un pas d'un point de pourcentage garde le signal utile tout en rendant
  // l'entraînement DVC reproductible entre Windows et Linux.
  return Math.round(similarity * 100) / 100;
}

export function buildRankingFeatures({
  cvText,
  cvSkills = [],
  offer,
  semanticScore,
  taxonomy = createSkillTaxonomy(),
}) {
  const offerSkills = Array.isArray(offer.skills) ? offer.skills : [];
  const candidateSkills = Array.isArray(cvSkills) ? cvSkills : [];
  const candidateSet = new Set(candidateSkills);
  const matchedSkills = offerSkills.filter((skill) => candidateSet.has(skill));
  const missingSkills = offerSkills.filter((skill) => !candidateSet.has(skill));
  const requiredSkillCoverage = offerSkills.length ? matchedSkills.length / offerSkills.length : 0;
  const skillSpecificity = candidateSkills.length ? matchedSkills.length / candidateSkills.length : 0;
  const values = {
    semanticSimilarity: canonicalSemanticSimilarity(semanticScore),
    requiredSkillCoverage,
    relatedSkillCoverage: taxonomy.relatedCoverage(candidateSkills, offerSkills),
    titleAlignment: coverage(tokens(offer.title), tokens(cvText)),
    skillSpecificity,
  };

  return {
    names: rankingFeatureNames,
    vector: rankingFeatureNames.map((name) => values[name]),
    values,
    matchedSkills,
    missingSkills,
  };
}
