/* Web Worker hosting Pyodide (CPython compiled to WebAssembly). */
/* global loadPyodide */
let pyodide = null;
let stdinLines = [];

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      importScripts('../vendor/pyodide/pyodide.js');
      pyodide = await loadPyodide({ indexURL: new URL('../vendor/pyodide/', self.location.href).href });
      pyodide.setStdin({ stdin: () => (stdinLines.length ? stdinLines.shift() : null), autoEOF: true });
      pyodide.runPython('import warnings\nwarnings.filterwarnings("ignore", category=DeprecationWarning)\nwarnings.filterwarnings("ignore", category=FutureWarning)');
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'init-error', error: String(err && err.message || err) });
    }
    return;
  }
  if (msg.type === 'run') {
    const id = msg.id;
    stdinLines = (msg.stdin || '').split('\n');
    if (stdinLines.length && stdinLines[stdinLines.length - 1] === '') stdinLines.pop();
    const send = (text) => self.postMessage({ type: 'stdout', id, text });
    pyodide.setStdout({ batched: (t) => send(t + '\n') });
    pyodide.setStderr({ batched: (t) => send(t + '\n') });
    try {
      // Load numpy / pandas / scikit-learn on demand when the code imports them.
      const scan = msg.code + '\n' + (msg.scan || '');
      if (/^\s*(import|from)\s+(numpy|pandas|sklearn|scipy)\b/m.test(scan)) {
        send('(loading Python packages: the first time takes a while, then they are cached)\n');
        await pyodide.loadPackagesFromImports(scan, { messageCallback: () => {}, errorCallback: (m) => send(m + '\n') });
      }
      // fresh globals per run so examples don't leak into each other
      const ns = pyodide.globals.get('dict')();
      ns.set('__name__', '__main__');
      await pyodide.runPythonAsync(msg.code, { globals: ns });
      ns.destroy();
      self.postMessage({ type: 'done', id, ok: true });
    } catch (err) {
      let text = String(err && err.message || err);
      // Trim Pyodide's internal frames from the traceback.
      const lines = text.split('\n');
      const k = lines.findIndex((l) => l.includes('File "<exec>"'));
      if (k > 0) text = 'Traceback (most recent call last):\n' + lines.slice(k).join('\n');
      self.postMessage({ type: 'done', id, ok: false, error: text.trim() });
    }
  }
};
