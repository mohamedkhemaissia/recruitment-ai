import { readFileSync } from 'node:fs';

const defaultTaxonomy = JSON.parse(readFileSync(new URL('../ai/skill-taxonomy.json', import.meta.url), 'utf8'));

export function normalizeSkillText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createSkillTaxonomy(definitions = defaultTaxonomy) {
  const entries = definitions.map((definition) => ({
    ...definition,
    patterns: definition.aliases.map((alias) => new RegExp(
      `(^|[^a-z0-9+#])${escapeRegExp(normalizeSkillText(alias))}(?=$|[^a-z0-9+#])`,
      'i',
    )),
  }));
  const byName = new Map(entries.map((entry) => [entry.name, entry]));

  function evidenceFor(text, entry) {
    const lines = String(text || '').split(/\n|(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
    return lines.find((line) => {
      const normalizedLine = normalizeSkillText(line);
      return entry.patterns.some((pattern) => pattern.test(normalizedLine));
    }) || '';
  }

  return {
    definitions: entries.map(({ patterns, ...entry }) => entry),

    extractDetailed(text) {
      const normalizedText = normalizeSkillText(text);
      return entries
        .filter(({ patterns }) => patterns.some((pattern) => pattern.test(normalizedText)))
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          category: entry.category,
          confidence: 1,
          evidence: evidenceFor(text, entry),
        }));
    },

    relatedCoverage(candidateSkills = [], offerSkills = []) {
      if (!offerSkills.length) return 0;
      const candidates = new Set(candidateSkills);
      let relatedMatches = 0;
      for (const skill of offerSkills) {
        if (candidates.has(skill)) {
          relatedMatches += 1;
          continue;
        }
        const related = byName.get(skill)?.relatedSkills || [];
        if (related.some((item) => candidates.has(item))) relatedMatches += 0.5;
      }
      return relatedMatches / offerSkills.length;
    },
  };
}

export { defaultTaxonomy };
