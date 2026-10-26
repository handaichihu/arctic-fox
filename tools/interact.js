// 交互自测：按钮点击、狐狸点击、拖拽旋转、滚轮缩放、窗口自适应
// 用法: node tools/interact.js
const http = require('http');
const PORT = process.env.CDP_PORT || 9222;
const URL = process.env.PAGE_URL || 'http://127.0.0.1:8765/index.html';

const rq = (path, method = 'GET') => new Promise((res, rej) => {
  const req = http.request({ host: '127.0.0.1', port: PORT, path, method }, r => {
    let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(new Error(b.slice(0, 120))); } });
  });
  req.on('error', rej);
  req.end();
});

(async () => {
  const tab = await rq('/json/new?about:blank', 'PUT');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0; const waiters = new Map();
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; waiters.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiters.has(d.id)) {
      const w = waiters.get(d.id); waiters.delete(d.id);
      d.error ? w.rej(new Error(JSON.stringify(d.error))) : w.res(d.result);
    }
  };
  await new Promise(r => { ws.onopen = r; });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.value;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await sleep(26000);

  const ready = await ev('!!window.__fox');
  console.log('ready:', ready);
  if (!ready) { console.log('NOT READY'); process.exit(1); }

  // 1) 按钮
  const rect = await ev(`(() => {
    const pickBtn = (txt) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(txt));
    const r = pickBtn('飘雪').getBoundingClientRect();
    const r2 = pickBtn('自动旋转').getBoundingClientRect();
    return { snow: [r.x + r.width/2, r.y + r.height/2], auto: [r2.x + r2.width/2, r2.y + r2.height/2] };
  })()`);
  console.log('btn rects:', JSON.stringify(rect));

  const click = async ([x, y]) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(800);
  };

  const pointsVisible = `[...__fox.scene.children].filter(o => o.type === 'Points').map(o => o.visible)`;
  console.log('points before:', JSON.stringify(await ev(pointsVisible)));
  await click(rect.snow);
  console.log('points after snow click:', JSON.stringify(await ev(pointsVisible)));
  console.log('snow btn on:', await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('飘雪')).classList.contains('on')`));

  const auto0 = await ev(`__fox.controls.autoRotate`);
  await click(rect.auto);
  const auto1 = await ev(`__fox.controls.autoRotate`);
  console.log('autoRotate before/after:', auto0, auto1);

  // 2) 点击狐狸
  const foxXY = await ev(`(() => {
    const v = new THREE.Vector3(0, 16, 4).project(__fox.camera);
    return [ (v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight ];
  })()`);
  console.log('fox screen xy:', JSON.stringify(foxXY));
  await click(foxXY);
  let maxY = 0;
  for (let i = 0; i < 12; i++) {
    const y = await ev(`__fox.foxRoot.position.y`);
    if (y > maxY) maxY = y;
    await sleep(80);
  }
  console.log('fox jump peak y:', maxY);

  // 3) 拖拽旋转
  const cam0 = await ev(`__fox.camera.position.toArray().map(n=>+n.toFixed(2))`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 800, y: 500, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 10; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 800 - i * 22, y: 500, button: 'left', buttons: 1 });
    await sleep(35);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 580, y: 500, button: 'left', clickCount: 1 });
  await sleep(1000);
  const cam1 = await ev(`__fox.camera.position.toArray().map(n=>+n.toFixed(2))`);
  console.log('camera drag:', JSON.stringify(cam0), '->', JSON.stringify(cam1));

  // 4) 滚轮
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 800, y: 500, deltaX: 0, deltaY: -260 });
  await sleep(1000);
  const cam2 = await ev(`__fox.camera.position.toArray().map(n=>+n.toFixed(2))`);
  console.log('camera wheel:', JSON.stringify(cam2));

  // 5) 窗口自适应
  await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(1000);
  console.log('resize:', JSON.stringify(await ev(`({ aspect: +__fox.camera.aspect.toFixed(3), w: innerWidth, h: innerHeight })`)));

  ws.close();
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });