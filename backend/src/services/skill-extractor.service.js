import { createSkillTaxonomy } from './skill-taxonomy.service.js';

export function createSkillExtractor({ taxonomy = createSkillTaxonomy() } = {}) {
  return {
    extract(text) {
      return taxonomy.extractDetailed(text).map(({ name }) => name);
    },

    extractDetailed(text) {
      return taxonomy.extractDetailed(text);
    },
  };
}
