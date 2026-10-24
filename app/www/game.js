// «Долгая ночь» — 3D-выживание. Мир, пещеры, звуки, зомби и интерфейс.
(function () {
  'use strict';

  // ==================================================================
  // Настройки игры
  // ==================================================================
  const CFG = {
    dayLen: 150, nightLen: 100,
    maxHunger: 100, maxThirst: 100, hungerDecay: 0.4, thirstDecay: 0.55,
    starveDmg: 3, regenThreshold: 50, regen: 0.6, berryFood: 20, drink: 35,
    playerSpeed: 6, swimSpeed: 0.55, jumpSpeed: 7.2, gravity: 22,
    reach: 1.4, gatherCd: 0.42, attackReach: 2.4,
    weapons: {
      fist: { dmg: 8, cd: 0.5 },
      sword: { dmg: 25, cd: 0.42 },
      iron: { dmg: 42, cd: 0.4 },
    },
    campfire: { life: 240, radius: 7, heal: 4 },
    wall: { hp: 150 },
    zombie: { hp: 60, hpDay: 10, speed: 3.2, speedDay: 0.12, maxSpeed: 4.6, dmg: 15, range: 1.35, cd: 1,
      base: 3, perDay: 2, max: 25, interval: 1.5, minD: 28, maxD: 42 },
    caveZombie: { hp: 90, dmg: 18, speed: 3.4, aggro: 26 },
    res: {
      tree: { item: 'wood', amount: 5, respawn: 60, action: 'Рубить', sound: 'chop' },
      rock: { item: 'stone', amount: 4, respawn: 80, action: 'Добыть', sound: 'mine' },
      bush: { item: 'berry', amount: 3, respawn: 50, action: 'Собрать', sound: 'pick' },
      iron: { item: 'iron', amount: 3, respawn: 0, action: 'Добыть', sound: 'mine' },
      crystal: { item: 'crystal', amount: 2, respawn: 0, action: 'Собрать', sound: 'crystal' },
    },
    pitchMin: -0.12, pitchMax: 1.5,
  };
  const ITEMS = { wood: 'Древесина', stone: 'Камень', berry: 'Ягоды', iron: 'Железо', crystal: 'Кристалл' };
  const RECIPES = [
    { id: 'sword', name: 'Меч', cost: { wood: 3, stone: 2 }, desc: 'Удар 25 вместо 8 кулаком' },
    { id: 'iron', name: 'Железный меч', cost: { wood: 2, iron: 4 }, desc: 'Удар 42. Железо есть в пещерах' },
    { id: 'lantern', name: 'Фонарь', cost: { wood: 2, crystal: 2 }, desc: 'Ярко светит ночью и в пещерах' },
    { id: 'campfire', name: 'Костёр', cost: { wood: 5, stone: 3 }, desc: 'Светит и лечит рядом 4 минуты' },
    { id: 'wall', name: 'Стена', cost: { wood: 4 }, desc: 'Зомби придётся её ломать' },
  ];
  const KEYS = { save: 'dolgaya-noch-save', stats: 'dolgaya-noch-stats', settings: 'dolgaya-noch-settings', oldBest: 'dolgaya-noch-best' };
  const SAVE_VERSION = 2;

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;
  const lerpAngle = (a, b, t) => a + ((((b - a + Math.PI) % TAU) + TAU) % TAU - Math.PI) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function readJson(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function writeJson(key, value) {
    try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* хранилище недоступно */ }
  }

  const settings = Object.assign({ sens: 1, dist: 14, invert: false, shadows: true, quality: 'mid', volume: 0.8, sound: true },
    readJson(KEYS.settings, {}));
  const stats = Object.assign({ best: 0, kills: 0, games: 0 }, readJson(KEYS.stats, {}));
  try { stats.best = Math.max(stats.best, parseInt(localStorage.getItem(KEYS.oldBest) || '0', 10) || 0); } catch (e) { /* нет хранилища */ }
  const saveStats = () => writeJson(KEYS.stats, stats);

  // ==================================================================
  // Шум для генерации мира (детерминированный: мир всегда один и тот же)
  // ==================================================================
  function hash2(ix, iz, s) {
    let h = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, z, s) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = hash2(ix, iz, s), b = hash2(ix + 1, iz, s), c = hash2(ix, iz + 1, s), d = hash2(ix + 1, iz + 1, s);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }
  function fbm(x, z, s, oct) {
    let sum = 0, amp = 0.5, norm = 0, f = 1;
    for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, z * f, s + i * 17); norm += amp; amp *= 0.5; f *= 2.03; }
    return sum / norm;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ==================================================================
  // Звуки: всё синтезируется на лету через Web Audio, без файлов
  // ==================================================================
  const Sound = (function () {
    let ctx = null, master = null, sfx = null, echoOut = null, noiseBuf = null, ready = false;
    let ambT = 2;

    function init() {
      if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { return; }
      master = ctx.createGain();
      master.connect(ctx.destination);
      sfx = ctx.createGain();
      sfx.connect(master);
      // Эхо для пещер
      const echo = ctx.createDelay(1.0);
      echo.delayTime.value = 0.21;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.4;
      echoOut = ctx.createGain();
      echoOut.gain.value = 0;
      sfx.connect(echo); echo.connect(feedback); feedback.connect(echo); echo.connect(echoOut); echoOut.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      // На iPhone звук включается только после проигрывания чего-нибудь в ответ на касание
      const unlock = ctx.createBufferSource();
      unlock.buffer = ctx.createBuffer(1, 1, 22050);
      unlock.connect(ctx.destination);
      unlock.start(0);
      ready = true;
      applyVolume();
    }
    function applyVolume() { if (master) master.gain.value = settings.sound ? settings.volume : 0; }

    function envelope(g, t, attack, dur, peak) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    function noise(o) {
      const t = ctx.currentTime + (o.delay || 0), dur = o.dur || 0.1;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = o.type || 'lowpass';
      f.frequency.setValueAtTime(o.freq || 1000, t);
      if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + dur);
      f.Q.value = o.q || 1;
      const g = ctx.createGain();
      envelope(g, t, o.attack || 0.005, dur, o.gain || 0.3);
      src.connect(f); f.connect(g); g.connect(sfx);
      src.start(t, Math.random() * 0.7);
      src.stop(t + dur + 0.05);
    }
    function tone(o) {
      const t = ctx.currentTime + (o.delay || 0), dur = o.dur || 0.1;
      const osc = ctx.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq || 440, t);
      if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + dur);
      const g = ctx.createGain();
      envelope(g, t, o.attack || 0.005, dur, o.gain || 0.2);
      let out = g;
      if (o.lowpass) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = o.lowpass;
        g.connect(f); out = f;
      }
      osc.connect(g); out.connect(sfx);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }

    const LIB = {
      click() { tone({ freq: 620, freqEnd: 880, dur: 0.07, gain: 0.16 }); noise({ dur: 0.025, type: 'highpass', freq: 3500, gain: 0.07 }); },
      back() { tone({ freq: 700, freqEnd: 460, dur: 0.08, gain: 0.14 }); },
      toggle() { tone({ freq: 980, dur: 0.04, type: 'triangle', gain: 0.1 }); },
      step(surface, k) {
        const v = (0.85 + Math.random() * 0.3) * (k || 1);
        if (surface === 'grass') {
          noise({ dur: 0.09, type: 'lowpass', freq: 650 + Math.random() * 300, gain: 0.3 * v });
          noise({ dur: 0.05, type: 'bandpass', freq: 2400, q: 0.8, gain: 0.04 * v, delay: 0.015 });
        } else if (surface === 'sand') {
          noise({ dur: 0.13, type: 'bandpass', freq: 2600 + Math.random() * 900, q: 0.7, gain: 0.2 * v });
          noise({ dur: 0.06, type: 'highpass', freq: 5000, gain: 0.07 * v, delay: 0.035 });
        } else if (surface === 'water') {
          noise({ dur: 0.2, type: 'bandpass', freq: 1500, freqEnd: 450, q: 1.2, gain: 0.3 * v });
          tone({ freq: 380 + Math.random() * 200, freqEnd: 950, dur: 0.07, gain: 0.05 * v, delay: 0.04 });
        } else if (surface === 'swim') {
          noise({ dur: 0.38, type: 'bandpass', freq: 950, freqEnd: 320, q: 0.8, gain: 0.26 * v, attack: 0.04 });
        } else {
          noise({ dur: 0.05, type: 'highpass', freq: 1800, gain: 0.16 * v });
          tone({ freq: 170, freqEnd: 110, dur: 0.06, type: 'triangle', gain: 0.12 * v });
        }
      },
      jump() {
        tone({ freq: 260, freqEnd: 560, dur: 0.16, type: 'triangle', gain: 0.12 });
        noise({ dur: 0.15, type: 'bandpass', freq: 700, freqEnd: 2200, q: 0.7, gain: 0.07 });
      },
      land(surface) {
        if (surface === 'water' || surface === 'swim') noise({ dur: 0.3, type: 'bandpass', freq: 1100, freqEnd: 300, q: 0.9, gain: 0.4 });
        else if (surface === 'sand') noise({ dur: 0.16, type: 'bandpass', freq: 1800, q: 0.6, gain: 0.32 });
        else if (surface === 'stone') { noise({ dur: 0.08, type: 'highpass', freq: 1200, gain: 0.25 }); tone({ freq: 120, freqEnd: 70, dur: 0.1, gain: 0.25 }); }
        else noise({ dur: 0.14, type: 'lowpass', freq: 480, gain: 0.5 });
      },
      chop() { noise({ dur: 0.08, type: 'bandpass', freq: 1700, q: 2.5, gain: 0.4 }); tone({ freq: 230, freqEnd: 140, dur: 0.09, type: 'triangle', gain: 0.22 }); },
      mine() { tone({ freq: 1300, freqEnd: 900, dur: 0.07, type: 'square', gain: 0.05 }); noise({ dur: 0.07, type: 'highpass', freq: 2800, gain: 0.22 }); },
      pick() { noise({ dur: 0.06, type: 'bandpass', freq: 2200, q: 1.5, gain: 0.16 }); tone({ freq: 700, freqEnd: 1050, dur: 0.06, gain: 0.05 }); },
      crystal() { tone({ freq: 1760, dur: 0.3, gain: 0.07 }); tone({ freq: 2637, dur: 0.35, gain: 0.05, delay: 0.05 }); },
      swing() { noise({ dur: 0.12, type: 'bandpass', freq: 900, freqEnd: 2400, q: 0.8, gain: 0.1 }); },
      hit() { noise({ dur: 0.1, type: 'lowpass', freq: 1300, gain: 0.45 }); tone({ freq: 150, freqEnd: 70, dur: 0.12, gain: 0.28 }); },
      hurt() { tone({ freq: 320, freqEnd: 170, dur: 0.2, type: 'sawtooth', gain: 0.09, lowpass: 1500 }); noise({ dur: 0.12, type: 'lowpass', freq: 900, gain: 0.28 }); },
      groan(vol) {
        const v = vol || 1;
        tone({ freq: 98, freqEnd: 70, dur: 0.85, type: 'sawtooth', gain: 0.07 * v, attack: 0.12, lowpass: 520 });
        tone({ freq: 104, freqEnd: 74, dur: 0.8, type: 'sawtooth', gain: 0.05 * v, attack: 0.15, lowpass: 480, delay: 0.03 });
      },
      zombieDie() { tone({ freq: 140, freqEnd: 50, dur: 0.6, type: 'sawtooth', gain: 0.09, lowpass: 600 }); },
      eat() { for (let i = 0; i < 3; i++) noise({ dur: 0.05, type: 'bandpass', freq: 1700 + i * 200, q: 1, gain: 0.18, delay: i * 0.11 }); },
      drink() { for (let i = 0; i < 4; i++) tone({ freq: 340 + i * 80, freqEnd: 820 + i * 120, dur: 0.06, gain: 0.07, delay: i * 0.12 }); },
      craft() {
        noise({ dur: 0.06, type: 'bandpass', freq: 1500, q: 2, gain: 0.25 });
        tone({ freq: 523, dur: 0.14, gain: 0.1, delay: 0.08 });
        tone({ freq: 784, dur: 0.22, gain: 0.08, delay: 0.16 });
      },
      night() { tone({ freq: 110, freqEnd: 82, dur: 1.8, type: 'triangle', gain: 0.16, attack: 0.25 }); tone({ freq: 165, freqEnd: 123, dur: 1.8, type: 'triangle', gain: 0.08, attack: 0.25 }); },
      dawn() { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.5, gain: 0.06, delay: i * 0.12 })); },
      death() { tone({ freq: 300, freqEnd: 60, dur: 1.3, type: 'sawtooth', gain: 0.1, lowpass: 900 }); },
      cave() { noise({ dur: 1.1, type: 'lowpass', freq: 320, gain: 0.25, attack: 0.25 }); },
    };

    function ambient(dt, mode, nightK) {
      if (!ready || !settings.sound) return;
      ambT -= dt;
      if (ambT > 0) return;
      if (mode === 'cave') {
        tone({ freq: 1100 + Math.random() * 900, freqEnd: 380, dur: 0.09, gain: 0.05 });
        ambT = rand(1.4, 4);
      } else if (nightK > 0.6) {
        const f = 4100 + Math.random() * 500;
        for (let i = 0; i < 6; i++) tone({ freq: f, dur: 0.025, gain: 0.012, delay: i * 0.055 });
        ambT = rand(0.7, 2.2);
      } else {
        const n = 2 + Math.floor(Math.random() * 3), f = 2300 + Math.random() * 1200;
        for (let i = 0; i < n; i++) tone({ freq: f, freqEnd: f + 900 + Math.random() * 500, dur: 0.07, gain: 0.025, delay: i * 0.11 });
        ambT = rand(2.5, 7);
      }
    }

    return {
      init,
      applyVolume,
      ambient,
      play(name, a, b) { if (ready && LIB[name]) { try { LIB[name](a, b); } catch (e) { /* звук не критичен */ } } },
      setCave(on) { if (ready) echoOut.gain.setTargetAtTime(on ? 0.35 : 0, ctx.currentTime, 0.1); },
    };
  })();

  document.addEventListener('pointerdown', () => Sound.init(), true);
  document.addEventListener('keydown', () => Sound.init(), true);
  // Звук нажатия кнопок меню
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (!b || b.closest('#controls')) return;
    Sound.play(b.matches('[data-back], .x, #btnNewNo, #btnResume') ? 'back' : 'click');
  }, true);
  document.addEventListener('change', (e) => { if (e.target.matches && e.target.matches('input')) Sound.play('toggle'); }, true);

  // ==================================================================
  // Рендер, сцена, свет
  // ==================================================================
  const app = $('app');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ccfe8);
  scene.fog = new THREE.Fog(0xffffff, 60, 260);
  scene.fog.color = scene.background;

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1400);
  const QUALITY = { low: 0.75, mid: 1.25, high: 2 };
  function resize() {
    const w = app.clientWidth || window.innerWidth, h = app.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[settings.quality] || 1.25));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  const surface = new THREE.Group(); // всё, что на поверхности
  const caveGroup = new THREE.Group(); // текущая пещера
  caveGroup.visible = false;
  scene.add(surface, caveGroup);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a5a2a, 0.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 1);
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 160 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const playerLight = new THREE.PointLight(0xffd2a0, 0, 12, 1);
  scene.add(playerLight);
  // Фиксированный набор огней для костров: добавление новых источников света на лету вызывает подвисания.
  const firePool = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xff8a3a, 0, 14, 2); scene.add(l); return { light: l, used: false }; });

  // Ветер: общий таймер для травы, цветов и крон
  const windTime = { value: 0 };
  function windy(mat, strength) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = windTime;
      shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n' +
        '#ifdef USE_INSTANCING\n vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);\n#else\n vec3 ip = vec3(0.0);\n#endif\n' +
        'float sway = sin(uWind * 1.7 + ip.x * 0.35 + ip.z * 0.27) * ' + strength.toFixed(3) + ' * max(position.y, 0.0);\n' +
        'transformed.x += sway; transformed.z += sway * 0.6;');
    };
    return mat;
  }

  // Текстура-шум, чтобы земля и камень не были плоско-одноцветными
  function detailTexture(size, lo, hi, seed) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const n = fbm(x / 6, y / 6, seed, 3) * 0.6 + hash2(x, y, seed + 5) * 0.4;
      const v = Math.round(255 * lerp(lo, hi, n)), i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // ==================================================================
  // Небо: купол с градиентом, солнце, луна, звёзды, облака
  // ==================================================================
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1000, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uTop; uniform vec3 uHorizon; varying vec3 vDir; void main(){ float k = smoothstep(-0.05, 0.45, vDir.y); gl_FragColor = vec4(mix(uHorizon, uTop, k), 1.0); }',
      side: THREE.BackSide, depthWrite: false, fog: false,
    })
  );
  sky.renderOrder = -10;
  scene.add(sky);

  const sunDisk = new THREE.Mesh(new THREE.CircleGeometry(32, 24), new THREE.MeshBasicMaterial({ color: 0xfff1c9, fog: false, depthWrite: false }));
  const moonDisk = new THREE.Mesh(new THREE.CircleGeometry(22, 24), new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false, depthWrite: false }));
  sunDisk.renderOrder = moonDisk.renderOrder = -9;
  scene.add(sunDisk, moonDisk);

  const stars = (function () {
    const pos = [];
    for (let i = 0; i < 1100; i++) {
      const u = Math.random(), v = Math.random() * 0.95 + 0.05;
      const th = u * TAU, y = v, r = Math.sqrt(1 - y * y);
      pos.push(Math.cos(th) * r * 900, y * 900, Math.sin(th) * r * 900);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    pts.renderOrder = -8;
    scene.add(pts);
    return pts;
  })();

  // ==================================================================
  // Мир: карта высот, реки, озёра, горы
  // ==================================================================
  const WORLD = { size: 640, seg: 256, water: 0 };
  const HALF = WORLD.size / 2, STEP = WORLD.size / WORLD.seg, N1 = WORLD.seg + 1;
  const WATER = WORLD.water;
  const heights = new Float32Array(N1 * N1);
  const POND = { x: 46, z: -34, r: 15 };

  function baseHeight(x, z) {
    const hills = (fbm(x * 0.007, z * 0.007, 11, 4) - 0.5) * 20;
    const mt = fbm(x * 0.0042 + 31, z * 0.0042 - 17, 23, 4);
    let mountain = 0;
    if (mt > 0.54) {
      const k = Math.min((mt - 0.54) / 0.16, 1.7);
      const ridge = 1 - Math.abs(vnoise(x * 0.022, z * 0.022, 41) * 2 - 1);
      mountain = Math.pow(k, 1.5) * 30 * (0.7 + ridge * 0.6);
    }
    let h = 3.4 + hills + mountain;
    // Озёра разной формы: впадины там, где «озёрный» шум выше порога
    const lk = fbm(x * 0.0095 - 60, z * 0.0095 + 90, 57, 3);
    if (lk > 0.57) h -= Math.min(1, (lk - 0.57) / 0.07) * (h + 3.6);
    // Ровная поляна вокруг старта
    const dc = Math.hypot(x, z);
    if (dc < 42) h = lerp(3.2 + hills * 0.12, h, smoothstep(16, 42, dc));
    // Пруд рядом со стартом, чтобы вода была близко
    const ang = Math.atan2(z - POND.z, x - POND.x);
    const pr = POND.r * (0.75 + vnoise(Math.cos(ang) * 2 + 5, Math.sin(ang) * 2 + 5, 61) * 0.6);
    const dp = Math.hypot(x - POND.x, z - POND.z);
    if (dp < pr * 1.7) h = Math.min(h, lerp(-3, h, smoothstep(pr * 0.6, pr * 1.6, dp)));
    // Горы по краю карты
    const edge = Math.max(Math.abs(x), Math.abs(z));
    h += smoothstep(HALF - 75, HALF - 5, edge) * 48;
    return h;
  }

  function makeRivers(rng) {
    const rivers = [];
    for (let k = 0; k < 5; k++) {
      let x = 0, z = 0;
      for (let tries = 0; tries < 80; tries++) {
        x = (rng() * 2 - 1) * (HALF - 100); z = (rng() * 2 - 1) * (HALF - 100);
        if (baseHeight(x, z) > 11 && Math.hypot(x, z) > 80) break;
      }
      let ang = rng() * TAU;
      const pts = [[x, z]], width = 3 + rng() * 2.5;
      for (let i = 0; i < 170; i++) {
        ang += (vnoise(i * 0.12, k * 13.7, 77) - 0.5) * 0.55;
        // Отворачиваем реку от стартовой поляны
        const dc = Math.hypot(x, z);
        if (dc < 70) ang = lerpAngle(ang, Math.atan2(z, x), 0.25);
        x += Math.cos(ang) * 4.5; z += Math.sin(ang) * 4.5;
        pts.push([x, z]);
        if (Math.abs(x) > HALF - 30 || Math.abs(z) > HALF - 30) break;
      }
      rivers.push({ pts, width });
    }
    return rivers;
  }

  function carveRivers(rivers) {
    const dist = new Float32Array(N1 * N1).fill(1e9), wid = new Float32Array(N1 * N1);
    for (const river of rivers) {
      const pts = river.pts;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        const w = river.width * (0.8 + (i / pts.length) * 0.7), reach = w * 2.6;
        const c0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach + HALF) / STEP)), c1 = Math.min(WORLD.seg, Math.ceil((Math.max(ax, bx) + reach + HALF) / STEP));
        const r0 = Math.max(0, Math.floor((Math.min(az, bz) - reach + HALF) / STEP)), r1 = Math.min(WORLD.seg, Math.ceil((Math.max(az, bz) + reach + HALF) / STEP));
        const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
          const px = -HALF + c * STEP, pz = -HALF + r * STEP;
          const t = clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1);
          const d = Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
          const idx = r * N1 + c;
          if (d < dist[idx]) { dist[idx] = d; wid[idx] = w; }
        }
      }
    }
    for (let i = 0; i < heights.length; i++) {
      const w = wid[i];
      if (!w || dist[i] > w * 2.6) continue;
      const t = smoothstep(w * 0.55, w * 2.6, dist[i]);
      heights[i] = Math.min(heights[i], lerp(-2.2, heights[i], t));
    }
  }

  function getHeight(x, z) {
    const fx = clamp((x + HALF) / STEP, 0, WORLD.seg - 0.0001), fz = clamp((z + HALF) / STEP, 0, WORLD.seg - 0.0001);
    const c = Math.floor(fx), r = Math.floor(fz), tx = fx - c, tz = fz - r;
    const i = r * N1 + c;
    // Та же разбивка на треугольники, что и у PlaneGeometry, чтобы ноги стояли ровно на земле
    if (tx + tz <= 1) return heights[i] + (heights[i + 1] - heights[i]) * tx + (heights[i + N1] - heights[i]) * tz;
    const e = heights[i + N1 + 1];
    return e + (heights[i + N1] - e) * (1 - tx) + (heights[i + 1] - e) * (1 - tz);
  }
  function slopeAt(x, z) {
    return Math.hypot(getHeight(x + 1.5, z) - getHeight(x - 1.5, z), getHeight(x, z + 1.5) - getHeight(x, z - 1.5)) / 3;
  }
  const forestK = (x, z) => fbm(x * 0.009 + 200, z * 0.009 - 120, 71, 3);

  const TC = {
    sandWet: new THREE.Color(0xa8946a), sand: new THREE.Color(0xdcc893), deep: new THREE.Color(0x5b5444),
    meadow: new THREE.Color(0x8fc057), grass: new THREE.Color(0x72a84a), forest: new THREE.Color(0x4a7a35),
    dry: new THREE.Color(0xa9b25c), rock: new THREE.Color(0x8d877e), rockDark: new THREE.Color(0x67625b), snow: new THREE.Color(0xf1f4f7),
  };
  const tmpC = new THREE.Color();
  function terrainColor(x, z, h, slope, out) {
    if (h < WATER - 0.4) return out.copy(TC.sandWet).lerp(TC.deep, clamp((-h - 0.4) / 3, 0, 1));
    if (h < 1.1) return out.copy(TC.sand).lerp(TC.sandWet, clamp((1.1 - h) / 1.5, 0, 1) * 0.6);
    const m = vnoise(x * 0.05, z * 0.05, 91);
    out.copy(TC.meadow).lerp(TC.grass, m);
    out.lerp(TC.forest, smoothstep(0.47, 0.6, forestK(x, z)));
    out.lerp(TC.dry, smoothstep(0.6, 0.72, vnoise(x * 0.012, z * 0.012, 93)) * 0.6);
    if (h < 1.9) out.lerp(TC.sand, (1.9 - h) / 0.8 * 0.75);
    const rockK = Math.max(smoothstep(0.55, 0.95, slope), smoothstep(18, 25, h));
    if (rockK > 0) out.lerp(tmpC.copy(TC.rock).lerp(TC.rockDark, m), rockK);
    const snowK = smoothstep(31, 37, h + m * 4) * (1 - smoothstep(0.9, 1.4, slope));
    if (snowK > 0) out.lerp(TC.snow, snowK);
    return out;
  }
  function surfaceAt(x, z) {
    if (inCave) return 'stone';
    const h = getHeight(x, z);
    if (h < WATER + 0.05) return 'water';
    if (h < 1.6) return 'sand';
    if (h > 20 || slopeAt(x, z) > 0.7) return 'stone';
    return 'grass';
  }

  const worldRng = mulberry32(20261024);
  const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: detailTexture(128, 0.78, 1.0, 5) });
  terrainMat.map.repeat.set(WORLD.size / 5, WORLD.size / 5);
  let terrain = null;

  function buildTerrain() {
    for (let r = 0; r < N1; r++) for (let c = 0; c < N1; c++) heights[r * N1 + c] = baseHeight(-HALF + c * STEP, -HALF + r * STEP);
    carveRivers(makeRivers(worldRng));

    const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, WORLD.seg, WORLD.seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = heights[i];
      pos.setY(i, h);
      terrainColor(x, z, h, slopeAt(x, z), c);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    terrain = new THREE.Mesh(geo, terrainMat);
    terrain.receiveShadow = true;
    surface.add(terrain);
  }

  // Вода: одна большая плоскость с анимированной рябью
  const waterMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uDeep: { value: new THREE.Color(0x1b5a85) }, uShallow: { value: new THREE.Color(0x4fb3d1) }, uLight: { value: 1 },
    }]),
    vertexShader: [
      '#include <fog_pars_vertex>',
      'varying vec3 vWorld;',
      'void main() {',
      '  vec4 wp = modelMatrix * vec4(position, 1.0);',
      '  vWorld = wp.xyz;',
      '  vec4 mvPosition = viewMatrix * wp;',
      '  gl_Position = projectionMatrix * mvPosition;',
      '  #include <fog_vertex>',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform float uLight;',
      '#include <fog_pars_fragment>',
      'varying vec3 vWorld;',
      'void main() {',
      '  float w = sin(vWorld.x * 0.33 + uTime * 1.2) * cos(vWorld.z * 0.29 - uTime * 1.05)',
      '          + 0.5 * sin((vWorld.x + vWorld.z) * 0.85 + uTime * 2.1) + 0.3 * sin(vWorld.x * 1.7 - vWorld.z * 1.3 + uTime * 3.0);',
      '  vec3 col = mix(uDeep, uShallow, 0.45 + 0.18 * w);',
      '  col += vec3(pow(max(0.0, w - 1.0), 2.0) * 0.6);',
      '  gl_FragColor = vec4(col * uLight, 0.8);',
      '  #include <fog_fragment>',
      '}',
    ].join('\n'),
    transparent: true, depthWrite: false, fog: true,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size, WORLD.size), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER;
  surface.add(water);

  // ==================================================================
  // Растительность и ресурсы (всё рисуется пачками через InstancedMesh)
  // ==================================================================
  const dummy = new THREE.Object3D();
  function matrixOf(x, y, z, sx, sy, sz, ry, rx, rz) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx || 0, ry || 0, rz || 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  }
  class Batch {
    constructor(geo, mat, opts) { this.geo = geo; this.mat = mat; this.items = []; this.opts = opts || {}; this.mesh = null; }
    add(matrix, color) { this.items.push({ m: matrix, c: color || null }); return this.items.length - 1; }
    build(parent) {
      const n = Math.max(1, this.items.length);
      const mesh = new THREE.InstancedMesh(this.geo, this.mat, n);
      const white = new THREE.Color(1, 1, 1);
      this.items.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        if (this.opts.colored) mesh.setColorAt(i, it.c || white);
      });
      mesh.count = this.items.length;
      mesh.castShadow = !!this.opts.cast;
      mesh.receiveShadow = !!this.opts.receive;
      mesh.frustumCulled = false;
      parent.add(mesh);
      this.mesh = mesh;
      return mesh;
    }
  }

  const lam = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}));
  const GEO = {
    trunk: new THREE.CylinderGeometry(0.7, 1, 1, 6).translate(0, 0.5, 0),
    cone: new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
    blob: new THREE.IcosahedronGeometry(1, 0),
    rock: new THREE.DodecahedronGeometry(1, 0),
    berry: new THREE.SphereGeometry(0.13, 6, 5),
    stem: new THREE.CylinderGeometry(0.015, 0.022, 0.42, 3).translate(0, 0.21, 0),
    petal: new THREE.OctahedronGeometry(0.1, 0).translate(0, 0.44, 0),
    flame: new THREE.ConeGeometry(0.42, 1.1, 6).translate(0, 0.55, 0),
    flameCore: new THREE.ConeGeometry(0.22, 0.7, 6).translate(0, 0.35, 0),
    stone: new THREE.DodecahedronGeometry(0.22, 0),
    hpBg: new THREE.PlaneGeometry(0.92, 0.13),
    hpFill: new THREE.PlaneGeometry(0.86, 0.08).translate(0.43, 0, 0),
    box: new THREE.BoxGeometry(1, 1, 1),
  };
  const MAT = {
    trunk: lam(0xffffff),
    crown: windy(lam(0xffffff), 0.05),
    rock: lam(0xffffff),
    bush: windy(lam(0xffffff), 0.04),
    berry: lam(0xd0263f, { emissive: 0x300008 }),
    stem: windy(lam(0x4f8a35), 0.22),
    petal: windy(lam(0xffffff), 0.22),
    cloud: lam(0xffffff, { fog: false }),
    log: lam(0x5e3c22),
    flame: new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
    flameCore: new THREE.MeshBasicMaterial({ color: 0xffdd80 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xff3b2f }),
    caveEye: new THREE.MeshBasicMaterial({ color: 0x9cff5a }),
    blade: new THREE.MeshPhongMaterial({ color: 0xdfe3ea, shininess: 100 }),
    ironBlade: new THREE.MeshPhongMaterial({ color: 0x9fb4c8, shininess: 120, specular: 0x8899aa }),
    hilt: lam(0x5a3b22),
    hpBg: new THREE.MeshBasicMaterial({ color: 0x1a0808, depthWrite: false }),
    hpFill: new THREE.MeshBasicMaterial({ color: 0xe0524a, depthWrite: false }),
    lantern: new THREE.MeshBasicMaterial({ color: 0x9ff4ff }),
    rockStatic: lam(0x7f7a73),
    hole: new THREE.MeshBasicMaterial({ color: 0x020203 }),
  };

  // Пространственная сетка: быстро находит ресурсы рядом с точкой на большой карте
  const HCELL = 8;
  const grid = new Map();
  const gkey = (cx, cz) => (cx + 1000) * 4000 + (cz + 1000);
  function gridAdd(o) {
    const k = gkey(Math.floor(o.x / HCELL), Math.floor(o.z / HCELL));
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(o);
  }
  function gridEach(x, z, r, fn) {
    const c0 = Math.floor((x - r) / HCELL), c1 = Math.floor((x + r) / HCELL), r0 = Math.floor((z - r) / HCELL), r1 = Math.floor((z + r) / HCELL);
    for (let cx = c0; cx <= c1; cx++) for (let cz = r0; cz <= r1; cz++) {
      const a = grid.get(gkey(cx, cz));
      if (a) for (let i = 0; i < a.length; i++) fn(a[i]);
    }
  }

  const resources = []; // ресурсы на поверхности
  const occupied = new Uint8Array((WORLD.size / 2) * (WORLD.size / 2));
  function isFree(x, z, gap) {
    const g = Math.ceil(gap / 2), cx = Math.floor((x + HALF) / 2), cz = Math.floor((z + HALF) / 2), W2 = WORLD.size / 2;
    for (let a = cx - g; a <= cx + g; a++) for (let b = cz - g; b <= cz + g; b++) {
      if (a < 0 || b < 0 || a >= W2 || b >= W2 || occupied[b * W2 + a]) return false;
    }
    return true;
  }
  function occupy(x, z, gap) {
    const g = Math.ceil(gap / 2) - 1, cx = Math.floor((x + HALF) / 2), cz = Math.floor((z + HALF) / 2), W2 = WORLD.size / 2;
    for (let a = cx - g; a <= cx + g; a++) for (let b = cz - g; b <= cz + g; b++) {
      if (a >= 0 && b >= 0 && a < W2 && b < W2) occupied[b * W2 + a] = 1;
    }
  }

  const caveEntrances = [];
  const staticColliders = [];

  function buildNature() {
    const rng = worldRng;
    const B = {
      trunk: new Batch(GEO.trunk, MAT.trunk, { cast: true, colored: true }),
      cone: new Batch(GEO.cone, MAT.crown, { cast: true, colored: true }),
      blob: new Batch(GEO.blob, MAT.crown, { cast: true, colored: true }),
      rock: new Batch(GEO.rock, MAT.rock, { cast: true, receive: true, colored: true }),
      bush: new Batch(GEO.blob, MAT.bush, { cast: true, colored: true }),
      berry: new Batch(GEO.berry, MAT.berry, {}),
      stem: new Batch(GEO.stem, MAT.stem, {}),
      petal: new Batch(GEO.petal, MAT.petal, { colored: true }),
    };
    const col = (hex, jitter) => { const c = new THREE.Color(hex); c.offsetHSL((rng() - 0.5) * 0.03, (rng() - 0.5) * 0.1, (rng() - 0.5) * (jitter || 0.08)); return c; };
    function addRes(type, x, z, r, parts) {
      const o = { type, cfg: CFG.res[type], x, z, y: getHeight(x, z), r, left: CFG.res[type].amount, active: true, respawnAt: 0, parts, hitT: 0 };
      resources.push(o);
      gridAdd(o);
      return o;
    }
    const nearCave = (x, z) => caveEntrances.some((e) => Math.hypot(e.x - x, e.z - z) < 14);
    const okGround = (x, z, h, s) => h > 1.7 && s < 0.6 && h < 27 && Math.hypot(x, z) > 9 && !nearCave(x, z);

    // Деревья трёх видов
    let trees = 0;
    for (let i = 0; i < 9000 && trees < 2300; i++) {
      const x = (rng() * 2 - 1) * (HALF - 12), z = (rng() * 2 - 1) * (HALF - 12);
      const h = getHeight(x, z), s = slopeAt(x, z);
      if (!okGround(x, z, h, s)) continue;
      const f = forestK(x, z);
      const p = f > 0.56 ? 0.9 : f > 0.48 ? 0.35 : 0.05;
      if (rng() > p || !isFree(x, z, 3)) continue;
      occupy(x, z, 3);
      trees++;
      const sc = 0.8 + rng() * 0.5, ry = rng() * TAU, parts = [];
      const kind = h > 15 ? 'pine' : f > 0.56 ? (rng() < 0.5 ? 'pine' : rng() < 0.6 ? 'oak' : 'birch') : (rng() < 0.55 ? 'oak' : rng() < 0.5 ? 'birch' : 'pine');
      if (kind === 'pine') {
        const th = 2.2 * sc;
        parts.push(['trunk', B.trunk.add(matrixOf(x, h - 0.2, z, 0.32 * sc, th + 0.6, 0.32 * sc, ry), col(0x6b4a2f, 0.05))]);
        const green = col(rng() < 0.5 ? 0x2f6b3f : 0x2a5f3a, 0.06);
        for (let k = 0; k < 3; k++) {
          const rr = (1.9 - k * 0.5) * sc, hh = 2.4 * sc;
          parts.push(['cone', B.cone.add(matrixOf(x, h + th * 0.6 + k * 1.25 * sc, z, rr, hh, rr, ry + k), green)]);
        }
      } else if (kind === 'oak') {
        const th = 2.4 * sc;
        parts.push(['trunk', B.trunk.add(matrixOf(x, h - 0.2, z, 0.36 * sc, th + 0.4, 0.36 * sc, ry), col(0x6b4a2f, 0.05))]);
        const autumn = rng() < 0.08;
        const leaf = col(autumn ? (rng() < 0.5 ? 0xd98a2b : 0xc9b23a) : [0x4c8c3c, 0x3f7d3a, 0x5a9a44][Math.floor(rng() * 3)], 0.06);
        parts.push(['blob', B.blob.add(matrixOf(x, h + th + 1.1 * sc, z, 2.3 * sc, 1.9 * sc, 2.3 * sc, ry, rng(), rng()), leaf)]);
        parts.push(['blob', B.blob.add(matrixOf(x + 0.9 * sc, h + th + 0.6 * sc, z + 0.5 * sc, 1.5 * sc, 1.3 * sc, 1.5 * sc, ry + 1, rng(), 0), leaf)]);
      } else {
        const th = 3.6 * sc;
        parts.push(['trunk', B.trunk.add(matrixOf(x, h - 0.2, z, 0.22 * sc, th + 0.4, 0.22 * sc, ry), col(0xe7e2d6, 0.03))]);
        parts.push(['blob', B.blob.add(matrixOf(x, h + th + 0.8 * sc, z, 1.5 * sc, 2.4 * sc, 1.5 * sc, ry, rng() * 0.4, 0), col(0x8fbf4a, 0.07))]);
      }
      addRes('tree', x, z, 0.45 * sc + 0.1, parts);
    }

    // Камни и валуны (больше в горах)
    let rocks = 0;
    for (let i = 0; i < 5000 && rocks < 520; i++) {
      const x = (rng() * 2 - 1) * (HALF - 12), z = (rng() * 2 - 1) * (HALF - 12);
      const h = getHeight(x, z), s = slopeAt(x, z);
      if (h < 0.6 || s > 0.95 || Math.hypot(x, z) < 9 || nearCave(x, z)) continue;
      const p = h > 14 || s > 0.4 ? 0.6 : 0.09;
      if (rng() > p || !isFree(x, z, 3)) continue;
      occupy(x, z, 3);
      rocks++;
      const sc = (h > 14 ? 1.1 : 0.7) + rng() * 0.9;
      const m = matrixOf(x, h + sc * 0.2, z, sc, sc * 0.7, sc * (0.8 + rng() * 0.4), rng() * TAU, rng() * 0.6, rng() * 0.3);
      addRes('rock', x, z, sc * 0.85, [['rock', B.rock.add(m, col(0x8a8d90, 0.1))]]);
    }

    // Ягодные кусты
    let bushes = 0;
    for (let i = 0; i < 6000 && bushes < 380; i++) {
      const x = (rng() * 2 - 1) * (HALF - 12), z = (rng() * 2 - 1) * (HALF - 12);
      const h = getHeight(x, z), s = slopeAt(x, z);
      if (!okGround(x, z, h, s) || h > 14) continue;
      const f = forestK(x, z);
      if (rng() > (f > 0.44 && f < 0.6 ? 0.5 : 0.12) || !isFree(x, z, 2.5)) continue;
      occupy(x, z, 2.5);
      bushes++;
      const sc = 0.8 + rng() * 0.3, parts = [];
      parts.push(['bush', B.bush.add(matrixOf(x, h + 0.55 * sc, z, 0.85 * sc, 0.7 * sc, 0.85 * sc, rng() * TAU), col(0x2f6e35, 0.06))]);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + rng() * 0.5;
        parts.push(['berry', B.berry.add(matrixOf(x + Math.cos(a) * 0.7 * sc, h + (0.4 + rng() * 0.5) * sc, z + Math.sin(a) * 0.7 * sc, 1, 1, 1))]);
      }
      addRes('bush', x, z, 0.65 * sc, parts);
    }
    // Ближайшие к старту ресурсы, чтобы не бегать далеко в начале
    const starter = [['tree', 7, 6], ['tree', -8, 4], ['tree', 5, -9], ['rock', -6, -7], ['rock', 10, 2], ['bush', -3, 9], ['bush', 9, -4]];
    for (const [type, x, z] of starter) {
      const h = getHeight(x, z);
      if (type === 'tree') {
        addRes('tree', x, z, 0.5, [
          ['trunk', B.trunk.add(matrixOf(x, h - 0.2, z, 0.36, 2.8, 0.36, 0), col(0x6b4a2f, 0.04))],
          ['blob', B.blob.add(matrixOf(x, h + 3.5, z, 2.3, 1.9, 2.3, x, 0.3, 0.2), col(0x4c8c3c, 0.05))],
        ]);
      } else if (type === 'rock') {
        addRes('rock', x, z, 0.95, [['rock', B.rock.add(matrixOf(x, h + 0.2, z, 1.1, 0.8, 1, x), col(0x8a8d90, 0.08))]]);
      } else {
        const parts = [['bush', B.bush.add(matrixOf(x, h + 0.55, z, 0.85, 0.7, 0.85, x), col(0x2f6e35, 0.05))]];
        for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; parts.push(['berry', B.berry.add(matrixOf(x + Math.cos(a) * 0.7, h + 0.6, z + Math.sin(a) * 0.7, 1, 1, 1))]); }
        addRes('bush', x, z, 0.65, parts);
      }
    }

    // Цветы полянками
    const PETALS = [0xf2e14b, 0xffffff, 0xe94f6a, 0x9b6cf0, 0x4f8ff0, 0xff8a3d, 0xf7a6d4];
    let clusters = 0;
    for (let i = 0; i < 4000 && clusters < 420; i++) {
      const cx = (rng() * 2 - 1) * (HALF - 15), cz = (rng() * 2 - 1) * (HALF - 15);
      const h = getHeight(cx, cz);
      if (h < 2 || h > 15 || slopeAt(cx, cz) > 0.4 || forestK(cx, cz) > 0.56) continue;
      clusters++;
      const pc = new THREE.Color(PETALS[Math.floor(rng() * PETALS.length)]);
      const n = 6 + Math.floor(rng() * 10);
      for (let k = 0; k < n; k++) {
        const x = cx + (rng() - 0.5) * 7, z = cz + (rng() - 0.5) * 7, hh = getHeight(x, z);
        if (hh < 1.8) continue;
        const sc = 0.8 + rng() * 0.6, m = matrixOf(x, hh, z, sc, sc, sc, rng() * TAU);
        B.stem.add(m);
        B.petal.add(m, pc);
      }
    }

    for (const key of Object.keys(B)) B[key].build(surface);
    for (const r of resources) {
      r.parts = r.parts.map(([key, i]) => {
        const mesh = B[key].mesh, m = new THREE.Matrix4();
        mesh.getMatrixAt(i, m);
        return { mesh, i, m };
      });
    }
  }

  // Облака
  const clouds = new THREE.Group();
  (function buildClouds() {
    const rng = mulberry32(99);
    const batch = new Batch(new THREE.IcosahedronGeometry(1, 1), MAT.cloud, {});
    for (let c = 0; c < 34; c++) {
      const x = (rng() * 2 - 1) * 520, z = (rng() * 2 - 1) * 520, y = 95 + rng() * 40, s = 6 + rng() * 6;
      for (let k = 0; k < 5; k++) {
        batch.add(matrixOf(x + (k - 2) * s * 0.9 + rng() * 3, y + rng() * 3, z + (rng() - 0.5) * s, s * (0.8 + rng() * 0.6), s * 0.55, s * (0.7 + rng() * 0.5), rng() * TAU));
      }
    }
    batch.build(clouds);
    scene.add(clouds);
  })();

  // Трава: густые пучки вокруг игрока, перестраиваются при движении
  function tuftGeometry() {
    const pos = [], col = [], nor = [];
    const base = new THREE.Color(0x3d6b29), tip = new THREE.Color(0xc6e07a);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3, ca = Math.cos(a) * 0.08, sa = Math.sin(a) * 0.08, lean = (i - 1) * 0.08;
      // Каждая травинка с двух сторон и с нормалью вверх, чтобы обе стороны освещались одинаково
      pos.push(-ca, 0, -sa, ca, 0, sa, lean, 0.42, lean * 0.6);
      pos.push(ca, 0, sa, -ca, 0, -sa, lean, 0.42, lean * 0.6);
      for (let k = 0; k < 2; k++) {
        col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
        nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return g;
  }
  const GRASS = { cell: 1.05, max: 9000 };
  const grassMesh = new THREE.InstancedMesh(tuftGeometry(), windy(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.32), GRASS.max);
  grassMesh.frustumCulled = false;
  grassMesh.setColorAt(0, new THREE.Color(1, 1, 1)); // создаёт буфер цветов на все пучки, поэтому до обнуления count
  grassMesh.count = 0;
  surface.add(grassMesh);
  let grassCenter = { x: 1e9, z: 1e9 };
  const grassColor = new THREE.Color(), GRASS_FOREST = new THREE.Color(0.62, 0.78, 0.6), GRASS_SHORE = new THREE.Color(1.1, 1.05, 0.7);
  function grassRadius() { return settings.quality === 'low' ? 0 : settings.quality === 'high' ? 44 : 30; }
  function updateGrass(force) {
    const R = grassRadius();
    if (R === 0) { grassMesh.count = 0; return; }
    const cx = Math.round(P.x / 8) * 8, cz = Math.round(P.z / 8) * 8;
    if (!force && cx === grassCenter.x && cz === grassCenter.z) return;
    grassCenter = { x: cx, z: cz };
    const C = GRASS.cell, n0x = Math.floor((cx - R) / C), n1x = Math.ceil((cx + R) / C), n0z = Math.floor((cz - R) / C), n1z = Math.ceil((cz + R) / C);
    let n = 0;
    for (let gx = n0x; gx <= n1x && n < GRASS.max; gx++) for (let gz = n0z; gz <= n1z && n < GRASS.max; gz++) {
      const jx = hash2(gx, gz, 301), jz = hash2(gx, gz, 302);
      const x = (gx + jx) * C, z = (gz + jz) * C;
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz > R * R) continue;
      const h = getHeight(x, z);
      if (h < 1.6 || h > 22) continue;
      const s = slopeAt(x, z);
      if (s > 0.6) continue;
      const k = 0.65 + hash2(gx, gz, 303) * 0.55;
      grassMesh.setMatrixAt(n, matrixOf(x, h - 0.03, z, k, k * (0.75 + jx * 0.5), k, jz * TAU));
      const f = forestK(x, z);
      grassColor.setRGB(1, 1, 1).lerp(GRASS_FOREST, smoothstep(0.47, 0.6, f));
      if (h < 2.2) grassColor.lerp(GRASS_SHORE, 0.5);
      grassMesh.setColorAt(n, grassColor);
      n++;
    }
    grassMesh.count = n;
    grassMesh.instanceMatrix.needsUpdate = true;
    if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
  }

  // ==================================================================
  // Входы в пещеры
  // ==================================================================
  function buildCaveEntrances() {
    const rng = mulberry32(4242);
    for (let tries = 0; tries < 6000 && caveEntrances.length < 5; tries++) {
      const x = (rng() * 2 - 1) * (HALF - 90), z = (rng() * 2 - 1) * (HALF - 90);
      const h = getHeight(x, z), s = slopeAt(x, z);
      if (h < 7 || h > 20 || s < 0.25 || s > 0.85) continue;
      if (Math.hypot(x, z) < 60 || caveEntrances.some((e) => Math.hypot(e.x - x, e.z - z) < 110)) continue;
      // Вход смотрит вниз по склону
      const gx = getHeight(x + 2, z) - getHeight(x - 2, z), gz = getHeight(x, z + 2) - getHeight(x, z - 2);
      const face = Math.atan2(-gx, -gz);
      const fx = Math.sin(face), fz = Math.cos(face);
      const g = new THREE.Group();
      g.position.set(x, h - 0.4, z);
      g.rotation.y = face;
      const rock = (px, py, pz, sx, sy, sz) => {
        const m = new THREE.Mesh(GEO.rock, MAT.rockStatic);
        m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.rotation.set(rng(), rng() * 3, rng() * 0.4);
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
      };
      rock(-2.4, 1.6, 0, 1.6, 2.2, 1.8);
      rock(2.4, 1.6, 0, 1.6, 2.3, 1.8);
      rock(0, 3.9, 0.1, 3.2, 1.2, 1.9);
      rock(0, 2.2, -2.6, 4.2, 3.4, 3);
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.4), MAT.hole);
      hole.position.set(0, 1.7, 0.6);
      g.add(hole);
      surface.add(g);
      const e = { x, z, face, ix: x + fx * 3.2, iz: z + fz * 3.2, index: caveEntrances.length };
      caveEntrances.push(e);
      for (const [lx, lz, r] of [[-2.4, 0, 1.5], [2.4, 0, 1.5], [0, -2.6, 2.8]]) {
        const wx = x + lx * Math.cos(face) + lz * Math.sin(face), wz = z - lx * Math.sin(face) + lz * Math.cos(face);
        const c = { x: wx, z: wz, r, isStatic: true };
        staticColliders.push(c);
        gridAdd(c);
      }
    }
  }

  // ==================================================================
  // Персонажи
  // ==================================================================
  function makeHuman(mats) {
    const g = new THREE.Group();
    const box = (w, h, d, mat) => { const m = new THREE.Mesh(GEO.box, mat); m.scale.set(w, h, d); m.castShadow = true; return m; };
    const body = box(0.62, 0.72, 0.36, mats.shirt); body.position.y = 1.26; g.add(body);
    const head = new THREE.Group(); head.position.y = 1.86; g.add(head);
    head.add(box(0.46, 0.46, 0.46, mats.skin));
    const limb = (x, y, w, h, mat) => {
      const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
      const m = box(w, h, w, mat); m.position.y = -h / 2; pivot.add(m);
      g.add(pivot);
      return pivot;
    };
    return {
      g, head, body,
      legL: limb(-0.16, 0.9, 0.26, 0.9, mats.pants), legR: limb(0.16, 0.9, 0.26, 0.9, mats.pants),
      armL: limb(-0.43, 1.58, 0.22, 0.74, mats.arms || mats.skin), armR: limb(0.43, 1.58, 0.22, 0.74, mats.arms || mats.skin),
    };
  }
  const ZOMBIE_MATS = { skin: lam(0x7fa36a), shirt: lam(0x5b4a3c), pants: lam(0x34405a) };
  const CAVE_ZOMBIE_MATS = { skin: lam(0x8c93a8), shirt: lam(0x3b3346), pants: lam(0x2a2a33) };

  const hero = makeHuman({ skin: lam(0xf0c8a0), shirt: lam(0x3a78c9), pants: lam(0x2b3448), arms: lam(0x3a78c9) });
  const hair = new THREE.Mesh(GEO.box, lam(0x4a2f1c)); hair.scale.set(0.5, 0.14, 0.5); hair.position.y = 0.25; hero.head.add(hair);
  function makeSword(bladeMat, length) {
    const s = new THREE.Group();
    for (const [mat, sx, sy, sz, z] of [[bladeMat, 0.06, 0.12, length, 0.12 + length / 2], [MAT.hilt, 0.32, 0.06, 0.08, 0.1], [MAT.hilt, 0.07, 0.07, 0.26, -0.06]]) {
      const part = new THREE.Mesh(GEO.box, mat); part.scale.set(sx, sy, sz); part.position.z = z; part.castShadow = true; s.add(part);
    }
    s.position.set(0, -0.7, 0.04);
    s.visible = false;
    hero.armR.add(s);
    return s;
  }
  const swordMesh = makeSword(MAT.blade, 1.0);
  const ironSwordMesh = makeSword(MAT.ironBlade, 1.25);
  const lanternMesh = new THREE.Group();
  (function () {
    const frame = new THREE.Mesh(GEO.box, MAT.hilt); frame.scale.set(0.2, 0.06, 0.2); frame.position.y = 0.14; lanternMesh.add(frame);
    const glow = new THREE.Mesh(GEO.box, MAT.lantern); glow.scale.set(0.16, 0.22, 0.16); lanternMesh.add(glow);
    lanternMesh.position.set(0, -0.82, 0.08);
    lanternMesh.visible = false;
    hero.armL.add(lanternMesh);
  })();
  scene.add(hero.g);

  function animateHuman(h, walkPhase, walkAmount, zombie, swim) {
    const swing = Math.sin(walkPhase) * 0.7 * walkAmount;
    h.legL.rotation.x = swing;
    h.legR.rotation.x = -swing;
    if (swim) {
      h.armL.rotation.x = -1.6 + Math.sin(walkPhase) * 1.1;
      h.armR.rotation.x = -1.6 - Math.sin(walkPhase) * 1.1;
    } else if (zombie) {
      h.armL.rotation.x = -Math.PI / 2 + Math.sin(walkPhase * 0.5) * 0.12;
      h.armR.rotation.x = -Math.PI / 2 - Math.sin(walkPhase * 0.5) * 0.12;
    } else {
      h.armL.rotation.x = -swing * 0.8;
      h.armR.rotation.x = swing * 0.8;
    }
    return Math.abs(Math.sin(walkPhase)) * 0.06 * walkAmount;
  }

  // ==================================================================
  // Состояние игры
  // ==================================================================
  const P = {};
  const W = { clock: 0 };
  const zombies = [];
  const walls = [];
  const campfires = [];
  let screen = 'loading'; // loading | menu | game | pause | dead
  let craftOpen = false;
  let camYaw = 0.6, camPitch = 0.75, shake = 0, vignette = 0;
  let inCave = 0; // 0 — на поверхности, иначе номер пещеры + 1
  let caveReturn = null;
  let cave = null; // данные текущей пещеры

  function freshPlayer() {
    return {
      x: 0, z: 0, y: getHeight(0, 0), vy: 0, grounded: true, swimming: false, r: 0.4, face: 0, hp: 100, maxHp: 100,
      hunger: CFG.maxHunger, thirst: CFG.maxThirst,
      inv: { wood: 0, stone: 0, berry: 0, iron: 0, crystal: 0 }, weapon: 'fist', lantern: false,
      kills: 0, nights: 0, dead: false, deadT: 0,
      walk: 0, walkAmt: 0, stepIdx: 0, swingT: 0, actCd: 0, starveWarned: false,
    };
  }

  function clearWorld() {
    if (inCave) leaveCave(true);
    for (const z of zombies) scene.remove(z.h.g, z.bar.g);
    zombies.length = 0;
    for (const w of walls) surface.remove(w.mesh);
    walls.length = 0;
    for (const c of campfires) removeCampfire(c, true);
    campfires.length = 0;
    for (const r of resources) { r.left = r.cfg.amount; setResVisible(r, true); }
  }

  function resetGame() {
    clearWorld();
    Object.keys(P).forEach((k) => delete P[k]);
    Object.assign(P, freshPlayer());
    Object.assign(W, { day: 1, night: false, t: CFG.dayLen * 0.15, toSpawn: 0, spawnT: 0, warned: false });
    refreshEquipment();
    hero.g.rotation.set(0, 0, 0);
    camYaw = 0.6;
    camPitch = 0.75;
    updateGrass(true);
  }

  function refreshEquipment() {
    swordMesh.visible = P.weapon === 'sword';
    ironSwordMesh.visible = P.weapon === 'iron';
    lanternMesh.visible = !!P.lantern;
  }

  // ==================================================================
  // Сохранение
  // ==================================================================
  function makeSave() {
    const pos = inCave && caveReturn ? caveReturn : { x: P.x, z: P.z };
    return {
      v: SAVE_VERSION,
      P: { x: pos.x, z: pos.z, face: P.face, hp: P.hp, hunger: P.hunger, thirst: P.thirst,
        inv: Object.assign({}, P.inv), weapon: P.weapon, lantern: P.lantern, kills: P.kills, nights: P.nights },
      W: { day: W.day, night: W.night, t: W.t, warned: W.warned },
      zombies: W.night ? zombies.filter((z) => !z.dead && !z.burn && !z.cave).length + W.toSpawn : 0,
      walls: walls.map((w) => ({ x: w.x, z: w.z, rot: w.rot, hp: w.hp })),
      fires: campfires.map((c) => ({ x: c.x, z: c.z, life: c.life })),
      cam: { yaw: camYaw, pitch: camPitch },
    };
  }
  function loadSave(data) {
    resetGame();
    const sp = data.P || {};
    Object.assign(P, {
      hp: sp.hp > 0 ? sp.hp : 1, hunger: sp.hunger, thirst: sp.thirst, face: sp.face || 0,
      kills: sp.kills || 0, nights: sp.nights || 0,
      inv: Object.assign({ wood: 0, stone: 0, berry: 0, iron: 0, crystal: 0 }, sp.inv),
      weapon: sp.weapon || (sp.hasSword ? 'sword' : 'fist'), lantern: !!sp.lantern,
    });
    // Старые сохранения были на другой карте: начинаем на поляне, но с вещами
    if (data.v === SAVE_VERSION) {
      P.x = sp.x; P.z = sp.z;
      for (const w of data.walls || []) { addWall(w.x, w.z, w.rot); damageWall(walls[walls.length - 1], CFG.wall.hp - w.hp, true); }
      for (const c of data.fires || []) { addCampfire(c.x, c.z); campfires[campfires.length - 1].life = c.life; }
    }
    P.y = groundY(P.x, P.z);
    Object.assign(W, data.W || {});
    W.toSpawn = data.zombies || 0;
    W.spawnT = 2;
    refreshEquipment();
    if (data.cam) { camYaw = data.cam.yaw; camPitch = data.cam.pitch; }
    updateGrass(true);
  }
  const hasSave = () => !!readJson(KEYS.save, null);
  function persist() {
    if ((screen === 'game' || screen === 'pause') && !P.dead) writeJson(KEYS.save, makeSave());
  }
  setInterval(() => { if (screen === 'game') persist(); }, 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'game') { persist(); showScreen('pause'); }
  });

  // ==================================================================
  // Уведомления
  // ==================================================================
  const toastBox = $('toasts');
  const recentToasts = new Map();
  function toast(text, kind) {
    const now = performance.now();
    if (recentToasts.has(text) && now - recentToasts.get(text) < 1400) return;
    recentToasts.set(text, now);
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = text;
    toastBox.appendChild(el);
    while (toastBox.children.length > 4) toastBox.firstChild.remove();
    setTimeout(() => el.classList.add('out'), kind === 'item' ? 1100 : 2800);
    setTimeout(() => el.remove(), kind === 'item' ? 1700 : 3400);
  }

  // ==================================================================
  // Управление
  // ==================================================================
  const keys = {};
  const joy = { id: null, sx: 0, sy: 0, x: 0, y: 0 };
  const look = { id: null, lastX: 0, lastY: 0 };
  let actionHeld = false, jumpQueued = false;
  const touchLayer = $('touch'), joyEl = $('joy'), knob = $('knob');
  const playing = () => screen === 'game' && !craftOpen;

  touchLayer.addEventListener('pointerdown', (e) => {
    if (!playing()) return;
    if (e.pointerType !== 'mouse' && e.clientX < window.innerWidth * 0.5 && joy.id === null) {
      joy.id = e.pointerId; joy.sx = e.clientX; joy.sy = e.clientY; joy.x = 0; joy.y = 0;
      joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
      knob.style.transform = '';
      joyEl.hidden = false;
    } else if (look.id === null) {
      look.id = e.pointerId; look.lastX = e.clientX; look.lastY = e.clientY;
    }
    try { touchLayer.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
  });
  touchLayer.addEventListener('pointermove', (e) => {
    if (e.pointerId === joy.id) {
      let dx = e.clientX - joy.sx, dy = e.clientY - joy.sy;
      const d = Math.hypot(dx, dy), max = 50;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      joy.x = dx / max; joy.y = dy / max;
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    } else if (e.pointerId === look.id) {
      const k = 0.007 * settings.sens;
      camYaw -= (e.clientX - look.lastX) * k;
      camPitch = clamp(camPitch + (e.clientY - look.lastY) * k * (settings.invert ? -1 : 1), CFG.pitchMin, CFG.pitchMax);
      look.lastX = e.clientX; look.lastY = e.clientY;
    }
  });
  function endPointer(e) {
    if (e.pointerId === joy.id) { joy.id = null; joy.x = 0; joy.y = 0; joyEl.hidden = true; }
    if (e.pointerId === look.id) look.id = null;
  }
  function releaseAllInput() {
    joy.id = null; joy.x = 0; joy.y = 0; joyEl.hidden = true;
    look.id = null;
    actionHeld = false;
    jumpQueued = false;
    for (const k in keys) keys[k] = false;
  }
  touchLayer.addEventListener('pointerup', endPointer);
  touchLayer.addEventListener('pointercancel', endPointer);
  touchLayer.addEventListener('wheel', (e) => {
    settings.dist = clamp(settings.dist + Math.sign(e.deltaY), 6, 24);
    writeJson(KEYS.settings, settings);
  }, { passive: true });
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'Escape') {
      if (craftOpen) toggleCraft(false);
      else if (screen === 'game') showScreen('pause');
      else if (screen === 'pause') showScreen('game');
      return;
    }
    if (!playing() && !(craftOpen && e.code === 'KeyC')) return;
    if (e.code === 'KeyE') actionHeld = true;
    if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
    if (e.code === 'KeyF') eat();
    if (e.code === 'KeyC') toggleCraft();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'KeyE') actionHeld = false;
  });
  window.addEventListener('blur', releaseAllInput);

  const btnAction = $('btnAction');
  btnAction.addEventListener('pointerdown', (e) => { e.preventDefault(); if (playing()) actionHeld = true; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btnAction.addEventListener(ev, () => { actionHeld = false; });
  btnAction.addEventListener('keydown', (e) => { if (e.code === 'Enter') actionHeld = true; });
  btnAction.addEventListener('keyup', (e) => { if (e.code === 'Enter') actionHeld = false; });
  $('btnJump').addEventListener('pointerdown', (e) => { e.preventDefault(); if (playing()) jumpQueued = true; });
  $('btnEat').addEventListener('click', () => eat());
  $('btnCraft').addEventListener('click', () => toggleCraft());
  $('craftClose').addEventListener('click', () => toggleCraft(false));
  $('btnPause').addEventListener('click', () => showScreen('pause'));

  // ==================================================================
  // Столкновения и высота земли
  // ==================================================================
  const CAVE = { n: 56, cell: 2.6, y: -400 };
  const SWIM_DEPTH = 1.05;

  function groundY(x, z) { return inCave ? CAVE.y : getHeight(x, z); }

  function pushFromCircle(e, ox, oz, or) {
    const dx = e.x - ox, dz = e.z - oz, d = Math.hypot(dx, dz), min = e.r + or;
    if (d >= min) return false;
    if (d < 1e-4) { e.x += min; return true; }
    e.x = ox + dx / d * min; e.z = oz + dz / d * min;
    return true;
  }
  // Повёрнутый прямоугольник (стена или клетка пещеры): переводим точку в его систему, выталкиваем, возвращаем обратно.
  function pushFromBox(e, w) {
    const c = Math.cos(w.rot), s = Math.sin(w.rot);
    const dx = e.x - w.x, dz = e.z - w.z;
    let lx = dx * c - dz * s, lz = dx * s + dz * c;
    const cx = clamp(lx, -w.hw, w.hw), cz = clamp(lz, -w.hd, w.hd);
    const ox = lx - cx, oz = lz - cz, d = Math.hypot(ox, oz);
    if (d >= e.r) return false;
    if (d < 1e-4) {
      if (w.hw - Math.abs(lx) < w.hd - Math.abs(lz)) lx = Math.sign(lx || 1) * (w.hw + e.r);
      else lz = Math.sign(lz || 1) * (w.hd + e.r);
    } else {
      lx = cx + ox / d * e.r; lz = cz + oz / d * e.r;
    }
    e.x = w.x + lx * c + lz * s;
    e.z = w.z - lx * s + lz * c;
    return true;
  }
  const cellBox = { x: 0, z: 0, rot: 0, hw: CAVE.cell / 2, hd: CAVE.cell / 2 };
  function caveSolid(c, r) { return c < 0 || r < 0 || c >= CAVE.n || r >= CAVE.n || cave.grid[r * CAVE.n + c] === 1; }
  const caveCellOf = (v) => Math.floor(v / CAVE.cell + CAVE.n / 2);
  const caveCenter = (i) => (i - CAVE.n / 2 + 0.5) * CAVE.cell;

  function collide(e) {
    let touchedWall = null;
    if (inCave) {
      const c0 = caveCellOf(e.x - e.r) , c1 = caveCellOf(e.x + e.r), r0 = caveCellOf(e.z - e.r), r1 = caveCellOf(e.z + e.r);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        if (!caveSolid(c, r)) continue;
        cellBox.x = caveCenter(c); cellBox.z = caveCenter(r);
        pushFromBox(e, cellBox);
      }
      for (const res of cave.resources) if (res.active) pushFromCircle(e, res.x, res.z, res.r);
      return null;
    }
    gridEach(e.x, e.z, 4, (o) => { if (o.isStatic || o.active) pushFromCircle(e, o.x, o.z, o.r); });
    for (const c of campfires) pushFromCircle(e, c.x, c.z, 0.6);
    for (const w of walls) if (pushFromBox(e, w)) touchedWall = w;
    const lim = HALF - 6;
    e.x = clamp(e.x, -lim, lim);
    e.z = clamp(e.z, -lim, lim);
    return touchedWall;
  }

  // Движение с учётом склонов: слишком крутой подъём не пускает
  function tryMove(e, dx, dz, footY) {
    const step = Math.hypot(dx, dz);
    if (step < 1e-6) return;
    if (inCave) { e.x += dx; e.z += dz; return; }
    const maxRise = step * 1.25 + 0.03;
    const canGo = (x, z) => getHeight(x, z) - footY <= maxRise || getHeight(x, z) < WATER - SWIM_DEPTH + 0.2;
    if (canGo(e.x + dx, e.z + dz)) { e.x += dx; e.z += dz; return; }
    if (canGo(e.x + dx, e.z)) { e.x += dx; return; }
    if (canGo(e.x, e.z + dz)) { e.z += dz; }
  }

  // ==================================================================
  // Ресурсы: показать или спрятать
  // ==================================================================
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmpM = new THREE.Matrix4(), tmpM2 = new THREE.Matrix4();
  function setResVisible(r, vis) {
    r.active = vis;
    if (r.g) { r.g.visible = vis; return; }
    for (const p of r.parts) { p.mesh.setMatrixAt(p.i, vis ? p.m : ZERO); p.mesh.instanceMatrix.needsUpdate = true; }
  }
  function setResScale(r, k) {
    if (r.g) { r.g.scale.setScalar(k); return; }
    tmpM.makeTranslation(r.x, r.y, r.z).multiply(tmpM2.makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(-r.x, -r.y, -r.z));
    for (const p of r.parts) { p.mesh.setMatrixAt(p.i, tmpM2.multiplyMatrices(tmpM, p.m)); p.mesh.instanceMatrix.needsUpdate = true; }
  }
  const shaking = new Set();

  // ==================================================================
  // Действия игрока
  // ==================================================================
  function faceTo(x, z) { P.face = Math.atan2(x - P.x, z - P.z); }
  function forward() { return { x: Math.sin(P.face), z: Math.cos(P.face) }; }
  const activeZombies = () => zombies.filter((z) => !z.dead && !z.burn && !!z.cave === !!inCave);

  function nearestZombie(maxDist) {
    let found = null, bestD = maxDist;
    for (const z of zombies) {
      if (z.dead || z.burn || !!z.cave !== !!inCave) continue;
      const d = Math.hypot(z.x - P.x, z.z - P.z);
      if (d < bestD) { found = z; bestD = d; }
    }
    return found;
  }
  function nearestResource() {
    let found = null, bestD = Infinity;
    const check = (r) => {
      if (r.isStatic || !r.active) return;
      const d = Math.hypot(r.x - P.x, r.z - P.z) - r.r - P.r;
      if (d < CFG.reach && d < bestD) { found = r; bestD = d; }
    };
    if (inCave) cave.resources.forEach(check);
    else gridEach(P.x, P.z, 5, check);
    return found;
  }
  function nearWater() {
    if (inCave) return false;
    if (P.swimming) return true;
    for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (getHeight(P.x + dx, P.z + dz) < WATER - 0.15) return true;
    return false;
  }
  function nearCaveEntrance() {
    if (inCave) return null;
    return caveEntrances.find((e) => Math.hypot(e.ix - P.x, e.iz - P.z) < 3.2) || null;
  }
  const nearCaveExit = () => inCave && Math.hypot(cave.exit.x - P.x, cave.exit.z - P.z) < 3.4;

  function context() {
    const z = nearestZombie(CFG.attackReach);
    if (z) return { kind: 'attack', target: z, label: 'Удар' };
    if (nearCaveExit()) return { kind: 'exit', label: 'Выйти' };
    const ent = nearCaveEntrance();
    if (ent) return { kind: 'enter', target: ent, label: 'В пещеру' };
    const r = nearestResource();
    if (r) return { kind: 'gather', target: r, label: r.cfg.action };
    if (nearWater()) return { kind: 'drink', label: 'Пить' };
    return { kind: 'swing', label: 'Удар', idle: true };
  }

  function doAction() {
    const ctx = context();
    P.swingT = 0.3;
    if (ctx.kind === 'attack') {
      const z = ctx.target, weapon = CFG.weapons[P.weapon];
      faceTo(z.x, z.z);
      hitZombie(z, weapon.dmg);
      P.actCd = weapon.cd;
    } else if (ctx.kind === 'gather') {
      const r = ctx.target;
      faceTo(r.x, r.z);
      r.left--;
      r.hitT = 0.18;
      shaking.add(r);
      P.inv[r.cfg.item]++;
      Sound.play(r.cfg.sound);
      toast('+1 ' + ITEMS[r.cfg.item], 'item');
      if (r.left <= 0) { setResVisible(r, false); shaking.delete(r); r.respawnAt = W.clock + r.cfg.respawn; }
      P.actCd = CFG.gatherCd;
    } else if (ctx.kind === 'drink') {
      P.swingT = 0;
      if (P.thirst >= CFG.maxThirst - 1) toast('Ты не хочешь пить');
      else { P.thirst = Math.min(CFG.maxThirst, P.thirst + CFG.drink); Sound.play('drink'); toast('Ты попил воды', 'item'); }
      P.actCd = 0.8;
    } else if (ctx.kind === 'enter') {
      P.swingT = 0;
      enterCave(ctx.target);
      P.actCd = 1;
    } else if (ctx.kind === 'exit') {
      P.swingT = 0;
      leaveCave(false);
      P.actCd = 1;
    } else {
      Sound.play('swing');
      P.actCd = CFG.weapons[P.weapon].cd;
    }
  }

  function eat() {
    if (!playing() || P.dead) return;
    if (P.inv.berry < 1) { toast('Нет ягод. Ищи кусты с красными ягодами', 'warn'); return; }
    if (P.hunger >= CFG.maxHunger - 1) { toast('Ты не голоден'); return; }
    P.inv.berry--;
    P.hunger = Math.min(CFG.maxHunger, P.hunger + CFG.berryFood);
    Sound.play('eat');
    toast('Ням! +' + CFG.berryFood + ' к сытости', 'item');
  }

  function hurtPlayer(dmg, from) {
    if (P.dead) return;
    P.hp -= dmg;
    vignette = 0.8;
    shake = 0.25;
    Sound.play('hurt');
    if (from) {
      const dx = P.x - from.x, dz = P.z - from.z, d = Math.hypot(dx, dz) || 1;
      tryMove(P, dx / d * 0.5, dz / d * 0.5, P.y);
    }
    if (P.hp <= 0) die();
  }

  function die() {
    P.hp = 0;
    P.dead = true;
    P.deadT = 0;
    releaseAllInput();
    toggleCraft(false);
    writeJson(KEYS.save, null);
    Sound.play('death');
    $('deadDays').textContent = P.nights;
    $('deadKills').textContent = P.kills;
    $('deadBest').textContent = stats.best;
    setTimeout(() => { if (P.dead && screen === 'game') showScreen('dead'); }, 1400);
  }

  // ==================================================================
  // Крафт
  // ==================================================================
  const canAfford = (cost) => Object.keys(cost).every((k) => P.inv[k] >= cost[k]);
  const owned = (id) => (id === 'sword' && (P.weapon === 'sword' || P.weapon === 'iron')) || (id === 'iron' && P.weapon === 'iron') || (id === 'lantern' && P.lantern);
  const recipeBox = $('recipes');
  const recipeEls = RECIPES.map((rec) => {
    const el = document.createElement('div');
    el.className = 'recipe';
    const costHtml = Object.keys(rec.cost).map((k) =>
      '<span data-item="' + k + '"><i class="ic ' + k + '"></i>' + ITEMS[k] + ' ×' + rec.cost[k] + '</span>').join('');
    el.innerHTML = '<h3>' + rec.name + '</h3><div class="cost">' + costHtml + '</div><p>' + rec.desc + '</p>' +
      '<button type="button" id="craft-' + rec.id + '">Создать</button>';
    el.querySelector('button').addEventListener('click', () => craft(rec));
    recipeBox.appendChild(el);
    return { rec, btn: el.querySelector('button'), costs: el.querySelectorAll('[data-item]') };
  });

  function toggleCraft(force) {
    craftOpen = typeof force === 'boolean' ? force : !craftOpen;
    if (screen !== 'game' || P.dead) craftOpen = false;
    $('craft').hidden = !craftOpen;
    releaseAllInput();
    updateCraftSheet();
  }
  function updateCraftSheet() {
    if (!craftOpen) return;
    for (const r of recipeEls) {
      const has = owned(r.rec.id);
      r.btn.disabled = has || !canAfford(r.rec.cost);
      r.btn.textContent = has ? 'Есть' : 'Создать';
      r.costs.forEach((s) => s.classList.toggle('miss', P.inv[s.dataset.item] < r.rec.cost[s.dataset.item]));
    }
  }

  function craft(rec) {
    if (P.dead) return;
    if (owned(rec.id)) { toast('У тебя это уже есть', 'warn'); return; }
    if ((rec.id === 'campfire' || rec.id === 'wall') && inCave) { toast('В пещере строить нельзя', 'warn'); return; }
    if (!canAfford(rec.cost)) { toast('Не хватает ресурсов', 'warn'); return; }
    for (const k of Object.keys(rec.cost)) P.inv[k] -= rec.cost[k];
    const f = forward();
    if (rec.id === 'sword') P.weapon = 'sword';
    else if (rec.id === 'iron') P.weapon = 'iron';
    else if (rec.id === 'lantern') P.lantern = true;
    else if (rec.id === 'campfire') addCampfire(P.x + f.x * 1.9, P.z + f.z * 1.9);
    else if (rec.id === 'wall') addWall(P.x + f.x * 2.1, P.z + f.z * 2.1, P.face);
    refreshEquipment();
    Sound.play('craft');
    toast('Создано: ' + rec.name, 'good');
    toggleCraft(false);
  }

  const WALL_COLOR = new THREE.Color(0x9a6b40), WALL_BROKEN = new THREE.Color(0x3a2a1c);
  function addWall(x, z, rot) {
    const mat = lam(0x9a6b40);
    const g = new THREE.Group();
    const y = getHeight(x, z);
    g.position.set(x, y + 1.1, z);
    g.rotation.y = rot;
    const body = new THREE.Mesh(GEO.box, mat); body.scale.set(4, 2.6, 0.5); body.castShadow = true; body.receiveShadow = true; g.add(body);
    for (let i = -1; i <= 1; i++) {
      const plank = new THREE.Mesh(GEO.box, MAT.log); plank.scale.set(4.05, 0.08, 0.52); plank.position.y = i * 0.8; g.add(plank);
    }
    surface.add(g);
    walls.push({ x, z, rot, hw: 2, hd: 0.25, hp: CFG.wall.hp, mesh: g, mat, shake: 0 });
  }
  function damageWall(w, dmg, silent) {
    w.hp -= dmg;
    if (!silent) { w.shake = 0.2; Sound.play('chop'); }
    w.mat.color.copy(WALL_COLOR).lerp(WALL_BROKEN, 1 - Math.max(0, w.hp) / CFG.wall.hp);
    if (w.hp <= 0) {
      surface.remove(w.mesh);
      walls.splice(walls.indexOf(w), 1);
      if (!silent) toast('Зомби сломали стену!', 'bad');
    }
  }

  function addCampfire(x, z) {
    const g = new THREE.Group();
    g.position.set(x, getHeight(x, z), z);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const s = new THREE.Mesh(GEO.stone, MAT.rockStatic);
      s.position.set(Math.cos(a) * 0.62, 0.12, Math.sin(a) * 0.62);
      s.castShadow = true;
      g.add(s);
    }
    for (const a of [0.6, -0.6, 2.2]) {
      const log = new THREE.Mesh(GEO.box, MAT.log);
      log.scale.set(0.16, 0.16, 1.0); log.position.y = 0.16; log.rotation.y = a;
      g.add(log);
    }
    const flame = new THREE.Mesh(GEO.flame, MAT.flame); flame.position.y = 0.15; g.add(flame);
    const core = new THREE.Mesh(GEO.flameCore, MAT.flameCore); core.position.y = 0.15; g.add(core);
    surface.add(g);
    const slot = firePool.find((s) => !s.used) || null;
    if (slot) { slot.used = true; slot.light.position.set(x, g.position.y + 1.4, z); }
    campfires.push({ x, z, g, flame, core, slot, life: CFG.campfire.life, seed: Math.random() * 10 });
  }
  function removeCampfire(c, keepInList) {
    surface.remove(c.g);
    if (c.slot) { c.slot.used = false; c.slot.light.intensity = 0; }
    if (!keepInList) campfires.splice(campfires.indexOf(c), 1);
  }

  // ==================================================================
  // Пещеры: лабиринт из клеток, железо, кристаллы, пещерные зомби
  // ==================================================================
  const caveFloorMat = new THREE.MeshLambertMaterial({ color: 0x7a7482, map: detailTexture(64, 0.6, 1.0, 21) });
  caveFloorMat.map.repeat.set(30, 30);
  const caveWallMat = lam(0xffffff);
  const crystalMats = [new THREE.MeshBasicMaterial({ color: 0x5ef0ff }), new THREE.MeshBasicMaterial({ color: 0xb57bff })];
  const oreMat = new THREE.MeshBasicMaterial({ color: 0xe0892f });
  const exitMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });

  function generateCaveGrid(rng) {
    const n = CAVE.n;
    for (let attempt = 0; attempt < 8; attempt++) {
      let g = new Uint8Array(n * n);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        g[r * n + c] = r < 1 || c < 1 || r >= n - 1 || c >= n - 1 || rng() < 0.45 ? 1 : 0;
      }
      for (let it = 0; it < 5; it++) {
        const ng = new Uint8Array(n * n);
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
          let walls = 0;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            walls += rr < 0 || cc < 0 || rr >= n || cc >= n ? 1 : g[rr * n + cc];
          }
          ng[r * n + c] = r < 1 || c < 1 || r >= n - 1 || c >= n - 1 ? 1 : walls >= 5 ? 1 : 0;
        }
        g = ng;
      }
      // Входная площадка у левого края
      const er = n >> 1, ec = 3;
      for (let r = er - 3; r <= er + 3; r++) for (let c = 1; c <= ec + 4; c++) if (Math.hypot(r - er, c - ec) < 3.4 || (Math.abs(r - er) <= 1)) g[r * n + c] = 0;
      for (let c = ec; c < n / 2; c++) if (g[er * n + c] === 0) break; else g[er * n + c] = 0, g[(er + 1) * n + c] = 0;
      // Оставляем только пещеру, связанную со входом
      const seen = new Uint8Array(n * n), queue = [er * n + ec];
      seen[er * n + ec] = 1;
      let count = 0;
      while (queue.length) {
        const i = queue.pop(); count++;
        const r = (i / n) | 0, c = i % n;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr, cc = c + dc, j = rr * n + cc;
          if (rr > 0 && cc > 0 && rr < n - 1 && cc < n - 1 && !seen[j] && g[j] === 0) { seen[j] = 1; queue.push(j); }
        }
      }
      if (count < n * n * 0.3) continue;
      for (let i = 0; i < g.length; i++) if (!seen[i]) g[i] = 1;
      return { grid: g, entry: { r: er, c: ec } };
    }
    return null;
  }

  function buildCave(index) {
    while (caveGroup.children.length) {
      const ch = caveGroup.children[0];
      caveGroup.remove(ch);
      if (ch.userData.ownGeometry) ch.geometry.dispose();
    }
    const rng = mulberry32(9000 + index * 101);
    const gen = generateCaveGrid(rng);
    const n = CAVE.n, C = CAVE.cell, Y = CAVE.y;
    const data = { index, grid: gen.grid, resources: [], exit: { x: caveCenter(gen.entry.c), z: caveCenter(gen.entry.r) }, flow: null, flowCell: -1, map: null };

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(n * C, n * C), caveFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = Y;
    floor.receiveShadow = true;
    floor.userData.ownGeometry = true;
    caveGroup.add(floor);

    const isWall = (r, c) => c < 0 || r < 0 || c >= n || r >= n || gen.grid[r * n + c] === 1;
    const openNear = (r, c) => { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (!isWall(r + dr, c + dc)) return true; return false; };
    const wallBatch = new Batch(GEO.rock, caveWallMat, { colored: true, cast: false, receive: true });
    const spikeBatch = new Batch(GEO.cone, caveWallMat, { colored: true });
    const shade = (hex) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, (rng() - 0.5) * 0.12); return c; };
    const edgeFloors = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const x = caveCenter(c), z = caveCenter(r);
      if (isWall(r, c)) {
        if (!openNear(r, c)) continue;
        const h = 2.6 + rng() * 2.2;
        wallBatch.add(matrixOf(x, Y + h / 2 - 0.3, z, C * 0.85, h / 1.6, C * 0.85, rng() * TAU, rng() * 0.3, rng() * 0.3), shade(0x8a8494));
      } else {
        let adj = 0;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) adj += isWall(r + dr, c + dc) ? 1 : 0;
        if (adj > 0 && Math.hypot(c - gen.entry.c, r - gen.entry.r) > 5) edgeFloors.push({ r, c, x, z });
        if (adj > 0 && rng() < 0.12) spikeBatch.add(matrixOf(x + (rng() - 0.5) * 1.4, Y, z + (rng() - 0.5) * 1.4, 0.25, 0.8 + rng() * 1.2, 0.25, rng() * 3), shade(0x6f6878));
      }
    }
    wallBatch.build(caveGroup);
    if (spikeBatch.items.length) spikeBatch.build(caveGroup);

    // Железо и кристаллы у стен
    for (let i = edgeFloors.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [edgeFloors[i], edgeFloors[j]] = [edgeFloors[j], edgeFloors[i]]; }
    const picks = edgeFloors.slice(0, 30);
    picks.forEach((p, i) => {
      const type = i < 17 ? 'iron' : 'crystal';
      const g = new THREE.Group();
      g.position.set(p.x, Y, p.z);
      if (type === 'iron') {
        const rock = new THREE.Mesh(GEO.rock, MAT.rockStatic);
        rock.scale.set(0.9, 0.7, 0.85); rock.position.y = 0.35; rock.rotation.set(rng(), rng() * 3, 0);
        g.add(rock);
        for (let k = 0; k < 6; k++) {
          const ore = new THREE.Mesh(GEO.box, oreMat);
          const a = rng() * TAU;
          ore.scale.setScalar(0.14 + rng() * 0.08);
          ore.position.set(Math.cos(a) * 0.62, 0.25 + rng() * 0.45, Math.sin(a) * 0.62);
          ore.rotation.set(rng(), rng(), rng());
          g.add(ore);
        }
      } else {
        const mat = crystalMats[Math.floor(rng() * 2)];
        for (let k = 0; k < 5; k++) {
          const cr = new THREE.Mesh(GEO.petal, mat);
          cr.scale.set(1.6, 4 + rng() * 4, 1.6);
          cr.position.set((rng() - 0.5) * 0.7, -1.6, (rng() - 0.5) * 0.7);
          cr.rotation.set((rng() - 0.5) * 0.7, rng() * 3, (rng() - 0.5) * 0.7);
          g.add(cr);
        }
      }
      caveGroup.add(g);
      data.resources.push({ type, cfg: CFG.res[type], x: p.x, z: p.z, y: Y, r: 0.7, left: CFG.res[type].amount, active: true, g, hitT: 0 });
    });

    // Столб света у выхода
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 9, 14, 1, true), exitMat);
    beam.position.set(data.exit.x, Y + 4.5, data.exit.z);
    beam.userData.ownGeometry = true;
    caveGroup.add(beam);

    // Карта пещеры для мини-карты
    const mc = document.createElement('canvas'); mc.width = mc.height = n;
    const mg = mc.getContext('2d'), img = mg.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const v = gen.grid[i] ? [30, 28, 36] : [118, 112, 128];
      img.data[i * 4] = v[0]; img.data[i * 4 + 1] = v[1]; img.data[i * 4 + 2] = v[2]; img.data[i * 4 + 3] = 255;
    }
    mg.putImageData(img, 0, 0);
    data.map = mc;
    return { data, edgeFloors: edgeFloors.slice(30), entry: gen.entry };
  }

  function fadeTransition(fn) {
    const f = $('fade');
    f.classList.add('on');
    setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 60); }, 330);
  }

  function enterCave(entrance) {
    fadeTransition(() => {
      const built = buildCave(entrance.index);
      cave = built.data;
      inCave = entrance.index + 1;
      caveReturn = { x: entrance.ix, z: entrance.iz };
      surface.visible = false;
      caveGroup.visible = true;
      P.x = caveCenter(built.entry.c + 4); P.z = caveCenter(built.entry.r);
      P.y = CAVE.y; P.vy = 0; P.swimming = false;
      P.face = Math.PI / 2;
      camYaw = -Math.PI / 2;
      // Пещерные зомби в дальних частях
      const far = built.edgeFloors.filter((p) => Math.hypot(p.x - P.x, p.z - P.z) > 30);
      const count = Math.min(far.length, 4 + entrance.index);
      for (let i = 0; i < count; i++) {
        const p = far[Math.floor((i / count) * far.length)];
        spawnZombieAt(p.x, p.z, true);
      }
      Sound.setCave(true);
      Sound.play('cave');
      updateCamera(0, true, false);
      toast('Пещера. Ищи железо и кристаллы', 'good');
      if (!P.lantern) toast('Здесь темно. Фонарь делается из кристаллов', 'warn');
    });
  }

  function leaveCave(silent) {
    const go = () => {
      for (let i = zombies.length - 1; i >= 0; i--) if (zombies[i].cave) { scene.remove(zombies[i].h.g, zombies[i].bar.g); zombies.splice(i, 1); }
      inCave = 0;
      surface.visible = true;
      caveGroup.visible = false;
      if (caveReturn) { P.x = caveReturn.x; P.z = caveReturn.z; }
      P.y = getHeight(P.x, P.z); P.vy = 0;
      cave = null;
      Sound.setCave(false);
      updateGrass(true);
      if (!silent) { updateCamera(0, true, false); toast(W.night ? 'Снаружи ночь. Осторожно!' : 'Ты выбрался наружу', W.night ? 'bad' : 'good'); }
    };
    if (silent) go(); else fadeTransition(go);
  }

  // Поиск пути в пещере: карта расстояний от клетки игрока
  function updateCaveFlow() {
    const n = CAVE.n, pc = caveCellOf(P.x), pr = caveCellOf(P.z), start = pr * n + pc;
    if (cave.flowCell === start) return;
    cave.flowCell = start;
    const dist = cave.flow || (cave.flow = new Int16Array(n * n));
    dist.fill(-1);
    if (caveSolid(pc, pr)) return;
    const queue = new Int32Array(n * n);
    let head = 0, tail = 0;
    queue[tail++] = start; dist[start] = 0;
    while (head < tail) {
      const i = queue[head++], r = (i / n) | 0, c = i % n;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        if (caveSolid(cc, rr)) continue;
        const j = rr * n + cc;
        if (dist[j] === -1) { dist[j] = dist[i] + 1; queue[tail++] = j; }
      }
    }
  }

  // ==================================================================
  // Зомби
  // ==================================================================
  function spawnZombieAt(x, z, inCaveZombie) {
    const h = makeHuman(inCaveZombie ? CAVE_ZOMBIE_MATS : ZOMBIE_MATS);
    for (const ex of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(GEO.box, inCaveZombie ? MAT.caveEye : MAT.eye);
      eye.scale.set(0.09, 0.07, 0.02);
      eye.position.set(ex, 0.04, 0.235);
      h.head.add(eye);
    }
    h.g.position.set(x, groundY(x, z), z);
    scene.add(h.g);
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(GEO.hpBg, MAT.hpBg);
    const fill = new THREE.Mesh(GEO.hpFill, MAT.hpFill);
    fill.position.set(-0.43, 0, 0.002);
    bar.add(bg, fill);
    bar.visible = false;
    scene.add(bar);
    const Z = CFG.zombie, day = W.day;
    const hp = inCaveZombie ? CFG.caveZombie.hp + Z.hpDay * (day - 1) : Z.hp + Z.hpDay * (day - 1);
    zombies.push({
      h, x, z, y: h.g.position.y, r: 0.4, face: Math.random() * TAU, hp, maxHp: hp, cave: !!inCaveZombie,
      speed: (inCaveZombie ? CFG.caveZombie.speed : Math.min(Z.maxSpeed, Z.speed + Z.speedDay * (day - 1))) * rand(0.9, 1.1),
      dmg: inCaveZombie ? CFG.caveZombie.dmg : Z.dmg,
      atkCd: 0, walk: rand(0, TAU), dead: false, deadT: 0, burn: false, burnT: 0, hitT: 0, kx: 0, kz: 0,
      groanT: rand(2, 8), bar: { g: bar, fill },
    });
  }

  function spawnSurfaceZombie() {
    const Z = CFG.zombie, lim = HALF - 10;
    for (let tries = 0; tries < 16; tries++) {
      const a = rand(0, TAU), d = rand(Z.minD, Z.maxD);
      const x = clamp(P.x + Math.cos(a) * d, -lim, lim), z = clamp(P.z + Math.sin(a) * d, -lim, lim);
      const h = getHeight(x, z);
      if (h < 0.5 || slopeAt(x, z) > 0.8) continue;
      if (Math.hypot(x - P.x, z - P.z) < Z.minD * 0.6) continue;
      spawnZombieAt(x, z, false);
      return;
    }
  }

  function hitZombie(z, dmg) {
    z.hp -= dmg;
    z.hitT = 0.14;
    Sound.play('hit');
    const dx = z.x - P.x, dz = z.z - P.z, d = Math.hypot(dx, dz) || 1;
    z.kx = dx / d * 7; z.kz = dz / d * 7;
    if (z.hp <= 0 && !z.dead) {
      z.dead = true;
      z.bar.g.visible = false;
      P.kills++;
      stats.kills++;
      saveStats();
      Sound.play('zombieDie');
    }
  }

  function burnZombie(z) {
    if (z.dead || z.burn || z.cave) return;
    z.burn = true;
    z.burnT = -rand(0, 1.5);
    z.bar.g.visible = false;
    const f = new THREE.Mesh(GEO.flame, MAT.flame);
    f.scale.set(1.3, 1.6, 1.3);
    f.position.y = 1.0;
    f.visible = false;
    z.h.g.add(f);
    z.flameMesh = f;
  }

  function removeZombie(z) {
    scene.remove(z.h.g, z.bar.g);
    zombies.splice(zombies.indexOf(z), 1);
  }

  function updateZombies(dt) {
    const Z = CFG.zombie;
    if (inCave) updateCaveFlow();
    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i];
      const here = !!z.cave === !!inCave;
      z.h.g.visible = here;
      if (!here) { z.bar.g.visible = false; continue; }
      if (z.dead) {
        z.deadT += dt;
        z.h.g.rotation.x = -Math.min(1, z.deadT / 0.4) * Math.PI / 2;
        z.h.g.position.y = z.y + Math.min(1, z.deadT / 0.4) * 0.25;
        if (z.deadT > 1.6) removeZombie(z);
        continue;
      }
      if (z.burn) {
        z.burnT += dt;
        if (z.burnT > 0) {
          z.flameMesh.visible = true;
          z.flameMesh.scale.y = 1.6 + Math.sin(z.burnT * 25) * 0.25;
          z.h.g.scale.setScalar(Math.max(0.01, 1 - Math.max(0, z.burnT - 1) / 0.8));
          if (z.burnT > 1.8) { removeZombie(z); continue; }
        }
      }

      let dx = P.x - z.x, dz = P.z - z.z;
      const d = Math.hypot(dx, dz) || 1;
      z.atkCd -= dt;
      let moving = false, chase = !P.dead && !z.burn;
      // Пещерный зомби идёт по лабиринту к игроку, если тот близко
      if (chase && z.cave) {
        const n = CAVE.n, zc = caveCellOf(z.x), zr = caveCellOf(z.z);
        const myD = cave.flow ? cave.flow[zr * n + zc] : -1;
        if (myD < 0 || myD * CAVE.cell > CFG.caveZombie.aggro) chase = false;
        else if (myD > 1) {
          let best = myD, bx = 0, bz = 0;
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const rr = zr + dr, cc = zc + dc;
            if (caveSolid(cc, rr) || (dr && dc && (caveSolid(zc, rr) || caveSolid(cc, zr)))) continue;
            const v = cave.flow[rr * n + cc];
            if (v >= 0 && v < best) { best = v; bx = caveCenter(cc) - z.x; bz = caveCenter(rr) - z.z; }
          }
          if (best < myD) { dx = bx; dz = bz; }
        }
      }
      if (chase) {
        const dd = Math.hypot(dx, dz) || 1;
        const swim = !z.cave && getHeight(z.x, z.z) < WATER - SWIM_DEPTH;
        if (d > Z.range) {
          const sp = z.speed * (swim ? 0.6 : 1) * dt;
          z.x += dx / dd * sp;
          z.z += dz / dd * sp;
          moving = true;
        } else if (z.atkCd <= 0) {
          z.atkCd = Z.cd;
          hurtPlayer(z.dmg, z);
        }
        z.face = lerpAngle(z.face, Math.atan2(dx, dz), 1 - Math.exp(-dt * 8));
        z.groanT -= dt;
        if (z.groanT <= 0) { z.groanT = rand(4, 10); if (d < 28) Sound.play('groan', 1 - d / 28); }
      }
      z.x += z.kx * dt; z.z += z.kz * dt;
      const decay = Math.exp(-dt * 9);
      z.kx *= decay; z.kz *= decay;

      // Зомби не слипаются друг с другом и не проходят сквозь игрока
      for (const o of zombies) {
        if (o === z || o.dead || !!o.cave !== !!z.cave) continue;
        pushFromCircle(z, o.x, o.z, o.r * 0.9);
      }
      if (!P.dead) pushFromCircle(z, P.x, P.z, P.r);
      const wall = collide(z);
      if (wall && z.atkCd <= 0 && !z.burn && !P.dead) {
        z.atkCd = Z.cd;
        damageWall(wall, z.dmg);
      }

      const g = groundY(z.x, z.z);
      const swimming = !z.cave && g < WATER - SWIM_DEPTH;
      z.y = swimming ? WATER - SWIM_DEPTH : g;
      if (moving) z.walk += dt * z.speed * 2.1;
      z.hitT = Math.max(0, z.hitT - dt);
      const bob = animateHuman(z.h, z.walk, moving ? 1 : 0.15, true, false);
      z.h.g.position.set(z.x, z.y + bob + (z.hitT > 0 ? 0.08 : 0), z.z);
      z.h.g.rotation.y = z.face;
      if (!z.burn) z.h.g.scale.setScalar(z.hitT > 0 ? 1.08 : 1);

      const bar = z.bar;
      bar.g.visible = z.hp < z.maxHp;
      bar.g.position.set(z.x, z.y + 2.45, z.z);
      bar.g.quaternion.copy(camera.quaternion);
      bar.fill.scale.x = Math.max(0.001, z.hp / z.maxHp);
    }
  }

  // ==================================================================
  // День и ночь
  // ==================================================================
  function onNight() {
    const Z = CFG.zombie;
    W.toSpawn = Math.min(Z.base + Z.perDay * (W.day - 1), Z.max);
    W.spawnT = 0;
    Sound.play('night');
    toast('Ночь ' + W.day + '. Зомби выходят на охоту: ' + W.toSpawn, 'bad');
  }
  function onDawn() {
    W.toSpawn = 0;
    for (const z of zombies) burnZombie(z);
    Sound.play('dawn');
    if (!P.dead) {
      P.nights++;
      if (P.nights > stats.best) { stats.best = P.nights; saveStats(); toast('Новый рекорд: ' + stats.best + '!', 'good'); }
      else toast('Рассвет! Ты пережил ночей: ' + P.nights, 'good');
    }
  }
  function updateClock(dt) {
    W.clock += dt;
    W.t += dt;
    const dur = W.night ? CFG.nightLen : CFG.dayLen;
    if (!W.night && !W.warned && dur - W.t < 15) { W.warned = true; toast('Скоро стемнеет. Готовь меч и костёр!', 'warn'); }
    if (W.t >= dur) {
      W.t -= dur;
      if (W.night) { W.night = false; W.day++; W.warned = false; onDawn(); }
      else { W.night = true; onNight(); }
    }
    // Пока игрок в пещере, ночные зомби ждут его снаружи
    if (W.night && W.toSpawn > 0 && !inCave) {
      W.spawnT -= dt;
      if (W.spawnT <= 0) {
        W.spawnT = CFG.zombie.interval;
        W.toSpawn--;
        if (zombies.filter((z) => !z.dead && !z.cave).length < CFG.zombie.max) spawnSurfaceZombie();
      }
    }
  }
  const hourNow = () => (W.night ? 18 : 6) + 12 * W.t / (W.night ? CFG.nightLen : CFG.dayLen);

  const SKY = {
    topDay: new THREE.Color(0x2f7fe0), topDusk: new THREE.Color(0x3a4f86), topNight: new THREE.Color(0x03050f),
    horDay: new THREE.Color(0xa8d6f5), horDusk: new THREE.Color(0xf0a06a), horNight: new THREE.Color(0x0c1229),
    sun: new THREE.Color(0xfff0d6), moon: new THREE.Color(0x7d8fc7),
    cloudDay: new THREE.Color(0xffffff), cloudDusk: new THREE.Color(0xf5b48c), cloudNight: new THREE.Color(0x262c42),
  };
  const sunDir = new THREE.Vector3();
  let nightK = 0;
  function blend3(out, night, dusk, day, dl) {
    if (dl < 0.35) return out.copy(night).lerp(dusk, dl / 0.35);
    return out.copy(dusk).lerp(day, (dl - 0.35) / 0.65);
  }
  function updateLighting(hourOverride) {
    const showSky = !inCave;
    sky.visible = sunDisk.visible = moonDisk.visible = stars.visible = clouds.visible = showSky;
    if (inCave) {
      scene.background.setRGB(0.01, 0.01, 0.015);
      scene.fog.near = 6; scene.fog.far = P.lantern ? 55 : 34;
      hemi.intensity = P.lantern ? 0.62 : 0.42; hemi.color.setHex(0x9aa6d8); hemi.groundColor.setHex(0x2a2633);
      sun.intensity = 0;
      playerLight.intensity = P.lantern ? 2.6 : 1.3;
      playerLight.distance = P.lantern ? 26 : 13;
      playerLight.color.setHex(P.lantern ? 0xbff6ff : 0xffd2a0);
      playerLight.position.set(P.x, P.y + 2.6, P.z);
      nightK = 1;
      return;
    }
    const h = hourOverride !== undefined ? hourOverride : hourNow();
    const dl = clamp(Math.sin(((h - 6) / 12) * Math.PI) * 1.7 + 0.08, 0, 1);
    nightK = 1 - dl;
    blend3(sky.material.uniforms.uTop.value, SKY.topNight, SKY.topDusk, SKY.topDay, dl);
    blend3(sky.material.uniforms.uHorizon.value, SKY.horNight, SKY.horDusk, SKY.horDay, dl);
    scene.background.copy(sky.material.uniforms.uHorizon.value);
    blend3(MAT.cloud.color, SKY.cloudNight, SKY.cloudDusk, SKY.cloudDay, dl);
    scene.fog.near = lerp(14, 70, dl);
    scene.fog.far = lerp(70, 280, dl);
    hemi.color.setHex(0xcfe8ff); hemi.groundColor.setHex(0x4a5a2a);
    hemi.intensity = 0.3 + 0.5 * dl;
    sun.intensity = 0.14 + 0.85 * dl;
    sun.color.copy(SKY.moon).lerp(SKY.sun, dl);
    const night = h >= 18 || h < 6;
    const a = ((((night ? h - 18 : h - 6) + 24) % 24) / 12) * Math.PI;
    sunDir.set(Math.cos(a), Math.max(0.12, Math.sin(a)), 0.45).normalize();
    sun.position.set(P.x + sunDir.x * 60, P.y + sunDir.y * 60, P.z + sunDir.z * 60);
    sun.target.position.set(P.x, P.y, P.z);
    sun.target.updateMatrixWorld();
    // Солнце днём, луна ночью — на противоположных сторонах неба
    const realSun = night ? sunDir.clone().multiplyScalar(-1) : sunDir;
    sunDisk.position.copy(camera.position).addScaledVector(realSun, 850);
    sunDisk.lookAt(camera.position);
    sunDisk.visible = !night && realSun.y > -0.05;
    moonDisk.position.copy(camera.position).addScaledVector(night ? sunDir : sunDir.clone().multiplyScalar(-1), 850);
    moonDisk.lookAt(camera.position);
    moonDisk.visible = night;
    stars.material.opacity = clamp(1 - dl * 2.5, 0, 1);
    stars.position.copy(camera.position);
    sky.position.copy(camera.position);
    waterMat.uniforms.uLight.value = 0.35 + 0.65 * dl;
    const torch = P.lantern ? 1.9 : 1.0;
    playerLight.color.setHex(P.lantern ? 0xcff6ff : 0xffd2a0);
    playerLight.intensity = nightK * torch * 1.2;
    playerLight.distance = P.lantern ? 22 : 12;
    playerLight.position.set(P.x, P.y + 2.6, P.z);
  }

  // ==================================================================
  // Игрок: движение, прыжок, плавание, шаги
  // ==================================================================
  function updatePlayer(dt) {
    let ix = joy.x, iy = -joy.y;
    if (keys.KeyD || keys.ArrowRight) ix += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1;
    if (keys.KeyW || keys.ArrowUp) iy += 1;
    if (keys.KeyS || keys.ArrowDown) iy -= 1;
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    const amt = Math.min(1, len);

    const g0 = groundY(P.x, P.z);
    const deep = !inCave && g0 < WATER - SWIM_DEPTH;
    const shallow = !inCave && g0 < WATER - 0.2;
    if (deep && !P.swimming && P.y <= WATER - SWIM_DEPTH + 0.3) { P.swimming = true; Sound.play('land', 'swim'); }
    if (!deep) P.swimming = false;

    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const mx = fx * iy + rx * ix, mz = fz * iy + rz * ix;
    if (amt > 0.08) {
      const speed = CFG.playerSpeed * (P.swimming ? CFG.swimSpeed : shallow ? 0.8 : 1);
      tryMove(P, mx * speed * dt, mz * speed * dt, P.y);
      P.face = lerpAngle(P.face, Math.atan2(mx, mz), 1 - Math.exp(-dt * 12));
      P.walk += dt * speed * 2 * amt * (P.swimming ? 0.6 : 1);
    }
    P.walkAmt = lerp(P.walkAmt, amt > 0.08 ? amt : 0, 1 - Math.exp(-dt * 10));
    for (const z of zombies) if (!z.dead && !z.burn && !!z.cave === !!inCave) pushFromCircle(P, z.x, z.z, z.r);
    collide(P);

    // Высота: земля, прыжок или поверхность воды
    const g = groundY(P.x, P.z);
    if (jumpQueued) {
      jumpQueued = false;
      if (P.grounded && !P.swimming) { P.vy = CFG.jumpSpeed; P.grounded = false; Sound.play('jump'); }
      else if (P.swimming) { P.vy = 3.2; Sound.play('step', 'swim'); }
    }
    if (P.swimming && P.vy <= 0) {
      P.y = lerp(P.y, WATER - SWIM_DEPTH + Math.sin(W.clock * 2.5) * 0.05, 1 - Math.exp(-dt * 6));
      P.vy = 0;
      P.grounded = true;
    } else {
      P.vy -= CFG.gravity * dt;
      P.y += P.vy * dt;
      const floor = P.swimming ? WATER - SWIM_DEPTH : g;
      if (P.y <= floor) {
        if (!P.grounded && P.vy < -4) Sound.play('land', surfaceAt(P.x, P.z));
        P.y = floor; P.vy = 0; P.grounded = true;
      } else if (P.y - floor > 0.25 || P.vy > 0) {
        P.grounded = false;
      } else {
        P.y = floor;
      }
    }

    // Шаги
    const idx = Math.floor(P.walk / Math.PI);
    if (idx !== P.stepIdx) {
      P.stepIdx = idx;
      if (P.walkAmt > 0.25 && (P.grounded || P.swimming)) Sound.play('step', P.swimming ? 'swim' : surfaceAt(P.x, P.z), 0.6 + P.walkAmt * 0.5);
    }

    P.actCd -= dt;
    if (actionHeld && P.actCd <= 0) doAction();
    P.swingT = Math.max(0, P.swingT - dt);
    if (!inCave) updateGrass(false);
  }

  function updateSurvival(dt) {
    P.hunger = Math.max(0, P.hunger - CFG.hungerDecay * dt);
    P.thirst = Math.max(0, P.thirst - CFG.thirstDecay * dt);
    if (P.hunger <= 0 || P.thirst <= 0) {
      if (!P.starveWarned) { P.starveWarned = true; toast(P.hunger <= 0 ? 'Ты умираешь от голода!' : 'Ты умираешь от жажды!', 'bad'); }
      P.hp -= CFG.starveDmg * dt;
      if (P.hp <= 0) die();
      return;
    }
    P.starveWarned = false;
    let heal = 0;
    if (P.hunger >= CFG.regenThreshold && P.thirst >= CFG.regenThreshold) heal += CFG.regen;
    if (!inCave && campfires.some((c) => Math.hypot(c.x - P.x, c.z - P.z) < CFG.campfire.radius)) heal += CFG.campfire.heal;
    P.hp = Math.min(P.maxHp, P.hp + heal * dt);
  }

  let respawnTimer = 0;
  function updateWorldObjects(dt) {
    respawnTimer -= dt;
    if (respawnTimer <= 0) {
      respawnTimer = 1;
      for (const r of resources) {
        if (!r.active && W.clock >= r.respawnAt && Math.hypot(r.x - P.x, r.z - P.z) > r.r + 1.5) { r.left = r.cfg.amount; setResVisible(r, true); }
      }
    }
    for (const r of shaking) {
      r.hitT -= dt;
      if (r.hitT <= 0) { shaking.delete(r); if (r.active) setResScale(r, 1); continue; }
      setResScale(r, 1 - Math.sin((r.hitT / 0.18) * Math.PI) * 0.07);
    }
    for (const w of walls) {
      if (w.shake > 0) { w.shake = Math.max(0, w.shake - dt); w.mesh.position.x = w.x + Math.sin(w.shake * 80) * 0.05; }
    }
    for (let i = campfires.length - 1; i >= 0; i--) {
      const c = campfires[i];
      c.life -= dt;
      if (c.life <= 0) { removeCampfire(c); toast('Костёр догорел', 'warn'); continue; }
      const t = W.clock * 9 + c.seed;
      const fade = Math.min(1, c.life / 20);
      const flick = 1 + Math.sin(t) * 0.1 + Math.sin(t * 2.3) * 0.07;
      c.flame.scale.set(fade, flick * fade, fade);
      c.core.scale.set(fade, (2 - flick) * fade, fade);
      if (c.slot) c.slot.light.intensity = (inCave ? 0 : 1.6) * flick * fade;
    }
  }

  // ==================================================================
  // Камера: крутится по кругу и вверх-вниз вокруг игрока
  // ==================================================================
  const camLook = new THREE.Vector3();
  function updateCamera(dt, snap, orbit) {
    const dist = orbit ? 24 : inCave ? Math.min(settings.dist, 11) : settings.dist;
    const pitch = orbit ? 0.3 : camPitch;
    const lookY = P.y + 1.3;
    const horiz = Math.cos(pitch) * dist;
    const tx = P.x + Math.sin(camYaw) * horiz, tz = P.z + Math.cos(camYaw) * horiz;
    let ty = lookY + Math.sin(pitch) * dist;
    if (!inCave) ty = Math.max(ty, getHeight(tx, tz) + 0.7, WATER + 0.4);
    else ty = Math.max(ty, CAVE.y + 0.5);
    const k = snap ? 1 : 1 - Math.exp(-dt * 14);
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (ty - camera.position.y) * k;
    camera.position.z += (tz - camera.position.z) * k;
    if (shake > 0) {
      camera.position.x += rand(-1, 1) * shake * 0.4;
      camera.position.y += rand(-1, 1) * shake * 0.4;
      shake = Math.max(0, shake - dt);
    }
    camLook.set(P.x, lookY, P.z);
    camera.lookAt(camLook);
  }

  // ==================================================================
  // Мини-карта
  // ==================================================================
  const mm = $('minimap'), mmCtx = mm.getContext('2d');
  let mapBase = null;
  function buildMapBase() {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d'), img = g.createImageData(S, S), col = new THREE.Color();
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const x = -HALF + (px + 0.5) * (WORLD.size / S), z = -HALF + (py + 0.5) * (WORLD.size / S);
      const h = getHeight(x, z), i = (py * S + px) * 4;
      if (h < WATER - 0.1) col.setHex(0x3f8fc0).lerp(new THREE.Color(0x1d5f8a), clamp(-h / 3, 0, 1));
      else {
        terrainColor(x, z, h, slopeAt(x, z), col);
        const shadeK = clamp(1 + (getHeight(x - 2, z - 2) - h) * 0.12, 0.7, 1.25);
        col.multiplyScalar(shadeK);
        if (forestK(x, z) > 0.56 && h > 1.7 && h < 20) col.multiplyScalar(0.82);
      }
      img.data[i] = clamp(col.r * 255, 0, 255); img.data[i + 1] = clamp(col.g * 255, 0, 255); img.data[i + 2] = clamp(col.b * 255, 0, 255); img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    mapBase = c;
  }
  function drawMinimap() {
    const S = mm.width;
    mmCtx.save();
    mmCtx.clearRect(0, 0, S, S);
    mmCtx.beginPath(); mmCtx.arc(S / 2, S / 2, S / 2, 0, TAU); mmCtx.clip();
    mmCtx.fillStyle = '#111'; mmCtx.fillRect(0, 0, S, S);
    const view = 200; // метров в поперечнике
    if (inCave && cave) {
      const n = CAVE.n, span = n * CAVE.cell, src = (view / span) * n;
      const cx = (P.x / span + 0.5) * n, cz = (P.z / span + 0.5) * n;
      mmCtx.imageSmoothingEnabled = false;
      mmCtx.drawImage(cave.map, cx - src / 2, cz - src / 2, src, src, 0, 0, S, S);
      const ex = S / 2 + ((cave.exit.x - P.x) / view) * S, ez = S / 2 + ((cave.exit.z - P.z) / view) * S;
      mmCtx.fillStyle = '#bfe6ff'; mmCtx.beginPath(); mmCtx.arc(ex, ez, 6, 0, TAU); mmCtx.fill();
      for (const r of cave.resources) {
        if (!r.active) continue;
        const rx = S / 2 + ((r.x - P.x) / view) * S, rz = S / 2 + ((r.z - P.z) / view) * S;
        mmCtx.fillStyle = r.type === 'iron' ? '#e0892f' : '#6fe7ff';
        mmCtx.fillRect(rx - 2.5, rz - 2.5, 5, 5);
      }
    } else if (mapBase) {
      const Sb = mapBase.width, src = (view / WORLD.size) * Sb;
      const cx = ((P.x + HALF) / WORLD.size) * Sb, cz = ((P.z + HALF) / WORLD.size) * Sb;
      mmCtx.imageSmoothingEnabled = true;
      mmCtx.drawImage(mapBase, cx - src / 2, cz - src / 2, src, src, 0, 0, S, S);
      for (const e of caveEntrances) {
        const ex = S / 2 + ((e.x - P.x) / view) * S, ez = S / 2 + ((e.z - P.z) / view) * S;
        mmCtx.fillStyle = '#111'; mmCtx.strokeStyle = '#ff8a3d'; mmCtx.lineWidth = 3;
        mmCtx.beginPath(); mmCtx.arc(ex, ez, 7, 0, TAU); mmCtx.fill(); mmCtx.stroke();
      }
      for (const c of campfires) {
        const fx = S / 2 + ((c.x - P.x) / view) * S, fz = S / 2 + ((c.z - P.z) / view) * S;
        mmCtx.fillStyle = '#ffb347'; mmCtx.beginPath(); mmCtx.arc(fx, fz, 4, 0, TAU); mmCtx.fill();
      }
    }
    for (const z of zombies) {
      if (z.dead || !!z.cave !== !!inCave) continue;
      const zx = S / 2 + ((z.x - P.x) / view) * S, zz = S / 2 + ((z.z - P.z) / view) * S;
      mmCtx.fillStyle = '#ff4a3d'; mmCtx.beginPath(); mmCtx.arc(zx, zz, 3.5, 0, TAU); mmCtx.fill();
    }
    // Игрок — стрелка
    mmCtx.translate(S / 2, S / 2);
    mmCtx.rotate(Math.atan2(Math.sin(P.face), Math.cos(P.face)) * -1 + Math.PI);
    mmCtx.fillStyle = '#fff'; mmCtx.strokeStyle = '#000'; mmCtx.lineWidth = 2;
    mmCtx.beginPath(); mmCtx.moveTo(0, -11); mmCtx.lineTo(8, 9); mmCtx.lineTo(0, 4); mmCtx.lineTo(-8, 9); mmCtx.closePath();
    mmCtx.fill(); mmCtx.stroke();
    mmCtx.restore();
  }

  // ==================================================================
  // HUD
  // ==================================================================
  const hud = {
    root: $('hud'), day: $('day'), dayName: $('dayName'), dayPhase: $('dayPhase'), dayTime: $('dayTime'),
    hpFill: $('hpFill'), hpVal: $('hpVal'), foodFill: $('foodFill'), foodVal: $('foodVal'),
    waterFill: $('waterFill'), waterVal: $('waterVal'),
    wood: $('invWood'), stone: $('invStone'), berry: $('invBerry'), iron: $('invIron'), crystal: $('invCrystal'), kills: $('kills'),
    actLabel: $('actLabel'), eatCount: $('eatCount'), craft: $('btnCraft'), vignette: $('vignette'), mapLabel: $('mapLabel'),
  };
  let hudTimer = 0, mapTimer = 0;
  function setText(el, v) { v = String(v); if (el.textContent !== v) el.textContent = v; }
  function updateHud(dt) {
    vignette = Math.max(0, vignette - dt * 1.6);
    const lowHp = screen === 'game' && !P.dead && P.hp < 30 ? 0.25 + Math.sin(W.clock * 5) * 0.1 : 0;
    hud.vignette.style.opacity = Math.max(vignette, lowHp);
    if (screen !== 'game' && screen !== 'dead') return;
    mapTimer -= dt;
    if (mapTimer <= 0) { mapTimer = 0.15; drawMinimap(); }
    hudTimer -= dt;
    if (hudTimer > 0) return;
    hudTimer = 0.1;
    setText(hud.dayName, 'День ' + W.day);
    setText(hud.dayPhase, W.night ? 'ночь' : 'день');
    setText(hud.dayTime, fmtTime((W.night ? CFG.nightLen : CFG.dayLen) - W.t));
    hud.day.classList.toggle('night', W.night);
    setText(hud.mapLabel, inCave ? 'Пещера' : 'Карта');
    hud.hpFill.style.width = (P.hp / P.maxHp * 100) + '%';
    hud.foodFill.style.width = (P.hunger / CFG.maxHunger * 100) + '%';
    hud.waterFill.style.width = (P.thirst / CFG.maxThirst * 100) + '%';
    setText(hud.hpVal, Math.ceil(P.hp));
    setText(hud.foodVal, Math.ceil(P.hunger));
    setText(hud.waterVal, Math.ceil(P.thirst));
    for (const k of ['wood', 'stone', 'berry', 'iron', 'crystal']) setText(hud[k], P.inv[k]);
    setText(hud.kills, P.kills);
    setText(hud.eatCount, P.inv.berry);
    const ctx = P.dead ? { label: '—', idle: true } : context();
    setText(hud.actLabel, ctx.label);
    btnAction.classList.toggle('idle', !!ctx.idle);
    hud.craft.classList.toggle('ready', RECIPES.some((r) => canAfford(r.cost) && !owned(r.id)));
    updateCraftSheet();
  }

  // ==================================================================
  // Экраны: меню, пауза, настройки, рекорды
  // ==================================================================
  const OVERLAYS = ['menu', 'how', 'records', 'settings', 'pause', 'dead'];
  let panelReturn = 'menu';
  let wakeLock = null;

  function showScreen(name) {
    if (name === 'pause' && screen !== 'game') return;
    if (screen === 'game' && name !== 'game') { releaseAllInput(); toggleCraft(false); persist(); }
    screen = ['how', 'records', 'settings'].includes(name) ? screen : name;
    for (const id of OVERLAYS) $(id).hidden = id !== name;
    hud.root.hidden = !(name === 'game' || name === 'dead');
    if (name === 'menu') refreshMenu();
    if (name === 'records') {
      $('recBest').textContent = stats.best;
      $('recKills').textContent = stats.kills;
      $('recGames').textContent = stats.games;
    }
    if (name === 'settings') refreshSettings();
    if (name === 'game') requestWakeLock();
    const focusable = name !== 'game' && $(name) && $(name).querySelector('button:not([hidden])');
    if (focusable && !matchMedia('(pointer: coarse)').matches) focusable.focus({ preventScroll: true });
  }
  function openPanel(name, from) { panelReturn = from; showScreen(name); }
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => showScreen(panelReturn)));

  const isStandalone = !!window.Capacitor || navigator.standalone === true ||
    matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const onOwnSite = /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname);
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    if (screen === 'menu') refreshMenu();
  });
  $('btnInstall').addEventListener('click', () => {
    if (!installEvent) return;
    installEvent.prompt();
    installEvent.userChoice.finally(() => { installEvent = null; refreshMenu(); });
  });

  function refreshMenu() {
    $('btnInstall').hidden = !installEvent || isStandalone;
    $('installHint').hidden = !(isIOS && onOwnSite && !isStandalone);
    const saved = hasSave();
    $('btnContinue').hidden = !saved;
    $('btnNew').classList.toggle('primary', !saved);
    $('menuButtons').hidden = false;
    $('confirmNew').hidden = true;
  }

  function startNewGame() {
    writeJson(KEYS.save, null);
    resetGame();
    stats.games++;
    saveStats();
    updateCamera(0, true, false);
    showScreen('game');
    toast('Подойди к дереву и нажми «Рубить»', 'good');
  }
  function continueGame() {
    const data = readJson(KEYS.save, null);
    if (!data) { startNewGame(); return; }
    loadSave(data);
    updateCamera(0, true, false);
    showScreen('game');
    toast('День ' + W.day + '. С возвращением!', 'good');
  }
  function goToMenu() {
    persist();
    resetGame();
    showScreen('menu');
  }

  $('btnContinue').addEventListener('click', continueGame);
  $('btnNew').addEventListener('click', () => {
    if (hasSave()) { $('menuButtons').hidden = true; $('confirmNew').hidden = false; $('btnNewYes').focus({ preventScroll: true }); }
    else startNewGame();
  });
  $('btnNewNo').addEventListener('click', refreshMenu);
  $('btnNewYes').addEventListener('click', startNewGame);
  $('btnHow').addEventListener('click', () => openPanel('how', 'menu'));
  $('btnRecords').addEventListener('click', () => openPanel('records', 'menu'));
  $('btnSettings').addEventListener('click', () => openPanel('settings', 'menu'));
  $('btnResume').addEventListener('click', () => showScreen('game'));
  $('btnPauseSettings').addEventListener('click', () => openPanel('settings', 'pause'));
  $('btnToMenu').addEventListener('click', goToMenu);
  $('btnRestart').addEventListener('click', startNewGame);
  $('btnDeadMenu').addEventListener('click', () => { resetGame(); showScreen('menu'); });

  function applySettings() {
    sun.castShadow = !!settings.shadows;
    resize();
    Sound.applyVolume();
    if (P.x !== undefined) updateGrass(true);
  }
  function refreshSettings() {
    $('setVolume').value = settings.volume; $('outVolume').textContent = Math.round(settings.volume * 100) + '%';
    $('setSound').checked = !!settings.sound;
    $('setSens').value = settings.sens; $('outSens').textContent = Number(settings.sens).toFixed(1);
    $('setDist').value = settings.dist; $('outDist').textContent = settings.dist;
    $('setInvert').checked = !!settings.invert;
    $('setShadows').checked = !!settings.shadows;
    document.querySelectorAll('#setQuality button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.q === settings.quality)));
  }
  function changeSetting(key, value) {
    settings[key] = value;
    writeJson(KEYS.settings, settings);
    applySettings();
    refreshSettings();
  }
  $('setVolume').addEventListener('input', (e) => changeSetting('volume', parseFloat(e.target.value)));
  $('setVolume').addEventListener('change', () => Sound.play('click'));
  $('setSound').addEventListener('change', (e) => changeSetting('sound', e.target.checked));
  $('setSens').addEventListener('input', (e) => changeSetting('sens', parseFloat(e.target.value)));
  $('setDist').addEventListener('input', (e) => changeSetting('dist', parseInt(e.target.value, 10)));
  $('setInvert').addEventListener('change', (e) => changeSetting('invert', e.target.checked));
  $('setShadows').addEventListener('change', (e) => changeSetting('shadows', e.target.checked));
  document.querySelectorAll('#setQuality button').forEach((b) => b.addEventListener('click', () => changeSetting('quality', b.dataset.q)));

  function requestWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    navigator.wakeLock.request('screen').then((lock) => {
      wakeLock = lock;
      lock.addEventListener('release', () => { wakeLock = null; });
    }).catch(() => { /* экран может погаснуть, это не страшно */ });
  }

  // ==================================================================
  // Главный цикл
  // ==================================================================
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const inMenu = screen === 'menu';
    windTime.value += dt;
    waterMat.uniforms.uTime.value += dt;
    clouds.position.x = ((windTime.value * 1.6) % 1040) - 520;

    if (screen === 'game' && !craftOpen) {
      updateClock(dt);
      if (!P.dead) { updatePlayer(dt); updateSurvival(dt); }
      updateZombies(dt);
      updateWorldObjects(dt);
      Sound.ambient(dt, inCave ? 'cave' : 'surface', nightK);
    } else if (inMenu) {
      W.clock += dt;
      camYaw += dt * 0.04;
      updateWorldObjects(dt);
    }

    hero.g.rotation.y = P.face;
    if (P.dead) {
      P.deadT += dt;
      hero.g.rotation.x = -Math.min(1, P.deadT / 0.5) * Math.PI / 2;
      hero.g.position.set(P.x, P.y + Math.min(1, P.deadT / 0.5) * 0.25, P.z);
    } else {
      hero.g.rotation.x = 0;
      const bob = animateHuman(hero, P.walk, P.walkAmt, false, P.swimming);
      if (!P.grounded && !P.swimming) { hero.legL.rotation.x = 0.5; hero.legR.rotation.x = -0.3; }
      if (P.swingT > 0) hero.armR.rotation.x = -Math.sin((1 - P.swingT / 0.3) * Math.PI) * 2.0;
      hero.g.position.set(P.x, P.y + (P.grounded && !P.swimming ? bob : 0), P.z);
    }

    updateCamera(dt, false, inMenu);
    updateLighting(inMenu ? 17.4 : undefined);
    updateHud(dt);
    renderer.render(scene, camera);
  }

  // ==================================================================
  // Запуск
  // ==================================================================
  function start(data) {
    applySettings();
    resetGame();
    if (data && data.save && (data.screen === 'game' || data.screen === 'pause')) {
      // Страница обновилась во время игры: продолжаем с того же места.
      loadSave(data.save);
      showScreen('game');
    } else {
      showScreen('menu');
    }
    $('loading').hidden = true;
    updateCamera(0, true, screen !== 'game');
    requestAnimationFrame((t) => { last = t; frame(t); });
  }

  function boot() {
    buildTerrain();
    buildCaveEntrances();
    buildNature();
    buildMapBase();
    Object.assign(P, freshPlayer());
    const hot = window.claude && window.claude.hot;
    if (hot && hot.snapshot) hot.snapshot(() => ({ screen, save: screen === 'game' || screen === 'pause' ? makeSave() : null }));
    if (hot && hot.ready) hot.ready(start);
    else start((hot && hot.data) || {});
  }

  // Офлайн-режим для версии, установленной на главный экран (в приложении Android он не нужен).
  if ('serviceWorker' in navigator && !window.Capacitor && /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* без офлайн-режима */ }); });
  }

  // Отладка для разработки: открой игру с ?debug=1 в адресе
  if (/[?&]debug=1/.test(location.search)) {
    window.__game = {
      P, W, caveEntrances, settings,
      tp(x, z) { if (inCave) leaveCave(true); P.x = x; P.z = z; P.y = getHeight(x, z) + 2; updateGrass(true); },
      time(t, night) { W.t = t; W.night = !!night; },
      cave(i) { const e = caveEntrances[i || 0]; P.x = e.ix; P.z = e.iz; enterCave(e); },
      give(k, n) { P.inv[k] = (P.inv[k] || 0) + n; },
      cam(yaw, pitch, dist) { camYaw = yaw; camPitch = pitch; if (dist) settings.dist = dist; },
      state() { return { inCave, x: P.x, z: P.z, y: P.y, swimming: P.swimming, zombies: zombies.length, res: resources.length }; },
    };
  }

  // Даём браузеру показать «Создаём мир…», а потом строим мир
  setTimeout(boot, 30);
})();
