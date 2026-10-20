import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { referenceCandidates, referenceJudgments, referenceOffers } from '../evaluation/reference-cases.js';

const outputUrl = new URL('../../data/ai-evaluation-dataset.json', import.meta.url);
const outputPath = fileURLToPath(outputUrl);

await mkdir(new URL('../../data/', import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({
  version: 2,
  generatedAt: 'reproducible',
  offers: referenceOffers,
  candidates: referenceCandidates,
  judgments: referenceJudgments,
}, null, 2)}\n`, 'utf8');

console.log(`${referenceOffers.length} offres, ${referenceCandidates.length} CV et ${referenceJudgments.length} jugements exportés pour DVC.`);
