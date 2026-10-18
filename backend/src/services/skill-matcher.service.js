export function createSkillMatcher() {
  return {
    async compare({ cvSkills = [], offer }) {
      const candidateSkills = new Set(Array.isArray(cvSkills) ? cvSkills : []);
      const offerSkills = Array.isArray(offer.skills) ? offer.skills : [];
      const matchedSkills = offerSkills.filter((skill) => candidateSkills.has(skill));
      const missingSkills = offerSkills.filter((skill) => !candidateSkills.has(skill));
      const score = offerSkills.length
        ? Math.round((matchedSkills.length / offerSkills.length) * 10000) / 100
        : 0;

      return { score, matchedSkills, missingSkills, model: 'skill-overlap-baseline' };
    },
  };
}
