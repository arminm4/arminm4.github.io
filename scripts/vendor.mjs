// Copies the in-browser runtimes into ./vendor so the app serves them from its own
// origin (no third-party CDN at run time, and they can be cached for offline use):
//   - Pyodide core (Python 3.12 in WebAssembly) from node_modules/pyodide
//   - sql.js (SQLite in WebAssembly) from node_modules/sql.js
//   - Pyodide packages numpy, pandas and scikit-learn (+ dependencies), downloaded once
//     from the official Pyodide CDN and verified against the SHA-256 in pyodide-lock.json.
import { cpSync, existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'vendor');
const cache = join(root, '.cache', 'pyodide-packages');
const PACKAGES = ['numpy', 'pandas', 'scikit-learn'];

if (!existsSync(join(nm, 'pyodide')) || !existsSync(join(nm, 'sql.js'))) {
  console.error('Missing node_modules. Run "npm install" first.');
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'pyodide'), { recursive: true });
mkdirSync(join(out, 'sqljs'), { recursive: true });
mkdirSync(cache, { recursive: true });

for (const f of ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
  cpSync(join(nm, 'pyodide', f), join(out, 'pyodide', f));
}
for (const f of ['sql-wasm.js', 'sql-wasm.wasm']) {
  cpSync(join(nm, 'sql.js', 'dist', f), join(out, 'sqljs', f));
}

// Resolve package dependencies from the lock file.
const lock = JSON.parse(readFileSync(join(nm, 'pyodide', 'pyodide-lock.json'), 'utf8'));
const version = lock.info.version;
const want = new Set();
const add = (n) => { if (want.has(n) || !lock.packages[n]) return; want.add(n); lock.packages[n].depends.forEach(add); };
PACKAGES.forEach(add);

let ok = 0, failed = 0, bytes = 0;
for (const name of want) {
  const { file_name: file, sha256 } = lock.packages[name];
  const cached = join(cache, file);
  try {
    if (!existsSync(cached)) {
      const url = `https://cdn.jsdelivr.net/pyodide/v${version}/full/${file}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const got = createHash('sha256').update(buf).digest('hex');
      if (got !== sha256) throw new Error('checksum mismatch');
      writeFileSync(cached, buf);
    }
    cpSync(cached, join(out, 'pyodide', file));
    bytes += readFileSync(cached).length;
    ok++;
  } catch (e) {
    failed++;
    console.warn(`  ! could not fetch ${name} (${file}): ${e.message}. Python still works; this package won't.`);
  }
}
console.log(`Vendor runtimes copied to ./vendor (${ok} Python packages, ${(bytes / 1048576).toFixed(1)} MB${failed ? `, ${failed} failed` : ''})`);
