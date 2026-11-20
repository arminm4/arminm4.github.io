/* Small, dependency-free Markdown renderer tuned for the lesson files.
 * Supports: headings, paragraphs, emphasis, links, images, inline/fenced code (with
 * highlighting + run buttons), lists (nested, task lists), tables, blockquotes and
 * callouts (> [!tip]), horizontal rules, raw HTML blocks, and TeX-style math via a
 * mini renderer ($...$ inline, $$...$$ display). */
(function (global) {
  'use strict';

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ------------------------------------------------------------------ TeX */
  const SYM = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
    vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
    tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
    cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠',
    approx: '≈', equiv: '≡', sim: '∼', simeq: '≃', propto: '∝', in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆',
    supset: '⊃', cup: '∪', cap: '∩', emptyset: '∅', varnothing: '∅', infty: '∞', partial: '∂', nabla: '∇',
    to: '→', rightarrow: '→', leftarrow: '←', gets: '←', Rightarrow: '⇒', Leftarrow: '⇐', implies: '⇒',
    iff: '⇔', Leftrightarrow: '⇔', leftrightarrow: '↔', mapsto: '↦', uparrow: '↑', downarrow: '↓',
    forall: '∀', exists: '∃', neg: '¬', lnot: '¬', land: '∧', wedge: '∧', lor: '∨', vee: '∨', oplus: '⊕', otimes: '⊗',
    ldots: '…', dots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱', top: '⊤', perp: '⊥', circ: '∘', star: '⋆', ast: '∗',
    bullet: '•', prime: '′', degree: '°', mid: ' | ', colon: ':', lvert: '|', rvert: '|', vert: '|', lVert: '‖', rVert: '‖',
    langle: '⟨', rangle: '⟩', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', ell: 'ℓ', hbar: 'ℏ', Re: 'ℜ', Im: 'ℑ',
    quad: ' ', qquad: '  ', ',': ' ', ';': ' ', ':': ' ', '!': '', ' ': ' ',
    '{': '{', '}': '}', '|': '‖', '%': '%', '#': '#', '&': '&amp;', '_': '_', '$': '$', backslash: '\\', setminus: '∖',
    therefore: '∴', because: '∵', angle: '∠', triangle: '△', square: '□', checkmark: '✓', ll: '≪', gg: '≫'
  };
  const BIG = { sum: '∑', prod: '∏', int: '∫', oint: '∮', iint: '∬', bigcup: '⋃', bigcap: '⋂', coprod: '∐' };
  const FUNCS = ['log', 'ln', 'exp', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh',
    'tanh', 'det', 'dim', 'ker', 'rank', 'tr', 'deg', 'gcd', 'Pr', 'Var', 'Cov', 'sgn', 'softmax', 'ReLU', 'diag'];
  const LIMFUNCS = ['max', 'min', 'lim', 'sup', 'inf', 'argmax', 'argmin', 'arg'];
  const BB = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', E: '𝔼', P: 'ℙ', '1': '𝟙' };
  const ACCENT = { hat: '̂', bar: '̄', tilde: '̃', vec: '⃗', dot: '̇', ddot: '̈', check: '̌' };

  function tex(src, keepSeps) {
    let i = 0;
    const s = String(src);
    const skipWs = () => { while (i < s.length && /\s/.test(s[i])) i++; };

    function group() { // after '{' — read until matching '}'
      let out = '';
      while (i < s.length) {
        if (s[i] === '}') { i++; return out; }
        out += atom();
      }
      return out;
    }
    function rawGroup() { // literal text inside {...}
      skipWs();
      if (s[i] !== '{') return s[i++] || '';
      let depth = 0, start = ++i;
      for (; i < s.length; i++) {
        if (s[i] === '{') depth++;
        else if (s[i] === '}') { if (depth === 0) break; depth--; }
      }
      const t = s.slice(start, i); i++;
      return t;
    }
    function arg() {
      skipWs();
      if (s[i] === '{') { i++; return group(); }
      return atom();
    }
    function scripts(base) { // attach ^ and _ following a big operator, stacked
      let sup = '', sub = '';
      for (let k = 0; k < 2; k++) {
        skipWs();
        if (s[i] === '^') { i++; sup = arg(); } else if (s[i] === '_') { i++; sub = arg(); }
      }
      if (!sup && !sub) return base;
      return `<span class="tx-lim"><span class="tx-limsup">${sup || '&nbsp;'}</span><span class="tx-limop">${base}</span><span class="tx-limsub">${sub || '&nbsp;'}</span></span>`;
    }
    function env(name) {
      const endTag = '\\end{' + name + '}';
      const end = s.indexOf(endTag, i);
      const inner = s.slice(i, end < 0 ? s.length : end);
      i = end < 0 ? s.length : end + endTag.length;
      const rows = tex(inner.replace(/\\\\/g, '\u0002').replace(/&/g, '\u0001'), true)
        .split('\u0002').filter((r, idx, arr) => r.trim() || idx < arr.length - 1);
      const table = '<span class="tx-mat">' + rows.map((r) =>
        '<span class="tx-row">' + r.split('\u0001').map((c) => `<span class="tx-cell">${c}</span>`).join('') + '</span>').join('') + '</span>';
      const L = { bmatrix: '[', pmatrix: '(', vmatrix: '|', Vmatrix: '‖', cases: '{' }[name];
      const R = { bmatrix: ']', pmatrix: ')', vmatrix: '|', Vmatrix: '‖' }[name];
      if (!L) return `<span class="tx-env">${table}</span>`;
      const delim = (ch, side) => {
        if (ch === '[' || ch === ']') return `<span class="tx-br tx-br-${side}"></span>`;
        if (ch === '(' || ch === ')') return `<span class="tx-br tx-par tx-br-${side}"></span>`;
        if (ch === '|' || ch === '‖') return `<span class="tx-br tx-bar"></span>`;
        return `<span class="tx-delim">${ch}</span>`;
      };
      return `<span class="tx-env">${delim(L, 'l')}${table}${R ? delim(R, 'r') : ''}</span>`;
    }
    function command(name) {
      if (name in BIG) return scripts(`<span class="tx-big">${BIG[name]}</span>`);
      if (LIMFUNCS.includes(name)) {
        const label = name === 'argmax' ? 'arg max' : name === 'argmin' ? 'arg min' : name;
        return scripts(`<span class="tx-fn">${label}</span>`);
      }
      if (FUNCS.includes(name)) return `<span class="tx-fn">${name}</span>`;
      if (name in SYM) return SYM[name];
      switch (name) {
        case 'frac': case 'dfrac': case 'tfrac': {
          const n = arg(), d = arg();
          return `<span class="tx-frac"><span>${n}</span><span>${d}</span></span>`;
        }
        case 'binom': {
          const n = arg(), k = arg();
          return `<span class="tx-delim">(</span><span class="tx-frac tx-binom"><span>${n}</span><span>${k}</span></span><span class="tx-delim">)</span>`;
        }
        case 'sqrt': {
          skipWs();
          let idx = '';
          if (s[i] === '[') { const e = s.indexOf(']', i); idx = tex(s.slice(i + 1, e)); i = e + 1; }
          const body = arg();
          return `${idx ? `<sup class="tx-root">${idx}</sup>` : ''}<span class="tx-sqrt">√<span class="tx-rad">${body}</span></span>`;
        }
        case 'mathbf': case 'boldsymbol': case 'bm': return `<b class="tx-bf">${arg()}</b>`;
        case 'mathrm': case 'operatorname': return `<span class="tx-fn">${esc(rawGroup())}</span>`;
        case 'text': case 'textrm': case 'mbox': return `<span class="tx-text">${esc(rawGroup())}</span>`;
        case 'textbf': return `<b class="tx-text">${esc(rawGroup())}</b>`;
        case 'textit': case 'mathit': return `<i>${esc(rawGroup())}</i>`;
        case 'mathbb': { const g = rawGroup(); return BB[g] || esc(g); }
        case 'mathcal': case 'mathscr': return `<span class="tx-cal">${esc(rawGroup())}</span>`;
        case 'overline': return `<span class="tx-over">${arg()}</span>`;
        case 'underline': return `<span class="tx-under">${arg()}</span>`;
        case 'underbrace': case 'overbrace': { const a = arg(); skipWs(); if (s[i] === '_' || s[i] === '^') { i++; const l = arg(); return `<span class="tx-lim"><span class="tx-limop">${a}</span><span class="tx-limsub">${l}</span></span>`; } return a; }
        case 'left': case 'right': case 'big': case 'Big': case 'bigg': case 'Bigg': case 'bigl': case 'bigr': case 'Bigl': case 'Bigr': {
          skipWs();
          if (s[i] === '.') { i++; return ''; }
          return atom();
        }
        case 'displaystyle': case 'textstyle': case 'limits': case 'nolimits': return '';
        case 'begin': return env(rawGroup());
        case 'end': rawGroup(); return '';
        case '\\': return '\u0002';
      }
      if (name in ACCENT) {
        const a = arg();
        if (/^<i>.<\/i>$/.test(a) || a.length === 1) return a.replace(/(<\/i>)?$/, ACCENT[name] + '$1');
        return `<span class="tx-over">${a}</span>`;
      }
      return `<span class="tx-fn">${esc(name)}</span>`;
    }
    function atom() {
      const c = s[i];
      if (c === undefined) return '';
      if (c === '{') { i++; return group(); }
      if (c === '\\') {
        i++;
        let name = '';
        if (/[a-zA-Z]/.test(s[i])) { while (i < s.length && /[a-zA-Z]/.test(s[i])) name += s[i++]; }
        else name = s[i++];
        return command(name);
      }
      if (c === '^' || c === '_') {
        i++;
        const a = arg();
        return c === '^' ? `<sup>${a}</sup>` : `<sub>${a}</sub>`;
      }
      if (c === '&') { i++; return '\u0001'; }
      i++;
      if (/\s/.test(c)) return '';
      if (/[a-zA-Z]/.test(c)) return `<i>${c}</i>`;
      if (c === "'") return '′';
      if (c === '-') return '<span class="tx-op">−</span>';
      if ('=+<>'.includes(c)) return `<span class="tx-op">${esc(c)}</span>`;
      if (c === '*') return '∗';
      if (c === ',') return ',<span class="tx-thin"></span>';
      return esc(c);
    }
    let out = '';
    while (i < s.length) out += atom();
    return keepSeps ? out : out.replace(/[\u0001\u0002]/g, ' ');
  }

  /* ------------------------------------------------------------ highlight */
  const KW = {
    python: 'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case print len range self int str float list dict set tuple bool type isinstance super open enumerate zip map filter sorted sum min max abs round input',
    js: 'async await break case catch class const continue debugger default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield console document window fetch JSON Promise Math Object Array String Number',
    sql: 'select from where and or not in is null as join inner left right full outer cross on group by order having limit offset distinct union all insert into values update set delete create table view index primary key foreign references drop alter add column with recursive case when then else end over partition rows range between preceding following current row unbounded asc desc count sum avg min max cast coalesce nullif exists like ilike top int integer text varchar date timestamp numeric decimal real boolean default unique check constraint explain analyze lag lead rank dense_rank row_number ntile first_value last_value round strftime extract interval returning materialized trigger begin commit rollback transaction',
    bash: 'if then else elif fi for in do done while until case esac function return local export echo exit set read source cd ls cat grep sed awk sudo chmod chown mkdir rm cp mv touch find xargs sort uniq head tail wc curl systemctl journalctl docker kubectl git apt ssh scp tar ps kill top df du free ip ss ping dig nginx terraform ansible helm npm pip python',
    yaml: 'true false null yes no on off',
    dax: 'VAR RETURN CALCULATE FILTER ALL ALLEXCEPT ALLSELECTED SUM SUMX AVERAGE AVERAGEX COUNT COUNTROWS DISTINCTCOUNT DIVIDE IF SWITCH TRUE FALSE RELATED RELATEDTABLE VALUES SELECTEDVALUE DATEADD SAMEPERIODLASTYEAR TOTALYTD DATESYTD DATESINPERIOD USERELATIONSHIP KEEPFILTERS REMOVEFILTERS MAX MIN BLANK ISBLANK FORMAT RANKX TOPN ADDCOLUMNS SUMMARIZE SUMMARIZECOLUMNS CALENDAR CALENDARAUTO EOMONTH YEAR MONTH',
    hcl: 'resource data variable output provider module locals terraform true false null for in if count for_each depends_on lifecycle backend required_providers',
    dockerfile: 'FROM RUN CMD LABEL EXPOSE ENV ADD COPY ENTRYPOINT VOLUME USER WORKDIR ARG ONBUILD STOPSIGNAL HEALTHCHECK SHELL AS',
    go: 'func package import var const type struct interface map chan go defer return if else for range switch case default break continue nil true false'
  };
  const ALIAS = { py: 'python', python3: 'python', javascript: 'js', ts: 'js', typescript: 'js', jsx: 'js', tsx: 'js', json: 'js', sh: 'bash', shell: 'bash', console: 'bash', zsh: 'bash', yml: 'yaml', terraform: 'hcl', tf: 'hcl', docker: 'dockerfile', mysql: 'sql', postgres: 'sql', postgresql: 'sql', sqlite: 'sql', tsql: 'sql', promql: 'sql', m: 'dax', powerquery: 'dax', golang: 'go' };
  const kwCache = {};
  function kwSet(lang) {
    if (!kwCache[lang]) kwCache[lang] = new Set((KW[lang] || '').split(' ').map((w) => (lang === 'sql' ? w.toLowerCase() : w)));
    return kwCache[lang];
  }

  function highlight(code, langIn) {
    const lang = ALIAS[langIn] || langIn;
    if (!lang || lang === 'text' || lang === 'txt' || lang === 'plain' || lang === 'output') return esc(code);
    const lineCom = { python: '#', bash: '#', yaml: '#', dockerfile: '#', hcl: '#|//', js: '//', go: '//', dax: '//', sql: '--' }[lang] || '#|//';
    const comAlt = lineCom.split('|').map((c) => c.replace(/[/]/g, '\\/')).map((c) => c + '[^\\n]*').join('|');
    const blockCom = (lang === 'js' || lang === 'go' || lang === 'hcl' || lang === 'sql' || lang === 'dax') ? '|\\/\\*[\\s\\S]*?\\*\\/' : '';
    const strs = lang === 'python'
      ? `[rbfuRBFU]{0,2}"""[\\s\\S]*?"""|[rbfuRBFU]{0,2}'''[\\s\\S]*?'''|[rbfuRBFU]{0,2}"(?:\\\\.|[^"\\\\\\n])*"|[rbfuRBFU]{0,2}'(?:\\\\.|[^'\\\\\\n])*'`
      : lang === 'js' ? '`(?:\\\\.|[^`\\\\])*`|"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\''
        : '"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'';
    const re = new RegExp(`(${comAlt}${blockCom})|(${strs})|(\\b\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b)|(@[\\w.]+)|([A-Za-z_$][\\w$]*)`, 'g');
    const kws = kwSet(lang);
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      const [tok, com, str, num, deco, word] = m;
      if (com) out += `<span class="hl-c">${esc(tok)}</span>`;
      else if (str) out += `<span class="hl-s">${esc(tok)}</span>`;
      else if (num) out += `<span class="hl-n">${tok}</span>`;
      else if (deco) out += `<span class="hl-d">${esc(tok)}</span>`;
      else if (word) {
        const key = lang === 'sql' ? word.toLowerCase() : word;
        if (kws.has(key)) out += `<span class="hl-k">${esc(tok)}</span>`;
        else if (code[re.lastIndex] === '(') out += `<span class="hl-f">${esc(tok)}</span>`;
        else if (lang === 'yaml' && /^\s*$/.test(code.slice(code.lastIndexOf('\n', m.index) + 1, m.index).replace(/-\s*/, '')) && /^[\w.-]*\s*:/.test(code.slice(m.index))) out += `<span class="hl-f">${esc(tok)}</span>`;
        else out += esc(tok);
      }
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  /* --------------------------------------------------------------- inline */
  function inline(src) {
    const slots = [];
    const keep = (html) => `\u0000${slots.push(html) - 1}\u0000`;
    let s = String(src);
    s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m, t, c) => keep(`<code>${esc(c.replace(/^ (.*) $/, '$1'))}</code>`));
    s = s.replace(/\\\$/g, () => keep('$'));
    s = s.replace(/\$([^\s$](?:[^$\n]*?[^\s$\\])?)\$(?!\d)/g, (m, t) => keep(`<span class="math">${tex(t)}</span>`));
    s = s.replace(/\\([\\`*_{}\[\]()#+\-.!|<>])/g, (m, c) => keep(esc(c)));
    s = s.replace(/<(https?:\/\/[^\s>]+)>/g, (m, u) => keep(`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`));
    s = s.replace(/<(kbd|sup|sub|mark|br|abbr)\b([^>]*)>([\s\S]*?)<\/\1>|<br\s*\/?>/g, (m) => keep(m));
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => keep(`<img src="${u}" alt="${a}" loading="lazy">`));
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
      const ext = /^https?:/i.test(u);
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
    });
    s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    s = s.replace(/ --(?= )/g, ' —');
    let guard = 0;
    while (/\u0000\d+\u0000/.test(s) && guard++ < 5) s = s.replace(/\u0000(\d+)\u0000/g, (m, n) => slots[+n]);
    return s;
  }

  /* --------------------------------------------------------------- blocks */
  const LIST_RE = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
  const indentOf = (l) => l.match(/^\s*/)[0].replace(/\t/g, '    ').length;
  const RUNNABLE = { python: 'python', py: 'python', sql: 'sql', sqlite: 'sql', js: 'js', javascript: 'js' };
  let codeCounter = 0;

  function codeBlock(code, lang, info) {
    const id = 'cb' + (++codeCounter);
    const runLang = /\bnorun\b/.test(info) ? null : RUNNABLE[lang];
    const label = { py: 'python', js: 'javascript', sh: 'bash' }[lang] || lang || 'text';
    const title = (info.match(/title="([^"]+)"/) || [])[1];
    const stdin = (info.match(/stdin="([^"]*)"/) || [])[1];
    return `<div class="code" id="${id}" data-lang="${esc(runLang || lang || '')}"${stdin ? ` data-stdin="${esc(stdin)}"` : ''}>` +
      `<div class="code-head"><span class="code-lang">${esc(title || label)}</span><span class="code-actions">` +
      (runLang ? `<button type="button" class="btn-mini" data-act="run-code" data-target="${id}">▶ Run</button><button type="button" class="btn-mini" data-act="edit-code" data-target="${id}">Edit</button>` : '') +
      `<button type="button" class="btn-mini" data-act="copy-code" data-target="${id}">Copy</button></span></div>` +
      `<pre><code>${highlight(code, lang)}</code></pre><textarea class="code-src" hidden>${esc(code)}</textarea></div>`;
  }

  function splitRow(line) {
    let l = line.trim();
    if (l.startsWith('|')) l = l.slice(1);
    if (l.endsWith('|') && !l.endsWith('\\|')) l = l.slice(0, -1);
    const cells = [];
    let cur = '', inCode = false;
    for (let k = 0; k < l.length; k++) {
      const ch = l[k];
      if (ch === '\\' && l[k + 1] === '|') { cur += '|'; k++; continue; }
      if (ch === '`') inCode = !inCode;
      if (ch === '|' && !inCode) { cells.push(cur.trim()); cur = ''; } else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  }

  const CALLOUT = {
    note: ['Note', 'ℹ️'], tip: ['Tip', '💡'], warning: ['Watch out', '⚠️'], caution: ['Caution', '⚠️'], important: ['Key idea', '🔑'],
    connect: ['How this connects', '🔗'], example: ['Example', '🧪'], intuition: ['Intuition', '🧠'], recap: ['Recap', '📌'],
    mistake: ['Common mistake', '🚫'], practice: ['Try it', '✍️'], source: ['Source', '📚'], definition: ['Definition', '📖']
  };

  function render(src, opts) {
    opts = opts || {};
    const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    const isBlank = (l) => /^\s*$/.test(l);
    const startsBlock = (l) => /^(\s*)(```|~~~|\$\$|#{1,6}\s|>|---\s*$|\*\*\*\s*$)/.test(l) || LIST_RE.test(l) || /^<(div|details|figure|table|svg|section|aside)\b/i.test(l.trim());

    while (i < lines.length) {
      const line = lines[i];
      if (isBlank(line)) { i++; continue; }
      let m;

      if ((m = line.match(/^(\s*)(```+|~~~+)\s*([\w+#.-]*)\s*(.*)$/))) {
        const fence = m[2], ind = m[1].length, buf = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith(fence)) { buf.push(lines[i].slice(Math.min(ind, indentOf(lines[i])))); i++; }
        i++;
        out.push(codeBlock(buf.join('\n'), m[3].toLowerCase(), m[4] || ''));
        continue;
      }
      if (line.trim().startsWith('$$')) {
        let body = line.trim().slice(2);
        if (body.trim().endsWith('$$') && body.trim().length > 2) { i++; out.push(`<div class="math-block">${tex(body.trim().slice(0, -2))}</div>`); continue; }
        const buf = [body]; i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) buf.push(lines[i++]);
        if (i < lines.length) buf.push(lines[i].trim().slice(0, -2));
        i++;
        out.push(`<div class="math-block">${tex(buf.join(' '))}</div>`);
        continue;
      }
      if ((m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) {
        const lvl = m[1].length;
        const text = m[2];
        const slug = text.toLowerCase().replace(/<[^>]+>|`/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
        out.push(`<h${lvl} id="h-${slug}">${inline(text)}</h${lvl}>`);
        i++; continue;
      }
      if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

      if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        const head = splitRow(line);
        const aligns = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : ''));
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes('|') && !isBlank(lines[i])) rows.push(splitRow(lines[i++]));
        const al = (k) => (aligns[k] ? ` style="text-align:${aligns[k]}"` : '');
        out.push('<div class="table-wrap"><table><thead><tr>' + head.map((h, k) => `<th${al(k)}>${inline(h)}</th>`).join('') +
          '</tr></thead><tbody>' + rows.map((r) => '<tr>' + head.map((_, k) => `<td${al(k)}>${inline(r[k] || '')}</td>`).join('') + '</tr>').join('') +
          '</tbody></table></div>');
        continue;
      }

      if (/^\s*>/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
        const cm = buf[0] && buf[0].match(/^\[!(\w+)\]\s*(.*)$/);
        if (cm) {
          const kind = cm[1].toLowerCase();
          const [label, icon] = CALLOUT[kind] || [cm[1], '•'];
          const title = cm[2] || label;
          out.push(`<aside class="callout callout-${esc(kind)}"><div class="callout-title"><span aria-hidden="true">${icon}</span> ${inline(title)}</div>${render(buf.slice(1).join('\n'))}</aside>`);
        } else out.push(`<blockquote>${render(buf.join('\n'))}</blockquote>`);
        continue;
      }

      if (/^<(div|details|figure|table|svg|section|aside|summary|\/)/i.test(line.trim())) {
        const buf = [];
        while (i < lines.length && !isBlank(lines[i])) buf.push(lines[i++]);
        out.push(buf.join('\n'));
        continue;
      }

      if ((m = line.match(LIST_RE))) {
        const res = parseList(lines, i, indentOf(line));
        out.push(res.html); i = res.i;
        continue;
      }

      const buf = [];
      while (i < lines.length && !isBlank(lines[i]) && !(buf.length && startsBlock(lines[i]))) buf.push(lines[i++].trim());
      const txt = buf.join('\n').replace(/ {2,}\n/g, '<br>\n');
      out.push(opts.tight && !out.length && i >= lines.length ? inline(txt) : `<p>${inline(txt)}</p>`);
    }
    return out.join('\n');
  }

  function parseList(lines, i, base) {
    const first = lines[i].match(LIST_RE);
    const ordered = /\d/.test(first[2]);
    const startNum = ordered ? parseInt(first[2], 10) : 1;
    const items = [];
    let task = false;
    while (i < lines.length) {
      const mm = lines[i].match(LIST_RE);
      if (!mm || indentOf(lines[i]) !== base || /\d/.test(mm[2]) !== ordered) break;
      const content = [mm[3]];
      const contentIndent = base + mm[2].length + 1;
      i++;
      while (i < lines.length) {
        const n = lines[i];
        if (/^\s*$/.test(n)) {
          let k = i + 1;
          while (k < lines.length && /^\s*$/.test(lines[k])) k++;
          if (k < lines.length && indentOf(lines[k]) > base) { content.push(''); i++; continue; }
          break;
        }
        const ind = indentOf(n);
        if (ind > base) { content.push(n.replace(/^\s+/, ' '.repeat(Math.max(0, ind - contentIndent)))); i++; continue; }
        if (!LIST_RE.test(n) && !/^(```|~~~|#|>|\$\$)/.test(n.trim()) && content[content.length - 1] !== '') { content.push(n.trim()); i++; continue; }
        break;
      }
      let body = content.join('\n');
      let check = '';
      const tm = body.match(/^\[([ xX])\]\s+/);
      if (tm) { task = true; check = `<span class="task-box${tm[1] !== ' ' ? ' on' : ''}" aria-hidden="true"></span>`; body = body.slice(tm[0].length); }
      const html = render(body, { tight: true });
      items.push(`<li${check ? ' class="task"' : ''}>${check}${html}</li>`);
      while (i < lines.length && /^\s*$/.test(lines[i])) {
        let k = i; while (k < lines.length && /^\s*$/.test(lines[k])) k++;
        if (k < lines.length && LIST_RE.test(lines[k]) && indentOf(lines[k]) === base) i = k; else break;
      }
    }
    const tag = ordered ? 'ol' : 'ul';
    const start = ordered && startNum !== 1 ? ` start="${startNum}"` : '';
    return { html: `<${tag}${start}${task ? ' class="tasks"' : ''}>${items.join('')}</${tag}>`, i };
  }

  function plain(md) {
    return String(md)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[`*_>#|$\\]/g, ' ')
      .replace(/\[!\w+\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  global.MD = { render, inline, tex, highlight, esc, plain };
})(typeof window !== 'undefined' ? window : globalThis);
