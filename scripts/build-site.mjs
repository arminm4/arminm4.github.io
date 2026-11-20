// Assembles the deployable static site into ./_site (used by the GitHub Pages workflow).
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '_site');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);

const items = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'content', 'assets', 'icons', 'vendor', '.well-known'];
for (const it of items) {
  const src = join(root, it);
  if (existsSync(src)) cpSync(src, join(out, it), { recursive: true });
  else console.warn('skip (missing):', it);
}
writeFileSync(join(out, '.nojekyll'), '');
console.log('Site assembled in ./_site');
