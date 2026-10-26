#!/usr/bin/env node
/* 检查当前 Chrome 实例的 WebGL 状态：node probe.js [port] */
const PORT = process.argv[2] || 9222;
async function main() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  const t = await res.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send('Runtime.enable');
  const r = await send('Runtime.evaluate', {
    expression: `(function(){var c=document.createElement('canvas');var gl=c.getContext('webgl2')||c.getContext('webgl');return gl?('OK '+gl.getParameter(gl.VERSION)+' / '+gl.getParameter(gl.RENDERER)):'NO';})()`,
    returnByValue: true
  });
  console.log(r.result.value);
  await send('Page.close').catch(() => {});
  ws.close(); process.exit(0);
}
main().catch(e => { console.log('ERR', e.message); process.exit(1); });