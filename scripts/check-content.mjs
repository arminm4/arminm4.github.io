// Validates all course content:
//  - every module file in the catalog exists and parses
//  - ids are unique; builds_on / leads_to / prereqs point to real modules
//  - every quiz question has at least one correct option
//  - every lesson renders without throwing
//  - every Python exercise's solution passes its own tests (needs python on PATH)
//  - every SQL exercise's solution matches the reference query
// Run: npm run check
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
require(join(root, 'content/catalog.js'));
require(join(root, 'js/md.js'));
require(join(root, 'js/parser.js'));
const { CATALOG } = globalThis;
const { Parser, MD } = globalThis;

const errors = [], warnings = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
const modules = {}, lessonIds = new Set();
let lessons = 0, questions = 0, exercises = 0, projects = 0, words = 0;
const pyEx = [], sqlEx = [];

for (const [cid, c] of Object.entries(CATALOG.courses)) {
  c.modules.forEach((path, idx) => {
    const file = join(root, 'content', path);
    if (!existsSync(file)) { warn(`missing module file: ${path}`); return; }
    const mod = Parser.parseModule(readFileSync(file, 'utf8'), cid, idx);
    const expectId = path.split('/').pop().replace(/\.md$/, '');
    if (mod.id !== expectId) err(`${path}: front-matter id "${mod.id}" should be "${expectId}"`);
    if (modules[mod.id]) err(`duplicate module id ${mod.id}`);
    modules[mod.id] = mod;
    if (mod.kind !== 'project' && !mod.lessons.length) err(`${path}: no lessons`);
    if (mod.kind !== 'project' && mod.quiz.length < 5) warn(`${path}: only ${mod.quiz.length} quiz questions`);
    mod.lessons.forEach((l) => {
      lessons++; lessonIds.add(l.id);
      words += l.md.split(/\s+/).length;
      try { MD.render(l.md); } catch (e) { err(`${l.id}: render failed: ${e.message}`); }
      if (/\$\$/.test(l.md.replace(/```[\s\S]*?```/g, '')) && (l.md.match(/\$\$/g) || []).length % 2) err(`${l.id}: unbalanced $$`);
    });
    mod.quiz.forEach((q) => {
      questions++;
      if (!q.options.some((o) => o.correct)) err(`${q.id}: no correct option`);
      if (!q.explain) warn(`${q.id}: no explanation`);
    });
    mod.exercises.forEach((e) => {
      exercises++;
      if (e.tests && e.lang === 'python') pyEx.push(e);
      if (e.tests && e.lang === 'sql') sqlEx.push(e);
      if (e.tests && !e.solution) err(`${e.id}: has tests but no solution`);
    });
    projects += mod.projects.length;
    mod.projects.forEach((p) => { if (!p.milestones.length) warn(`${p.id}: no milestones`); });
  });
}

const refOk = (id) => !!modules[id];
Object.values(modules).forEach((m) => {
  [...m.buildsOn, ...m.leadsTo].forEach((r) => { if (!refOk(r)) warn(`${m.id}: unknown module reference "${r}"`); });
  m.lessons.forEach((l) => {
    for (const [, kind, id] of l.md.matchAll(/\(#\/(lesson|module|quiz|exercise|project|course)\/([\w-]+)\)/g)) {
      const ok = kind === 'lesson' ? lessonIds.has(id) : kind === 'course' ? !!CATALOG.courses[id] : kind === 'module' || kind === 'quiz' ? refOk(id) : true;
      if (!ok) warn(`${l.id}: broken link #/${kind}/${id}`);
    }
  });
});
Object.entries(CATALOG.courses).forEach(([cid, c]) => (c.prereqs || []).forEach((p) => { if (!refOk(p)) warn(`${cid}: unknown prereq ${p}`); }));

// ---- run Python exercise solutions against their tests
const firstCode = (md, lang) => { const m = md.match(new RegExp('```' + lang + '[^\\n]*\\n([\\s\\S]*?)\\n```')); return m ? m[1] : null; };
const appJs = readFileSync(join(root, 'js/app.js'), 'utf8');
const helpers = eval(appJs.match(/const PY_HELPERS = (\[[\s\S]*?\]\.join\('\\n'\));/)[1]);
const py = ['python3', 'python', 'py'].find((p) => spawnSync(p, ['--version']).status === 0);
if (!py) warn('python not found: skipped running Python exercise solutions');
else {
  const dir = mkdtempSync(join(tmpdir(), 'armo-check-'));
  const hasPkg = {};
  const canImport = (m) => (hasPkg[m] ??= spawnSync(py, ['-c', `import ${m}`]).status === 0);
  for (const e of pyEx) {
    const sol = firstCode(e.solution, 'python');
    if (!sol) { err(`${e.id}: solution has no python code block`); continue; }
    const needs = [...new Set([...(sol + '\n' + e.tests).matchAll(/^\s*(?:import|from)\s+(numpy|pandas|sklearn|scipy)\b/gm)].map((m) => m[1]))];
    const missing = needs.filter((m) => !canImport(m));
    if (missing.length) { warn(`${e.id}: skipped (local python lacks ${missing.join(', ')})`); continue; }
    const f = join(dir, e.id + '.py');
    writeFileSync(f, `__user_code__ = ${JSON.stringify(sol)}\n${helpers}\n${e.tests}\n`);
    const r = spawnSync(py, ['-I', f], { encoding: 'utf8', timeout: 30000 });
    if (r.status !== 0) err(`${e.id}: solution FAILS its tests:\n${(r.stderr || r.stdout).trim().split('\n').slice(-4).join('\n')}`);
  }
}

// ---- JavaScript exercises
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
for (const m of Object.values(modules)) for (const e of m.exercises) {
  if (e.lang !== 'js' || !e.tests) continue;
  const sol = firstCode(e.solution, 'js');
  try {
    const quiet = { log() {}, info() {}, warn() {}, error() {}, table() {} };
    await new AsyncFunction('console', 'const assert=(c,m)=>{if(!c)throw new Error("Check failed: "+(m||""))};\n' + sol + '\n;\n' + e.tests)(quiet);
  } catch (x) { err(`${e.id}: JS solution fails its tests: ${x.message}`); }
}

// ---- SQL exercises
if (sqlEx.length) {
  const initSqlJs = require(join(root, 'node_modules/sql.js'));
  const SQL = await initSqlJs();
  const seed = readFileSync(join(root, 'content/data/shop.sql'), 'utf8');
  const run = (q) => { const db = new SQL.Database(); db.run(seed); const r = db.exec(q); db.close(); return r.length ? r[r.length - 1].values : []; };
  for (const e of sqlEx) {
    const sol = firstCode(e.solution, 'sql');
    try {
      const a = JSON.stringify(run(sol).map(String).sort()), b = JSON.stringify(run(e.tests).map(String).sort());
      if (a !== b) err(`${e.id}: SQL solution result differs from reference`);
      if (b === '[]') warn(`${e.id}: reference query returns no rows`);
    } catch (x) { err(`${e.id}: SQL error: ${x.message}`); }
  }
}

console.log(`Modules ${Object.keys(modules).length} · lessons ${lessons} (~${Math.round(words / 1000)}k words) · quiz questions ${questions} · exercises ${exercises} (python auto-checked ${pyEx.length}, sql ${sqlEx.length}) · projects ${projects}`);
warnings.forEach((w) => console.log('WARN ', w));
errors.forEach((e) => console.log('ERROR', e));
if (errors.length) { console.log(`\n${errors.length} error(s)`); process.exit(1); }
console.log('Content OK');
