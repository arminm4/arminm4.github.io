/* Parses a module markdown file into { meta, intro, lessons, quiz, exercises, projects, sources }.
 *
 * File layout:
 *   ---                       front matter (id, title, week, summary, builds_on, leads_to, kind)
 *   ---
 *   intro markdown
 *   # Lesson: Title (20 min)  lesson body (## / ### headings allowed)
 *   # Quiz                    ## question … - [ ] wrong / - [x] right … > explanation
 *   # Exercise: Title         prompt, then optional ## Hint, ## Solution, ## Starter, ## Tests
 *   # Project: Title          brief, ## Milestones (task list), other ## sections
 *   # Sources                 list of links
 */
(function (global) {
  'use strict';

  function frontMatter(text) {
    const m = text.match(/^﻿?---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (!m) return { meta: {}, body: text };
    const meta = {};
    m[1].split('\n').forEach((l) => {
      const k = l.match(/^(\w+)\s*:\s*(.*)$/);
      if (k) meta[k[1]] = k[2].trim();
    });
    ['builds_on', 'leads_to'].forEach((k) => {
      meta[k] = meta[k] ? meta[k].split(',').map((s) => s.trim()).filter(Boolean) : [];
    });
    return { meta, body: text.slice(m[0].length) };
  }

  // Split into top-level "# " sections, ignoring headings inside fenced code.
  function sections(body, level) {
    const marker = '#'.repeat(level) + ' ';
    const lines = body.split('\n');
    const out = [];
    let cur = { head: null, lines: [] };
    let fence = null;
    for (const line of lines) {
      const f = line.match(/^\s*(```+|~~~+)/);
      if (f) {
        if (!fence) fence = f[1];
        else if (line.trim().startsWith(fence)) fence = null;
      }
      if (!fence && line.startsWith(marker)) {
        out.push(cur);
        cur = { head: line.slice(marker.length).trim(), lines: [] };
      } else cur.lines.push(line);
    }
    out.push(cur);
    return out.map((s) => ({ head: s.head, text: s.lines.join('\n').trim() }));
  }

  function parseQuiz(text, moduleId) {
    return sections(text, 2).filter((s) => s.head !== null).map((s, n) => {
      const lines = s.text.split('\n');
      const stem = [s.head];
      const options = [];
      const explain = [];
      let fence = null;
      for (const line of lines) {
        const f = line.match(/^\s*(```+|~~~+)/);
        if (f) { if (!fence) fence = f[1]; else if (line.trim().startsWith(fence)) fence = null; }
        const om = !fence && line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
        if (om) options.push({ text: om[2], correct: om[1] !== ' ' });
        else if (!fence && options.length && /^\s*>/.test(line)) explain.push(line.replace(/^\s*>\s?/, ''));
        else if (!options.length) stem.push(line);
        else if (explain.length) explain.push(line);
      }
      const correctCount = options.filter((o) => o.correct).length;
      return {
        id: `${moduleId}-q${n + 1}`,
        stem: stem.join('\n').trim(),
        options,
        multi: correctCount > 1,
        explain: explain.join('\n').trim()
      };
    }).filter((q) => q.options.length >= 2);
  }

  function parseExercise(head, text, id) {
    const parts = sections(text, 2);
    const ex = { id, title: head.replace(/^Exercise:\s*/i, ''), prompt: '', hint: '', solution: '', starter: '', tests: '', lang: '' };
    const extra = [];
    parts.forEach((p, k) => {
      if (k === 0) { ex.prompt = p.text; return; }
      const h = (p.head || '').toLowerCase();
      if (h.startsWith('hint')) ex.hint = p.text;
      else if (h.startsWith('solution')) ex.solution = p.text;
      else if (h.startsWith('starter')) ex.starter = codeOf(p.text, ex);
      else if (h.startsWith('tests')) ex.tests = codeOf(p.text, ex);
      else extra.push(`## ${p.head}\n\n${p.text}`);
    });
    if (extra.length) ex.prompt += '\n\n' + extra.join('\n\n');
    return ex;
  }

  function codeOf(text, ex) {
    const m = text.match(/```(\w*)[^\n]*\n([\s\S]*?)\n```/);
    if (!m) return text;
    if (m[1] && !ex.lang) ex.lang = { py: 'python', javascript: 'js', sqlite: 'sql' }[m[1]] || m[1];
    return m[2];
  }

  function parseProject(head, text, id) {
    const parts = sections(text, 2);
    const pr = { id, title: head.replace(/^Project:\s*/i, ''), brief: '', milestones: [], sections: [] };
    parts.forEach((p, k) => {
      if (k === 0) { pr.brief = p.text; return; }
      if (/^milestones?/i.test(p.head)) {
        p.text.split('\n').forEach((l) => {
          const m = l.match(/^\s*[-*]\s+\[[ xX]\]\s+(.*)$/);
          if (m) pr.milestones.push(m[1]);
          else if (pr.milestones.length && /^\s{2,}\S/.test(l)) pr.milestones[pr.milestones.length - 1] += ' ' + l.trim();
        });
      } else pr.sections.push({ title: p.head, md: p.text });
    });
    return pr;
  }

  function parseModule(text, courseId, order) {
    const { meta, body } = frontMatter(text.replace(/\r\n?/g, '\n'));
    const id = meta.id || `${courseId}-m${order + 1}`;
    const mod = {
      id, courseId, order,
      title: meta.title || id,
      week: meta.week || '',
      summary: meta.summary || '',
      kind: meta.kind || 'module',
      buildsOn: meta.builds_on || [],
      leadsTo: meta.leads_to || [],
      intro: '', lessons: [], quiz: [], exercises: [], projects: [], sources: ''
    };
    sections(body, 1).forEach((sec) => {
      if (sec.head === null) { mod.intro = sec.text; return; }
      const h = sec.head;
      if (/^Lesson:/i.test(h)) {
        const mm = h.match(/^Lesson:\s*(.*?)\s*(?:\((\d+)\s*min\))?\s*$/i);
        const n = mod.lessons.length + 1;
        mod.lessons.push({ id: `${id}-l${n}`, n, title: mm[1], minutes: mm[2] ? +mm[2] : estimate(sec.text), md: sec.text, moduleId: id, courseId });
      } else if (/^Quiz/i.test(h)) {
        mod.quiz = mod.quiz.concat(parseQuiz(sec.text, id));
      } else if (/^Exercise:/i.test(h)) {
        const ex = parseExercise(h, sec.text, `${id}-e${mod.exercises.length + 1}`);
        ex.moduleId = id; ex.courseId = courseId;
        mod.exercises.push(ex);
      } else if (/^Project:/i.test(h)) {
        const pr = parseProject(h, sec.text, `${id}-p${mod.projects.length + 1}`);
        pr.moduleId = id; pr.courseId = courseId;
        mod.projects.push(pr);
      } else if (/^Sources|^References|^Further reading/i.test(h)) {
        mod.sources = sec.text;
      } else {
        mod.intro += `\n\n## ${h}\n\n${sec.text}`;
      }
    });
    return mod;
  }

  function estimate(md) {
    const words = md.replace(/```[\s\S]*?```/g, (c) => ' '.repeat(Math.round(c.length / 12))).split(/\s+/).length;
    return Math.max(5, Math.round(words / 160));
  }

  global.Parser = { parseModule, frontMatter, sections };
})(typeof window !== 'undefined' ? window : globalThis);
