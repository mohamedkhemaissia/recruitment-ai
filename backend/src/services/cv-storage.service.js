import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultCvDirectory = fileURLToPath(new URL('../../uploads/cvs/', import.meta.url));
const storedFileNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i;

function cvPath(cvDirectory, storedFileName) {
  if (!storedFileNamePattern.test(storedFileName)) {
    const error = new Error('Nom de fichier CV invalide.');
    error.code = 'INVALID_CV_FILE';
    throw error;
  }
  return join(cvDirectory, storedFileName);
}

export function createCvStorage() {
  const configuredDirectory = process.env.CV_STORAGE_PATH;
  const cvDirectory = configuredDirectory
    ? (isAbsolute(configuredDirectory) ? configuredDirectory : resolve(process.cwd(), configuredDirectory))
    : defaultCvDirectory;

  return {
    async store(buffer) {
      await mkdir(cvDirectory, { recursive: true });
      const storedFileName = `${randomUUID()}.pdf`;
      await writeFile(cvPath(cvDirectory, storedFileName), buffer, { flag: 'wx' });
      return storedFileName;
    },

    async remove(storedFileName) {
      await rm(cvPath(cvDirectory, storedFileName), { force: true });
    },

    async stageRemoval(storedFileName) {
      const originalPath = cvPath(cvDirectory, storedFileName);
      const stagedPath = `${originalPath}.pending-${randomUUID()}`;
      try {
        await rename(originalPath, stagedPath);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return {
          async commit() {},
          async rollback() {},
        };
      }
      let settled = false;

      return {
        async commit() {
          if (settled) return;
          await rm(stagedPath, { force: true });
          settled = true;
        },
        async rollback() {
          if (settled) return;
          await rename(stagedPath, originalPath);
          settled = true;
        },
      };
    },

    async read(storedFileName) {
      return readFile(cvPath(cvDirectory, storedFileName));
    },
  };
}
