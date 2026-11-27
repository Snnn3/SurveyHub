import { spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(clientRoot, '..');
const outputDirectory = resolve(repositoryRoot, 'tmp');
const outputFile = resolve(outputDirectory, 'survey-question-input.test.mjs');

await mkdir(outputDirectory, { recursive: true });

try {
  await build({
    entryPoints: [resolve(clientRoot, 'tests/survey-question-input.test.tsx')],
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    packages: 'external',
    jsx: 'automatic',
  });

  const result = spawnSync(process.execPath, ['--test', outputFile], {
    cwd: repositoryRoot,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(outputFile, { force: true });
}
