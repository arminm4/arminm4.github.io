/* Progress store. Everything lives in localStorage under one key, so it can be
 * exported/imported as a single JSON file (the backup + device-sync mechanism,
 * since there is no server). */
(function (global) {
  'use strict';
  const KEY = 'armo-learn:v1';

  const blank = () => ({
    v: 1,
    created: Date.now(),
    done: {},      // lessonId -> timestamp
    quiz: {},      // moduleId -> { best, last, attempts, ts }
    qs: {},        // questionId -> { r: right, w: wrong, ts }
    ex: {},        // exerciseId -> timestamp
    code: {},      // exerciseId -> saved editor code
    proj: {},      // projectId -> { milestoneIndex: true }
    notes: {},     // lessonId -> text
    marks: {},     // lessonId -> timestamp (bookmarks)
    days: {},      // 'YYYY-MM-DD' -> activity count
    last: null,    // { hash, title, ts }
    settings: { theme: 'dark', fontScale: 1 }
  });

  let state = load();
  let saveTimer = null;
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(blank(), JSON.parse(raw));
    } catch (e) { /* storage unavailable or corrupt */ }
    return blank();
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 150);
    listeners.forEach((fn) => { try { fn(state); } catch (e) {} });
  }
  function flush() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Could not save progress', e); }
  }
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  function activity() { state.days[today()] = (state.days[today()] || 0) + 1; }

  const Store = {
    get state() { return state; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    isDone: (id) => !!state.done[id],
    setDone(id, on) {
      if (on) { if (!state.done[id]) { state.done[id] = Date.now(); activity(); } }
      else delete state.done[id];
      save();
    },

    quizResult: (moduleId) => state.quiz[moduleId] || null,
    recordQuiz(moduleId, score, perQuestion) {
      const prev = state.quiz[moduleId] || { best: 0, attempts: 0 };
      state.quiz[moduleId] = { best: Math.max(prev.best, score), last: score, attempts: prev.attempts + 1, ts: Date.now() };
      Object.entries(perQuestion || {}).forEach(([qid, ok]) => Store.recordQuestion(qid, ok, true));
      activity(); save();
    },
    recordQuestion(qid, ok, silent) {
      const q = state.qs[qid] || { r: 0, w: 0 };
      if (ok) { q.r++; q.c = (q.c || 0) + 1; } else { q.w++; q.c = 0; }
      q.ts = Date.now(); q.ok = !!ok;
      state.qs[qid] = q;
      if (!silent) { activity(); save(); }
    },

    exDone: (id) => !!state.ex[id],
    setEx(id, on) { if (on) { state.ex[id] = state.ex[id] || Date.now(); activity(); } else delete state.ex[id]; save(); },
    code: (id) => state.code[id],
    setCode(id, src) { state.code[id] = src; save(); },

    milestone: (pid, k) => !!(state.proj[pid] && state.proj[pid][k]),
    setMilestone(pid, k, on) {
      state.proj[pid] = state.proj[pid] || {};
      if (on) { state.proj[pid][k] = true; activity(); } else delete state.proj[pid][k];
      save();
    },

    note: (id) => state.notes[id] || '',
    setNote(id, text) { if (text && text.trim()) state.notes[id] = text; else delete state.notes[id]; save(); },
    isMarked: (id) => !!state.marks[id],
    toggleMark(id) { if (state.marks[id]) delete state.marks[id]; else state.marks[id] = Date.now(); save(); return !!state.marks[id]; },

    setLast(hash, title) { state.last = { hash, title, ts: Date.now() }; save(); },

    setting: (k) => state.settings[k],
    setSetting(k, v) { state.settings[k] = v; save(); flush(); },

    streak() {
      let n = 0;
      const d = new Date();
      const key = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
      if (!state.days[key(d)]) d.setDate(d.getDate() - 1); // today not started yet: count from yesterday
      while (state.days[key(d)]) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },

    exportJSON() { flush(); return JSON.stringify(Object.assign({ app: 'armo-learn', exported: new Date().toISOString() }, state), null, 1); },
    importJSON(text, mode) {
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object' || !('done' in data)) throw new Error('This does not look like an Armo Learn backup.');
      delete data.app; delete data.exported;
      if (mode === 'replace') state = Object.assign(blank(), data);
      else {
        // merge: union of everything, keep best scores and longest notes
        const merged = Object.assign(blank(), state);
        ['done', 'ex', 'marks'].forEach((k) => { merged[k] = Object.assign({}, data[k] || {}, state[k]); });
        merged.code = Object.assign({}, data.code || {}, state.code);
        Object.entries(data.days || {}).forEach(([d, n]) => { merged.days[d] = Math.max(merged.days[d] || 0, n); });
        Object.entries(data.quiz || {}).forEach(([m, r]) => {
          const a = merged.quiz[m];
          merged.quiz[m] = !a ? r : { best: Math.max(a.best, r.best), last: (a.ts || 0) > (r.ts || 0) ? a.last : r.last, attempts: a.attempts + r.attempts, ts: Math.max(a.ts || 0, r.ts || 0) };
        });
        Object.entries(data.qs || {}).forEach(([q, r]) => {
          const a = merged.qs[q];
          merged.qs[q] = !a ? r : { r: Math.max(a.r, r.r), w: Math.max(a.w, r.w), ts: Math.max(a.ts || 0, r.ts || 0), ok: (a.ts || 0) > (r.ts || 0) ? a.ok : r.ok };
        });
        Object.entries(data.proj || {}).forEach(([p, ms]) => { merged.proj[p] = Object.assign({}, ms, merged.proj[p]); });
        Object.entries(data.notes || {}).forEach(([l, t]) => { if (!merged.notes[l] || t.length > merged.notes[l].length) merged.notes[l] = t; });
        if (data.last && (!merged.last || data.last.ts > merged.last.ts)) merged.last = data.last;
        state = merged;
      }
      save(); flush();
    },
    reset() { const settings = state.settings; state = blank(); state.settings = settings; save(); flush(); }
  };

  // Ask the browser not to evict our storage (helps on iPad/Android).
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  global.Store = Store;
})(window);
