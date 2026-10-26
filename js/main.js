/* 寒带赤狐 · Three.js 体素场景 */
(function () {
  'use strict';

  const V = window.VoxelModel;
  const canvas = document.getElementById('scene');

  /* ---------------- 基础三件套 ---------------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xcfe6f7, 0.0062);

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.5, 500);
  camera.position.set(32, 28, 76);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 16, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 26;
  controls.maxDistance = 130;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minPolarAngle = Math.PI * 0.08;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;
  controls.enablePan = false;

  /* ---------------- 天空渐变 ---------------- */
  const skyGeo = new THREE.SphereGeometry(320, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x8fc4ea) },
      midColor: { value: new THREE.Color(0xd6ecfb) },
      botColor: { value: new THREE.Color(0xf4fbff) }
    },
    vertexShader: `
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 topColor; uniform vec3 midColor; uniform vec3 botColor;
      void main() {
        float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
        vec3 c = h < 0.5 ? mix(botColor, midColor, smoothstep(0.0, 0.5, h))
                         : mix(midColor, topColor, smoothstep(0.5, 1.0, h));
        gl_FragColor = vec4(c, 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  /* ---------------- 灯光 ---------------- */
  const hemi = new THREE.HemisphereLight(0xe6f5ff, 0xb6d2e4, 0.3);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xc2dff2, 0.24);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff6e2, 0.78);
  sun.position.set(-40, 74, 34);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -60; sc.right = 60; sc.top = 70; sc.bottom = -50; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.012;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0, 10, -2);

  const fill = new THREE.DirectionalLight(0x9ec8e8, 0.16);
  fill.position.set(60, 26, -30);
  scene.add(fill);

  // 正面弱补光：让背光的脸和胸口不至于糊进阴影
  const front = new THREE.DirectionalLight(0xdcf0ff, 0.2);
  front.position.set(-12, 20, 72);
  scene.add(front);

  // 背后的冷色轮廓光，把狐狸从冰壁里拉出来
  const rim = new THREE.DirectionalLight(0xa8e2ff, 0.22);
  rim.position.set(16, 34, -58);
  scene.add(rim);

  const poolLight = new THREE.PointLight(0x63e6ff, 0.9, 40, 2);
  poolLight.position.set(31, 1.5, 3);
  scene.add(poolLight);

  /* ---------------- 材质工具 ---------------- */
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const matCache = new Map();

  function material(kind, color) {
    const key = kind + ':' + color;
    if (matCache.has(key)) return matCache.get(key);
    let m;
    if (kind === 'ice') {
      m = new THREE.MeshPhongMaterial({
        color, specular: 0xffffff, shininess: 110, reflectivity: 0.5, flatShading: true
      });
    } else if (kind === 'wall') {
      m = new THREE.MeshPhongMaterial({
        color, specular: 0xcfeaff, shininess: 45, flatShading: true
      });
    } else {
      m = new THREE.MeshStandardMaterial({
        color, roughness: 0.9, metalness: 0.0,
        emissive: new THREE.Color(color).multiplyScalar(0.085)
      });
    }
    matCache.set(key, m);
    return m;
  }

  /* 把体素数组按颜色合并成 InstancedMesh，挂到 group 上 */
  function voxelGroup(voxels, kind, pivot) {
    const group = new THREE.Group();
    if (pivot) group.position.set(pivot[0], pivot[1], pivot[2]);
    const byColor = new Map();
    for (const v of voxels) {
      const c = v[3];
      if (!byColor.has(c)) byColor.set(c, []);
      byColor.get(c).push(v);
    }
    const m4 = new THREE.Matrix4();
    for (const [color, list] of byColor) {
      const mesh = new THREE.InstancedMesh(boxGeo, material(kind, color), list.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        m4.makeTranslation(v[0] - (pivot ? pivot[0] : 0),
                           v[1] - (pivot ? pivot[1] : 0),
                           v[2] - (pivot ? pivot[2] : 0));
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    }
    return group;
  }

  /* ---------------- 世界 ---------------- */
  const world = V.buildWorld();
  scene.add(voxelGroup(world.floor, 'ice', null));
  scene.add(voxelGroup(world.walls, 'wall', null));

  // 水面
  const waterGeo = new THREE.PlaneGeometry(23, 22.6, 72, 72);
  waterGeo.scale(1, 0.93, 1);
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      cDeep: { value: new THREE.Color(0x2a7185) },
      cShallow: { value: new THREE.Color(0x74ccd9) },
      cEdge: { value: new THREE.Color(0xe4f8ff) }
    },
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.x * 0.55 + uTime * 1.4) * 0.13 + cos(p.y * 0.72 + uTime * 1.05) * 0.10;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 cDeep; uniform vec3 cShallow; uniform vec3 cEdge;
      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        if (r > 1.0) discard;
        vec3 col = mix(cShallow, cDeep, smoothstep(0.05, 0.9, r));
        float w = sin(c.x * 52.0 + uTime * 1.7) * cos(c.y * 58.0 - uTime * 1.25);
        float w2 = sin((c.x + c.y) * 80.0 - uTime * 2.1);
        col += vec3(0.32, 0.58, 0.66) * smoothstep(0.45, 1.0, w) * 0.45;
        col += vec3(0.20, 0.42, 0.50) * smoothstep(0.86, 1.0, w2) * 0.35;
        col = mix(col, cEdge, smoothstep(0.88, 0.995, r) * 0.85);
        gl_FragColor = vec4(col, 0.95);
      }
    `
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(31, -2.15, 3);
  water.receiveShadow = false;
  scene.add(water);
  window.__water = water;

  /* ---------------- 狐狸 ---------------- */
  const fox = V.buildFox();
  const foxRoot = new THREE.Group();
  const body = voxelGroup(fox.body.voxels, 'fox', fox.body.pivot);
  const head = voxelGroup(fox.head.voxels, 'fox', fox.head.pivot);
  const tail = voxelGroup(fox.tail.voxels, 'fox', fox.tail.pivot);
  foxRoot.add(body, head, tail);
  scene.add(foxRoot);

  // 接地软化：脚下一圈冷色假 AO，让狐狸坐实
  (function contactShadow() {
    const s = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g2 = cv.getContext('2d');
    const rg = g2.createRadialGradient(s / 2, s / 2, s * 0.04, s / 2, s / 2, s / 2);
    rg.addColorStop(0, 'rgba(20,56,82,0.58)');
    rg.addColorStop(0.42, 'rgba(20,56,82,0.26)');
    rg.addColorStop(1, 'rgba(20,56,82,0)');
    g2.fillStyle = rg;
    g2.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(cv);
    const ao = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 28),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    ao.rotation.x = -Math.PI / 2;
    ao.position.set(0, -0.46, 0);
    ao.renderOrder = 1;
    scene.add(ao);
  })();

  /* ---------------- 飘雪 ---------------- */
  const SNOW = 1100;
  const snowGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(SNOW * 3);
  const sVel = new Float32Array(SNOW);
  for (let i = 0; i < SNOW; i++) {
    sPos[i * 3] = (Math.random() - 0.5) * 120;
    sPos[i * 3 + 1] = Math.random() * 60 - 2;
    sPos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    sVel[i] = 1.4 + Math.random() * 2.2;
  }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));

  const flake = (function () {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.65)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  })();

  const snowMat = new THREE.PointsMaterial({
    size: 0.52, map: flake, transparent: true, opacity: 0.72, color: 0xeaf6ff,
    depthWrite: false, sizeAttenuation: true, blending: THREE.NormalBlending
  });
  const snow = new THREE.Points(snowGeo, snowMat);
  scene.add(snow);

  // 近景雪：大颗粒，从镜头前飘过，撑出前后层次
  const SNOW2 = 120;
  const s2Geo = new THREE.BufferGeometry();
  const s2Pos = new Float32Array(SNOW2 * 3);
  const s2Vel = new Float32Array(SNOW2);
  for (let i = 0; i < SNOW2; i++) {
    s2Pos[i * 3] = (Math.random() - 0.5) * 74;
    s2Pos[i * 3 + 1] = Math.random() * 40 - 4;
    s2Pos[i * 3 + 2] = (Math.random() - 0.35) * 54;
    s2Vel[i] = 2.0 + Math.random() * 2.8;
  }
  s2Geo.setAttribute('position', new THREE.BufferAttribute(s2Pos, 3));
  const s2Mat = new THREE.PointsMaterial({
    size: 1.8, map: flake, transparent: true, opacity: 0.34, color: 0xffffff,
    depthWrite: false, sizeAttenuation: true
  });
  const snow2 = new THREE.Points(s2Geo, s2Mat);
  scene.add(snow2);

  /* ---------------- 交互 ---------------- */
  const state = {
    autoRotate: true,
    snow: true,
    pointer: { x: 0, y: 0 },
    headYaw: 0, headPitch: 0,
    jump: 0
  };

  window.addEventListener('pointermove', (e) => {
    state.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    state.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  const raycaster = new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown', (e) => {
    const ndc = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects([head, body, tail], true);
    if (hit.length) {
      state.jump = 0.0001;
      document.body.classList.add('poked');
      setTimeout(() => document.body.classList.remove('poked'), 600);
    }
  });

  const btnRotate = document.getElementById('btn-rotate');
  const btnSnow = document.getElementById('btn-snow');
  const btnReset = document.getElementById('btn-reset');

  btnRotate.addEventListener('click', () => {
    state.autoRotate = !state.autoRotate;
    controls.autoRotate = state.autoRotate;
    btnRotate.classList.toggle('on', state.autoRotate);
  });
  btnSnow.addEventListener('click', () => {
    state.snow = !state.snow;
    snow.visible = state.snow;
    snow2.visible = state.snow;
    btnSnow.classList.toggle('on', state.snow);
  });
  btnReset.addEventListener('click', () => {
    camera.position.set(32, 28, 76);
    controls.target.set(0, 16, 0);
    controls.update();
  });

  /* ---------------- 循环 ---------------- */
  const clock = new THREE.Clock();
  let t = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    // 头：待机微动 + 跟随鼠标
    const targetYaw = THREE.MathUtils.clamp(state.pointer.x * 0.22, -0.24, 0.24) + Math.sin(t * 0.55) * 0.045;
    const targetPitch = THREE.MathUtils.clamp(-state.pointer.y * 0.10, -0.12, 0.12) + Math.sin(t * 0.8 + 1) * 0.018;
    state.headYaw += (targetYaw - state.headYaw) * Math.min(1, dt * 3.2);
    state.headPitch += (targetPitch - state.headPitch) * Math.min(1, dt * 3.2);
    head.rotation.y = state.headYaw;
    head.rotation.x = state.headPitch;

    // 呼吸
    body.scale.set(1, 1 + Math.sin(t * 1.5) * 0.008, 1);

    // 尾巴摆动
    tail.rotation.y = Math.sin(t * 1.1) * 0.055;
    tail.rotation.x = Math.sin(t * 0.85 + 0.6) * 0.03;

    // 点击跳跃
    if (state.jump > 0) {
      state.jump += dt * 2.2;
      const k = Math.sin(Math.min(state.jump, 1) * Math.PI);
      foxRoot.position.y = k * 2.4;
      head.rotation.z = Math.sin(state.jump * Math.PI * 2) * 0.06;
      tail.rotation.y += Math.sin(state.jump * 10) * 0.25;
      if (state.jump >= 1) { state.jump = 0; foxRoot.position.y = 0; head.rotation.z = 0; }
    }

    // 雪
    if (state.snow) {
      const p = snowGeo.attributes.position.array;
      for (let i = 0; i < SNOW; i++) {
        p[i * 3 + 1] -= sVel[i] * dt;
        p[i * 3] += Math.sin(t * 0.6 + i) * dt * 0.35;
        if (p[i * 3 + 1] < -2) {
          p[i * 3 + 1] = 58;
          p[i * 3] = (Math.random() - 0.5) * 120;
          p[i * 3 + 2] = (Math.random() - 0.5) * 120;
        }
      }
      snowGeo.attributes.position.needsUpdate = true;

      // 近景雪
      const q = s2Geo.attributes.position.array;
      for (let i = 0; i < SNOW2; i++) {
        q[i * 3 + 1] -= s2Vel[i] * dt;
        q[i * 3] += Math.sin(t * 0.42 + i * 1.7) * dt * 0.55;
        if (q[i * 3 + 1] < -6) {
          q[i * 3 + 1] = 38;
          q[i * 3] = (Math.random() - 0.5) * 74;
          q[i * 3 + 2] = (Math.random() - 0.35) * 54;
        }
      }
      s2Geo.attributes.position.needsUpdate = true;
    }

    // 水面波纹
    waterMat.uniforms.uTime.value = t;

    controls.update();
    renderer.render(scene, camera);
  }

  function fitLens() {
    const a = window.innerWidth / window.innerHeight;
    // 窄屏时放大视角，避免狐狸被裁掉
    camera.fov = a < 1.05 ? 38 + (1.05 - a) * 26 : 38;
    camera.aspect = a;
    camera.updateProjectionMatrix();
  }
  fitLens();

  window.addEventListener('resize', () => {
    fitLens();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
  window.__fox = { scene, camera, controls, foxRoot, head, body, tail };
})();