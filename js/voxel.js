/* 体素模型：寒带赤狐 + 冰原世界
 * 纯数据生成，不依赖 three，浏览器/Node 通用。
 * 每个体素 = [x, y, z, 颜色(hex int)]，格子边长 1，格心在整数坐标。
 */
(function (global) {
  'use strict';

  function h3(x, y, z) {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  function pick(pal, x, y, z) {
    const i = Math.floor(h3(x, y, z) * pal.length) % pal.length;
    return pal[i];
  }

  const PAL = {
    orange:  [0xcf6a1f, 0xd67322, 0xdd7c28, 0xe5842e, 0xee8d38, 0xc4611b],
    orange2: [0xb9581a, 0xc26120, 0xcb6a25],
    cream:   [0xf7f0e2, 0xfdf8ec, 0xfffcf5, 0xe9e0cd],
    cream2:  [0xe3d9c5, 0xefe6d3],
    black:   [0x18110e, 0x221916, 0x0f0a08],
    claw:    [0x2a201c, 0x1a1210]
  };

  /* ---------------- 网格容器 ---------------- */
  class Grid {
    constructor() { this.m = new Map(); }
    static key(x, y, z) { return x + '|' + y + '|' + z; }
    set(x, y, z, pal) {
      const c = typeof pal === 'number' ? pal
        : (typeof pal === 'function' ? pal(x, y, z) : pick(pal, x, y, z));
      this.m.set(Grid.key(x, y, z), [x, y, z, c]);
      return this;
    }
    has(x, y, z) { return this.m.has(Grid.key(x, y, z)); }
    box(x0, y0, z0, x1, y1, z1, pal) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
          for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
            this.set(x, y, z, pal);
      return this;
    }
    ellipsoid(cx, cy, cz, rx, ry, rz, pal) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
          for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
            const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
            if (dx * dx + dy * dy + dz * dz <= 1.0) this.set(x, y, z, pal);
          }
      return this;
    }
    capsule(ax, ay, az, bx, by, bz, ra, rb, pal) {
      const len = Math.hypot(bx - ax, by - ay, bz - az);
      const steps = Math.max(2, Math.ceil(len * 1.6));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = ax + (bx - ax) * t, py = ay + (by - ay) * t, pz = az + (bz - az) * t;
        const r = ra + (rb - ra) * t, r2 = r * r;
        for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++)
          for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++)
            for (let z = Math.floor(pz - r); z <= Math.ceil(pz + r); z++) {
              const dx = x - px, dy = y - py, dz = z - pz;
              if (dx * dx + dy * dy + dz * dz <= r2) this.set(x, y, z, pal);
            }
      }
      return this;
    }
    /* 只给已存在的体素换色（用于白胸、黑爪等覆盖层） */
    paint(pred, pal) {
      const hits = [];
      for (const [k, v] of this.m) if (pred(v[0], v[1], v[2])) hits.push([k, v]);
      for (const [k, v] of hits) {
        const c = typeof pal === 'function' ? pal(v[0], v[1], v[2]) : pick(pal, v[0], v[1], v[2]);
        this.m.set(k, [v[0], v[1], v[2], c]);
      }
      return this;
    }
    /* 剔除被完全包裹的内部体素 */
    cull() {
      const out = new Map();
      for (const [k, v] of this.m) {
        const [x, y, z] = v;
        const inner = this.has(x + 1, y, z) && this.has(x - 1, y, z) &&
                      this.has(x, y + 1, z) && this.has(x, y - 1, z) &&
                      this.has(x, y, z + 1) && this.has(x, y, z - 1);
        if (!inner) out.set(k, v);
      }
      this.m = out;
      return this;
    }
    toArray() { return Array.from(this.m.values()); }
  }

  /* ---------------- 狐狸 ---------------- */
  function buildFox() {
    /* ---- 身体 ---- */
    const b = new Grid();
    b.ellipsoid(0, 9, -4.5, 7.4, 9.2, 7.0, PAL.orange);      // 臀
    b.ellipsoid(0, 15.5, 1.0, 6.4, 8.0, 6.2, PAL.orange);     // 胸
    b.capsule(0, 18, 2, 0, 21.5, 3.5, 4.7, 4.4, PAL.orange);  // 颈
    b.ellipsoid(-6.2, 6.0, -1.5, 3.4, 6.6, 5.4, PAL.orange);  // 左后腿
    b.ellipsoid(6.2, 6.0, -1.5, 3.4, 6.6, 5.4, PAL.orange);   // 右后腿
    b.capsule(-3.6, 13, 4.6, -3.6, 1.6, 6.2, 2.6, 2.4, PAL.orange); // 左前腿
    b.capsule(3.6, 13, 4.6, 3.6, 1.6, 6.2, 2.6, 2.4, PAL.orange);   // 右前腿
    b.ellipsoid(-6.0, 1.4, 1.8, 3.0, 2.0, 3.8, PAL.orange);   // 左后脚
    b.ellipsoid(6.0, 1.4, 1.8, 3.0, 2.0, 3.8, PAL.orange);    // 右后脚

    // 白胸（V 形，从下巴往下）
    b.paint((x, y, z) => y >= 9 && y <= 23 && z >= 1.8 + Math.abs(x) * 0.42 && Math.abs(x) <= 6.6,
      (x, y, z) => pick(PAL.cream, x, y, z));
    // 前爪
    b.paint((x, y, z) => y <= 2 && z >= 4.2 && Math.abs(x) <= 4.9, PAL.claw);
    // 后爪
    b.paint((x, y, z) => y <= 2 && z >= 0.6 && Math.abs(x) >= 3.6, PAL.claw);

    /* ---- 头 ---- */
    const h = new Grid();
    h.box(-6, 21, 1, 6, 32, 12, PAL.orange);
    // 耳朵：阶梯状三角，向上收窄
    h.box(-6, 33, 2, -3, 35, 6, PAL.orange);   // 左耳根
    h.box(-6, 36, 3, -4, 37, 5, PAL.orange);   // 左耳中
    h.box(-5, 38, 3, -4, 38, 5, PAL.orange);   // 左耳尖
    h.box(3, 33, 2, 6, 35, 6, PAL.orange);     // 右耳根
    h.box(4, 36, 3, 6, 37, 5, PAL.orange);     // 右耳中
    h.box(4, 38, 3, 5, 38, 5, PAL.orange);     // 右耳尖
    h.paint((x, y, z) => y >= 36 && Math.abs(x) >= 3, PAL.cream);  // 白耳尖
    // 吻部：向前收窄
    h.box(-2, 24, 12, 2, 27, 14, PAL.cream);
    h.box(-1, 24, 15, 1, 26, 16, PAL.cream);
    h.paint((x, y, z) => y === 27 && z >= 12 && z <= 14 && Math.abs(x) <= 2, PAL.orange); // 鼻梁
    h.paint((x, y, z) => z >= 9 && y >= 21 && y <= 25 && Math.abs(x) <= 5, PAL.cream);    // 下巴/脸颊
    h.paint((x, y, z) => z === 12 && y >= 27 && y <= 29 && Math.abs(x) >= 3 && Math.abs(x) <= 4, PAL.black); // 眼
    h.paint((x, y, z) => z === 16 && y >= 25 && y <= 26 && Math.abs(x) <= 1, PAL.black);                     // 鼻

    /* ---- 尾巴 ---- */
    const t = new Grid();
    const pts = [
      [0, 8.4, -8.0, 4.9],
      [-4.5, 6.4, -10.0, 5.1],
      [-9.5, 4.4, -7.5, 5.0],
      [-12.5, 3.6, -1.0, 4.7],
      [-12.5, 3.6, 5.5, 4.3],
      [-10.0, 4.6, 11.0, 3.7],
      [-6.8, 5.6, 14.5, 3.0]
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], bb = pts[i + 1];
      t.capsule(a[0], a[1], a[2], bb[0], bb[1], bb[2], a[3], bb[3], PAL.orange);
    }
    // 尾巴深色纹理
    t.paint((x, y, z) => h3(x * 0.5, y * 0.5, z * 0.5) > 0.78, PAL.orange2);
    // 白尾尖
    const e = pts[pts.length - 1];
    t.paint((x, y, z) => Math.hypot(x - e[0], (y - e[1]) * 0.8, z - e[2]) <= 4.0, PAL.cream);

    return {
      body: { voxels: b.cull().toArray(), pivot: [0, 0, 0] },
      head: { voxels: h.cull().toArray(), pivot: [0, 21, 3] },
      tail: { voxels: t.cull().toArray(), pivot: [-2, 8, -7] }
    };
  }

  /* ---------------- 冰原世界 ---------------- */
  function buildWorld() {
    const floorG = new Grid();   // 冰面 / 地台
    const wallG = new Grid();    // 冰壁

    const icePal   = [0xd2e7f4, 0xc6dceb, 0xe0f0fa, 0xbad3e5, 0xcde3f1, 0xe9f5fc];
    const iceDeep  = [0x9fc4de, 0xaed0e6, 0x8fb8d6];
    const wallDeep = [0x6389a6, 0x6f96b2, 0x7aa1bc];
    const wallMid  = [0x8db4cc, 0x9bc0d8, 0x86adc7];
    const wallTop  = [0xb2d6ea, 0xbfdfef, 0xa8cfe4];
    const poolBed  = [0x1d6f88, 0x22798f, 0x185f75];
    const snowCap  = [0xf4fbff, 0xeaf7ff, 0xfffdf7];

    // 冰壁颜色：越高越亮，底部沉入深蓝
    const wallColor = (x, y, z) => {
      const t = y / 26;
      const pal = t > 0.62 ? wallTop : (t > 0.28 ? wallMid : wallDeep);
      return pick(pal, x, y, z);
    };

    const POOL = { cx: 31, cz: 3, rx: 11.5, rz: 10.5 };
    const poolD = (x, z) => {
      const dx = (x - POOL.cx) / POOL.rx, dz = (z - POOL.cz) / POOL.rz;
      return dx * dx + dz * dz;
    };
    const pool = (x, z) => poolD(x, z) < 1;

    for (let x = -46; x <= 46; x++) {
      for (let z = -46; z <= 46; z++) {
        const r = Math.hypot(x, z * 0.92);
        if (r > 43) continue;
        if (pool(x, z)) continue;
        floorG.set(x, -1, z, icePal);
        // 少量冰裂纹深色块
        if (h3(x * 1.7, 3, z * 1.7) > 0.93) floorG.set(x, -1, z, iceDeep);
      }
    }

    // 水池边缘：软过渡，不要一圈硬切口
    for (let x = POOL.cx - 18; x <= POOL.cx + 18; x++)
      for (let z = POOL.cz - 17; z <= POOL.cz + 17; z++) {
        const d = poolD(x, z);
        if (d >= 1 && d < 1.09) floorG.set(x, -1, z, iceDeep);
        else if (d >= 1.09 && d < 1.3 && h3(x, 4, z) > 0.42)
          floorG.set(x, -1, z, pick(icePal, x, 5, z));
      }

    // 背景冰壁：三排柱子，越远越高
    const rows = [
      { z: -20, depth: 6, wMin: 4, wVar: 4, hMin: 12, hVar: 12 },
      { z: -30, depth: 8, wMin: 5, wVar: 5, hMin: 19, hVar: 14 },
      { z: -40, depth: 9, wMin: 6, wVar: 6, hMin: 27, hVar: 16 }
    ];
    rows.forEach((row, ri) => {
      for (let x = -54; x < 54; ) {
        const w = row.wMin + Math.floor(h3(x, ri, 7) * row.wVar);
        const hgt = row.hMin + Math.floor(h3(x, ri, 13) * row.hVar);
        const zOff = Math.floor(h3(x, ri, 21) * 3) - 1;            // 前后错落
        const dep = Math.max(2, row.depth - Math.floor(h3(x, ri, 33) * 3));
        const stepMax = 1 + Math.floor(h3(x, ri, 27) * 3);         // 顶部阶梯层数
        for (let i = 0; i < w; i++) {
          const xx = x + i;
          const notch = Math.floor((i / w) * stepMax);
          const hh = Math.max(2, hgt - notch);
          for (let y = 0; y < hh; y++)
            for (let z = row.z + zOff; z < row.z + zOff + dep; z++)
              wallG.set(xx, y, z, y >= hh - 1 ? snowCap : wallColor);
        }
        x += w;
      }
    });

    // 冰壁上垂下的冰棱
    for (let i = 0; i < 42; i++) {
      const ri = Math.floor(h3(i, 42, 4) * 3);
      const row = rows[ri];
      const cx = -52 + Math.floor(h3(i, 41, 3) * 104);
      const colH = row.hMin + Math.floor(h3(cx, ri, 13) * row.hVar);
      const len = 2 + Math.floor(h3(i, 43, 5) * 13);
      const zz = row.z + row.depth - 1;
      for (let d = 0; d < len; d++)
        wallG.set(cx, Math.max(1, colH - 2 - d), zz, d === 0 ? snowCap : pick(iceDeep, cx, d, zz));
    }

    // 远景雪丘：被雾吞掉的浅色块体，撑起地平线
    for (let i = 0; i < 9; i++) {
      const cx = -70 + i * 17 + Math.floor(h3(i, 2, 5) * 8);
      const cz = -64 - Math.floor(h3(i, 3, 6) * 16);
      const w = 7 + Math.floor(h3(i, 4, 7) * 9);
      const hh = 22 + Math.floor(h3(i, 5, 8) * 22);
      for (let dx = -w; dx <= w; dx++) {
        const fall = 1 - Math.abs(dx) / (w + 1);
        const top = Math.max(1, Math.round(hh * fall));
        for (let dz = -w; dz <= w; dz++)
          for (let y = 0; y <= top; y++)
            wallG.set(cx + dx, y, cz + dz, pick([0xd3e8f6, 0xc6e0f1, 0xdeeffa], cx + dx, y, cz + dz));
      }
    }

    // 左侧阶梯冰坡
    for (let i = 0; i < 6; i++) {
      const y = i, x0 = -32 - i * 3, x1 = -17 - i * 3;
      for (let x = x0; x <= x1; x++)
        for (let z = -28; z <= 8; z++)
          for (let yy = Math.min(y, 0); yy <= y; yy++)
            floorG.set(x, yy - 1, z, yy === y ? snowCap : wallColor);
    }

    // 水池：碗状池壁 + 深色池底 + 岸边碎冰
    for (let x = POOL.cx - POOL.rx - 2; x <= POOL.cx + POOL.rx + 2; x++) {
      for (let z = POOL.cz - POOL.rz - 2; z <= POOL.cz + POOL.rz + 2; z++) {
        const d = poolD(x, z);
        if (d < 1) {
          const top = Math.round(-1 - (1 - d) * 5);
          for (let y = -6; y <= top; y++) floorG.set(x, y, z, poolBed);
        } else if (d < 1.16 && h3(x, 9, z) > 0.45) {
          floorG.set(x, 0, z, pick(icePal, x, 8, z));
        }
      }
    }

    // 散落的小冰块
    for (let i = 0; i < 16; i++) {
      const a = h3(i, 1, 2) * Math.PI * 2, d = 17 + h3(i, 2, 3) * 25;
      const x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d * 0.9);
      if (pool(x, z)) continue;
      const w = 1 + Math.floor(h3(i, 3, 4) * 3);
      const hh = 1 + Math.floor(h3(i, 4, 5) * 3);
      for (let dx = -w; dx <= w; dx++)
        for (let dz = -w; dz <= w; dz++)
          for (let dy = 0; dy < hh; dy++)
            floorG.set(x + dx, dy, z + dz, icePal);
    }

    // 雪堆：打散冰面的平整感
    for (let i = 0; i < 34; i++) {
      const a = h3(i, 51, 2) * Math.PI * 2;
      const d = 13 + h3(i, 52, 3) * 29;
      const cx = Math.round(Math.cos(a) * d);
      const cz = Math.round(Math.sin(a) * d * 0.9);
      if (pool(cx, cz)) continue;
      if (Math.abs(cx) < 11 && cz > -9 && cz < 18) continue;  // 别挡住狐狸
      const r = 1 + Math.floor(h3(i, 53, 4) * 3);
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          const dd = Math.hypot(dx, dz) / (r + 0.6);
          if (dd > 1) continue;
          const hh = Math.max(1, Math.round((1 - dd) * (2 + h3(i, 54, 5) * 3)));
          for (let y = 0; y < hh; y++)
            floorG.set(cx + dx, y, cz + dz, y >= hh - 1 ? snowCap : pick(icePal, cx + dx, y, cz + dz));
        }
    }

    return {
      floor: floorG.cull().toArray(),
      walls: wallG.cull().toArray(),
      pool
    };
  }

  global.VoxelModel = { buildFox, buildWorld, h3, pick, PAL, Grid };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.VoxelModel;
})(typeof window !== 'undefined' ? window : globalThis);