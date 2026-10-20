import { readFileSync } from 'node:fs';
import { scoreWithArtifact } from './pairwise-ranker-training.service.js';

const defaultArtifactUrl = new URL('../ai/models/recruitment-ranker-v2.json', import.meta.url);

const featureLabels = {
  semanticSimilarity: 'Proximité sémantique',
  requiredSkillCoverage: 'Compétences demandées',
  relatedSkillCoverage: 'Compétences associées',
  titleAlignment: 'Alignement du poste',
  skillSpecificity: 'Précision des compétences',
};

export function loadRankerArtifact(url = defaultArtifactUrl) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

export function createLearnedRanker({ artifact = loadRankerArtifact() } = {}) {
  if (artifact.featureNames.length !== artifact.weights.length) {
    throw new Error('RANKER_ARTIFACT_INVALID');
  }

  return {
    version: artifact.version,
    metadata: artifact,

    predict(featureSet) {
      const { rawScore, probability, normalized } = scoreWithArtifact(featureSet.vector, artifact);
      const contributions = artifact.featureNames.map((name, index) => ({
        name,
        label: featureLabels[name] || name,
        value: featureSet.values[name],
        contribution: artifact.weights[index] * normalized[index],
      })).sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution));
      const score = Math.round(probability * 10000) / 100;

      return {
        score,
        probability,
        rawScore,
        contributions,
      };
    },
  };
}
