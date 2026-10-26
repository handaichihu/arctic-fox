#!/usr/bin/env node
/* CDP 截图 + 可注入相机/场景调试代码
 * 用法: node shotjs.js <url> <out.png> <waitMs> <w> <h> [jsFile]
 */
const fs = require('fs');
const url = process.argv[2];
const out = process.argv[3];
const waitMs = Number(process.argv[4] || 4000);
const W = Number(process.argv[5] || 1200);
const H = Number(process.argv[6] || 900);
const jsFile = process.argv[7];
const PORT = process.env.CDP_PORT || 9222;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(waitMs);

  if (jsFile && fs.existsSync(jsFile)) {
    const code = fs.readFileSync(jsFile, 'utf8');
    const r = await send('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true });
    console.log('inject:', JSON.stringify(r.result && (r.result.value !== undefined ? r.result.value : r.result.description)));
    await sleep(1800);
  }

  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('saved', out, fs.statSync(out).size, 'bytes');
  await send('Page.close').catch(() => {});
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });