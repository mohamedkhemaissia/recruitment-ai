import { buildRankingFeatures } from './ai-ranking-features.service.js';
import { createLearnedRanker } from './learned-ranker.service.js';
import { createSemanticMatcher } from './semantic-matcher.service.js';
import { createSkillTaxonomy } from './skill-taxonomy.service.js';

export function createRecruitmentMatcher({
  semanticMatcher = createSemanticMatcher(),
  ranker = createLearnedRanker(),
  taxonomy = createSkillTaxonomy(),
} = {}) {
  return {
    async compare({ cvText, cvSkills = [], offer }) {
      const semantic = await semanticMatcher.compare({ cvText, cvSkills, offer });
      const featureSet = buildRankingFeatures({
        cvText,
        cvSkills,
        offer,
        semanticScore: semantic.semanticScore,
        taxonomy,
      });
      const prediction = ranker.predict(featureSet);
      const detailedSkills = taxonomy.extractDetailed(cvText);
      const matchedSet = new Set(featureSet.matchedSkills);
      const evidence = detailedSkills
        .filter((skill) => matchedSet.has(skill.name) && skill.evidence)
        .slice(0, 5)
        .map(({ name, evidence: excerpt }) => ({ criterion: name, excerpt }));
      const factors = prediction.contributions.slice(0, 3).map((factor) => ({
        ...factor,
        effect: factor.contribution >= 0 ? 'positive' : 'negative',
      }));

      return {
        ...semantic,
        score: prediction.score,
        skillScore: Math.round(featureSet.values.requiredSkillCoverage * 10000) / 100,
        matchedSkills: featureSet.matchedSkills,
        missingSkills: featureSet.missingSkills,
        scoringVersion: ranker.version,
        model: `${semantic.model}+${ranker.version}`,
        // Une probabilité calibrée n'est pas une mesure d'incertitude.
        // La colonne reste nullable pour la compatibilité avec les analyses historiques.
        confidence: null,
        explanation: {
          status: prediction.score >= 70 ? 'high' : prediction.score >= 40 ? 'medium' : 'low',
          features: featureSet.values,
          factors,
          evidence,
        },
      };
    },
  };
}
