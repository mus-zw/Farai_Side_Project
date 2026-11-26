/**
 * Runs every src/**\/*.test.ts with Node's built-in test runner, no extra dependencies: Vite (already a
 * dependency) bundles the tests, with the app code they import, into a temp folder, and `node --test` runs them.
 *   npm test
 */
import { build } from 'vite';
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const find = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return find(p);
    return name.endsWith('.test.ts') ? [p] : [];
  });

const files = find(join(root, 'src'));
if (files.length === 0) {
  console.log('No *.test.ts files found.');
  process.exit(0);
}

// Inside node_modules so the bundled tests can resolve the packages they import; git already ignores it.
const outDir = join(root, 'node_modules', '.cache', `farai-tests-${process.pid}`);
const input = Object.fromEntries(files.map((f) => [relative(root, f).replace(/[\\/]/g, '__').replace(/\.test\.ts$/, ''), f]));

try {
  await build({
    configFile: false,
    logLevel: 'warn',
    build: { ssr: true, outDir, emptyOutDir: true, minify: false, rollupOptions: { input, output: { format: 'es', entryFileNames: '[name].mjs' } } },
  });
  const outputs = Object.keys(input).map((n) => join(outDir, `${n}.mjs`));
  const run = spawnSync(process.execPath, ['--test', ...outputs], { stdio: 'inherit' });
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
