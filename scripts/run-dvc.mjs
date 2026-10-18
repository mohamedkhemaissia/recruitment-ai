import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const dvcArgs = process.argv.slice(2);
const candidates = process.platform === 'win32'
  ? [
      ['dvc.exe', dvcArgs],
      ['python3.14', ['-m', 'dvc', ...dvcArgs]],
      ['python3', ['-m', 'dvc', ...dvcArgs]],
      ['py', ['-m', 'dvc', ...dvcArgs]],
    ]
  : [
      ['dvc', dvcArgs],
      ['python3', ['-m', 'dvc', ...dvcArgs]],
    ];

const env = {
  ...process.env,
  DVC_NO_ANALYTICS: 'true',
  DVC_SITE_CACHE_DIR: resolve('.dvc/site-cache'),
};

for (const [command, args] of candidates) {
  const result = spawnSync(command, args, { env, stdio: 'inherit' });

  if (!result.error || result.error.code !== 'ENOENT') {
    process.exit(result.status ?? 1);
  }
}

console.error('DVC est absent. Installez-le avec : pip install -r requirements-dvc.txt');
process.exit(1);
