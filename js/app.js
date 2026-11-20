/* Armo Learn — app shell: content loading, routing, views and interactions. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = MD.esc;
  const md = (s) => MD.render(s || '');
  const il = (s) => MD.inline(s || '');
  const CAT = self.CATALOG;
  let view = $('#view');

  /* =============================================================== content */
  const DB = { courses: {}, modules: {}, lessons: {}, exercises: {}, projects: {}, questions: {}, steps: {}, stepIndex: {}, search: [], roadmap: '' };

  async function loadContent() {
    const jobs = [];
    Object.entries(CAT.courses).forEach(([cid, c]) => {
      DB.courses[cid] = Object.assign({ id: cid, mods: [] }, c);
      c.modules.forEach((path, idx) => {
        jobs.push(fetch('content/' + path)
          .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
          .then((t) => ({ cid, idx, mod: Parser.parseModule(t, cid, idx) }))
          .catch(() => ({ cid, idx, mod: { id: path.split('/').pop().replace('.md', ''), courseId: cid, order: idx, title: 'Coming soon', week: '', summary: 'This module file could not be loaded.', kind: 'missing', buildsOn: [], leadsTo: [], intro: '', lessons: [], quiz: [], exercises: [], projects: [], sources: '' } })));
      });
    });
    jobs.push(fetch('content/roadmap.md').then((r) => (r.ok ? r.text() : '')).then((t) => { DB.roadmap = t; }).catch(() => {}));
    const res = (await Promise.all(jobs)).filter(Boolean).filter((r) => r.mod);
    res.sort((a, b) => a.idx - b.idx).forEach(({ cid, mod }) => {
      DB.courses[cid].mods.push(mod);
      DB.modules[mod.id] = mod;
      mod.lessons.forEach((l) => { DB.lessons[l.id] = l; });
      mod.exercises.forEach((e) => { DB.exercises[e.id] = e; });
      mod.projects.forEach((p) => { DB.projects[p.id] = p; });
      mod.quiz.forEach((q) => { q.moduleId = mod.id; DB.questions[q.id] = q; });
    });
    Object.values(DB.courses).forEach((c) => {
      c.mods.sort((a, b) => a.order - b.order);
      const steps = [];
      c.mods.forEach((m) => {
        m.lessons.forEach((l) => steps.push({ type: 'lesson', id: l.id, title: l.title, moduleId: m.id, hash: `#/lesson/${l.id}` }));
        if (m.quiz.length) steps.push({ type: 'quiz', id: m.id, title: `Quiz: ${m.title}`, moduleId: m.id, hash: `#/quiz/${m.id}` });
        m.exercises.forEach((e) => steps.push({ type: 'exercise', id: e.id, title: e.title, moduleId: m.id, hash: `#/exercise/${e.id}` }));
        m.projects.forEach((p) => steps.push({ type: 'project', id: p.id, title: p.title, moduleId: m.id, hash: `#/project/${p.id}` }));
      });
      DB.steps[c.id] = steps;
      steps.forEach((s, k) => { DB.stepIndex[s.type + ':' + s.id] = { course: c.id, k }; });
    });
    Object.values(DB.lessons).forEach((l) => {
      const m = DB.modules[l.moduleId], c = DB.courses[l.courseId];
      DB.search.push({ kind: 'Lesson', id: l.id, title: l.title, where: `${c.short} · ${m.week ? m.week + ' · ' : ''}${m.title}`, hash: `#/lesson/${l.id}`, text: MD.plain(l.md), lc: (l.title + ' ' + MD.plain(l.md)).toLowerCase() });
    });
    Object.values(DB.exercises).forEach((e) => {
      const m = DB.modules[e.moduleId], c = DB.courses[e.courseId];
      DB.search.push({ kind: 'Exercise', id: e.id, title: e.title, where: `${c.short} · ${m.title}`, hash: `#/exercise/${e.id}`, text: MD.plain(e.prompt), lc: (e.title + ' ' + MD.plain(e.prompt)).toLowerCase() });
    });
    Object.values(DB.projects).forEach((p) => {
      const m = DB.modules[p.moduleId], c = DB.courses[p.courseId];
      DB.search.push({ kind: 'Project', id: p.id, title: p.title, where: `${c.short} · ${m.title}`, hash: `#/project/${p.id}`, text: MD.plain(p.brief), lc: (p.title + ' ' + MD.plain(p.brief)).toLowerCase() });
    });
  }

  /* ============================================================== progress */
  const PASS = 0.7;
  function stepDone(s) {
    if (s.type === 'lesson') return Store.isDone(s.id);
    if (s.type === 'quiz') { const r = Store.quizResult(s.id); return !!r && r.best >= PASS; }
    if (s.type === 'exercise') return Store.exDone(s.id);
    if (s.type === 'project') {
      const p = DB.projects[s.id];
      if (!p.milestones.length) return Store.isDone(p.id);
      return p.milestones.every((_, k) => Store.milestone(p.id, k));
    }
    return false;
  }
  function tally(steps) {
    const total = steps.length, done = steps.filter(stepDone).length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }
  const courseProgress = (cid) => tally(DB.steps[cid] || []);
  const moduleSteps = (mid) => { const m = DB.modules[mid]; return (DB.steps[m.courseId] || []).filter((s) => s.moduleId === mid); };
  const moduleProgress = (mid) => tally(moduleSteps(mid));
  function overall() {
    const all = Object.keys(DB.courses).flatMap((c) => DB.steps[c]);
    return tally(all);
  }
  function nextStep(cid) {
    const steps = DB.steps[cid] || [];
    return steps.find((s) => !stepDone(s)) || steps[0];
  }
  function neighbours(type, id) {
    const ix = DB.stepIndex[type + ':' + id];
    if (!ix) return {};
    const steps = DB.steps[ix.course];
    return { prev: steps[ix.k - 1], next: steps[ix.k + 1], pos: ix.k + 1, total: steps.length };
  }

  /* ============================================================ components */
  const ring = (pct, size, color) => {
    const r = 15.5, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 36 36" width="${size || 44}" height="${size || 44}" aria-label="${pct}% complete"><circle cx="18" cy="18" r="${r}" class="ring-bg"/><circle cx="18" cy="18" r="${r}" class="ring-fg" style="stroke:${color || 'var(--accent)'}" stroke-dasharray="${(c * pct) / 100} ${c}"/><text x="18" y="21.5" text-anchor="middle">${pct}%</text></svg>`;
  };
  const bar = (pct, color) => `<div class="bar"><span style="width:${pct}%;${color ? `background:${color}` : ''}"></span></div>`;
  const ICON = {
    lesson: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    quiz: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6M12 17h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    exercise: '<svg viewBox="0 0 24 24"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    project: '<svg viewBox="0 0 24 24"><path d="M3 7h18v12H3zM8 7V5h8v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    bookmarkOn: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
  };
  const typeLabel = { lesson: 'Lesson', quiz: 'Quiz', exercise: 'Exercise', project: 'Project' };

  function stepRow(s) {
    const done = stepDone(s);
    let meta = '';
    if (s.type === 'lesson') meta = `${DB.lessons[s.id].minutes} min`;
    if (s.type === 'quiz') { const r = Store.quizResult(s.id); meta = `${DB.modules[s.id].quiz.length} questions${r ? ` · best ${Math.round(r.best * 100)}%` : ''}`; }
    if (s.type === 'exercise') { const e = DB.exercises[s.id]; meta = e.tests ? 'auto-checked' : (e.lang ? 'runnable' : 'self-checked'); }
    if (s.type === 'project') { const p = DB.projects[s.id]; const n = p.milestones.filter((_, k) => Store.milestone(p.id, k)).length; meta = `${n}/${p.milestones.length} milestones`; }
    return `<a class="step ${done ? 'is-done' : ''}" href="${s.hash}"><span class="step-ico step-${s.type}">${done ? ICON.check : ICON[s.type]}</span><span class="step-body"><span class="step-kind">${typeLabel[s.type]}</span><span class="step-title">${il(s.type === 'quiz' ? 'Module quiz' : s.title)}</span></span><span class="step-meta">${esc(meta)}</span></a>`;
  }

  function moduleChip(mid) {
    const m = DB.modules[mid];
    if (!m) return '';
    const c = DB.courses[m.courseId];
    const p = moduleProgress(mid);
    return `<a class="chip" href="#/module/${m.id}" style="--chip:${c.color}"><span class="chip-dot"></span>${esc(c.short)}: ${il(m.title)}${p.pct === 100 ? ' ✓' : p.done ? ` · ${p.pct}%` : ''}</a>`;
  }

  function crumbs(parts) {
    return `<nav class="crumbs">${parts.map(([t, h]) => (h ? `<a href="${h}">${il(t)}</a>` : `<span>${il(t)}</span>`)).join('<span class="sep">›</span>')}</nav>`;
  }

  /* ================================================================= views */
  function home() {
    const o = overall();
    const last = Store.state.last;
    const due = reviewPool().due.length;
    const f = DB.courses.foundations, fp = courseProgress('foundations');
    const cards = CAT.grid.map((cid) => {
      const c = DB.courses[cid], p = courseProgress(cid);
      return `<a class="bc-card" href="#/course/${cid}" style="--c:${c.color}">
        <div class="bc-art"><img src="${c.art}" alt="" loading="lazy"></div>
        <div class="bc-name">${esc(c.title)}</div>
        <div class="bc-prog">${bar(p.pct, c.color)}<span>${p.pct}%</span></div>
      </a>`;
    }).join('');
    return {
      title: 'Home',
      html: `
      <section class="hero">
        <div>
          <h1>${o.done ? 'Welcome back' : 'Welcome to Armo Learn'}</h1>
          <p class="muted">Six bootcamps plus their foundations, with quizzes, hands-on exercises and projects. Your progress is saved on this device.</p>
        </div>
        ${last ? `<a class="continue" href="${last.hash}"><span class="muted small">Continue where you left off</span><strong>${il(last.title)}</strong><span class="arrow">→</span></a>`
          : `<a class="continue" href="#/roadmap"><span class="muted small">Not sure where to start?</span><strong>See the recommended learning path</strong><span class="arrow">→</span></a>`}
      </section>
      <section class="stats">
        <div class="stat">${ring(o.pct, 52)}<div><strong>${o.done}/${o.total}</strong><span>steps completed</span></div></div>
        <div class="stat"><div class="stat-big">🔥 ${Store.streak()}</div><div><strong>day streak</strong><span>study a little every day</span></div></div>
        <a class="stat" href="#/review"><div class="stat-big">🔁 ${due}</div><div><strong>to review</strong><span>spaced-repetition questions</span></div></a>
      </section>
      <h2 class="section-title">Bootcamps</h2>
      <section class="bc-grid">${cards}</section>
      <h2 class="section-title">Prerequisites</h2>
      <a class="found-card" href="#/course/foundations" style="--c:${f.color}">
        <div class="bc-art small"><img src="${f.art}" alt=""></div>
        <div class="found-body">
          <strong>${esc(f.title)}</strong>
          <span class="muted">${esc(f.tagline)}</span>
          <div class="bc-prog">${bar(fp.pct, f.color)}<span>${fp.pct}%</span></div>
        </div>
      </a>
      <section class="tools">
        <a class="tool" href="#/roadmap"><strong>🗺️ Roadmap</strong><span>How the bootcamps connect and in what order to study them</span></a>
        <a class="tool" href="#/playground"><strong>🧪 Playground</strong><span>Run Python, SQL and JavaScript right here</span></a>
        <a class="tool" href="#/progress"><strong>💾 Backup &amp; sync</strong><span>Export your progress to move it between iPad and phone</span></a>
      </section>`
    };
  }

  function course(cid) {
    const c = DB.courses[cid];
    if (!c) return notFound();
    const p = courseProgress(cid);
    const nxt = nextStep(cid);
    const prereq = (c.prereqs || []).map(moduleChip).join('');
    const req = (c.requires || []).map((rid) => { const r = DB.courses[rid]; const rp = courseProgress(rid); return `<a class="chip" href="#/course/${rid}" style="--chip:${r.color}"><span class="chip-dot"></span>${esc(r.title)} bootcamp · ${rp.pct}%</a>`; }).join('');
    const mods = c.mods.map((m) => {
      const mp = moduleProgress(m.id);
      const isProj = m.kind === 'project';
      return `<a class="mod-card ${isProj ? 'is-proj' : ''} ${mp.pct === 100 ? 'is-done' : ''}" href="#/module/${m.id}">
        <div class="mod-week">${esc(m.week || '')}${isProj ? ' · Project' : ''}</div>
        <div class="mod-title">${il(m.title)}</div>
        <div class="mod-sum muted">${il(m.summary)}</div>
        <div class="mod-foot">${bar(mp.pct, c.color)}<span>${mp.done}/${mp.total}</span></div>
      </a>`;
    }).join('');
    const lessons = c.mods.reduce((n, m) => n + m.lessons.length, 0);
    const exs = c.mods.reduce((n, m) => n + m.exercises.length, 0);
    return {
      title: c.title, parent: '#/',
      html: `
      <section class="course-hero" style="--c:${c.color}">
        <div class="bc-art big"><img src="${c.art}" alt=""></div>
        <div class="course-head">
          <div class="eyebrow">${c.kind === 'foundation' ? 'Prerequisite track' : 'Bootcamp'}</div>
          <h1>${esc(c.title)}</h1>
          <p class="muted">${esc(c.tagline)}</p>
          <div class="meta-row">
            ${c.weeks ? `<span>📅 ${c.weeks} weeks</span>` : ''}${c.hours ? `<span>⏱️ ${c.hours} h (original)</span>` : ''}
            <span>📚 ${lessons} lessons</span><span>🧩 ${exs} exercises</span>
          </div>
          <div class="course-cta">
            ${ring(p.pct, 56, c.color)}
            ${nxt ? `<a class="btn primary" href="${nxt.hash}">${p.done ? 'Continue' : 'Start'}: ${il(nxt.type === 'quiz' ? 'Module quiz' : nxt.title)} →</a>` : ''}
          </div>
        </div>
      </section>
      <section class="prose">${md(c.description)}</section>
      ${prereq || req ? `<section class="panel"><h3>Before you start</h3>
        ${req ? `<p class="muted small">Complete (or be comfortable with) this bootcamp first:</p><div class="chips">${req}</div>` : ''}
        ${prereq ? `<p class="muted small">Foundation modules this bootcamp relies on:</p><div class="chips">${prereq}</div>` : ''}
      </section>` : ''}
      <section class="panel"><h3>What you will be able to do</h3><ul class="outcomes">${(c.outcomes || []).map((o) => `<li>${il(o)}</li>`).join('')}</ul></section>
      <h2 class="section-title">Syllabus</h2>
      <section class="mod-list">${mods}</section>`
    };
  }

  function moduleView(mid) {
    const m = DB.modules[mid];
    if (!m) return notFound();
    const c = DB.courses[m.courseId];
    const steps = moduleSteps(mid);
    const p = tally(steps);
    const next = steps.find((s) => !stepDone(s)) || steps[0];
    const idx = c.mods.indexOf(m);
    const prevM = c.mods[idx - 1], nextM = c.mods[idx + 1];
    return {
      title: m.title, parent: `#/course/${c.id}`,
      html: `
      ${crumbs([[c.title, `#/course/${c.id}`], [m.week || 'Module']])}
      <section class="mod-hero" style="--c:${c.color}">
        <div class="eyebrow">${esc(m.week)}${m.kind === 'project' ? ' · Project' : ''}</div>
        <h1>${il(m.title)}</h1>
        <p class="muted">${il(m.summary)}</p>
        <div class="course-cta">${ring(p.pct, 52, c.color)}${next ? `<a class="btn primary" href="${next.hash}">${p.done ? 'Continue' : 'Start'} →</a>` : ''}</div>
      </section>
      ${m.buildsOn.length || m.leadsTo.length ? `<section class="panel connect">
        ${m.buildsOn.length ? `<div><h4>Builds on</h4><div class="chips">${m.buildsOn.map(moduleChip).join('')}</div></div>` : ''}
        ${m.leadsTo.length ? `<div><h4>Leads to</h4><div class="chips">${m.leadsTo.map(moduleChip).join('')}</div></div>` : ''}
      </section>` : ''}
      ${m.intro ? `<section class="prose">${md(m.intro)}</section>` : ''}
      <section class="steps">${steps.map(stepRow).join('') || '<p class="muted">No content yet.</p>'}</section>
      ${m.sources ? `<section class="panel sources"><h3>📚 Sources &amp; further reading</h3>${md(m.sources)}</section>` : ''}
      <nav class="pager">
        ${prevM ? `<a class="btn" href="#/module/${prevM.id}">← ${il(prevM.title)}</a>` : '<span></span>'}
        ${nextM ? `<a class="btn" href="#/module/${nextM.id}">${il(nextM.title)} →</a>` : ''}
      </nav>`
    };
  }

  function pager(type, id) {
    const n = neighbours(type, id);
    const lab = (s) => (s.type === 'quiz' ? 'Module quiz' : s.title);
    return `<nav class="pager">
      ${n.prev ? `<a class="btn" href="${n.prev.hash}" data-key="prev"><small>${typeLabel[n.prev.type]}</small>← ${il(lab(n.prev))}</a>` : '<span></span>'}
      ${n.next ? `<a class="btn" href="${n.next.hash}" data-key="next"><small>${typeLabel[n.next.type]}</small>${il(lab(n.next))} →</a>` : ''}
    </nav>`;
  }

  function lesson(lid) {
    const l = DB.lessons[lid];
    if (!l) return notFound();
    const m = DB.modules[l.moduleId], c = DB.courses[l.courseId];
    const n = neighbours('lesson', lid);
    const done = Store.isDone(lid);
    const marked = Store.isMarked(lid);
    Store.setLast(`#/lesson/${lid}`, l.title);
    const body = md(l.md);
    return {
      title: l.title, parent: `#/module/${m.id}`, reading: true,
      html: `
      <div class="lesson-layout">
      <article class="lesson">
        ${crumbs([[c.short, `#/course/${c.id}`], [m.week ? `${m.week}: ${m.title}` : m.title, `#/module/${m.id}`]])}
        <header class="lesson-head">
          <div class="eyebrow">Lesson ${l.n} of ${m.lessons.length} · ${l.minutes} min read</div>
          <h1>${il(l.title)}</h1>
          <div class="lesson-tools">
            <button class="btn ghost small" data-act="bookmark" data-id="${lid}" aria-pressed="${marked}">${marked ? ICON.bookmarkOn : ICON.bookmark} ${marked ? 'Bookmarked' : 'Bookmark'}</button>
            <button class="btn ghost small" data-act="font" data-d="-0.08" aria-label="Smaller text">A−</button>
            <button class="btn ghost small" data-act="font" data-d="0.08" aria-label="Larger text">A+</button>
          </div>
        </header>
        <details class="toc-mobile"><summary>On this page</summary><div class="toc-list"></div></details>
        <div class="prose reading">${body}</div>
        ${m.buildsOn.length || m.leadsTo.length ? `<section class="panel connect small-panel">
          ${m.buildsOn.length ? `<div><h4>This module builds on</h4><div class="chips">${m.buildsOn.map(moduleChip).join('')}</div></div>` : ''}
          ${m.leadsTo.length ? `<div><h4>It prepares you for</h4><div class="chips">${m.leadsTo.map(moduleChip).join('')}</div></div>` : ''}
        </section>` : ''}
        ${m.sources ? `<details class="panel sources"><summary>📚 Sources &amp; further reading for this module</summary>${md(m.sources)}</details>` : ''}
        <section class="panel notes">
          <h3>📝 My notes</h3>
          <textarea id="noteBox" rows="4" placeholder="Summarize this lesson in your own words — it's the fastest way to find gaps in your understanding.">${esc(Store.note(lid))}</textarea>
          <div class="muted small" id="noteState">${Store.note(lid) ? 'Saved' : 'Notes save automatically.'}</div>
        </section>
        <div class="complete-row">
          <button class="btn ${done ? '' : 'primary'} big" data-act="complete" data-id="${lid}" data-next="${n.next ? n.next.hash : `#/module/${m.id}`}">
            ${done ? '✓ Completed — continue →' : 'Mark complete & continue →'}
          </button>
          ${done ? `<button class="btn ghost small" data-act="uncomplete" data-id="${lid}">Mark as not done</button>` : ''}
        </div>
        ${pager('lesson', lid)}
      </article>
      <aside class="toc-side"><div class="toc-title">On this page</div><div class="toc-list"></div></aside>
      </div>`,
      after() {
        const heads = $$('.reading h2, .reading h3');
        const tocHtml = heads.map((h) => `<a href="#" data-act="toc" data-target="${h.id}" class="toc-${h.tagName.toLowerCase()}">${h.textContent}</a>`).join('');
        $$('.toc-list').forEach((el) => { el.innerHTML = tocHtml; });
        if (heads.length < 2) { $$('.toc-mobile, .toc-side').forEach((e) => e.remove()); }
        const box = $('#noteBox');
        let t;
        box.addEventListener('input', () => {
          clearTimeout(t);
          $('#noteState').textContent = 'Saving…';
          t = setTimeout(() => { Store.setNote(lid, box.value); $('#noteState').textContent = 'Saved'; }, 400);
        });
      }
    };
  }

  function quiz(mid) {
    const m = DB.modules[mid];
    if (!m || !m.quiz.length) return notFound();
    const c = DB.courses[m.courseId];
    const r = Store.quizResult(mid);
    const qs = m.quiz;
    const qHtml = qs.map((q, k) => `
      <fieldset class="q" data-q="${k}">
        <legend><span class="q-num">${k + 1}</span><div class="q-stem">${md(q.stem)}</div></legend>
        ${q.multi ? '<div class="muted small">Select all that apply.</div>' : ''}
        <div class="opts">${q.options.map((o, j) => `
          <label class="opt"><input type="${q.multi ? 'checkbox' : 'radio'}" name="q${k}" value="${j}"><span>${il(o.text)}</span></label>`).join('')}
        </div>
        <div class="explain" hidden>${md(q.explain || '')}</div>
      </fieldset>`).join('');
    return {
      title: 'Quiz: ' + m.title, parent: `#/module/${mid}`,
      html: `
      ${crumbs([[c.short, `#/course/${c.id}`], [m.title, `#/module/${mid}`], ['Quiz']])}
      <header class="lesson-head"><div class="eyebrow">Module quiz · ${qs.length} questions · pass mark ${PASS * 100}%</div><h1>${il(m.title)}</h1>
      ${r ? `<p class="muted">Best score: <strong>${Math.round(r.best * 100)}%</strong> · ${r.attempts} attempt${r.attempts > 1 ? 's' : ''}</p>` : '<p class="muted">Answer from memory first, then read every explanation, including the ones you got right.</p>'}</header>
      <form id="quizForm" class="quiz">${qHtml}
        <div class="quiz-actions"><button class="btn primary big" type="submit">Check answers</button></div>
      </form>
      <div id="quizResult"></div>
      ${pager('quiz', mid)}`,
      after() {
        $('#quizForm').addEventListener('submit', (e) => {
          e.preventDefault();
          let right = 0;
          const per = {};
          qs.forEach((q, k) => {
            const fs = $(`.q[data-q="${k}"]`);
            const chosen = $$('input', fs).filter((x) => x.checked).map((x) => +x.value);
            const correct = q.options.map((o, j) => (o.correct ? j : -1)).filter((j) => j >= 0);
            const ok = chosen.length === correct.length && chosen.every((j) => correct.includes(j));
            if (ok) right++;
            per[q.id] = ok;
            fs.classList.toggle('is-right', ok); fs.classList.toggle('is-wrong', !ok);
            $$('.opt', fs).forEach((lab, j) => {
              lab.classList.toggle('opt-correct', correct.includes(j));
              lab.classList.toggle('opt-wrong', chosen.includes(j) && !correct.includes(j));
              $('input', lab).disabled = true;
            });
            $('.explain', fs).hidden = false;
          });
          const score = right / qs.length;
          Store.recordQuiz(mid, score, per);
          const pass = score >= PASS;
          $('.quiz-actions').innerHTML = '<button class="btn" type="button" data-act="retry">↻ Try again</button>';
          $('#quizResult').innerHTML = `<div class="result ${pass ? 'pass' : 'fail'}"><div class="result-score">${Math.round(score * 100)}%</div><div><strong>${right} of ${qs.length} correct.</strong> ${pass ? 'Passed — nice work. Review the explanations, then move on.' : `You need ${PASS * 100}% to pass. Re-read the lessons for the questions you missed, then retry.`}</div></div>`;
          $('#quizResult').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    };
  }

  function exercise(eid) {
    const e = DB.exercises[eid];
    if (!e) return notFound();
    const m = DB.modules[e.moduleId], c = DB.courses[e.courseId];
    const done = Store.exDone(eid);
    const runnable = ['python', 'sql', 'js'].includes(e.lang);
    const code = Store.code(eid) ?? e.starter ?? '';
    Store.setLast(`#/exercise/${eid}`, e.title);
    return {
      title: e.title, parent: `#/module/${m.id}`,
      html: `
      ${crumbs([[c.short, `#/course/${c.id}`], [m.title, `#/module/${m.id}`], ['Exercise']])}
      <header class="lesson-head"><div class="eyebrow">Exercise${e.tests ? ' · auto-checked' : ''}</div><h1>${il(e.title)}</h1></header>
      <section class="prose reading">${md(e.prompt)}</section>
      ${runnable ? `<section class="workbench" data-lang="${e.lang}">
        <div class="wb-head"><span>${{ python: 'Python', sql: 'SQL (SQLite · shop database)', js: 'JavaScript' }[e.lang]}</span>
          <span class="wb-actions">
            <button class="btn small" data-act="ex-reset" title="Restore starter code">Reset</button>
            <button class="btn small" data-act="ex-run">▶ Run</button>
            ${e.tests ? '<button class="btn small primary" data-act="ex-test">✓ Check</button>' : ''}
          </span></div>
        <textarea class="editor" id="exEditor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off">${esc(code)}</textarea>
        ${e.lang === 'python' ? '<details class="stdin"><summary>Program input (stdin)</summary><textarea id="exStdin" rows="3" placeholder="Lines typed here are returned by input(), one per call"></textarea></details>' : ''}
        <div class="out" id="exOut" hidden></div>
      </section>` : ''}
      ${e.hint ? `<details class="panel reveal"><summary>💡 Hint</summary><div class="prose">${md(e.hint)}</div></details>` : ''}
      ${e.solution ? `<details class="panel reveal solution"><summary>🔑 Solution <span class="muted small">(try for at least 15 minutes first)</span></summary><div class="prose">${md(e.solution)}</div></details>` : ''}
      <div class="complete-row">
        <label class="toggle"><input type="checkbox" id="exDone" ${done ? 'checked' : ''}><span>I completed this exercise</span></label>
      </div>
      ${pager('exercise', eid)}`,
      after() {
        $('#exDone').addEventListener('change', (ev) => { Store.setEx(eid, ev.target.checked); toast(ev.target.checked ? 'Exercise marked complete ✓' : 'Marked as not done'); });
        const ed = $('#exEditor');
        if (!ed) return;
        setupEditor(ed, (v) => Store.setCode(eid, v));
        const out = $('#exOut');
        const show = (html) => { out.hidden = false; out.innerHTML = html; };
        view.addEventListener('click', async function handler(ev) {
          const b = ev.target.closest('[data-act^="ex-"]');
          if (!b) return;
          const act = b.dataset.act;
          if (act === 'ex-reset') { if (confirm('Replace your code with the starter code?')) { ed.value = e.starter || ''; Store.setCode(eid, ed.value); autosize(ed); } return; }
          b.disabled = true;
          try {
            if (act === 'ex-run') show(await runToHtml(e.lang, ed.value, { stdin: $('#exStdin') && $('#exStdin').value, live: out }));
            if (act === 'ex-test') {
              const res = await checkExercise(e, ed.value);
              show(res.html);
              if (res.pass) { Store.setEx(eid, true); $('#exDone').checked = true; toast('All checks passed ✓'); }
            }
          } finally { b.disabled = false; }
        });
      }
    };
  }

  // Tests get two helpers: run_program(inputs) -> printed text, and load() -> the program's namespace.
  const PY_HELPERS = [
    'import io, contextlib',
    'def run_program(inputs=(), code=None):',
    '    lines = [str(x) for x in inputs]',
    '    def fake_input(prompt=""):',
    '        if not lines:',
    '            raise EOFError("the program asked for more input than the test provided")',
    '        return lines.pop(0)',
    '    buf = io.StringIO()',
    '    g = {"__name__": "__main__", "input": fake_input}',
    '    with contextlib.redirect_stdout(buf):',
    '        exec(code or __user_code__, g)',
    '    return buf.getvalue()',
    'def load():',
    '    g = {"__name__": "__exercise__"}',
    '    buf = io.StringIO()',
    '    with contextlib.redirect_stdout(buf):',
    '        exec(__user_code__, g)',
    '    return g',
    ''
  ].join('\n');
  const pyHarness = (code, tests) => `__user_code__ = ${JSON.stringify(code)}\n${PY_HELPERS}\n${tests}\nprint("ALL CHECKS PASSED")\n`;
  window.PY_HELPERS = PY_HELPERS;

  async function checkExercise(e, code) {
    if (e.lang === 'python') {
      const res = await Runners.runPython(pyHarness(code, e.tests), { timeout: 120000, scan: code + '\n' + e.tests });
      return res.ok
        ? { pass: true, html: `<div class="out-pass">✓ All checks passed.</div>` }
        : { pass: false, html: `<div class="out-fail">✗ Not yet.</div><pre class="out-err">${esc(cleanErr(res.error))}</pre>` };
    }
    if (e.lang === 'js') {
      const res = await Runners.runJS('const assert=(c,m)=>{if(!c)throw new Error("Check failed: "+(m||""))};\n' + code + '\n;\n' + e.tests);
      return res.ok ? { pass: true, html: `<pre class="out-text">${esc(res.stdout)}</pre><div class="out-pass">✓ All checks passed.</div>` }
        : { pass: false, html: `<pre class="out-text">${esc(res.stdout)}</pre><div class="out-fail">✗ ${esc(res.error)}</div>` };
    }
    if (e.lang === 'sql') {
      const mine = await Runners.runSQL(code, { fresh: true });
      if (!mine.ok) return { pass: false, html: `<pre class="out-err">${esc(mine.error)}</pre>` };
      const ref = await Runners.runSQL(e.tests, { fresh: true });
      const last = (r) => (r.results.length ? r.results[r.results.length - 1].values : []);
      const ordered = /order\s+by/i.test(e.tests);
      const norm = (rows) => {
        const x = rows.map((r) => JSON.stringify(r.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v))));
        return ordered ? x : x.sort();
      };
      const a = norm(last(mine)), b = norm(last(ref));
      const pass = a.length === b.length && a.every((v, k) => v === b[k]);
      return { pass, html: (pass ? '<div class="out-pass">✓ Your result matches the expected result.</div>' : `<div class="out-fail">✗ Your result differs from the expected one (${a.length} rows vs ${b.length} expected${ordered ? ', order matters' : ''}).</div>`) + Runners.renderSQLResult(mine) };
    }
    return { pass: false, html: '' };
  }

  function project(pid) {
    const p = DB.projects[pid];
    if (!p) return notFound();
    const m = DB.modules[p.moduleId], c = DB.courses[p.courseId];
    const doneN = p.milestones.filter((_, k) => Store.milestone(pid, k)).length;
    Store.setLast(`#/project/${pid}`, p.title);
    return {
      title: p.title, parent: `#/module/${m.id}`,
      html: `
      ${crumbs([[c.short, `#/course/${c.id}`], [m.title, `#/module/${m.id}`], ['Project']])}
      <header class="lesson-head"><div class="eyebrow">Project</div><h1>${il(p.title)}</h1></header>
      <section class="prose reading">${md(p.brief)}</section>
      ${p.milestones.length ? `<section class="panel"><h3>Milestones <span class="muted small" id="msCount">${doneN}/${p.milestones.length}</span></h3>
        <div class="milestones">${p.milestones.map((t, k) => `<label class="ms"><input type="checkbox" data-ms="${k}" ${Store.milestone(pid, k) ? 'checked' : ''}><span>${il(t)}</span></label>`).join('')}</div>
      </section>` : `<div class="complete-row"><label class="toggle"><input type="checkbox" id="projDone" ${Store.isDone(pid) ? 'checked' : ''}><span>Project completed</span></label></div>`}
      ${p.sections.map((s) => `<section class="panel"><h3>${il(s.title)}</h3><div class="prose">${md(s.md)}</div></section>`).join('')}
      ${pager('project', pid)}`,
      after() {
        $$('[data-ms]').forEach((cb) => cb.addEventListener('change', () => {
          Store.setMilestone(pid, +cb.dataset.ms, cb.checked);
          const n = p.milestones.filter((_, k) => Store.milestone(pid, k)).length;
          $('#msCount').textContent = `${n}/${p.milestones.length}`;
          if (n === p.milestones.length) toast('Project complete 🎉');
        }));
        const pd = $('#projDone');
        if (pd) pd.addEventListener('change', () => Store.setDone(pid, pd.checked));
      }
    };
  }

  function roadmap() {
    const items = CAT.path.map((cid, k) => {
      const c = DB.courses[cid], p = courseProgress(cid);
      const pre = (c.prereqs || []).map((mid) => DB.modules[mid]).filter(Boolean).map((m) => m.title);
      return `<a class="road-item" href="#/course/${cid}" style="--c:${c.color}">
        <div class="road-step">${k + 1}</div>
        <div class="bc-art small"><img src="${c.art}" alt=""></div>
        <div class="road-body"><strong>${esc(c.title)}</strong><span class="muted small">${esc(c.tagline)}</span>
          ${pre.length ? `<span class="small road-pre">Needs: ${pre.map(esc).join(' · ')}</span>` : ''}
          <div class="bc-prog">${bar(p.pct, c.color)}<span>${p.pct}%</span></div></div>
      </a>`;
    }).join('');
    return {
      title: 'Roadmap', tab: 'roadmap',
      html: `<header class="lesson-head"><div class="eyebrow">Learning path</div><h1>Roadmap</h1><p class="muted">The recommended order. Foundations are studied just in time, right before the bootcamp week that needs them.</p></header>
      <section class="road">${items}</section>
      <section class="prose reading">${md(DB.roadmap)}</section>`
    };
  }

  /* ---------------------------------------------------------------- review */
  function reviewPool() {
    const now = Date.now(), DAY = 864e5;
    const pool = [];
    Object.values(DB.modules).forEach((m) => {
      const started = m.lessons.some((l) => Store.isDone(l.id)) || Store.quizResult(m.id);
      if (!started) return;
      m.quiz.forEach((q) => pool.push(q));
    });
    const due = pool.filter((q) => {
      const s = Store.state.qs[q.id];
      if (!s) return true;
      if (!s.ok) return true;
      return now - s.ts > Math.pow(2, Math.max(0, (s.c || 1) - 1)) * DAY;
    });
    return { pool, due };
  }

  function review() {
    const { pool, due } = reviewPool();
    if (!pool.length) {
      return { title: 'Review', tab: 'review', html: `<header class="lesson-head"><h1>Review</h1></header><div class="empty"><p>Review uses <strong>spaced repetition</strong>: questions come back after 1, 2, 4, 8… days, and immediately if you got them wrong.</p><p class="muted">Complete a lesson to unlock its module's questions here.</p><a class="btn primary" href="#/roadmap">Find a lesson to start</a></div>` };
    }
    const source = due.length ? due : pool;
    const deck = shuffle(source.slice()).sort((a, b) => {
      const sa = Store.state.qs[a.id], sb = Store.state.qs[b.id];
      const wa = sa ? (sa.ok ? 1 : 0) : 0.5, wb = sb ? (sb.ok ? 1 : 0) : 0.5;
      return wa - wb;
    }).slice(0, 10);
    let k = 0, right = 0;
    return {
      title: 'Review', tab: 'review',
      html: `<header class="lesson-head"><div class="eyebrow">Spaced repetition</div><h1>Review</h1>
        <p class="muted">${due.length ? `${due.length} question${due.length > 1 ? 's' : ''} due` : 'Nothing due right now: here is extra practice'} · ${pool.length} questions unlocked</p></header>
        <div id="card"></div>`,
      after() {
        const card = $('#card');
        const draw = () => {
          if (k >= deck.length) {
            card.innerHTML = `<div class="result pass"><div class="result-score">${right}/${deck.length}</div><div><strong>Session complete.</strong> Questions you missed will come back first next time.</div></div><div class="quiz-actions"><a class="btn primary" href="#/review" data-act="reload">Another round</a><a class="btn" href="#/">Home</a></div>`;
            return;
          }
          const q = deck[k], m = DB.modules[q.moduleId], c = DB.courses[m.courseId];
          card.innerHTML = `<fieldset class="q review-q"><div class="muted small">${k + 1}/${deck.length} · ${esc(c.short)} · ${il(m.title)}</div>
            <legend><div class="q-stem">${md(q.stem)}</div></legend>${q.multi ? '<div class="muted small">Select all that apply.</div>' : ''}
            <div class="opts">${q.options.map((o, j) => `<label class="opt"><input type="${q.multi ? 'checkbox' : 'radio'}" name="rq" value="${j}"><span>${il(o.text)}</span></label>`).join('')}</div>
            <div class="explain" hidden>${md(q.explain)}<p><a href="#/module/${m.id}">Revisit this module →</a></p></div>
            <div class="quiz-actions"><button class="btn primary" data-act="rv-check">Check</button></div></fieldset>`;
          $('[data-act="rv-check"]', card).onclick = () => {
            const chosen = $$('input', card).filter((x) => x.checked).map((x) => +x.value);
            if (!chosen.length) { toast('Pick an answer first'); return; }
            const correct = q.options.map((o, j) => (o.correct ? j : -1)).filter((j) => j >= 0);
            const ok = chosen.length === correct.length && chosen.every((j) => correct.includes(j));
            if (ok) right++;
            Store.recordQuestion(q.id, ok);
            $('.q', card).classList.add(ok ? 'is-right' : 'is-wrong');
            $$('.opt', card).forEach((lab, j) => {
              lab.classList.toggle('opt-correct', correct.includes(j));
              lab.classList.toggle('opt-wrong', chosen.includes(j) && !correct.includes(j));
              $('input', lab).disabled = true;
            });
            $('.explain', card).hidden = false;
            $('.quiz-actions', card).innerHTML = `<button class="btn primary" data-act="rv-next">${k + 1 < deck.length ? 'Next →' : 'Finish'}</button>`;
            $('[data-act="rv-next"]', card).onclick = () => { k++; draw(); window.scrollTo(0, 0); };
          };
        };
        draw();
      }
    };
  }

  /* ---------------------------------------------------------------- search */
  function search(query) {
    const q = (query.get('q') || '').trim();
    return {
      title: 'Search', tab: 'search',
      html: `<header class="lesson-head"><h1>Search</h1></header>
        <input type="search" id="searchBox" class="search-box" placeholder="Search lessons, exercises, projects…" value="${esc(q)}" autocomplete="off">
        <div id="results" class="results"></div>`,
      after() {
        const box = $('#searchBox'), out = $('#results');
        const runQ = () => {
          const terms = box.value.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
          history.replaceState(null, '', '#/search' + (box.value ? '?q=' + encodeURIComponent(box.value) : ''));
          if (!terms.length) { out.innerHTML = `<p class="muted">Try “gradient descent”, “JOIN”, “Kubernetes probe”, “RAG chunking”, “decorator”…</p>`; return; }
          const hits = DB.search.map((d) => {
            if (!terms.every((t) => d.lc.includes(t))) return null;
            const tl = d.title.toLowerCase();
            const score = terms.reduce((s, t) => s + (tl.includes(t) ? 10 : 0) + Math.min(5, d.lc.split(t).length - 1), 0);
            return { d, score };
          }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 60);
          out.innerHTML = hits.length ? hits.map(({ d }) => {
            const lt = d.text.toLowerCase();
            const at = Math.max(0, lt.indexOf(terms[0]) - 70);
            let snip = esc((at ? '…' : '') + d.text.slice(at, at + 200) + '…');
            terms.forEach((t) => { snip = snip.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
            return `<a class="result-item" href="${d.hash}"><span class="muted small">${d.kind} · ${il(d.where)}</span><strong>${il(d.title)}</strong><span class="small">${snip}</span></a>`;
          }).join('') : '<p class="muted">No matches.</p>';
        };
        let t;
        box.addEventListener('input', () => { clearTimeout(t); t = setTimeout(runQ, 120); });
        runQ();
        if (!q) box.focus();
      }
    };
  }

  /* -------------------------------------------------------------- progress */
  function progress() {
    const o = overall();
    const rows = CAT.path.map((cid) => {
      const c = DB.courses[cid], p = courseProgress(cid);
      const by = (type) => tally((DB.steps[cid] || []).filter((s) => s.type === type));
      const L = by('lesson'), Q = by('quiz'), E = by('exercise'), P = by('project');
      return `<a class="prog-row" href="#/course/${cid}" style="--c:${c.color}"><div class="bc-art tiny"><img src="${c.art}" alt=""></div>
        <div class="prog-body"><div class="prog-top"><strong>${esc(c.title)}</strong><span>${p.pct}%</span></div>${bar(p.pct, c.color)}
        <div class="muted small">Lessons ${L.done}/${L.total} · Quizzes passed ${Q.done}/${Q.total} · Exercises ${E.done}/${E.total} · Projects ${P.done}/${P.total}</div></div></a>`;
    }).join('');
    const days = [];
    const d = new Date(); d.setDate(d.getDate() - 7 * 16 + 1 - ((d.getDay() + 6) % 7));
    for (let k = 0; k < 7 * 17; k++) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const n = Store.state.days[key] || 0;
      days.push(`<span class="hm hm${n ? Math.min(4, Math.ceil(n / 3)) : 0}" title="${key}: ${n}"></span>`);
      d.setDate(d.getDate() + 1);
      if (d > new Date()) break;
    }
    const marks = Object.keys(Store.state.marks).filter((id) => DB.lessons[id]);
    const notes = Object.keys(Store.state.notes).filter((id) => DB.lessons[id]);
    const theme = Store.setting('theme') || 'dark';
    return {
      title: 'Progress', tab: 'progress',
      html: `<header class="lesson-head"><h1>Progress</h1></header>
      <section class="stats">
        <div class="stat">${ring(o.pct, 52)}<div><strong>${o.done}/${o.total}</strong><span>steps completed</span></div></div>
        <div class="stat"><div class="stat-big">🔥 ${Store.streak()}</div><div><strong>day streak</strong><span>${Object.keys(Store.state.days).length} active days total</span></div></div>
      </section>
      <section class="panel"><h3>Activity</h3><div class="heatmap">${days.join('')}</div></section>
      <section class="prog-list">${rows}</section>
      <section class="panel"><h3>🔖 Bookmarks</h3>${marks.length ? `<div class="link-list">${marks.map((id) => `<a href="#/lesson/${id}">${il(DB.lessons[id].title)} <span class="muted small">${esc(DB.courses[DB.lessons[id].courseId].short)}</span></a>`).join('')}</div>` : '<p class="muted small">Bookmark lessons you want to revisit.</p>'}</section>
      <section class="panel"><h3>📝 Notes</h3>${notes.length ? `<div class="link-list">${notes.map((id) => `<a href="#/lesson/${id}"><strong>${il(DB.lessons[id].title)}</strong><span class="muted small">${esc(Store.note(id).slice(0, 140))}</span></a>`).join('')}</div>` : '<p class="muted small">Your lesson notes will appear here.</p>'}</section>

      <section class="panel" id="backup"><h3>💾 Backup &amp; sync between devices</h3>
        <p class="muted small">Progress is stored only on this device: there is no server. To move it between your iPad and Android phone, or to keep a safe copy, export a backup and import it on the other device. <strong>Merge</strong> combines both devices' progress.</p>
        <div class="btn-row">
          <button class="btn primary" data-act="export-file">⬇ Export backup file</button>
          <button class="btn" data-act="export-copy">📋 Copy backup as text</button>
          <label class="btn">⬆ Import file<input type="file" id="importFile" accept="application/json,.json,text/plain" hidden></label>
        </div>
        <details class="paste"><summary>Paste backup text instead</summary>
          <textarea id="importText" rows="4" placeholder="Paste the copied backup text here"></textarea>
          <div class="btn-row"><button class="btn" data-act="import-text" data-mode="merge">Merge</button><button class="btn" data-act="import-text" data-mode="replace">Replace</button></div>
        </details>
      </section>

      <section class="panel"><h3>⚙️ Settings</h3>
        <div class="setting"><span>Theme</span><div class="seg">${['dark', 'light', 'system'].map((t) => `<button class="${theme === t ? 'on' : ''}" data-act="theme" data-v="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
        <div class="setting"><span>Reading text size</span><input type="range" id="fontScale" min="0.85" max="1.45" step="0.05" value="${Store.setting('fontScale') || 1}"></div>
        <div class="setting"><span>App version</span><span class="muted">${esc(self.APP_VERSION)} <button class="btn small ghost" data-act="update">Check for updates</button></span></div>
        <div class="setting"><span>Storage</span><span class="muted small" id="persistState">checking…</span></div>
        <div class="setting danger"><span>Reset all progress</span><button class="btn small danger" data-act="reset">Reset…</button></div>
      </section>`,
      after() {
        $('#fontScale').addEventListener('input', (e) => { document.documentElement.style.setProperty('--read-scale', e.target.value); Store.setSetting('fontScale', +e.target.value); });
        $('#importFile').addEventListener('change', async (e) => {
          const f = e.target.files[0];
          if (!f) return;
          const mode = confirm('Merge this backup with your current progress?\n\nOK = Merge (recommended)\nCancel = Replace current progress') ? 'merge' : 'replace';
          try { Store.importJSON(await f.text(), mode); toast('Backup imported ✓'); route(); } catch (err) { alert(err.message); }
        });
        if (navigator.storage && navigator.storage.persisted) {
          navigator.storage.persisted().then((p) => { $('#persistState').textContent = p ? 'Persistent (protected from automatic clean-up)' : 'Best-effort: export backups regularly'; }).catch(() => {});
        } else $('#persistState').textContent = 'Best-effort: export backups regularly';
      }
    };
  }

  /* ------------------------------------------------------------ playground */
  function playground(query) {
    const lang = ['python', 'sql', 'js'].includes(query.get('lang')) ? query.get('lang') : 'python';
    const key = 'play-' + lang;
    const samples = {
      python: '# Python 3 runs right here in your browser.\nname = input("Your name? ")\nprint(f"Hello, {name}!")\n\nsquares = [n * n for n in range(1, 11)]\nprint(squares, sum(squares))\n',
      sql: '-- SQLite with a sample shop database. Tables: customers, products, orders, order_items, categories\nSELECT c.country, COUNT(DISTINCT o.order_id) AS orders, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue\nFROM orders o\nJOIN customers c ON c.customer_id = o.customer_id\nJOIN order_items oi ON oi.order_id = o.order_id\nGROUP BY c.country\nORDER BY revenue DESC;\n',
      js: '// Modern JavaScript; console.log output appears below.\nconst nums = [3, 1, 4, 1, 5, 9, 2, 6];\nconst evens = nums.filter(n => n % 2 === 0);\nconsole.log("evens:", evens);\n\nconst wait = ms => new Promise(r => setTimeout(r, ms));\nawait wait(300);\nconsole.log("done after 300 ms");\n'
    };
    const code = (Store.state.code[key] ?? (query.get('code') || samples[lang]));
    return {
      title: 'Playground',
      html: `<header class="lesson-head"><div class="eyebrow">Practice space</div><h1>Playground</h1></header>
      <div class="seg wide">${[['python', 'Python'], ['sql', 'SQL'], ['js', 'JavaScript']].map(([k, n]) => `<a class="${k === lang ? 'on' : ''}" href="#/playground?lang=${k}">${n}</a>`).join('')}</div>
      <section class="workbench" data-lang="${lang}">
        <div class="wb-head"><span>${{ python: 'Python 3 (Pyodide)', sql: 'SQLite — shop database', js: 'JavaScript' }[lang]}</span>
          <span class="wb-actions">${lang === 'python' ? '<button class="btn small" data-act="pg-stop">■ Stop</button>' : ''}${lang === 'sql' ? '<button class="btn small" data-act="pg-schema">Schema</button><button class="btn small" data-act="pg-resetdb">Reset DB</button>' : ''}<button class="btn small" data-act="pg-sample">Sample</button><button class="btn small primary" data-act="pg-run">▶ Run</button></span></div>
        <textarea class="editor" id="pgEditor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off">${esc(code)}</textarea>
        ${lang === 'python' ? '<details class="stdin" open><summary>Program input (stdin)</summary><textarea id="pgStdin" rows="2" placeholder="One line per input() call">Armo</textarea></details>' : ''}
        <div class="out" id="pgOut" hidden></div>
      </section>
      <p class="muted small">${lang === 'python' ? 'The Python runtime (≈10 MB) downloads the first time, then works offline. numpy, pandas and scikit-learn load automatically when you import them (a larger one-time download). For PyTorch and matplotlib use Google Colab or a local install.' : lang === 'sql' ? 'SQLite dialect. Changes you make (INSERT/UPDATE) persist until you press Reset DB.' : 'Top-level await works. Code runs in this page.'}</p>`,
      after() {
        const ed = $('#pgEditor'), out = $('#pgOut');
        setupEditor(ed, (v) => { Store.state.code[key] = v; Store.setCode(key, v); });
        view.addEventListener('click', async (ev) => {
          const b = ev.target.closest('[data-act^="pg-"]');
          if (!b) return;
          const act = b.dataset.act;
          if (act === 'pg-sample') { ed.value = samples[lang]; Store.setCode(key, ed.value); autosize(ed); return; }
          if (act === 'pg-stop') { Runners.stopPython(); toast('Python stopped'); return; }
          if (act === 'pg-resetdb') { await Runners.resetSQL(); toast('Database reset'); return; }
          if (act === 'pg-schema') {
            out.hidden = false;
            const r = await Runners.runSQL("SELECT m.name AS table_name, p.name AS column, p.type FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type='table' ORDER BY m.name, p.cid;");
            out.innerHTML = Runners.renderSQLResult(r);
            return;
          }
          if (act === 'pg-run') {
            b.disabled = true;
            out.hidden = false;
            try { out.innerHTML = await runToHtml(lang, ed.value, { stdin: $('#pgStdin') && $('#pgStdin').value, live: out }); } finally { b.disabled = false; }
          }
        });
      }
    };
  }

  function notFound() {
    return { title: 'Not found', html: '<div class="empty"><h1>Not found</h1><p class="muted">That page does not exist (maybe the content was reorganized).</p><a class="btn primary" href="#/">Go home</a></div>' };
  }

  /* ============================================================ code runs */
  const cleanErr = (s) => String(s || '').replace(/\n\s*$/, '');
  async function runToHtml(lang, code, opts) {
    opts = opts || {};
    if (lang === 'sql') return Runners.renderSQLResult(await Runners.runSQL(code));
    if (lang === 'js') {
      const r = await Runners.runJS(code);
      return `${r.stdout ? `<pre class="out-text">${esc(r.stdout)}</pre>` : ''}${r.ok ? (r.stdout ? '' : '<div class="out-note">(no output)</div>') : `<pre class="out-err">${esc(r.error)}</pre>`}`;
    }
    if (lang === 'python') {
      let buf = '';
      const live = opts.live;
      if (live) { live.hidden = false; live.innerHTML = '<div class="out-note">Running… (first run downloads Python, ≈10 MB)</div><pre class="out-text"></pre>'; }
      const r = await Runners.runPython(code, {
        stdin: opts.stdin,
        onOut: (t) => { buf += t; if (live) { const pre = $('.out-text', live); if (pre) pre.textContent = buf; } }
      });
      return `${buf ? `<pre class="out-text">${esc(buf)}</pre>` : ''}${r.ok ? (buf ? '' : '<div class="out-note">(no output)</div>') : `<pre class="out-err">${esc(cleanErr(r.error))}</pre>`}`;
    }
    return '';
  }

  function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(Math.max(ta.scrollHeight + 4, 120), window.innerHeight * 0.7) + 'px'; }
  function setupEditor(ta, onSave) {
    autosize(ta);
    let t;
    ta.addEventListener('input', () => { autosize(ta); clearTimeout(t); t = setTimeout(() => onSave && onSave(ta.value), 400); });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const s = ta.selectionStart, en = ta.selectionEnd;
        ta.setRangeText('    ', s, en, 'end');
        ta.dispatchEvent(new Event('input'));
      } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const s = ta.selectionStart;
        const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
        const line = ta.value.slice(lineStart, s);
        let ind = line.match(/^\s*/)[0];
        if (/[:{[(]\s*$/.test(line)) ind += '    ';
        e.preventDefault();
        ta.setRangeText('\n' + ind, s, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const btn = ta.closest('.workbench').querySelector('[data-act="pg-run"],[data-act="ex-run"]');
        if (btn) btn.click();
      }
    });
  }

  /* ========================================================== interaction */
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'copy-code') {
      const src = $('#' + b.dataset.target + ' .code-src');
      try { await navigator.clipboard.writeText(src.value); toast('Copied'); } catch (err) { toast('Copy failed'); }
    } else if (act === 'run-code' || act === 'edit-code') {
      const block = $('#' + b.dataset.target);
      const lang = block.dataset.lang;
      let ed = $('textarea.editor', block);
      if (act === 'edit-code') {
        if (!ed) {
          ed = document.createElement('textarea');
          ed.className = 'editor inline-editor';
          ed.spellcheck = false;
          ed.value = $('.code-src', block).value;
          $('pre', block).replaceWith(ed);
          setupEditor(ed);
          ed.focus();
          b.textContent = 'Editing';
          b.disabled = true;
        }
        return;
      }
      const code = ed ? ed.value : $('.code-src', block).value;
      let out = block.nextElementSibling;
      if (!out || !out.classList.contains('code-out')) {
        out = document.createElement('div');
        out.className = 'out code-out';
        block.after(out);
      }
      b.disabled = true;
      try {
        out.innerHTML = await runToHtml(lang, code, { stdin: (block.dataset.stdin || '').replace(/\\n/g, '\n'), live: out });
      } finally { b.disabled = false; }
    } else if (act === 'complete') {
      Store.setDone(b.dataset.id, true);
      location.hash = b.dataset.next;
    } else if (act === 'uncomplete') {
      Store.setDone(b.dataset.id, false); route();
    } else if (act === 'bookmark') {
      const on = Store.toggleMark(b.dataset.id);
      b.setAttribute('aria-pressed', on);
      b.innerHTML = `${on ? ICON.bookmarkOn : ICON.bookmark} ${on ? 'Bookmarked' : 'Bookmark'}`;
    } else if (act === 'font') {
      const v = Math.min(1.45, Math.max(0.85, (Store.setting('fontScale') || 1) + parseFloat(b.dataset.d)));
      Store.setSetting('fontScale', Math.round(v * 100) / 100);
      document.documentElement.style.setProperty('--read-scale', v);
    } else if (act === 'toc') {
      e.preventDefault();
      const t = document.getElementById(b.dataset.target);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const det = b.closest('details'); if (det) det.open = false;
    } else if (act === 'retry') {
      route(); window.scrollTo(0, 0);
    } else if (act === 'reload') {
      e.preventDefault(); route();
    } else if (act === 'theme') {
      Store.setSetting('theme', b.dataset.v); applyTheme(); route();
    } else if (act === 'export-file') {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `armo-learn-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } else if (act === 'export-copy') {
      try { await navigator.clipboard.writeText(Store.exportJSON()); toast('Backup copied: paste it into a note or message to yourself'); } catch (err) { prompt('Copy this backup text:', Store.exportJSON()); }
    } else if (act === 'import-text') {
      try { Store.importJSON($('#importText').value, b.dataset.mode); toast('Backup imported ✓'); route(); } catch (err) { alert(err.message); }
    } else if (act === 'reset') {
      if (confirm('Erase ALL progress, notes and bookmarks on this device?') && confirm('Really? Consider exporting a backup first. This cannot be undone.')) { Store.reset(); toast('Progress reset'); route(); }
    } else if (act === 'update') {
      checkUpdate(true);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight') { const n = $('[data-key="next"]'); if (n) location.hash = n.getAttribute('href'); }
    if (e.key === 'ArrowLeft') { const p = $('[data-key="prev"]'); if (p) location.hash = p.getAttribute('href'); }
    if (e.key === '/') { e.preventDefault(); location.hash = '#/search'; }
  });

  /* =============================================================== router */
  const routes = [
    [/^\/?$/, () => home()],
    [/^\/course\/([\w-]+)$/, (m) => course(m[1])],
    [/^\/module\/([\w-]+)$/, (m) => moduleView(m[1])],
    [/^\/lesson\/([\w-]+)$/, (m) => lesson(m[1])],
    [/^\/quiz\/([\w-]+)$/, (m) => quiz(m[1])],
    [/^\/exercise\/([\w-]+)$/, (m) => exercise(m[1])],
    [/^\/project\/([\w-]+)$/, (m) => project(m[1])],
    [/^\/roadmap$/, () => roadmap()],
    [/^\/review$/, () => review()],
    [/^\/search$/, (m, q) => search(q)],
    [/^\/progress$/, () => progress()],
    [/^\/playground$/, (m, q) => playground(q)]
  ];
  let currentParent = '#/';
  let lastPath = null;

  function route() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = hash.split('?');
    const query = new URLSearchParams(qs || '');
    let res = null;
    for (const [re, fn] of routes) {
      const m = path.match(re);
      if (m) { res = fn(m, query); break; }
    }
    res = res || notFound();
    const fresh = view.cloneNode(false); // drop listeners added by the previous view
    view.replaceWith(fresh);
    view = fresh;
    fresh.innerHTML = res.html;
    document.title = (res.title ? MD.plain(res.title) + ' · ' : '') + 'Armo Learn';
    $('#topTitle').textContent = res.title && path !== '/' ? MD.plain(res.title) : '';
    currentParent = res.parent || null;
    $('#backBtn').hidden = !currentParent;
    const tab = res.tab || (/^\/(course|module|lesson|quiz|exercise|project)/.test(path) || path === '/' || path === '' ? 'home' : '');
    $$('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
    document.body.classList.toggle('is-reading', !!res.reading);
    if (path !== lastPath) window.scrollTo(0, 0);
    lastPath = path;
    if (res.after) res.after();
    updateReadProgress();
  }

  function updateReadProgress() {
    const el = $('#readProgress');
    if (!document.body.classList.contains('is-reading')) { el.style.width = '0'; return; }
    const h = document.documentElement.scrollHeight - innerHeight;
    el.style.width = (h > 0 ? Math.min(100, (scrollY / h) * 100) : 100) + '%';
  }
  addEventListener('scroll', updateReadProgress, { passive: true });

  $('#backBtn').addEventListener('click', () => { if (currentParent) location.hash = currentParent; });

  /* ============================================================== utility */
  function shuffle(a) { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; }
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function applyTheme() {
    let t = Store.setting('theme') || 'dark';
    if (t === 'system') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = t === 'light' ? '#f5f6fa' : '#0f1220';
  }

  /* ======================================================= service worker */
  let swReg = null;
  async function checkUpdate(manual) {
    if (!swReg) { if (manual) toast('Offline support is not active in this browser'); return; }
    try { await swReg.update(); if (manual) toast(swReg.waiting || swReg.installing ? 'Updating… the app will reload' : 'You have the latest version'); } catch (e) { if (manual) toast('Could not check for updates (offline?)'); }
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      swReg = reg;
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('New content downloaded: it will be used next time you open the app');
        });
      });
    }).catch(() => {});
  }

  /* ================================================================= boot */
  (async function boot() {
    applyTheme();
    try {
      await loadContent();
    } catch (err) {
      $('#view').innerHTML = `<div class="empty"><h1>Could not load content</h1><p class="muted">${esc(err.message)}</p></div>`;
      return;
    }
    addEventListener('hashchange', route);
    route();
  })();

  window.ArmoLearn = { DB, route, toast };
})();
