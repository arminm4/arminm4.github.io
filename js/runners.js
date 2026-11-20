/* In-browser code runners.
 *  - Python: Pyodide in a Web Worker (vendor/pyodide/), so infinite loops can be stopped.
 *  - SQL: sql.js (SQLite compiled to WASM, vendor/sqljs/) preloaded with a sample shop database.
 *  - JavaScript: runs natively with console capture.
 * Vendor files are copied by `npm run vendor` (and by the GitHub Pages workflow). */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- Python */
  let worker = null, ready = null, seq = 0;
  const pending = new Map();

  function startWorker() {
    worker = new Worker('js/py-worker.js');
    ready = new Promise((resolve, reject) => {
      const onMsg = (e) => {
        if (e.data.type === 'ready') { worker.removeEventListener('message', onMsg); resolve(); }
        if (e.data.type === 'init-error') { worker.removeEventListener('message', onMsg); reject(new Error(e.data.error)); }
      };
      worker.addEventListener('message', onMsg);
    });
    worker.addEventListener('message', (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      if (e.data.type === 'stdout') p.onOut && p.onOut(e.data.text);
      if (e.data.type === 'done') { pending.delete(e.data.id); clearTimeout(p.timer); p.resolve(e.data); }
    });
    worker.addEventListener('error', (e) => {
      pending.forEach((p) => p.resolve({ ok: false, error: 'Python worker crashed: ' + (e.message || 'unknown error') }));
      pending.clear();
      worker = null;
    });
    worker.postMessage({ type: 'init' });
  }

  function stopPython() {
    if (worker) worker.terminate();
    worker = null;
    pending.forEach((p) => { clearTimeout(p.timer); p.resolve({ ok: false, error: 'Stopped.' }); });
    pending.clear();
  }

  async function runPython(code, opts) {
    opts = opts || {};
    if (!worker) startWorker();
    try { await ready; } catch (err) {
      stopPython();
      return { ok: false, error: 'Python runtime could not load. It is downloaded the first time you run Python (≈10 MB) and then cached for offline use. Check your connection and try again.\n\n' + err.message };
    }
    const id = ++seq;
    const heavy = /^\s*(import|from)\s+(numpy|pandas|sklearn|scipy)\b/m.test(code + '\n' + (opts.scan || ''));
    const limit = opts.timeout || (heavy ? 240000 : 15000);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        stopPython();
        resolve({ ok: false, error: `Timed out after ${limit / 1000}s. Is there an infinite loop? (The Python runtime was restarted.)` });
      }, limit);
      pending.set(id, { resolve, onOut: opts.onOut, timer });
      worker.postMessage({ type: 'run', id, code, stdin: opts.stdin || '', scan: opts.scan || '' });
    });
  }

  /* ------------------------------------------------------------------- SQL */
  let sqlReady = null, db = null;
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }
  async function initSQL(fresh) {
    if (!sqlReady) {
      sqlReady = (async () => {
        await loadScript('vendor/sqljs/sql-wasm.js');
        const SQL = await global.initSqlJs({ locateFile: (f) => 'vendor/sqljs/' + f });
        const seed = await (await fetch('content/data/shop.sql')).text();
        return { SQL, seed };
      })();
      sqlReady.catch(() => { sqlReady = null; });
    }
    const { SQL, seed } = await sqlReady;
    if (!db || fresh) {
      if (db) db.close();
      db = new SQL.Database();
      db.run(seed);
    }
    return db;
  }
  async function runSQL(code, opts) {
    opts = opts || {};
    try {
      const d = await initSQL(opts.fresh);
      const t0 = performance.now();
      const results = d.exec(code);
      const ms = performance.now() - t0;
      const changes = d.getRowsModified();
      return { ok: true, results, ms, changes };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  }

  /* ------------------------------------------------------------ JavaScript */
  async function runJS(code) {
    const lines = [];
    const fmt = (v) => {
      if (typeof v === 'string') return v;
      try { return JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() + 'n' : x)) ?? String(v); } catch (e) { return String(v); }
    };
    const con = {
      log: (...a) => lines.push(a.map(fmt).join(' ')),
      info: (...a) => lines.push(a.map(fmt).join(' ')),
      warn: (...a) => lines.push('⚠ ' + a.map(fmt).join(' ')),
      error: (...a) => lines.push('✖ ' + a.map(fmt).join(' ')),
      table: (t) => lines.push(fmt(t))
    };
    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction('console', '"use strict";\n' + code);
      const ret = await Promise.race([fn(con), new Promise((_, rej) => setTimeout(() => rej(new Error('Timed out after 5s')), 5000))]);
      if (ret !== undefined) lines.push('⇒ ' + fmt(ret));
      return { ok: true, stdout: lines.join('\n') };
    } catch (err) {
      return { ok: false, stdout: lines.join('\n'), error: String(err && err.stack ? err.stack.split('\n')[0] : err) };
    }
  }

  /* --------------------------------------------------------- output render */
  function renderSQLResult(res) {
    const esc = global.MD.esc;
    if (!res.ok) return `<pre class="out-err">${esc(res.error)}</pre>`;
    if (!res.results.length) return `<div class="out-note">Query OK${res.changes ? ` — ${res.changes} row(s) affected` : ''} (${res.ms.toFixed(1)} ms)</div>`;
    return res.results.map((r) => {
      const max = 200;
      const rows = r.values.slice(0, max);
      return `<div class="table-wrap out-table"><table><thead><tr>${r.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>` +
        rows.map((row) => `<tr>${row.map((v) => `<td>${v === null ? '<span class="null">NULL</span>' : esc(typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(4) : v)}</td>`).join('')}</tr>`).join('') +
        `</tbody></table></div><div class="out-note">${r.values.length} row(s)${r.values.length > max ? `, showing first ${max}` : ''} · ${res.ms.toFixed(1)} ms</div>`;
    }).join('');
  }

  async function run(lang, code, opts) {
    if (lang === 'python') return runPython(code, opts);
    if (lang === 'sql') return runSQL(code, opts);
    if (lang === 'js') return runJS(code, opts);
    return { ok: false, error: 'No runner for ' + lang };
  }

  global.Runners = { run, runPython, runSQL, runJS, stopPython, renderSQLResult, resetSQL: () => initSQL(true) };
})(window);
