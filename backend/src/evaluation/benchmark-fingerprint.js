import { createHash } from 'node:crypto';

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

// Preserve array order and string values; ignore only JSON presentation.
function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function datasetFingerprints(rawText) {
  const withoutBom = rawText.replace(/^\uFEFF/u, '');
  const dataset = JSON.parse(withoutBom);
  const lf = withoutBom.replace(/\r\n/gu, '\n');
  return {
    dataset,
    canonical: 'sha256-json-v1:' + sha256(canonicalJson(dataset)),
    // Migration only: exact original bytes, or Git's LF/CRLF variants.
    // These values are derived from the current file, never trusted blindly.
    legacy: new Set([sha256(rawText), sha256(lf), sha256(lf.replace(/\n/gu, '\r\n'))]),
  };
}

export function matchesDatasetFingerprint(fingerprints, provided) {
  return typeof provided === 'string'
    && (provided === fingerprints.canonical || fingerprints.legacy.has(provided));
}
