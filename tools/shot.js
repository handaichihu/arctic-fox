#!/usr/bin/env node
/* 用 CDP 打开页面并截图：node shot.js <url> <out.png> [waitMs] [w] [h] */
const fs = require('fs');

const url = process.argv[2];
const out = process.argv[3] || '/tmp/shot.png';
const waitMs = Number(process.argv[4] || 3500);
const W = Number(process.argv[5] || 1600);
const H = Number(process.argv[6] || 1000);
const PORT = process.env.CDP_PORT || 9222;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?` + encodeURIComponent(url), { method: 'PUT' });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 1, mobile: false
  });
  await send('Page.navigate', { url });
  await sleep(waitMs);

  const evalRes = await send('Runtime.evaluate', {
    expression: `(function(){
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl');
      return JSON.stringify({
        errs: (window.__errs || []).slice(0, 4),
        fox: typeof window.__fox,
        webgl: gl ? gl.getParameter(gl.VERSION) : 'none'
      });
    })()`,
    returnByValue: true
  });
  console.log('probe:', evalRes.result.value);

  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('saved', out, fs.statSync(out).size, 'bytes');

  await send('Page.close').catch(() => {});
  ws.close();
  process.exit(0);
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });