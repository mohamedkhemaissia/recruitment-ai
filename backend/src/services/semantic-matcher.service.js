const defaultModel = 'onnx-community/paraphrase-multilingual-MiniLM-L12-v2-ONNX';
const defaultModelRevision = 'd4c06bf0d7680171ac30042a1387e1fdb7a90021';
const scoringVersion = 'hybrid-v1';
const semanticWeight = 0.65;
const skillWeight = 0.35;
const sensitiveLinePattern = /\b(age|date de naissance|birth date|genre|gender|sexe|nationalite|nationality|religion|situation familiale|marital status|handicap|disability)\b/i;

export function sanitizeForMatching(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, ' ')
    .replace(/(?:\+?\d[\d .()-]{7,}\d)/g, ' ')
    .split('\n')
    .filter((line) => !sensitiveLinePattern.test(line.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitIntoChunks(text, maximumLength = 1600, maximumChunks = 4) {
  const chunks = [];
  let remaining = text.slice(0, maximumLength * maximumChunks);

  while (remaining && chunks.length < maximumChunks) {
    if (remaining.length <= maximumLength) {
      chunks.push(remaining);
      break;
    }
    const splitAt = Math.max(remaining.lastIndexOf('\n', maximumLength), remaining.lastIndexOf(' ', maximumLength));
    const end = splitAt > maximumLength * 0.6 ? splitAt : maximumLength;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }

  return chunks.filter(Boolean);
}

function dotProduct(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function compareSkills(cvSkills, offerSkills) {
  const candidateSkills = new Set(cvSkills);
  return {
    matchedSkills: offerSkills.filter((skill) => candidateSkills.has(skill)),
    missingSkills: offerSkills.filter((skill) => !candidateSkills.has(skill)),
  };
}

export function createSemanticMatcher({
  pipelineFactory,
  model = process.env.AI_MODEL_ID || defaultModel,
  revision = process.env.AI_MODEL_REVISION || defaultModelRevision,
} = {}) {
  let extractorPromise;

  async function getExtractor() {
    if (!extractorPromise) {
      extractorPromise = pipelineFactory
        ? Promise.resolve(pipelineFactory())
        : import('@huggingface/transformers').then(({ pipeline }) => pipeline(
          'feature-extraction',
          model,
          { dtype: 'q8', revision },
        ));
    }
    return extractorPromise;
  }

  return {
    async compare({ cvText, cvSkills = [], offer }) {
      const sanitizedCv = sanitizeForMatching(cvText);
      if (!sanitizedCv) throw new Error('CV_TEXT_UNAVAILABLE');

      const offerSkills = Array.isArray(offer.skills) ? offer.skills : [];
      const offerText = sanitizeForMatching([offer.title, offer.description, offer.requirements, offerSkills.join(', ')]
        .filter(Boolean)
        .join('\n'));
      const chunks = splitIntoChunks(sanitizedCv);
      const skillContext = cvSkills.length ? `Competences professionnelles : ${cvSkills.join(', ')}\n` : '';
      const inputs = [offerText, ...chunks.map((chunk) => `${skillContext}${chunk}`)];
      const extractor = await getExtractor();
      const output = await extractor(inputs, { pooling: 'mean', normalize: true });
      const embeddings = output.tolist();
      const similarities = embeddings.slice(1)
        .map((embedding) => dotProduct(embeddings[0], embedding))
        .sort((left, right) => right - left)
        .slice(0, Math.min(2, chunks.length));
      const averageSimilarity = similarities.reduce((sum, value) => sum + value, 0) / similarities.length;
      const semanticScore = Math.max(0, Math.min(1, averageSimilarity)) * 100;
      const skillScore = offerSkills.length
        ? (compareSkills(cvSkills, offerSkills).matchedSkills.length / offerSkills.length) * 100
        : 0;
      const score = Math.round((semanticScore * semanticWeight + skillScore * skillWeight) * 100) / 100;
      const skillComparison = compareSkills(cvSkills, offerSkills);

      return {
        score,
        semanticScore: Math.round(semanticScore * 100) / 100,
        skillScore: Math.round(skillScore * 100) / 100,
        semanticContribution: Math.round(semanticScore * semanticWeight * 100) / 100,
        skillContribution: Math.round(skillScore * skillWeight * 100) / 100,
        scoringVersion,
        ...skillComparison,
        model: `${model}@${revision}`,
      };
    },
  };
}
