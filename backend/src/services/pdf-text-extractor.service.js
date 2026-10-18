import { PDFParse } from 'pdf-parse';

function normalizeText(text) {
  return text
    .replace(/\r/g, '')
    .replace(/\n?-- \d+ of \d+ --\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 200000);
}

export function createPdfTextExtractor() {
  return {
    async extract(buffer) {
      const parser = new PDFParse({ data: Buffer.from(buffer) });

      try {
        const result = await parser.getText();
        return normalizeText(result.text || '');
      } finally {
        await parser.destroy();
      }
    },
  };
}
