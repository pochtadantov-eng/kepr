// «Долгая ночь» — 3D-выживание. Мир, пещеры, звуки, зомби и интерфейс.
(function () {
  'use strict';

  // ==================================================================
  // Настройки игры
  // ==================================================================
  const CFG = {
    dayLen: 150, nightLen: 100,
    maxHunger: 100, maxThirst: 100, hungerDecay: 0.14, thirstDecay: 0.2,
    starveDmg: 3, regenThreshold: 50, regen: 0.6, berryFood: 20, drink: 35,
    flask: 4, flaskDrink: 30,
    playerSpeed: 6, swimSpeed: 0.55, jumpSpeed: 7.2, gravity: 22,
    reach: 1.4, gatherCd: 0.42, attackReach: 2.4,
    weapons: {
      fist: { dmg: 10, cd: 0.45 },
      sword: { dmg: 40, cd: 0.4 },
      iron: { dmg: 70, cd: 0.38 },
    },
    bag: { slots: 30, stack: 64 },
    campfire: { life: 240, radius: 7, heal: 4 },
    wall: { hp: 150 },
    zombie: { hp: 60, hpDay: 10, speed: 3.2, speedDay: 0.12, maxSpeed: 4.6, dmg: 8, range: 1.35, cd: 1,
      base: 3, perDay: 2, max: 25, interval: 1.5, minD: 28, maxD: 42 },
    caveZombie: { hp: 90, dmg: 11, speed: 3.4, aggro: 26 },
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
    { id: 'bench', name: 'Верстак', cost: { wood: 6 }, desc: 'Рядом с ним делаются топор и мечи' },
    { id: 'axe', name: 'Топор', cost: { wood: 3, stone: 2 }, bench: true, desc: 'Рубит деревья вдвое быстрее' },
    { id: 'sword', name: 'Меч', cost: { wood: 3, stone: 2 }, bench: true, desc: 'Удар 40 вместо 10 кулаком' },
    { id: 'iron', name: 'Железный меч', cost: { wood: 2, iron: 4 }, bench: true, desc: 'Удар 70. Железо есть в пещерах' },
    { id: 'lantern', name: 'Фонарь', cost: { wood: 2, crystal: 2 }, bench: true, desc: 'Ярко светит ночью и в пещерах' },
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

  const settings = Object.assign({ sens: 1, dist: 14, invert: false, shadows: true, quality: 'mid', volume: 0.8, sound: true, autoQuality: true },
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
      src.connect(f); f.connect(g); panned(g, o.pan).connect(sfx);
      src.start(t, Math.random() * 0.7);
      src.stop(t + dur + 0.05);
    }
    function panned(node, pan) {
      if (pan === undefined || !ctx.createStereoPanner) return node;
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node.connect(p);
      return p;
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
      osc.connect(g); panned(out, o.pan).connect(sfx);
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
      radio() {
        noise({ dur: 0.45, type: 'bandpass', freq: 1900, q: 1.2, gain: 0.12, attack: 0.02 });
        for (let i = 0; i < 4; i++) noise({ dur: 0.02, type: 'highpass', freq: 3000, gain: 0.08, delay: 0.05 + Math.random() * 0.35 });
        tone({ freq: 1250, dur: 0.05, gain: 0.04, delay: 0.42, type: 'square', lowpass: 2500 });
      },
      whoosh() { noise({ dur: 1.4, type: 'bandpass', freq: 400, freqEnd: 1400, q: 0.6, gain: 0.12, attack: 0.5 }); },
    };

    // Птицы: несколько разных голосов с разных сторон
    function bird() {
      const pan = rand(-0.9, 0.9), v = 0.05 + Math.random() * 0.03, kind = Math.floor(Math.random() * 4);
      if (kind === 0) {
        const f = 3200 + Math.random() * 900;
        for (let i = 0; i < 9; i++) tone({ freq: f, freqEnd: f * 1.18, dur: 0.035, gain: v * 0.8, delay: i * 0.045, pan });
      } else if (kind === 1) {
        tone({ freq: 2200, freqEnd: 3400, dur: 0.18, gain: v, pan });
        tone({ freq: 3400, freqEnd: 2600, dur: 0.22, gain: v, delay: 0.2, pan });
        tone({ freq: 2900, freqEnd: 3700, dur: 0.12, gain: v * 0.8, delay: 0.46, pan });
      } else if (kind === 2) {
        const f = 4200 + Math.random() * 600;
        for (let i = 0; i < 3; i++) tone({ freq: f, freqEnd: f - 1500, dur: 0.06, gain: v, delay: i * 0.13, pan });
        tone({ freq: f - 800, freqEnd: f + 400, dur: 0.14, gain: v, delay: 0.42, pan });
      } else {
        // Кукушка вдалеке
        for (let i = 0; i < 2; i++) {
          tone({ freq: 740, freqEnd: 725, dur: 0.22, gain: v * 0.6, delay: i * 0.9, attack: 0.03, pan });
          tone({ freq: 590, freqEnd: 580, dur: 0.32, gain: v * 0.6, delay: i * 0.9 + 0.28, attack: 0.03, pan });
        }
      }
    }
    // Капля воды в пещере (эхо добавляется само)
    function drip() {
      const pan = rand(-0.85, 0.85), f = 1300 + Math.random() * 1500, v = 0.05 + Math.random() * 0.07;
      tone({ freq: f, freqEnd: f * 0.42, dur: 0.07, gain: v, pan });
      tone({ freq: f * 1.6, freqEnd: f * 0.7, dur: 0.045, gain: v * 0.35, delay: 0.008, pan });
      if (Math.random() < 0.45) tone({ freq: f * 0.92, freqEnd: f * 0.4, dur: 0.06, gain: v * 0.6, delay: 0.22 + Math.random() * 0.25, pan });
    }
    // Жутковатые звуки из глубины пещеры
    function eerie() {
      const pan = rand(-1, 1), kind = Math.floor(Math.random() * 5);
      if (kind === 0) {
        tone({ freq: 95, freqEnd: 68, dur: 2.6, type: 'sawtooth', gain: 0.05, attack: 0.9, lowpass: 280, pan });
        tone({ freq: 190, freqEnd: 140, dur: 2.2, gain: 0.02, attack: 0.8, delay: 0.2, pan });
      } else if (kind === 1) {
        noise({ dur: 1.8, type: 'bandpass', freq: 2200, freqEnd: 800, q: 5, gain: 0.05, attack: 0.6, pan });
        noise({ dur: 1.2, type: 'bandpass', freq: 1500, freqEnd: 2600, q: 6, gain: 0.03, attack: 0.4, delay: 0.9, pan });
      } else if (kind === 2) {
        for (let i = 0; i < 6; i++) noise({ dur: 0.04, type: 'highpass', freq: 1400 + Math.random() * 1500, gain: 0.12 / (i + 1), delay: i * (0.07 + Math.random() * 0.12), pan });
      } else if (kind === 3) {
        tone({ freq: 55, freqEnd: 45, dur: 0.18, gain: 0.16, pan });
        tone({ freq: 55, freqEnd: 45, dur: 0.18, gain: 0.12, delay: 0.32, pan });
      } else {
        tone({ freq: 260, freqEnd: 190, dur: 1.4, type: 'sawtooth', gain: 0.025, attack: 0.3, lowpass: 900, pan });
      }
    }
    // Низкий гул, пока игрок в пещере
    let drone = null;
    function startDrone() {
      if (drone) return;
      const t = ctx.currentTime, g = ctx.createGain(), f = ctx.createBiquadFilter();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 3);
      f.type = 'lowpass'; f.frequency.value = 240;
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
      o1.frequency.value = 55; o2.type = 'sawtooth'; o2.frequency.value = 41.6;
      lfo.frequency.value = 0.07; lfoGain.gain.value = 90;
      lfo.connect(lfoGain); lfoGain.connect(f.frequency);
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
      o1.start(); o2.start(); lfo.start();
      drone = { g, nodes: [o1, o2, lfo] };
    }
    function stopDrone() {
      if (!drone) return;
      const d = drone, t = ctx.currentTime;
      drone = null;
      d.g.gain.cancelScheduledValues(t);
      d.g.gain.setValueAtTime(Math.max(0.0001, d.g.gain.value), t);
      d.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      d.nodes.forEach((n) => n.stop(t + 1.6));
    }

    let eerieT = 6;
    function ambient(dt, mode, nightK) {
      if (!ready || !settings.sound) return;
      ambT -= dt;
      if (mode === 'cave') {
        eerieT -= dt;
        if (ambT <= 0) { drip(); ambT = rand(0.5, 3); }
        if (eerieT <= 0) { eerie(); eerieT = rand(9, 22); }
        return;
      }
      if (ambT > 0) return;
      if (nightK > 0.6) {
        const f = 4100 + Math.random() * 500, pan = rand(-0.8, 0.8);
        for (let i = 0; i < 6; i++) tone({ freq: f, dur: 0.025, gain: 0.015, delay: i * 0.055, pan });
        ambT = rand(0.7, 2.2);
      } else {
        bird();
        ambT = rand(1.8, 5.5);
      }
    }

    return {
      init,
      applyVolume,
      ambient,
      pause(on) { if (ctx) (on ? ctx.suspend() : ctx.resume()).catch(() => {}); },
      play(name, a, b) { if (ready && LIB[name]) { try { LIB[name](a, b); } catch (e) { /* звук не критичен */ } } },
      setCave(on) {
        if (!ready) return;
        echoOut.gain.setTargetAtTime(on ? 0.35 : 0, ctx.currentTime, 0.1);
        if (on) startDrone(); else stopDrone();
      },
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
  const QUALITY = { low: 0.7, mid: 1.0, high: 1.5 };
  // Дальность прорисовки деревьев и тумана по качеству графики
  const VIEW = { low: 220, mid: 380, high: 560 };
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
    // Пологие холмы-горы с плоским плато наверху: подъём по плавной S-кривой без острых гребней
    let mountain = 0;
    if (mt > 0.52) {
      const k = smoothstep(0.52, 0.72, mt);
      mountain = k * 13 + (vnoise(x * 0.012, z * 0.012, 41) - 0.5) * 2.5 * k;
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
    // Край карты — широкий пологий вал с ровной вершиной
    h += smoothstep(HALF - 90, HALF - 20, edge) * 18;
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
        if (Math.abs(x) > HALF - 100 || Math.abs(z) > HALF - 100) break;
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

  // Размытие карты высот: убирает острые углы и изломы склонов
  function smoothHeights(passes) {
    const tmp = new Float32Array(heights.length);
    for (let p = 0; p < passes; p++) {
      for (let r = 0; r < N1; r++) for (let c = 0; c < N1; c++) {
        let sum = 0, w = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = clamp(r + dr, 0, N1 - 1), cc = clamp(c + dc, 0, N1 - 1), k = dr === 0 && dc === 0 ? 4 : dr === 0 || dc === 0 ? 2 : 1;
          sum += heights[rr * N1 + cc] * k; w += k;
        }
        tmp[r * N1 + c] = sum / w;
      }
      heights.set(tmp);
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
    const rockK = Math.max(smoothstep(0.75, 1.15, slope), smoothstep(16, 20, h) * 0.55);
    if (rockK > 0) out.lerp(tmpC.copy(TC.rock).lerp(TC.rockDark, m), rockK);
    const snowK = smoothstep(19, 22, h + m * 2) * (1 - smoothstep(0.6, 1.0, slope));
    if (snowK > 0) out.lerp(TC.snow, snowK);
    return out;
  }
  function surfaceAt(x, z) {
    if (inCave) return 'stone';
    const h = getHeight(x, z);
    if (h < WATER + 0.05) return 'water';
    if (h < 1.6) return 'sand';
    if (h > 19 || slopeAt(x, z) > 0.8) return 'stone';
    return 'grass';
  }

  const worldRng = mulberry32(20261024);
  const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: detailTexture(128, 0.78, 1.0, 5) });
  terrainMat.map.repeat.set(WORLD.size / 5, WORLD.size / 5);
  let terrain = null;

  function buildTerrain() {
    for (let r = 0; r < N1; r++) for (let c = 0; c < N1; c++) heights[r * N1 + c] = baseHeight(-HALF + c * STEP, -HALF + r * STEP);
    carveRivers(makeRivers(worldRng));
    smoothHeights(3);

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
  // Участки растительности: каждый со своей пачкой, чтобы прятать дальние и невидимые
  const chunkMeshes = [];
  const CHUNK = 96;
  class Batch {
    constructor(geo, mat, opts) { this.geo = geo; this.mat = mat; this.items = []; this.opts = opts || {}; this.mesh = null; }
    add(matrix, color) {
      const it = { m: matrix, c: color || null, mesh: null, i: this.items.length };
      this.items.push(it);
      return this.opts.chunked ? it : this.items.length - 1;
    }
    build(parent) {
      if (this.opts.chunked) return this.buildChunks(parent);
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
    buildChunks(parent) {
      const groups = new Map(), v = new THREE.Vector3(), white = new THREE.Color(1, 1, 1);
      for (const it of this.items) {
        v.setFromMatrixPosition(it.m);
        const k = Math.floor(v.x / CHUNK) + ',' + Math.floor(v.z / CHUNK);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(it);
      }
      for (const list of groups.values()) {
        const mesh = new THREE.InstancedMesh(this.geo, this.mat, list.length);
        const box = new THREE.Box3();
        list.forEach((it, i) => {
          mesh.setMatrixAt(i, it.m);
          if (this.opts.colored) mesh.setColorAt(i, it.c || white);
          box.expandByPoint(v.setFromMatrixPosition(it.m));
          it.mesh = mesh; it.i = i;
        });
        box.expandByScalar(6);
        mesh.castShadow = !!this.opts.cast;
        mesh.receiveShadow = !!this.opts.receive;
        mesh.frustumCulled = false;
        parent.add(mesh);
        chunkMeshes.push({ mesh, sphere: box.getBoundingSphere(new THREE.Sphere()), cast: !!this.opts.cast });
      }
    }
  }
  // Раз в несколько кадров: дальние и находящиеся вне обзора участки не рисуются, тень только у ближних
  const frustum = new THREE.Frustum(), projView = new THREE.Matrix4();
  let cullT = 0;
  function cullChunks(dt, force) {
    cullT -= dt;
    if (cullT > 0 && !force) return;
    cullT = 0.12;
    camera.updateMatrixWorld();
    projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projView);
    const far = Math.min(scene.fog.far + 20, VIEW[settings.quality] || 380), shadowR = settings.quality === 'high' ? 70 : 45;
    for (const c of chunkMeshes) {
      const d = c.sphere.center.distanceTo(camera.position) - c.sphere.radius;
      c.mesh.visible = d < far && frustum.intersectsSphere(c.sphere);
      if (c.cast) {
        const dp = Math.hypot(c.sphere.center.x - P.x, c.sphere.center.z - P.z) - c.sphere.radius;
        c.mesh.castShadow = dp < shadowR;
      }
    }
  }

  // Округлый камень: сфера с лёгкими буграми и гладкими нормалями
  function lumpyRock() {
    const g = new THREE.IcosahedronGeometry(1, 1), pos = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const k = 0.82 + vnoise(v.x * 1.8 + 3, v.z * 1.8 + v.y * 1.3, 17) * 0.3;
      pos.setXYZ(i, v.x * k, v.y * k * 0.9, v.z * k);
    }
    // Нормали по исходной сфере: камень остаётся гладким, без граней
    const nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).normalize(); nor.setXYZ(i, v.x, v.y, v.z); }
    return g;
  }
  const lam = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}));
  const GEO = {
    trunk: new THREE.CylinderGeometry(0.7, 1, 1, 7, 1, true).translate(0, 0.5, 0),
    cone: new THREE.ConeGeometry(1, 1, 9).translate(0, 0.5, 0),
    blob: new THREE.IcosahedronGeometry(1, 1),
    rock: lumpyRock(),
    berry: new THREE.OctahedronGeometry(0.13, 0),
    stem: new THREE.CylinderGeometry(0.015, 0.022, 0.42, 3).translate(0, 0.21, 0),
    petal: new THREE.OctahedronGeometry(0.1, 0).translate(0, 0.44, 0),
    flame: new THREE.ConeGeometry(0.42, 1.1, 6).translate(0, 0.55, 0),
    flameCore: new THREE.ConeGeometry(0.22, 0.7, 6).translate(0, 0.35, 0),
    stone: new THREE.DodecahedronGeometry(0.22, 0),
    hpBg: new THREE.PlaneGeometry(0.92, 0.13),
    hpFill: new THREE.PlaneGeometry(0.86, 0.08).translate(0.43, 0, 0),
    box: new THREE.BoxGeometry(1, 1, 1),
    log: new THREE.CylinderGeometry(0.085, 0.085, 1.0, 8),
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
    const g = Math.ceil(gap / 2) - 1, cx = Math.floor((x + HALF) / 2), cz = Math.floor((z + HALF) / 2), W2 = WORLD.size / 2;
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
      trunk: new Batch(GEO.trunk, MAT.trunk, { chunked: true, cast: true, colored: true }),
      cone: new Batch(GEO.cone, MAT.crown, { chunked: true, cast: true, colored: true }),
      blob: new Batch(GEO.blob, MAT.crown, { chunked: true, cast: true, colored: true }),
      rock: new Batch(GEO.rock, MAT.rock, { chunked: true, cast: true, receive: true, colored: true }),
      bush: new Batch(GEO.blob, MAT.bush, { chunked: true, cast: true, colored: true }),
      berry: new Batch(GEO.berry, MAT.berry, { chunked: true }),
      stem: new Batch(GEO.stem, MAT.stem, { chunked: true }),
      petal: new Batch(GEO.petal, MAT.petal, { chunked: true, colored: true }),
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
    for (let i = 0; i < 45000 && trees < 4600; i++) {
      const x = (rng() * 2 - 1) * (HALF - 4), z = (rng() * 2 - 1) * (HALF - 4);
      const h = getHeight(x, z), s = slopeAt(x, z);
      if (h < 1.7 || s > 1.05 || h > 41 || Math.hypot(x, z) < 9 || nearCave(x, z)) continue;
      const f = forestK(x, z);
      const p = f > 0.56 ? 0.95 : f > 0.48 ? 0.5 : 0.22;
      if (rng() > p || !isFree(x, z, 3)) continue;
      occupy(x, z, 3);
      trees++;
      const sc = 0.8 + rng() * 0.5, ry = rng() * TAU, parts = [];
      let collR = 0.45 * sc + 0.1, crown;
      const kind = h > 12 || s > 0.45 ? 'pine' : f > 0.56 ? (rng() < 0.5 ? 'pine' : rng() < 0.6 ? 'oak' : 'birch') : (rng() < 0.55 ? 'oak' : rng() < 0.5 ? 'birch' : 'pine');
      if (kind === 'pine') {
        const th = 2.2 * sc;
        parts.push(['trunk', B.trunk.add(matrixOf(x, h - 0.2, z, 0.32 * sc, th + 0.6, 0.32 * sc, ry), col(0x6b4a2f, 0.05))]);
        const green = col(rng() < 0.5 ? 0x2f6b3f : 0x2a5f3a, 0.06);
        for (let k = 0; k < 3; k++) {
          const rr = (1.9 - k * 0.5) * sc, hh = 2.4 * sc;
          parts.push(['cone', B.cone.add(matrixOf(x, h + th * 0.6 + k * 1.25 * sc, z, rr, hh, rr, ry + k), green)]);
        }
        // Нижние ветки ели у земли: обходить её приходится по краю веток
        collR = 1.3 * sc;
        crown = { y0: h + th * 0.6, y1: h + th * 0.6 + 4.9 * sc, r: 1.9 * sc };
      } else if (kind === 'oak') {
        const th = 3.0 * sc;
        parts.push(['trunk', B.trunk.add(matrixOf(x, h - 0.2, z, 0.36 * sc, th + 0.4, 0.36 * sc, ry), col(0x6b4a2f, 0.05))]);
        crown = { y0: h + th - 0.4 * sc, y1: h + th + 3.4 * sc, r: 2.4 * sc };
        const autumn = rng() < 0.08;
        const leaf = col(autumn ? (rng() < 0.5 ? 0xd98a2b : 0xc9b23a) : [0x4c8c3c, 0x3f7d3a, 0x5a9a44][Math.floor(rng() * 3)], 0.06);
        parts.push(['blob', B.blob.add(matrixOf(x, h + th + 1.5 * sc, z, 2.3 * sc, 1.9 * sc, 2.3 * sc, ry, rng(), rng()), leaf)]);
        parts.push(['blob', B.blob.add(matrixOf(x + 0.9 * sc, h + th + 0.9 * sc, z + 0.5 * sc, 1.5 * sc, 1.3 * sc, 1.5 * sc, ry + 1, rng(), 0), leaf)]);
      } else {
        const th = 4.2 * sc;
        parts.push(['trunk', B.trunk.add(matrixOf(x, h - 0.2, z, 0.22 * sc, th + 0.4, 0.22 * sc, ry), col(0xe7e2d6, 0.03))]);
        parts.push(['blob', B.blob.add(matrixOf(x, h + th + 0.8 * sc, z, 1.5 * sc, 2.4 * sc, 1.5 * sc, ry, rng() * 0.4, 0), col(0x8fbf4a, 0.07))]);
        crown = { y0: h + th - 1.6 * sc, y1: h + th + 3.2 * sc, r: 1.5 * sc };
        collR = 0.3 * sc + 0.1;
      }
      addRes('tree', x, z, collR, parts).crown = crown;
    }

    // Камни и валуны (больше в горах)
    let rocks = 0;
    for (let i = 0; i < 9000 && rocks < 800; i++) {
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
    for (let i = 0; i < 24000 && bushes < 420; i++) {
      const x = (rng() * 2 - 1) * (HALF - 12), z = (rng() * 2 - 1) * (HALF - 12);
      const h = getHeight(x, z), s = slopeAt(x, z);
      if (!okGround(x, z, h, s) || h > 22) continue;
      const f = forestK(x, z);
      if (rng() > (f > 0.44 && f < 0.6 ? 0.6 : 0.3) || !isFree(x, z, 2.5)) continue;
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
          ['trunk', B.trunk.add(matrixOf(x, h - 0.2, z, 0.36, 3.4, 0.36, 0), col(0x6b4a2f, 0.04))],
          ['blob', B.blob.add(matrixOf(x, h + 4.4, z, 2.3, 1.9, 2.3, x, 0.3, 0.2), col(0x4c8c3c, 0.05))],
        ]).crown = { y0: h + 2.6, y1: h + 6.4, r: 2.4 };
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
      r.parts = r.parts.map(([, it]) => ({ mesh: it.mesh, i: it.i, m: it.m }));
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
  const GRASS = { cell: 1.05, max: 16000, near: 26 };
  // Два набора травы: пока один показан, второй пересчитывается понемногу в фоне — без подвисаний
  const grassMat = windy(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.32);
  const grassMeshes = [0, 1].map(() => {
    const m = new THREE.InstancedMesh(tuftGeometry(), grassMat, GRASS.max);
    m.frustumCulled = false;
    m.setColorAt(0, new THREE.Color(1, 1, 1)); // создаёт буфер цветов на все пучки, поэтому до обнуления count
    m.count = 0;
    surface.add(m);
    return m;
  });
  let grassFront = 0, grassJob = null;
  let grassCenter = { x: 1e9, z: 1e9 };
  const grassColor = new THREE.Color(), GRASS_FOREST = new THREE.Color(0.62, 0.78, 0.6), GRASS_SHORE = new THREE.Color(1.1, 1.05, 0.7);
  const gM = new THREE.Matrix4(), gQ = new THREE.Quaternion(), gS = new THREE.Vector3(), gP = new THREE.Vector3(), gUp = new THREE.Vector3(0, 1, 0);
  function grassRadius() { return settings.quality === 'low' ? 40 : settings.quality === 'high' ? 110 : 70; }
  function* grassFill(mesh, cx, cz, R) {
    const C = GRASS.cell, n0x = Math.floor((cx - R) / C), n1x = Math.ceil((cx + R) / C), n0z = Math.floor((cz - R) / C), n1z = Math.ceil((cz + R) / C);
    const near = settings.quality === 'low' ? GRASS.near * 0.6 : GRASS.near;
    let n = 0, work = 0;
    for (let gx = n0x; gx <= n1x && n < GRASS.max; gx++) {
      for (let gz = n0z; gz <= n1z && n < GRASS.max; gz++) {
        const jx = hash2(gx, gz, 301), jz = hash2(gx, gz, 302);
        const x = (gx + jx) * C, z = (gz + jz) * C;
        const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
        if (d2 > R * R) continue;
        // Дальше от игрока пучков меньше, но они крупнее — трава видна до самого горизонта
        const far = d2 > near * near ? Math.sqrt(d2) / near : 1;
        if (far > 1 && hash2(gx, gz, 304) > 1 / (far * far)) continue;
        work++;
        const h = getHeight(x, z);
        if (h < 1.6 || h > 40) continue;
        if (slopeAt(x, z) > 1.1) continue;
        const k = (0.65 + hash2(gx, gz, 303) * 0.55) * Math.min(far, 2.4);
        gQ.setFromAxisAngle(gUp, jz * TAU);
        gM.compose(gP.set(x, h - 0.03, z), gQ, gS.set(k, k * (0.75 + jx * 0.5), k));
        mesh.setMatrixAt(n, gM);
        grassColor.setRGB(1, 1, 1).lerp(GRASS_FOREST, smoothstep(0.47, 0.6, forestK(x, z)));
        if (h < 2.2) grassColor.lerp(GRASS_SHORE, 0.5);
        mesh.setColorAt(n, grassColor);
        n++;
      }
      if (work > 220) { work = 0; yield; }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  function swapGrass() {
    grassMeshes[grassFront].visible = false;
    grassFront = 1 - grassFront;
    grassMeshes[grassFront].visible = true;
    grassJob = null;
  }
  function updateGrass(force) {
    const cx = Math.round(P.x / 8) * 8, cz = Math.round(P.z / 8) * 8;
    if (!force && cx === grassCenter.x && cz === grassCenter.z) return;
    grassCenter = { x: cx, z: cz };
    grassJob = grassFill(grassMeshes[1 - grassFront], cx, cz, grassRadius());
    if (force) { while (!grassJob.next().done); swapGrass(); }
  }
  // Пара миллисекунд расчёта травы за кадр
  function stepGrass(budgetMs) {
    if (!grassJob) return;
    const t0 = performance.now();
    while (performance.now() - t0 < budgetMs) {
      if (grassJob.next().done) { swapGrass(); return; }
    }
  }

  // ==================================================================
  // Входы в пещеры
  // ==================================================================
  function buildCaveEntrances() {
    const rng = mulberry32(4242);
    for (let tries = 0; tries < 9000 && caveEntrances.length < 8; tries++) {
      const x = (rng() * 2 - 1) * (HALF - 90), z = (rng() * 2 - 1) * (HALF - 90);
      const h = getHeight(x, z), s = slopeAt(x, z);
      if (h < 5 || h > 18 || s < 0.16 || s > 0.85) continue;
      if (Math.hypot(x, z) < 60 || caveEntrances.some((e) => Math.hypot(e.x - x, e.z - z) < 85)) continue;
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
      const e = { x, z, face, ix: x + fx * 3.2, iz: z + fz * 3.2, hx: x + fx * 1.0, hz: z + fz * 1.0, index: caveEntrances.length };
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
  // Коробка со скруглёнными рёбрами и гладкими нормалями (геометрии кэшируются по размеру)
  const rbCache = {};
  function roundedBox(w, h, d, r) {
    r = Math.min(r, w / 2, h / 2, d / 2) * 0.999;
    const key = w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3) + ',' + r.toFixed(3);
    if (rbCache[key]) return rbCache[key];
    const g = new THREE.BoxGeometry(w, h, d, 3, 3, 3);
    const pos = g.attributes.position, nor = g.attributes.normal;
    const v = new THREE.Vector3(), inner = new THREE.Vector3(), n = new THREE.Vector3();
    const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      inner.set(clamp(v.x, -hw, hw), clamp(v.y, -hh, hh), clamp(v.z, -hd, hd));
      n.subVectors(v, inner);
      const l = n.length();
      if (l > 1e-6) {
        n.divideScalar(l);
        v.copy(inner).addScaledVector(n, r);
        pos.setXYZ(i, v.x, v.y, v.z);
        nor.setXYZ(i, n.x, n.y, n.z);
      }
    }
    rbCache[key] = g;
    return g;
  }
  const std = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.82, metalness: 0 }, extra || {}));
  const FACE = { white: std(0xf4f1ea, { roughness: 0.4 }), pupil: std(0x2a1f1a, { roughness: 0.3 }), mouth: std(0x6e2f2a) };

  // Человечек со скруглёнными частями: корпус, голова с лицом, руки с кистями, ноги в ботинках
  function makeHuman(mats, kind) {
    const g = new THREE.Group();
    const rb = (w, h, d, r, mat, shadow) => {
      const m = new THREE.Mesh(roundedBox(w, h, d, r), mat);
      m.castShadow = shadow !== false;
      return m;
    };
    const at = (m, x, y, z, parent) => { m.position.set(x, y, z); parent.add(m); return m; };
    // Корпус, голова и руки крепятся к поясу, чтобы персонаж мог наклоняться и поворачиваться
    const upper = new THREE.Group(); upper.position.y = 0.9; g.add(upper);
    const body = at(rb(0.62, 0.72, 0.36, 0.11, mats.shirt), 0, 0.36, 0, upper);
    at(rb(0.64, 0.09, 0.38, 0.04, mats.belt), 0, 0.06, 0, upper);
    const head = new THREE.Group(); head.position.y = 0.96; upper.add(head);
    at(rb(0.46, 0.46, 0.46, 0.11, mats.skin), 0, 0, 0, head);
    // Лицо
    if (kind !== 'zombie') {
      for (const ex of [-0.088, 0.088]) {
        at(rb(0.085, 0.075, 0.03, 0.02, FACE.white, false), ex, 0.03, 0.222, head);
        at(rb(0.045, 0.05, 0.02, 0.012, FACE.pupil, false), ex, 0.025, 0.236, head);
        at(rb(0.1, 0.028, 0.02, 0.01, mats.hair || FACE.pupil, false), ex, 0.105, 0.232, head);
      }
      at(rb(0.11, 0.028, 0.02, 0.01, FACE.mouth, false), 0, -0.12, 0.228, head);
    } else {
      at(rb(0.16, 0.05, 0.02, 0.015, FACE.pupil, false), 0, -0.12, 0.228, head);
    }
    at(rb(0.065, 0.085, 0.06, 0.025, mats.skin, false), 0, -0.03, 0.245, head);

    const limb = (parent, x, y, w, len, mat, endMat, endLen) => {
      const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
      const top = len - endLen + 0.04;
      at(rb(w, top, w, w * 0.36, mat), 0, -top / 2, 0, pivot);
      at(rb(w * 0.94, endLen, w * 0.94, w * 0.4, endMat), 0, -(len - endLen / 2), 0, pivot);
      parent.add(pivot);
      return pivot;
    };
    const leg = (x) => {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.9, 0);
      at(rb(0.26, 0.8, 0.26, 0.09, mats.pants), 0, -0.4, 0, pivot);
      at(rb(0.28, 0.16, 0.36, 0.07, mats.shoes), 0, -0.82, 0.04, pivot);
      g.add(pivot);
      return pivot;
    };
    const h = {
      g, upper, head, body,
      legL: leg(-0.16), legR: leg(0.16),
      armL: limb(upper, -0.43, 0.68, 0.22, 0.74, mats.arms || mats.skin, mats.skin, 0.2),
      armR: limb(upper, 0.43, 0.68, 0.22, 0.74, mats.armsR || mats.arms || mats.skin, mats.skin, 0.2),
    };
    if (kind === 'zombie') {
      // Рваная одежда: тёмные дыры и пятна на рубашке
      const rip = std(0x2a2420);
      at(rb(0.16, 0.12, 0.02, 0.03, rip, false), -0.12, 0.42, 0.181, upper);
      at(rb(0.1, 0.16, 0.02, 0.03, rip, false), 0.16, 0.22, 0.181, upper);
      at(rb(0.2, 0.1, 0.02, 0.03, mats.skin, false), 0.02, 0.6, -0.181, upper);
    }
    return h;
  }
  const ZOMBIE_MATS = { skin: std(0x7fa36a), shirt: std(0x5b4a3c), pants: std(0x34405a), belt: std(0x2a2019), shoes: std(0x2b2622), arms: std(0x5b4a3c), armsR: std(0x7fa36a) };
  const CAVE_ZOMBIE_MATS = { skin: std(0x8c93a8), shirt: std(0x3b3346), pants: std(0x2a2a33), belt: std(0x1d1a1f), shoes: std(0x1f1d22), arms: std(0x8c93a8) };

  const HAIR = std(0x4a2f1c, { roughness: 0.9 });
  const hero = makeHuman({ skin: std(0xf0c8a0, { roughness: 0.7 }), shirt: std(0x3a78c9), pants: std(0x2b3448), arms: std(0x3a78c9),
    belt: std(0x5a3b22), shoes: std(0x3b2a1e), hair: HAIR }, 'hero');
  (function heroDetails() {
    const rb = (w, h, d, r, mat, x, y, z, parent) => { const m = new THREE.Mesh(roundedBox(w, h, d, r), mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    // Причёска с чёлкой
    rb(0.5, 0.14, 0.5, 0.06, HAIR, 0, 0.22, -0.005, hero.head);
    rb(0.5, 0.1, 0.09, 0.04, HAIR, 0, 0.16, 0.21, hero.head);
    rb(0.07, 0.24, 0.44, 0.03, HAIR, -0.225, 0.08, -0.02, hero.head);
    rb(0.07, 0.24, 0.44, 0.03, HAIR, 0.225, 0.08, -0.02, hero.head);
    rb(0.48, 0.3, 0.08, 0.04, HAIR, 0, 0.06, -0.225, hero.head);
    // Рюкзак за спиной и лямки
    const bag = std(0x7a5a36), bagDark = std(0x5a4128);
    rb(0.44, 0.5, 0.2, 0.08, bag, 0, 0.38, -0.27, hero.upper);
    rb(0.42, 0.15, 0.23, 0.06, bagDark, 0, 0.6, -0.27, hero.upper);
    rb(0.3, 0.16, 0.06, 0.04, bagDark, 0, 0.22, -0.38, hero.upper);
    for (const x of [-0.17, 0.17]) rb(0.07, 0.62, 0.04, 0.02, bagDark, x, 0.38, 0.185, hero.upper);
  })();
  // Кисть правой руки: в ней меч, топор, фляга или ягода
  const handR = new THREE.Group();
  handR.position.set(0, -0.72, 0.02);
  hero.armR.add(handR);
  // Меч: клинок ромбовидного сечения сужается к острию, гарда с шариками, обмотанная рукоять, навершие
  function makeSword(o) {
    const s = new THREE.Group();
    const L = o.length, W = o.width;
    const part = (geo, mat, z, rx, sx, sy, sz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.z = z;
      m.rotation.x = rx || 0;
      if (sx) m.scale.set(sx, sy, sz);
      m.castShadow = true;
      s.add(m);
      return m;
    };
    const bodyLen = L * 0.8, tipLen = L * 0.2;
    part(new THREE.CylinderGeometry(W * 0.82, W, bodyLen, 4), o.blade, 0.17 + bodyLen / 2, Math.PI / 2, 0.26, 1, 1);
    part(new THREE.CylinderGeometry(0, W * 0.82, tipLen, 4), o.blade, 0.17 + bodyLen + tipLen / 2, Math.PI / 2, 0.26, 1, 1);
    part(new THREE.BoxGeometry(0.012, W * 0.5, bodyLen * 0.85), o.fuller, 0.17 + bodyLen * 0.45);
    part(GEO.box, o.guard, 0.13, 0, 0.09, 0.46, 0.07);
    for (const y of [-0.24, 0.24]) { const k = part(new THREE.SphereGeometry(0.045, 8, 6), o.guard, 0.13); k.position.y = y; }
    part(new THREE.CylinderGeometry(0.036, 0.036, 0.24, 8), o.grip, 0.0, Math.PI / 2);
    for (const z of [-0.08, -0.02, 0.04]) part(new THREE.TorusGeometry(0.038, 0.008, 4, 10), o.guard, z);
    part(new THREE.SphereGeometry(0.058, 10, 8), o.guard, -0.15);
    s.visible = false;
    handR.add(s);
    return s;
  }
  const steel = new THREE.MeshPhongMaterial({ color: 0xd2d7de, shininess: 110, specular: 0xaab4c0 });
  const swordMesh = makeSword({
    length: 1.0, width: 0.1, blade: steel,
    fuller: new THREE.MeshPhongMaterial({ color: 0x8e959e, shininess: 60 }),
    guard: new THREE.MeshPhongMaterial({ color: 0x8a6a42, shininess: 40 }),
    grip: lam(0x3e2617),
  });
  const ironSwordMesh = makeSword({
    length: 1.3, width: 0.115, blade: MAT.ironBlade,
    fuller: new THREE.MeshPhongMaterial({ color: 0x5f7488, shininess: 80 }),
    guard: new THREE.MeshPhongMaterial({ color: 0xd4a52a, shininess: 90, specular: 0xffe08a }),
    grip: lam(0x241612),
  });
  const axeMesh = new THREE.Group();
  (function () {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.9, 8), lam(0x7a5230));
    handle.rotation.x = Math.PI / 2; handle.position.z = 0.33; handle.castShadow = true; axeMesh.add(handle);
    const metal = new THREE.MeshPhongMaterial({ color: 0xb9c0c8, shininess: 90 });
    const blade = new THREE.Mesh(GEO.box, metal); blade.scale.set(0.035, 0.28, 0.2); blade.position.set(0, -0.12, 0.7); blade.castShadow = true; axeMesh.add(blade);
    const edge = new THREE.Mesh(GEO.box, new THREE.MeshPhongMaterial({ color: 0xe8ecf0, shininess: 120 }));
    edge.scale.set(0.02, 0.32, 0.03); edge.position.set(0, -0.12, 0.81); axeMesh.add(edge);
    const poll = new THREE.Mesh(GEO.box, metal); poll.scale.set(0.07, 0.09, 0.12); poll.position.set(0, 0.02, 0.7); axeMesh.add(poll);
    axeMesh.visible = false;
    handR.add(axeMesh);
  })();
  const bottleMesh = new THREE.Group();
  (function () {
    const glass = new THREE.MeshPhongMaterial({ color: 0x8fc7d8, shininess: 120, transparent: true, opacity: 0.75 });
    const bodyB = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.24, 10), glass); bodyB.position.y = -0.06; bottleMesh.add(bodyB);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.1, 8), glass); neck.position.y = 0.11; bottleMesh.add(neck);
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), lam(0x9a6b3c)); cork.position.y = 0.18; bottleMesh.add(cork);
    bottleMesh.userData.water = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.18, 10), new THREE.MeshBasicMaterial({ color: 0x3f8fc0, transparent: true, opacity: 0.8 }));
    bottleMesh.userData.water.position.y = -0.08; bottleMesh.add(bottleMesh.userData.water);
    bottleMesh.position.set(0, -0.06, 0.06);
    bottleMesh.visible = false;
    handR.add(bottleMesh);
  })();
  const berryMesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), MAT.berry);
  berryMesh.position.set(0, -0.08, 0.06);
  berryMesh.visible = false;
  handR.add(berryMesh);

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
    h.armR.rotation.y = h.armR.rotation.z = h.armL.rotation.y = h.armL.rotation.z = 0;
    h.upper.rotation.set(0, 0, 0);
    h.upper.position.z = 0;
    h.head.rotation.set(0, 0, 0);
    return Math.abs(Math.sin(walkPhase)) * 0.06 * walkAmount;
  }

  // ==================================================================
  // Анимации героя: каждая поза — функция от времени t (0…1)
  // ==================================================================
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const smooth = (t) => t * t * (3 - 2 * t);
  // Значение по ключевым кадрам [[t, v], ...] с плавными переходами
  function kf(t, ks) {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) { const [t0, v0] = ks[i - 1], [t1, v1] = ks[i]; return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0)); }
    }
    return ks[ks.length - 1][1];
  }
  const ANIM = {
    // Удар мечом сверху наискосок
    slash1: { dur: 0.34, hit: 0.5, prop: 'weapon', pose(t, h, o) {
      h.armR.rotation.x = kf(t, [[0, -0.4], [0.32, -3.0], [0.55, -0.35], [1, -0.3]]);
      h.armR.rotation.z = kf(t, [[0, 0], [0.32, 0.45], [0.55, -0.6], [1, 0]]);
      h.upper.rotation.y = kf(t, [[0, 0], [0.32, -0.45], [0.55, 0.5], [1, 0]]);
      h.upper.rotation.x = kf(t, [[0, 0], [0.32, -0.15], [0.55, 0.32], [1, 0]]);
      h.armL.rotation.x = kf(t, [[0, 0], [0.32, -0.7], [0.55, 0.35], [1, 0]]);
      o.tilt = kf(t, [[0, 0.3], [0.32, 0.9], [0.55, 1.15], [1, 0.25]]);
      o.lunge = kf(t, [[0, 0], [0.55, 0.18], [1, 0]]);
    } },
    // Размах мечом справа налево
    slash2: { dur: 0.32, hit: 0.52, prop: 'weapon', pose(t, h, o) {
      h.armR.rotation.x = kf(t, [[0, -0.5], [0.3, -1.45], [0.62, -1.35], [1, -0.3]]);
      h.armR.rotation.z = kf(t, [[0, 0], [0.3, 1.3], [0.62, -1.0], [1, 0]]);
      h.upper.rotation.y = kf(t, [[0, 0], [0.3, -0.7], [0.62, 0.75], [1, 0]]);
      h.armL.rotation.z = kf(t, [[0, 0], [0.3, -0.55], [0.62, -0.2], [1, 0]]);
      o.tilt = kf(t, [[0, 0.3], [0.3, 1.25], [0.62, 1.35], [1, 0.25]]);
    } },
    // Колющий выпад
    thrust: { dur: 0.32, hit: 0.52, prop: 'weapon', pose(t, h, o) {
      h.armR.rotation.x = kf(t, [[0, -0.6], [0.3, -1.1], [0.52, -1.62], [1, -0.4]]);
      h.armR.rotation.z = kf(t, [[0, 0], [0.3, 0.3], [0.52, -0.1], [1, 0]]);
      h.upper.rotation.y = kf(t, [[0, 0], [0.3, -0.5], [0.52, 0.3], [1, 0]]);
      h.upper.rotation.x = kf(t, [[0, 0], [0.3, -0.05], [0.52, 0.35], [1, 0]]);
      h.legL.rotation.x = kf(t, [[0, 0], [0.52, -0.65], [1, 0]]);
      h.legR.rotation.x = kf(t, [[0, 0], [0.52, 0.45], [1, 0]]);
      o.lunge = kf(t, [[0, 0], [0.3, -0.12], [0.52, 0.4], [1, 0]]);
      o.tilt = kf(t, [[0, 0.4], [0.3, 1.35], [0.52, 1.57], [1, 0.3]]);
    } },
    // Удар кулаком
    punch: { dur: 0.28, hit: 0.48, prop: 'none', pose(t, h, o) {
      h.armR.rotation.x = kf(t, [[0, 0], [0.3, -0.7], [0.48, -1.65], [1, 0]]);
      h.upper.rotation.y = kf(t, [[0, 0], [0.3, -0.4], [0.48, 0.35], [1, 0]]);
      h.armL.rotation.x = kf(t, [[0, 0], [0.3, -1.1], [0.48, -0.6], [1, 0]]);
      o.lunge = kf(t, [[0, 0], [0.48, 0.12], [1, 0]]);
    } },
    // Рубка дерева топором: замах из-за плеча и удар вбок
    chop: { dur: 0.46, hit: 0.58, prop: 'axe', pose(t, h, o) {
      h.armR.rotation.x = kf(t, [[0, -0.5], [0.38, -2.4], [0.58, -1.05], [1, -0.4]]);
      h.armR.rotation.z = kf(t, [[0, 0], [0.38, 1.0], [0.58, -0.35], [1, 0]]);
      h.upper.rotation.y = kf(t, [[0, 0], [0.38, -0.8], [0.58, 0.45], [1, 0]]);
      h.upper.rotation.x = kf(t, [[0, 0], [0.38, -0.05], [0.58, 0.22], [1, 0]]);
      h.armL.rotation.x = kf(t, [[0, -0.3], [0.38, -1.5], [0.58, -1.0], [1, -0.2]]);
      o.tilt = kf(t, [[0, 0.3], [0.38, 0.6], [0.58, 1.25], [1, 0.3]]);
    } },
    // Удар сверху по камню
    mine: { dur: 0.48, hit: 0.6, prop: 'axe', pose(t, h, o) {
      h.armR.rotation.x = kf(t, [[0, -0.4], [0.4, -3.0], [0.6, -0.7], [1, -0.3]]);
      h.armL.rotation.x = kf(t, [[0, -0.3], [0.4, -2.6], [0.6, -0.8], [1, -0.2]]);
      h.upper.rotation.x = kf(t, [[0, 0], [0.4, -0.2], [0.6, 0.5], [1, 0]]);
      o.tilt = kf(t, [[0, 0.3], [0.4, 0.2], [0.6, 1.1], [1, 0.3]]);
      o.dy = kf(t, [[0, 0], [0.6, -0.1], [1, 0]]);
    } },
    // Сорвать ягоды: наклониться к кусту и взять рукой
    pick: { dur: 0.6, hit: 0.55, prop: 'none', pose(t, h, o) {
      h.upper.rotation.x = kf(t, [[0, 0], [0.4, 0.55], [0.7, 0.5], [1, 0]]);
      h.armR.rotation.x = kf(t, [[0, 0], [0.4, -1.25], [0.55, -0.9], [0.75, -0.5], [1, 0]]);
      h.armR.rotation.z = kf(t, [[0, 0], [0.4, -0.25], [1, 0]]);
      h.armL.rotation.x = kf(t, [[0, 0], [0.4, -0.7], [1, 0]]);
      o.dy = kf(t, [[0, 0], [0.4, -0.12], [1, 0]]);
    } },
    // Присесть у воды и набрать флягу
    fill: { dur: 1.5, hit: 0.62, prop: 'bottle', pose(t, h, o) {
      const down = kf(t, [[0, 0], [0.25, 1], [0.8, 1], [1, 0]]);
      // Присед: одна нога вперёд, другая назад, корпус наклонён к воде
      h.upper.rotation.x = 0.85 * down;
      h.legL.rotation.x = -0.75 * down;
      h.legR.rotation.x = 0.55 * down;
      o.dy = -0.3 * down;
      h.armR.rotation.x = -0.95 * down + Math.sin(seg(t, 0.35, 0.75) * Math.PI * 2) * 0.12;
      h.armL.rotation.x = -0.4 * down;
      h.head.rotation.x = 0.2 * down;
      o.tilt = kf(t, [[0, 0], [0.3, 0.8], [0.6, 0.6], [0.8, 0], [1, 0]]);
    } },
    // Поднести флягу ко рту и выпить
    drink: { dur: 1.5, hit: 0.7, prop: 'bottle', pose(t, h, o) {
      const up = kf(t, [[0, 0], [0.28, 1], [0.82, 1], [1, 0]]);
      h.armR.rotation.x = -2.1 * up;
      h.armR.rotation.z = -0.7 * up;
      h.head.rotation.x = -0.45 * up + Math.sin(seg(t, 0.3, 0.8) * Math.PI * 6) * 0.05 * up;
      h.upper.rotation.x = -0.12 * up;
      o.tilt = 1.3 * up;
    } },
    // Достать ягоду из кармана и съесть
    eat: { dur: 1.4, hit: 0.72, prop: 'berry', pose(t, h) {
      h.armR.rotation.x = kf(t, [[0, 0], [0.18, 0.4], [0.45, -2.1], [0.82, -2.05], [1, 0]]);
      h.armR.rotation.z = kf(t, [[0, 0], [0.18, 0.3], [0.45, -0.7], [0.82, -0.7], [1, 0]]);
      h.head.rotation.x = t > 0.45 && t < 0.85 ? Math.abs(Math.sin(t * 40)) * 0.08 : 0;
    } },
  };
  function playAnim(name, onHit) {
    P.anim = { name, t: 0, dur: ANIM[name].dur, fired: false, onHit };
  }
  function updateAnim(dt) {
    const a = P.anim;
    if (!a || a.frozen) return;
    a.t += dt;
    if (!a.fired && a.t >= ANIM[a.name].hit * a.dur) { a.fired = true; if (a.onHit) a.onHit(); }
    if (a.t >= a.dur) P.anim = null;
  }
  const animPose = { tilt: 0, dy: 0, lunge: 0 };
  function applyAnim() {
    animPose.tilt = 0; animPose.dy = 0; animPose.lunge = 0;
    if (P.anim) ANIM[P.anim.name].pose(clamp(P.anim.t / P.anim.dur, 0, 1), hero, animPose);
    handR.rotation.x = animPose.tilt;
  }

  // ==================================================================
  // Состояние игры
  // ==================================================================
  const P = {};
  const W = { clock: 0 };
  const zombies = [];
  const walls = [];
  const campfires = [];
  const benches = [];
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
      slots: new Array(CFG.bag.slots).fill(null), weapon: 'fist', lantern: false, axe: false, flask: CFG.flask, caveCd: 0,
      anim: null, combo: 0, lastAttack: -9, jumpPrep: 0, landT: 0, benchHinted: false,
      kills: 0, nights: 0, dead: false, deadT: 0,
      walk: 0, walkAmt: 0, stepIdx: 0, actCd: 0, starveWarned: false,
    };
  }

  // Рюкзак: 30 ячеек, до 64 одинаковых вещей в ячейке
  function invCount(id) { let n = 0; for (const s of P.slots) if (s && s.id === id) n += s.n; return n; }
  function invSpace(id) { let n = 0; for (const s of P.slots) n += !s ? CFG.bag.stack : s.id === id ? CFG.bag.stack - s.n : 0; return n; }
  function invAdd(id, n) {
    let left = n;
    for (const s of P.slots) {
      if (left > 0 && s && s.id === id && s.n < CFG.bag.stack) { const k = Math.min(left, CFG.bag.stack - s.n); s.n += k; left -= k; }
    }
    for (let i = 0; i < P.slots.length && left > 0; i++) {
      if (!P.slots[i]) { const k = Math.min(left, CFG.bag.stack); P.slots[i] = { id, n: k }; left -= k; }
    }
    bagDirty = true;
    return n - left;
  }
  function invRemove(id, n) {
    let left = n;
    for (let i = P.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = P.slots[i];
      if (s && s.id === id) { const k = Math.min(left, s.n); s.n -= k; left -= k; if (s.n <= 0) P.slots[i] = null; }
    }
    bagDirty = true;
    return n - left;
  }
  const usedSlots = () => P.slots.filter(Boolean).length;

  function clearWorld() {
    if (inCave) leaveCave(true);
    if (typeof Intro !== 'undefined') Intro.clear();
    for (const z of zombies) scene.remove(z.h.g, z.bar.g);
    zombies.length = 0;
    for (const w of walls) surface.remove(w.mesh);
    walls.length = 0;
    for (const c of campfires) removeCampfire(c, true);
    campfires.length = 0;
    for (const b of benches) surface.remove(b.mesh);
    benches.length = 0;
    for (const r of resources) { r.left = r.cfg.amount; setResVisible(r, true); }
    for (const d of drops) if (d.mesh.parent) d.mesh.parent.remove(d.mesh);
    drops.length = 0;
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

  // Что сейчас в руке: предмет текущей анимации, иначе оружие
  function refreshEquipment() {
    const prop = P.anim ? ANIM[P.anim.name].prop : 'weapon';
    swordMesh.visible = prop === 'weapon' && P.weapon === 'sword';
    ironSwordMesh.visible = prop === 'weapon' && P.weapon === 'iron';
    axeMesh.visible = prop === 'axe';
    bottleMesh.visible = prop === 'bottle';
    bottleMesh.userData.water.visible = P.flask > 0 || (P.anim && P.anim.name === 'fill' && P.anim.fired);
    berryMesh.visible = prop === 'berry' && P.anim && P.anim.t / P.anim.dur > 0.18 && !P.anim.fired;
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
        slots: P.slots.map((s) => (s ? { id: s.id, n: s.n } : null)), weapon: P.weapon, lantern: P.lantern, axe: P.axe, flask: P.flask,
        kills: P.kills, nights: P.nights },
      W: { day: W.day, night: W.night, t: W.t, warned: W.warned },
      zombies: W.night ? zombies.filter((z) => !z.dead && !z.burn && !z.cave).length + W.toSpawn : 0,
      walls: walls.map((w) => ({ x: w.x, z: w.z, rot: w.rot, hp: w.hp })),
      fires: campfires.map((c) => ({ x: c.x, z: c.z, life: c.life })),
      benches: benches.map((b) => ({ x: b.x, z: b.z, rot: b.rot })),
      cam: { yaw: camYaw, pitch: camPitch },
    };
  }
  function loadSave(data) {
    resetGame();
    const sp = data.P || {};
    Object.assign(P, {
      hp: sp.hp > 0 ? sp.hp : 1, hunger: sp.hunger, thirst: sp.thirst, face: sp.face || 0,
      kills: sp.kills || 0, nights: sp.nights || 0,
      weapon: sp.weapon || (sp.hasSword ? 'sword' : 'fist'), lantern: !!sp.lantern, axe: !!sp.axe,
      flask: typeof sp.flask === 'number' ? sp.flask : CFG.flask,
    });
    if (Array.isArray(sp.slots)) {
      sp.slots.slice(0, CFG.bag.slots).forEach((s, i) => { if (s && ITEMS[s.id] && s.n > 0) P.slots[i] = { id: s.id, n: Math.min(s.n, CFG.bag.stack) }; });
    } else if (sp.inv) {
      // Старое сохранение: переносим ресурсы в ячейки
      for (const k of Object.keys(sp.inv)) if (ITEMS[k] && sp.inv[k] > 0) invAdd(k, sp.inv[k]);
    }
    // Старые сохранения были на другой карте: начинаем на поляне, но с вещами
    if (data.v === SAVE_VERSION) {
      P.x = sp.x; P.z = sp.z;
      for (const w of data.walls || []) { addWall(w.x, w.z, w.rot); damageWall(walls[walls.length - 1], CFG.wall.hp - w.hp, true); }
      for (const c of data.fires || []) { addCampfire(c.x, c.z); campfires[campfires.length - 1].life = c.life; }
      for (const b of data.benches || []) addBench(b.x, b.z, b.rot);
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
    Sound.pause(document.hidden);
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
  const look = { id: null, lastX: 0, lastY: 0, sx: 0, sy: 0, t0: 0, moved: false, holdTimer: 0 };
  let actionHeld = false, jumpQueued = false, tapAt = -1;
  const TAP = { move: 12, time: 300, hold: 280 };
  // Короткий тап без движения пальца — действие (рубить, добывать, бить...). Палец держишь на месте — действие повторяется.
  function queueTap() { if (playing()) tapAt = performance.now(); }
  const touchLayer = $('touch'), joyEl = $('joy'), knob = $('knob');
  const playing = () => screen === 'game' && !craftOpen && !bagOpen;

  touchLayer.addEventListener('pointerdown', (e) => {
    if (!playing()) return;
    if (e.pointerType !== 'mouse' && e.clientX < window.innerWidth * 0.5 && joy.id === null) {
      joy.id = e.pointerId; joy.sx = e.clientX; joy.sy = e.clientY; joy.x = 0; joy.y = 0; joy.t0 = performance.now(); joy.moved = false;
      joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
      knob.style.transform = '';
      joyEl.hidden = false;
    } else if (look.id === null) {
      look.id = e.pointerId; look.lastX = look.sx = e.clientX; look.lastY = look.sy = e.clientY;
      look.t0 = performance.now(); look.moved = false;
      const id = e.pointerId;
      clearTimeout(look.holdTimer);
      look.holdTimer = setTimeout(() => { if (look.id === id && !look.moved && playing()) actionHeld = true; }, TAP.hold);
    }
    try { touchLayer.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
  });
  touchLayer.addEventListener('pointermove', (e) => {
    if (e.pointerId === joy.id) {
      let dx = e.clientX - joy.sx, dy = e.clientY - joy.sy;
      const d = Math.hypot(dx, dy), max = 50;
      if (d > TAP.move) joy.moved = true;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      joy.x = dx / max; joy.y = dy / max;
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    } else if (e.pointerId === look.id) {
      if (!look.moved) {
        if (Math.hypot(e.clientX - look.sx, e.clientY - look.sy) < TAP.move) return;
        look.moved = true;
        actionHeld = false;
      }
      const k = 0.007 * settings.sens;
      camYaw -= (e.clientX - look.lastX) * k;
      camPitch = clamp(camPitch + (e.clientY - look.lastY) * k * (settings.invert ? -1 : 1), CFG.pitchMin, CFG.pitchMax);
      look.lastX = e.clientX; look.lastY = e.clientY;
    }
  });
  function endPointer(e) {
    const quick = (t0) => performance.now() - t0 < TAP.time;
    if (e.pointerId === joy.id) {
      if (e.type === 'pointerup' && !joy.moved && quick(joy.t0)) queueTap();
      joy.id = null; joy.x = 0; joy.y = 0; joyEl.hidden = true;
    }
    if (e.pointerId === look.id) {
      clearTimeout(look.holdTimer);
      if (e.type === 'pointerup' && !look.moved && !actionHeld && quick(look.t0)) queueTap();
      actionHeld = false;
      look.id = null;
    }
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
    if (screen === 'intro') {
      if (e.code === 'Escape') Intro.skip(); else if (e.code === 'Space' || e.code === 'Enter') Intro.next();
      return;
    }
    if (e.code === 'Escape') {
      if (bagOpen) toggleBag(false);
      else if (craftOpen) toggleCraft(false);
      else if (screen === 'game') showScreen('pause');
      else if (screen === 'pause') showScreen('game');
      return;
    }
    const bagKey = e.code === 'KeyI' || e.code === 'KeyB';
    if (!playing() && !(craftOpen && e.code === 'KeyC') && !(bagOpen && bagKey)) return;
    if (bagKey) toggleBag();
    if (e.code === 'KeyE') actionHeld = true;
    if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
    if (e.code === 'KeyF') eat();
    if (e.code === 'KeyQ') drinkFlask();
    if (e.code === 'KeyC') toggleCraft();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'KeyE') actionHeld = false;
  });
  window.addEventListener('blur', releaseAllInput);

  $('btnJump').addEventListener('pointerdown', (e) => { e.preventDefault(); if (playing()) jumpQueued = true; });
  $('btnEat').addEventListener('click', () => eat());
  $('btnDrink').addEventListener('click', () => drinkFlask());
  $('btnCraft').addEventListener('click', () => toggleCraft());
  $('craftClose').addEventListener('click', () => toggleCraft(false));
  $('btnPause').addEventListener('click', () => showScreen('pause'));

  // ==================================================================
  // Столкновения и высота земли
  // ==================================================================
  const CAVE = { n: 56, cell: 2.6, y: -400, ceil: 8, wall: 0.85 };
  const SWIM_DEPTH = 1.05;

  // Высота поверхности пещеры в точке: те же треугольники, что и видимая скала
  function rockHeightAt(rock, x, z) {
    const fx = clamp((x + rock.half) / rock.step, 0, rock.seg - 0.0001), fz = clamp((z + rock.half) / rock.step, 0, rock.seg - 0.0001);
    const c = Math.floor(fx), r = Math.floor(fz), tx = fx - c, tz = fz - r, n1 = rock.seg + 1, h = rock.h, i = r * n1 + c;
    if (tx + tz <= 1) return h[i] + (h[i + 1] - h[i]) * tx + (h[i + n1] - h[i]) * tz;
    const e = h[i + n1 + 1];
    return e + (h[i + n1] - e) * (1 - tx) + (h[i + 1] - e) * (1 - tz);
  }
  const caveRockH = (x, z) => rockHeightAt(cave.rock, x, z);
  // Стена там, где скала поднимается выше колена — ровно там, где её видно
  function caveBlocked(x, z, r) {
    if (caveRockH(x, z) > CAVE.wall) return true;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      if (caveRockH(x + Math.cos(a) * r, z + Math.sin(a) * r) > CAVE.wall) return true;
    }
    return false;
  }
  function groundY(x, z) { return inCave ? CAVE.y + (cave ? Math.min(caveRockH(x, z), CAVE.wall) : 0) : getHeight(x, z); }

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
  function caveSolid(c, r) { return c < 0 || r < 0 || c >= CAVE.n || r >= CAVE.n || cave.grid[r * CAVE.n + c] === 1; }
  const caveCellOf = (v) => Math.floor(v / CAVE.cell + CAVE.n / 2);
  const caveCenter = (i) => (i - CAVE.n / 2 + 0.5) * CAVE.cell;

  function collide(e) {
    let touchedWall = null;
    if (inCave) {
      for (const res of cave.resources) if (res.active) pushFromCircle(e, res.x, res.z, res.r);
      for (const o of cave.solids) pushFromCircle(e, o.x, o.z, o.r);
      return null;
    }
    gridEach(e.x, e.z, 4, (o) => { if (o.isStatic || o.active) pushFromCircle(e, o.x, o.z, o.r); });
    for (const c of campfires) pushFromCircle(e, c.x, c.z, 0.6);
    for (const b of benches) pushFromCircle(e, b.x, b.z, 0.85);
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
    if (inCave) {
      // Если уже упёрлись (например, вытолкнул зомби), разрешаем выйти из скалы
      const free = (x, z) => !caveBlocked(x, z, e.r) || caveBlocked(e.x, e.z, e.r);
      if (free(e.x + dx, e.z + dz)) { e.x += dx; e.z += dz; }
      else if (free(e.x + dx, e.z)) e.x += dx;
      else if (free(e.x, e.z + dz)) e.z += dz;
      return;
    }
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
  // Вход в пещеру — тёмный проход, выход — столб света: достаточно в них зайти
  function caveDoorAt() {
    if (inCave) return null;
    return caveEntrances.find((e) => Math.hypot(e.hx - P.x, e.hz - P.z) < 1.25) || null;
  }
  const atCaveExit = () => inCave && cave && Math.hypot(cave.exit.x - P.x, cave.exit.z - P.z) < 1.5;

  function context() {
    const z = nearestZombie(CFG.attackReach);
    if (z) return { kind: 'attack', target: z, label: 'Удар' };
    const r = nearestResource();
    if (r) return { kind: 'gather', target: r, label: r.cfg.action };
    if (nearWater() && P.flask < CFG.flask) return { kind: 'fill', label: 'Набрать воды' };
    return { kind: 'swing', label: 'Удар', idle: true };
  }

  function doAction() {
    if (P.anim) return;
    const ctx = context();
    if (ctx.kind === 'attack') {
      const z = ctx.target, weapon = CFG.weapons[P.weapon], armed = P.weapon !== 'fist';
      faceTo(z.x, z.z);
      // Серия ударов: сверху, вбок, выпад — если бить без пауз
      if (W.clock - P.lastAttack > 0.9) P.combo = 0;
      const name = armed ? ['slash1', 'slash2', 'thrust'][P.combo % 3] : 'punch';
      P.combo++;
      P.lastAttack = W.clock;
      if (armed) Sound.play('swing');
      playAnim(name, () => {
        const f = forward();
        for (const o of zombies.slice()) {
          if (o.dead || o.burn || !!o.cave !== !!inCave) continue;
          const dx = o.x - P.x, dz = o.z - P.z, d = Math.hypot(dx, dz) || 1;
          if ((o === z && d < CFG.attackReach + 0.8) || (d < CFG.attackReach + 0.4 && (dx * f.x + dz * f.z) / d > 0.3)) hitZombie(o, weapon.dmg);
        }
      });
      P.actCd = weapon.cd;
    } else if (ctx.kind === 'gather') {
      const r = ctx.target;
      faceTo(r.x, r.z);
      if (invSpace(r.cfg.item) < 1) { toast('Рюкзак полон. Выброси что-нибудь', 'warn'); P.actCd = 0.6; return; }
      const isTree = r.type === 'tree', bare = isTree && !P.axe;
      const name = r.type === 'bush' ? 'pick' : isTree ? (P.axe ? 'chop' : 'punch') : (P.axe ? 'mine' : 'punch');
      if (bare && !P.axeHinted) { P.axeHinted = true; toast('Руками рубить долго. Сделай топор на верстаке', 'warn'); }
      playAnim(name, () => {
        if (!r.active || r.left <= 0) return;
        r.left--;
        r.hitT = 0.18;
        shaking.add(r);
        invAdd(r.cfg.item, 1);
        Sound.play(r.cfg.sound);
        toast('+1 ' + ITEMS[r.cfg.item], 'item');
        if (r.left <= 0) { setResVisible(r, false); shaking.delete(r); r.respawnAt = W.clock + r.cfg.respawn; }
        if (r.cfg.item === 'wood' && !benches.length && !P.benchHinted && invCount('wood') >= 6) {
          P.benchHinted = true;
          toast('Хватает дерева на верстак. Открой «Крафт»', 'good');
        }
      });
      P.actCd = bare ? 1.0 : ANIM[name].dur + 0.06;
    } else if (ctx.kind === 'fill') {
      playAnim('fill', () => { P.flask = CFG.flask; Sound.play('drink'); toast('Фляга полна. Нажми «Пить»', 'item'); });
      P.actCd = ANIM.fill.dur + 0.1;
    } else {
      const armed = P.weapon !== 'fist';
      if (armed) Sound.play('swing');
      playAnim(armed ? 'slash1' : 'punch');
      P.actCd = CFG.weapons[P.weapon].cd;
    }
  }

  function eat() {
    if (playing()) eatBerry(false);
  }
  // Есть с анимацией: достать ягоду из кармана и поднести ко рту. Из рюкзака — сразу.
  function eatBerry(instant) {
    if (P.dead || (!instant && P.anim)) return;
    if (invCount('berry') < 1) { toast('Нет ягод. Ищи кусты с красными ягодами', 'warn'); return; }
    if (P.hunger >= CFG.maxHunger - 1) { toast('Ты не голоден'); return; }
    const finish = () => {
      if (invRemove('berry', 1) < 1) return;
      P.hunger = Math.min(CFG.maxHunger, P.hunger + CFG.berryFood);
      Sound.play('eat');
      toast('Ням! +' + CFG.berryFood + ' к сытости', 'item');
    };
    if (instant) finish(); else playAnim('eat', finish);
  }
  function drinkFlask() {
    if (!playing() || P.dead || P.anim) return;
    if (P.flask <= 0) { toast(nearWater() ? 'Фляга пуста. Нажми на экран, чтобы набрать воды' : 'Фляга пуста. Набери воды в озере или реке', 'warn'); return; }
    if (P.thirst >= CFG.maxThirst - 1) { toast('Ты не хочешь пить'); return; }
    playAnim('drink', () => {
      P.flask--;
      P.thirst = Math.min(CFG.maxThirst, P.thirst + CFG.flaskDrink);
      Sound.play('drink');
      toast('Ты попил воды. Во фляге: ' + P.flask, 'item');
    });
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
    P.anim = null;
    P.dead = true;
    P.deadT = 0;
    releaseAllInput();
    toggleCraft(false);
    toggleBag(false);
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
  const canAfford = (cost) => Object.keys(cost).every((k) => invCount(k) >= cost[k]);
  const owned = (id) => (id === 'sword' && (P.weapon === 'sword' || P.weapon === 'iron')) || (id === 'iron' && P.weapon === 'iron') ||
    (id === 'lantern' && P.lantern) || (id === 'axe' && P.axe);
  const nearBench = () => !inCave && benches.some((b) => Math.hypot(b.x - P.x, b.z - P.z) < 4.5);
  const canCraftHere = (rec) => !rec.bench || nearBench();
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
    if (craftOpen && bagOpen) toggleBag(false);
    $('craft').hidden = !craftOpen;
    releaseAllInput();
    updateCraftSheet();
  }
  function updateCraftSheet() {
    if (!craftOpen) return;
    for (const r of recipeEls) {
      const has = owned(r.rec.id), here = canCraftHere(r.rec);
      r.btn.disabled = has || !here || !canAfford(r.rec.cost);
      r.btn.textContent = has ? 'Есть' : here ? 'Создать' : 'Нужен верстак';
      r.costs.forEach((s) => s.classList.toggle('miss', invCount(s.dataset.item) < r.rec.cost[s.dataset.item]));
    }
  }

  function craft(rec) {
    if (P.dead) return;
    if (owned(rec.id)) { toast('У тебя это уже есть', 'warn'); return; }
    if ((rec.id === 'campfire' || rec.id === 'wall' || rec.id === 'bench') && inCave) { toast('В пещере строить нельзя', 'warn'); return; }
    if (!canCraftHere(rec)) { toast('Подойди к верстаку', 'warn'); return; }
    if (!canAfford(rec.cost)) { toast('Не хватает ресурсов', 'warn'); return; }
    for (const k of Object.keys(rec.cost)) invRemove(k, rec.cost[k]);
    const f = forward();
    if (rec.id === 'sword') P.weapon = 'sword';
    else if (rec.id === 'iron') P.weapon = 'iron';
    else if (rec.id === 'lantern') P.lantern = true;
    else if (rec.id === 'axe') P.axe = true;
    else if (rec.id === 'bench') addBench(P.x + f.x * 2.2, P.z + f.z * 2.2, P.face);
    else if (rec.id === 'campfire') addCampfire(P.x + f.x * 1.9, P.z + f.z * 1.9);
    else if (rec.id === 'wall') addWall(P.x + f.x * 2.1, P.z + f.z * 2.1, P.face);
    refreshEquipment();
    Sound.play('craft');
    toast('Создано: ' + rec.name, 'good');
    toggleCraft(false);
  }

  // ==================================================================
  // Рюкзак: ячейки, выбросить вещи, подобрать с земли
  // ==================================================================
  let bagOpen = false, bagDirty = true, selectedSlot = -1;
  const itemIcon = (id) => '<i class="ic ' + id + '"></i>';
  const slotEls = [];
  for (let i = 0; i < CFG.bag.slots; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot';
    b.id = 'slot-' + i;
    b.addEventListener('click', () => { selectedSlot = selectedSlot === i ? -1 : i; renderBag(); });
    $('slots').appendChild(b);
    slotEls.push(b);
  }
  function renderBag() {
    if (!bagOpen) return;
    bagDirty = false;
    if (selectedSlot >= 0 && !P.slots[selectedSlot]) selectedSlot = -1;
    P.slots.forEach((s, i) => {
      const el = slotEls[i];
      el.classList.toggle('sel', i === selectedSlot);
      el.classList.toggle('empty', !s);
      const html = s ? itemIcon(s.id) + '<b>' + s.n + '</b>' : '';
      if (el.innerHTML !== html) el.innerHTML = html;
      el.setAttribute('aria-label', s ? ITEMS[s.id] + ', ' + s.n + ' шт.' : 'Пустая ячейка');
    });
    $('bagUsed').textContent = usedSlots() + ' / ' + CFG.bag.slots;
    const s = selectedSlot >= 0 ? P.slots[selectedSlot] : null;
    $('slotInfo').hidden = !s;
    $('bagHint').hidden = !!s;
    if (s) {
      $('slotName').innerHTML = itemIcon(s.id) + ITEMS[s.id] + ' <span>×' + s.n + '</span>';
      $('dropHalf').textContent = 'Половину (' + Math.max(1, Math.floor(s.n / 2)) + ')';
      $('dropAll').textContent = 'Всё (' + s.n + ')';
      $('slotEat').hidden = s.id !== 'berry';
    }
  }
  function toggleBag(force) {
    bagOpen = typeof force === 'boolean' ? force : !bagOpen;
    if (screen !== 'game' || P.dead) bagOpen = false;
    if (bagOpen && craftOpen) toggleCraft(false);
    $('bag').hidden = !bagOpen;
    releaseAllInput();
    selectedSlot = -1;
    renderBag();
  }
  function dropFromSlot(amount) {
    const s = P.slots[selectedSlot];
    if (!s) return;
    const n = clamp(amount, 1, s.n);
    s.n -= n;
    if (s.n <= 0) P.slots[selectedSlot] = null;
    spawnDrop(s.id, n);
    Sound.play('pick');
    toast('Выброшено: ' + ITEMS[s.id] + ' ×' + n, 'item');
    bagDirty = true;
    renderBag();
  }
  $('btnBag').addEventListener('click', () => toggleBag());
  $('bagClose').addEventListener('click', () => toggleBag(false));
  $('drop1').addEventListener('click', () => dropFromSlot(1));
  $('dropHalf').addEventListener('click', () => { const s = P.slots[selectedSlot]; if (s) dropFromSlot(Math.floor(s.n / 2)); });
  $('dropAll').addEventListener('click', () => { const s = P.slots[selectedSlot]; if (s) dropFromSlot(s.n); });
  $('slotEat').addEventListener('click', () => { eatBerry(true); renderBag(); });

  const drops = [];
  const dropMats = {};
  for (const [id, hex] of Object.entries({ wood: 0x8a5a33, stone: 0x9a9ea3, berry: 0xd0263f, iron: 0xd9822b, crystal: 0x6fe7ff })) {
    dropMats[id] = lam(hex, { emissive: hex, emissiveIntensity: 0.3 });
  }
  function spawnDrop(id, n) {
    const f = forward();
    const x = P.x + f.x * 2 + rand(-0.25, 0.25), z = P.z + f.z * 2 + rand(-0.25, 0.25);
    const m = new THREE.Mesh(roundedBox(1, 1, 1, 0.28), dropMats[id]);
    m.scale.setScalar(n >= 16 ? 0.45 : 0.32);
    m.castShadow = true;
    (inCave ? caveGroup : surface).add(m);
    drops.push({ id, n, x, z, mesh: m, cave: !!inCave, age: 0 });
  }
  function updateDrops(dt) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (!!d.cave !== !!inCave) continue;
      d.age += dt;
      const g = inCave ? groundY(d.x, d.z) : Math.max(getHeight(d.x, d.z), WATER - 0.15);
      d.mesh.position.set(d.x, g + 0.4 + Math.sin(d.age * 3) * 0.08, d.z);
      d.mesh.rotation.y = d.age * 1.5;
      // Подбираем, когда игрок подходит (не сразу после выброса)
      if (d.age > 1.5 && !P.dead && Math.hypot(d.x - P.x, d.z - P.z) < 1.3) {
        const got = invAdd(d.id, d.n);
        if (got > 0) { d.n -= got; Sound.play('pick'); toast('+' + got + ' ' + ITEMS[d.id], 'item'); }
        if (d.n <= 0) { if (d.mesh.parent) d.mesh.parent.remove(d.mesh); drops.splice(i, 1); }
      }
    }
  }

  const WALL_COLOR = new THREE.Color(0x9a6b40), WALL_BROKEN = new THREE.Color(0x3a2a1c);
  function addWall(x, z, rot) {
    const mat = lam(0x9a6b40);
    const g = new THREE.Group();
    const y = getHeight(x, z);
    g.position.set(x, y + 1.1, z);
    g.rotation.y = rot;
    const body = new THREE.Mesh(roundedBox(4, 2.6, 0.5, 0.12), mat); body.castShadow = true; body.receiveShadow = true; g.add(body);
    for (let i = -1; i <= 1; i++) {
      const plank = new THREE.Mesh(roundedBox(4.06, 0.1, 0.54, 0.04), MAT.log); plank.position.y = i * 0.8; g.add(plank);
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

  // Верстак: стол с пилой и молотком
  function addBench(x, z, rot) {
    const g = new THREE.Group();
    g.position.set(x, getHeight(x, z), z);
    g.rotation.y = rot;
    const plank = lam(0xa0703f), dark = lam(0x5e3c22), metal = new THREE.MeshPhongMaterial({ color: 0xaab2ba, shininess: 80 });
    const part = (mat, sx, sy, sz, px, py, pz, ry) => {
      const m = new THREE.Mesh(roundedBox(sx, sy, sz, Math.min(sx, sy, sz) * 0.35), mat);
      m.position.set(px, py, pz); m.rotation.y = ry || 0;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    };
    part(plank, 1.6, 0.12, 0.85, 0, 0.84, 0);
    for (const [lx, lz] of [[-0.7, -0.33], [0.7, -0.33], [-0.7, 0.33], [0.7, 0.33]]) part(dark, 0.1, 0.8, 0.1, lx, 0.4, lz);
    part(dark, 1.4, 0.06, 0.7, 0, 0.25, 0);
    part(metal, 0.5, 0.02, 0.14, 0.3, 0.91, 0.12, 0.3);
    part(dark, 0.06, 0.05, 0.34, -0.42, 0.93, -0.1, -0.5);
    part(metal, 0.16, 0.08, 0.08, -0.5, 0.94, 0.04, -0.5);
    surface.add(g);
    benches.push({ x, z, rot, mesh: g });
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
      const log = new THREE.Mesh(GEO.log, MAT.log);
      log.position.y = 0.16; log.rotation.set(Math.PI / 2, a, 0, 'YXZ');
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
  const caveWallMat = lam(0xffffff);
  // Бесшовная текстура камня: цвет и карта высот для рельефа (трещины, бугры, вкрапления)
  function vnoiseP(x, z, s, per) {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const w = (v) => ((v % per) + per) % per;
    const a = hash2(w(ix), w(iz), s), b = hash2(w(ix + 1), w(iz), s), c = hash2(w(ix), w(iz + 1), s), d = hash2(w(ix + 1), w(iz + 1), s);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }
  function fbmP(u, v, s, base, oct) {
    let sum = 0, amp = 0.5, norm = 0, per = base;
    for (let i = 0; i < oct; i++) { sum += amp * vnoiseP(u * per, v * per, s + i * 31, per); norm += amp; amp *= 0.5; per *= 2; }
    return sum / norm;
  }
  function rockTextures(size, seed) {
    const ca = document.createElement('canvas'), ch = document.createElement('canvas');
    ca.width = ca.height = ch.width = ch.height = size;
    const ga = ca.getContext('2d'), gh = ch.getContext('2d');
    const ia = ga.createImageData(size, size), ih = gh.createImageData(size, size);
    const dark = new THREE.Color(0x2e2925), mid = new THREE.Color(0x6e6359), light = new THREE.Color(0xa59a8c), c = new THREE.Color();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const base = fbmP(u, v, seed, 4, 6);
      const ridge = 1 - Math.abs(fbmP(u, v, seed + 7, 3, 4) * 2 - 1);
      const crack = smoothstep(0.95, 0.995, ridge);
      const grain = vnoiseP(u * 64, v * 64, seed + 9, 64);
      const hgt = fbmP(u, v, seed, 4, 4);
      c.copy(dark).lerp(mid, smoothstep(0.25, 0.6, base)).lerp(light, smoothstep(0.62, 0.85, base) * 0.7);
      c.multiplyScalar((1 - crack * 0.25) * (0.85 + grain * 0.3));
      if (hash2(x, y, seed + 13) > 0.995) c.lerp(light, 0.6);
      const i = (y * size + x) * 4;
      ia.data[i] = clamp(c.r * 255, 0, 255); ia.data[i + 1] = clamp(c.g * 255, 0, 255); ia.data[i + 2] = clamp(c.b * 255, 0, 255); ia.data[i + 3] = 255;
      ih.data[i] = ih.data[i + 1] = ih.data[i + 2] = Math.round(hgt * 255); ih.data[i + 3] = 255;
    }
    ga.putImageData(ia, 0, 0); gh.putImageData(ih, 0, 0);
    const ta = new THREE.CanvasTexture(ca), th = new THREE.CanvasTexture(ch);
    for (const t of [ta, th]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
    return { albedo: ta, height: th };
  }
  // Камень без растяжения на стенах: текстура проецируется с трёх сторон, рельеф даёт объём при свете фонаря
  function rockMaterial(tex, scale, bump, vertexColors) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors, roughness: 0.93, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.tAlb = { value: tex.albedo };
      sh.uniforms.tHgt = { value: tex.height };
      sh.uniforms.uScale = { value: scale };
      sh.uniforms.uBump = { value: bump };
      sh.vertexShader = 'varying vec3 vWPos;\nvarying vec3 vWNorm;\n' + sh.vertexShader.replace('#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n' +
        '#ifdef USE_INSTANCING\n vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n vWNorm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);\n' +
        '#else\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n vWNorm = normalize(mat3(modelMatrix) * objectNormal);\n#endif');
      sh.fragmentShader = [
        'uniform sampler2D tAlb; uniform sampler2D tHgt; uniform float uScale; uniform float uBump;',
        'varying vec3 vWPos; varying vec3 vWNorm;',
        'vec4 triSample(sampler2D t) {',
        '  vec3 w = pow(abs(normalize(vWNorm)), vec3(4.0)); w /= (w.x + w.y + w.z);',
        '  vec3 p = vWPos * uScale;',
        '  return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;',
        '}',
      ].join('\n') + '\n' + sh.fragmentShader
        .replace('#include <map_fragment>', 'diffuseColor.rgb *= triSample(tAlb).rgb * 1.6;')
        .replace('#include <normal_fragment_maps>', [
          '#include <normal_fragment_maps>',
          '{',
          '  float hgt = triSample(tHgt).r;',
          '  vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);',
          '  vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);',
          '  float det = dot(dpx, r1);',
          '  vec3 grad = sign(det) * (dFdx(hgt) * r1 + dFdy(hgt) * r2) * uBump;',
          '  normal = normalize(abs(det) * normal - grad);',
          '}',
        ].join('\n'));
    };
    return mat;
  }
  let caveRock = null; // материалы пещеры создаются при первом входе, чтобы не замедлять запуск
  function caveMaterials() {
    if (caveRock) return caveRock;
    const tex = rockTextures(256, 77);
    caveRock = {
      rock: rockMaterial(tex, 0.2, 0.45, true),
      boulder: rockMaterial(tex, 0.4, 0.35, false),
      ore: rockMaterial(tex, 0.4, 0.35, false),
      puddle: new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.62, depthWrite: false }),
      glow: new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
    caveRock.ore.color.setHex(0x6e665f);
    return caveRock;
  }
  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.3)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // Пыль, летающая в свете фонаря
  const dust = (function () {
    const n = 260, pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffe2b8, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    pts.visible = false;
    scene.add(pts);
    const seeds = Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random(), Math.random() * TAU]);
    return {
      update(t) {
        pts.visible = !!inCave;
        if (!inCave) return;
        for (let i = 0; i < n; i++) {
          const [a, b, c, ph] = seeds[i], R = 9;
          const wrap = (v) => ((v % (2 * R)) + 2 * R) % (2 * R) - R;
          pos[i * 3] = P.x + wrap(a * 2 * R + Math.sin(t * 0.2 + ph) * 1.5 + t * 0.15 - P.x);
          pos[i * 3 + 1] = CAVE.y + 0.3 + ((b * 5 + t * 0.05 * (0.5 + c)) % 5);
          pos[i * 3 + 2] = P.z + wrap(c * 2 * R + Math.cos(t * 0.17 + ph) * 1.5 - P.z);
        }
        geo.attributes.position.needsUpdate = true;
      },
    };
  })();
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
    const data = { index, grid: gen.grid, resources: [], solids: [], puddles: null, exit: { x: caveCenter(gen.entry.c), z: caveCenter(gen.entry.r) }, flow: null, flowCell: -1, map: null };

    const isWall = (r, c) => c < 0 || r < 0 || c >= n || r >= n || gen.grid[r * n + c] === 1;
    const shade = (hex) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, (rng() - 0.5) * 0.12); return c; };

    // Пол и стены — одна сплошная неровная скала: там, где клетка-стена, поверхность поднимается до потолка
    const M = caveMaterials();
    const wallness = (x, z) => {
      const fc = x / C + n / 2 - 0.5, fr = z / C + n / 2 - 0.5;
      const c0 = Math.floor(fc), r0 = Math.floor(fr), tx = fc - c0, tz = fr - r0;
      const v = (r, c) => (isWall(r, c) ? 1 : 0);
      return lerp(lerp(v(r0, c0), v(r0, c0 + 1), tx), lerp(v(r0 + 1, c0), v(r0 + 1, c0 + 1), tx), tz);
    };
    const seed = 500 + index * 7;
    const SUB = 4, border = 4, size = (n + border * 2) * C;
    const rockGeo = new THREE.PlaneGeometry(size, size, (n + border * 2) * SUB, (n + border * 2) * SUB);
    rockGeo.rotateX(-Math.PI / 2);
    const pos = rockGeo.attributes.position, colors = new Float32Array(pos.count * 3);
    const rockSeg = (n + border * 2) * SUB, rockH = new Float32Array(pos.count);
    data.rock = { h: rockH, seg: rockSeg, step: size / rockSeg, half: size / 2 };
    const floorAt = (x, z) => Y + rockHeightAt(data.rock, x, z);
    const PUDDLE_LEVEL = -0.2;
    const puddleSpots = [];
    {
      const prng = mulberry32(seed + 99), open = [];
      for (let r = 2; r < n - 2; r++) for (let c = 2; c < n - 2; c++) {
        let solid = false;
        for (let dr = -1; dr <= 1 && !solid; dr++) for (let dc = -1; dc <= 1; dc++) if (isWall(r + dr, c + dc)) { solid = true; break; }
        if (!solid && Math.hypot(c - gen.entry.c, r - gen.entry.r) > 6) open.push([r, c]);
      }
      for (let i = 0; i < 10 && open.length; i++) {
        const [r, c] = open.splice(Math.floor(prng() * open.length), 1)[0];
        puddleSpots.push({ x: caveCenter(c) + (prng() - 0.5), z: caveCenter(r) + (prng() - 0.5), r: 0.7 + prng() * 0.7 });
      }
    }
    const floorCol = new THREE.Color(0x8c8278), wallCol = new THREE.Color(0xb0a596), topCol = new THREE.Color(0x6a6058), wetCol = new THREE.Color(0x5c544e), col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      // Скала начинается чуть дальше границы клетки, поэтому игрок не может зайти в неё
      const w = clamp(wallness(x, z) + (fbm(x * 0.35, z * 0.35, seed, 3) - 0.5) * 0.25, 0, 1);
      const k = smoothstep(0.52, 0.82, w);
      let floorBump = (fbm(x * 0.4, z * 0.4, seed + 1, 3) - 0.5) * 0.7 + Math.max(0, vnoise(x * 1.3, z * 1.3, seed + 8) - 0.8) * 1.4;
      for (const pd of puddleSpots) {
        const d = Math.hypot(x - pd.x, z - pd.z);
        if (d < pd.r + 0.8) floorBump = lerp(PUDDLE_LEVEL, floorBump, smoothstep(pd.r * 0.8, pd.r + 0.8, d));
      }
      const wallH = CAVE.ceil + 0.8 + (fbm(x * 0.25, z * 0.25, seed + 2, 3) - 0.3) * 2.5;
      const hgt = k * wallH + floorBump * (1 - k);
      pos.setY(i, hgt);
      rockH[i] = hgt;
      col.copy(floorCol).lerp(wallCol, smoothstep(0.08, 0.45, k)).lerp(topCol, smoothstep(0.6, 1, k));
      if (k < 0.1 && floorBump < -0.15) col.lerp(wetCol, 0.6);
      col.multiplyScalar(0.8 + fbm(x * 0.15, z * 0.15, seed + 4, 2) * 0.4);
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    rockGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    rockGeo.computeVertexNormals();
    const rock = new THREE.Mesh(rockGeo, M.rock);
    rock.position.y = Y;
    rock.userData.ownGeometry = true;
    caveGroup.add(rock);

    // Бугристый потолок
    const ceilGeo = new THREE.PlaneGeometry(size, size, (n + border * 2) * 2, (n + border * 2) * 2);
    ceilGeo.rotateX(Math.PI / 2);
    const cp = ceilGeo.attributes.position, cc = new Float32Array(cp.count * 3);
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), z = cp.getZ(i);
      cp.setY(i, CAVE.ceil - fbm(x * 0.18, z * 0.18, seed + 11, 4) * 2.2);
      const v = 0.45 + vnoise(x * 0.2, z * 0.2, seed + 12) * 0.25;
      cc[i * 3] = v; cc[i * 3 + 1] = v * 0.94; cc[i * 3 + 2] = v * 0.88;
    }
    ceilGeo.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    ceilGeo.computeVertexNormals();
    const ceiling = new THREE.Mesh(ceilGeo, M.rock);
    ceiling.position.y = Y;
    ceiling.userData.ownGeometry = true;
    caveGroup.add(ceiling);

    // Сталагмиты, сталактиты, щебень и лужи
    const spikeBatch = new Batch(GEO.cone, M.boulder, { colored: true });
    const rubbleBatch = new Batch(GEO.rock, M.boulder, { colored: true });
    const tone = () => { const v = 0.45 + rng() * 0.25; return new THREE.Color(v, v * 0.95, v * 0.9); };
    const edgeFloors = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (isWall(r, c)) continue;
      const x = caveCenter(c), z = caveCenter(r);
      let adj = 0;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) adj += isWall(r + dr, c + dc) ? 1 : 0;
      const nearEntry = Math.hypot(c - gen.entry.c, r - gen.entry.r) <= 5;
      if (adj > 0 && !nearEntry) edgeFloors.push({ r, c, x, z });
      if (adj > 0 && !nearEntry && rng() < 0.16) {
        const sx = x + (rng() - 0.5) * 1.4, sz = z + (rng() - 0.5) * 1.4, sr = 0.22 + rng() * 0.2;
        spikeBatch.add(matrixOf(sx, floorAt(sx, sz) - 0.2, sz, sr, 0.9 + rng() * 1.8, sr, rng() * 3), tone());
        data.solids.push({ x: sx, z: sz, r: sr + 0.05 });
      }
      if (rng() < 0.09) spikeBatch.add(matrixOf(x + (rng() - 0.5) * 1.8, Y + CAVE.ceil - 0.6, z + (rng() - 0.5) * 1.8, 0.2 + rng() * 0.25, 1 + rng() * 2.2, 0.2 + rng() * 0.25, rng() * 3, Math.PI), tone());
      const pebbles = adj > 0 ? 3 : rng() < 0.3 ? 1 : 0;
      for (let k = 0; k < pebbles; k++) {
        const sc = 0.08 + rng() * (adj > 0 ? 0.35 : 0.18);
        const rx = x + (rng() - 0.5) * 2.4, rz = z + (rng() - 0.5) * 2.4;
        rubbleBatch.add(matrixOf(rx, floorAt(rx, rz) + sc * 0.15, rz, sc, sc * 0.7, sc * (0.8 + rng() * 0.4), rng() * TAU, rng(), rng()), tone());
      }
    }
    // Вода лежит в ямке ровно, края прячутся в полу
    data.puddles = puddleSpots;
    for (const spot of puddleSpots) {
      const pd = new THREE.Mesh(new THREE.CircleGeometry(spot.r, 24), M.puddle);
      pd.rotation.x = -Math.PI / 2;
      pd.position.set(spot.x, Y + PUDDLE_LEVEL + 0.06, spot.z);
      pd.userData.ownGeometry = true;
      caveGroup.add(pd);
    }
    if (spikeBatch.items.length) spikeBatch.build(caveGroup);
    if (rubbleBatch.items.length) rubbleBatch.build(caveGroup);

    // Железо и кристаллы у стен
    for (let i = edgeFloors.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [edgeFloors[i], edgeFloors[j]] = [edgeFloors[j], edgeFloors[i]]; }
    const picks = edgeFloors.slice(0, 30);
    picks.forEach((p, i) => {
      const type = i < 17 ? 'iron' : 'crystal';
      const g = new THREE.Group();
      g.position.set(p.x, floorAt(p.x, p.z), p.z);
      if (type === 'iron') {
        const rock = new THREE.Mesh(GEO.rock, M.ore);
        rock.scale.set(0.9, 0.7, 0.85); rock.position.y = 0.22; rock.rotation.set(rng(), rng() * 3, 0);
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
          cr.position.set((rng() - 0.5) * 0.7, -1.8, (rng() - 0.5) * 0.7);
          cr.rotation.set((rng() - 0.5) * 0.7, rng() * 3, (rng() - 0.5) * 0.7);
          g.add(cr);
        }
        const glow = new THREE.Sprite(M.glow.clone());
        glow.material.color.copy(mat.color);
        glow.material.opacity = 0.55;
        glow.scale.setScalar(3.2);
        glow.position.y = 0.9;
        g.add(glow);
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
      toast('Чтобы выйти, зайди в столб света', 'item');
      if (!P.lantern) toast('Здесь темно. Фонарь делается из кристаллов', 'warn');
    });
  }

  function leaveCave(silent) {
    const go = () => {
      for (let i = zombies.length - 1; i >= 0; i--) if (zombies[i].cave) { scene.remove(zombies[i].h.g, zombies[i].bar.g); zombies.splice(i, 1); }
      for (let i = drops.length - 1; i >= 0; i--) if (drops[i].cave) { if (drops[i].mesh.parent) drops[i].mesh.parent.remove(drops[i].mesh); drops.splice(i, 1); }
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
    const h = makeHuman(inCaveZombie ? CAVE_ZOMBIE_MATS : ZOMBIE_MATS, 'zombie');
    for (const ex of [-0.095, 0.095]) {
      const eye = new THREE.Mesh(roundedBox(0.09, 0.07, 0.03, 0.015), inCaveZombie ? MAT.caveEye : MAT.eye);
      eye.position.set(ex, 0.04, 0.224);
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
          if (z.cave) tryMove(z, dx / dd * sp, dz / dd * sp, z.y);
          else { z.x += dx / dd * sp; z.z += dz / dd * sp; }
          moving = true;
        } else if (z.atkCd <= 0) {
          z.atkCd = Z.cd;
          hurtPlayer(z.dmg, z);
        }
        z.face = lerpAngle(z.face, Math.atan2(dx, dz), 1 - Math.exp(-dt * 8));
        z.groanT -= dt;
        if (z.groanT <= 0) { z.groanT = rand(4, 10); if (d < 28) Sound.play('groan', 1 - d / 28); }
      }
      if (z.cave) tryMove(z, z.kx * dt, z.kz * dt, z.y);
      else { z.x += z.kx * dt; z.z += z.kz * dt; }
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
      scene.background.setRGB(0.008, 0.007, 0.006);
      scene.fog.near = 3; scene.fog.far = P.lantern ? 40 : 24;
      hemi.intensity = P.lantern ? 0.16 : 0.12; hemi.color.setHex(0x9a8f86); hemi.groundColor.setHex(0x1c1814);
      sun.intensity = 0;
      const flicker = 1 + Math.sin(W.clock * 13) * 0.04 + Math.sin(W.clock * 7.3) * 0.05;
      playerLight.decay = 1.4;
      playerLight.intensity = (P.lantern ? 3.4 : 1.9) * flicker;
      playerLight.distance = P.lantern ? 30 : 16;
      playerLight.color.setHex(P.lantern ? 0xfff0dc : 0xffd2a8);
      playerLight.position.set(P.x + Math.sin(P.face) * 0.6, P.y + 2.3, P.z + Math.cos(P.face) * 0.6);
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
    scene.fog.near = lerp(14, 120, dl);
    scene.fog.far = lerp(90, VIEW[settings.quality] || 380, dl);
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
    playerLight.decay = 1;
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
      const busy = P.anim && /^(eat|drink|fill|pick)$/.test(P.anim.name);
      const speed = CFG.playerSpeed * (P.swimming ? CFG.swimSpeed : shallow ? 0.8 : 1) * (busy ? 0.35 : 1);
      tryMove(P, mx * speed * dt, mz * speed * dt, P.y);
      P.face = lerpAngle(P.face, Math.atan2(mx, mz), 1 - Math.exp(-dt * 12));
      P.walk += dt * speed * 2 * amt * (P.swimming ? 0.6 : 1);
    }
    P.walkAmt = lerp(P.walkAmt, amt > 0.08 ? amt : 0, 1 - Math.exp(-dt * 10));
    for (const z of zombies) if (!z.dead && !z.burn && !!z.cave === !!inCave) pushFromCircle(P, z.x, z.z, z.r);
    collide(P);

    P.caveCd = Math.max(0, P.caveCd - dt);
    if (P.caveCd <= 0) {
      const door = caveDoorAt();
      if (door) { P.caveCd = 2; enterCave(door); }
      else if (atCaveExit()) { P.caveCd = 2; leaveCave(false); }
    }

    // Высота: земля, прыжок или поверхность воды
    const g = groundY(P.x, P.z);
    if (jumpQueued) {
      jumpQueued = false;
      if (P.grounded && !P.swimming && P.jumpPrep <= 0) P.jumpPrep = 0.09; // короткое приседание перед прыжком
      else if (P.swimming) { P.vy = 3.2; Sound.play('step', 'swim'); }
    }
    if (P.jumpPrep > 0) {
      P.jumpPrep -= dt;
      if (P.jumpPrep <= 0 && P.grounded) { P.vy = CFG.jumpSpeed; P.grounded = false; Sound.play('jump'); }
    }
    P.landT = Math.max(0, P.landT - dt);
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
        if (!P.grounded && P.vy < -3) P.landT = 0.24;
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

    updateAnim(dt);
    P.actCd -= dt;
    const tapped = tapAt > 0 && performance.now() - tapAt < 450;
    if (tapAt > 0 && !tapped) tapAt = -1;
    if ((actionHeld || tapped) && P.actCd <= 0) { tapAt = -1; doAction(); }
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
  let camFrac = 1, camBlend = 0;
  function cameraBlocked(x, y, z) {
    if (y < getHeight(x, z) + 0.35) return true;
    let hit = false;
    gridEach(x, z, 3, (o) => {
      if (hit || !o.active || !o.crown) return;
      const d = Math.hypot(o.x - x, o.z - z);
      if (y > o.crown.y0 && y < o.crown.y1 && d < o.crown.r * 0.85) hit = true;
      else if (y <= o.crown.y0 && d < 0.6) hit = true;
    });
    return hit;
  }
  function updateCamera(dt, snap, orbit) {
    const dist = orbit ? 24 : inCave ? Math.min(settings.dist, 8) : settings.dist;
    const pitch = orbit ? 0.3 : inCave ? Math.min(camPitch, 0.7) : camPitch;
    const lookY = P.y + 1.3;
    const horiz = Math.cos(pitch) * dist;
    let tx = P.x + Math.sin(camYaw) * horiz, tz = P.z + Math.cos(camYaw) * horiz;
    let ty = lookY + Math.sin(pitch) * dist;
    if (!inCave) {
      ty = Math.max(ty, getHeight(tx, tz) + 0.7, WATER + 0.4);
      if (!orbit) {
        // Если между игроком и камерой дерево или склон — камера подъезжает ближе, а потом плавно отъезжает
        let frac = 1;
        const steps = 22;
        for (let i = 2; i <= steps; i++) {
          const t = i / steps, px = P.x + (tx - P.x) * t, pz = P.z + (tz - P.z) * t, py = lookY + (ty - lookY) * t;
          if (cameraBlocked(px, py, pz)) { frac = Math.max(0.12, (i - 1.5) / steps); break; }
        }
        camFrac = frac < camFrac || snap ? frac : lerp(camFrac, frac, 1 - Math.exp(-dt * 2.5));
        tx = P.x + (tx - P.x) * camFrac; tz = P.z + (tz - P.z) * camFrac; ty = lookY + (ty - lookY) * camFrac;
      }
    } else if (cave) {
      // Камера не залезает в скалу и не поднимается выше потолка
      ty = clamp(ty, CAVE.y + 0.6, CAVE.y + CAVE.ceil - 0.8);
      const steps = 28;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, px = P.x + (tx - P.x) * t, pz = P.z + (tz - P.z) * t;
        const py = lookY + (ty - lookY) * t;
        if (caveRockH(px, pz) > py - CAVE.y - 0.35) {
          const t2 = Math.max(0.08, (i - 2) / steps);
          tx = P.x + (tx - P.x) * t2; tz = P.z + (tz - P.z) * t2; ty = lookY + (ty - lookY) * t2;
          break;
        }
      }
    }
    camBlend = Math.max(0, camBlend - dt);
    const k = snap ? 1 : 1 - Math.exp(-dt * (camBlend > 0 ? 2.2 : 14));
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
      for (const b of benches) {
        const bx = S / 2 + ((b.x - P.x) / view) * S, bz = S / 2 + ((b.z - P.z) / view) * S;
        mmCtx.fillStyle = '#a0703f'; mmCtx.fillRect(bx - 4, bz - 4, 8, 8);
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
    kills: $('kills'), bagCount: $('bagCount'),
    actLabel: $('actLabel'), actHint: $('actHint'), flaskCount: $('flaskCount'), eatCount: $('eatCount'), craft: $('btnCraft'), vignette: $('vignette'), mapLabel: $('mapLabel'),
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
    setText(hud.kills, P.kills);
    setText(hud.eatCount, invCount('berry'));
    setText(hud.bagCount, usedSlots() + '/' + CFG.bag.slots);
    if (bagOpen && bagDirty) renderBag();
    const ctx = P.dead ? { label: '—', idle: true } : context();
    setText(hud.actLabel, ctx.label);
    hud.actHint.hidden = !!ctx.idle;
    hud.craft.classList.toggle('ready', RECIPES.some((r) => canAfford(r.cost) && !owned(r.id) && canCraftHere(r)));
    setText(hud.flaskCount, P.flask);
    updateCraftSheet();
  }

  // ==================================================================
  // Экраны: меню, пауза, настройки, рекорды
  // ==================================================================
  const OVERLAYS = ['menu', 'how', 'records', 'settings', 'pause', 'dead'];
  let panelReturn = 'menu';
  let wakeLock = null;

  function showScreen(name) {
    if (name === 'pause' && screen !== 'game' && screen !== 'pause') return;
    if (screen === 'game' && name !== 'game') { releaseAllInput(); toggleCraft(false); toggleBag(false); persist(); }
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
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => {
    if (b.closest('#settings')) { writeJson(KEYS.settings, settings); applySettings(); }
    showScreen(panelReturn);
  }));

  function refreshMenu() {
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
    Intro.start();
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
    $('setAuto').checked = !!settings.autoQuality;
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
  $('setAuto').addEventListener('change', (e) => changeSetting('autoQuality', e.target.checked));
  document.querySelectorAll('#setQuality button').forEach((b) => b.addEventListener('click', () => changeSetting('quality', b.dataset.q)));

  function requestWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    navigator.wakeLock.request('screen').then((lock) => {
      wakeLock = lock;
      lock.addEventListener('release', () => { wakeLock = null; });
    }).catch(() => { /* экран может погаснуть, это не страшно */ });
  }

  // ==================================================================
  // Автоподстройка: если кадров мало, по шагу снижаем качество графики
  // ==================================================================
  const Perf = (function () {
    let acc = 0, frames = 0, cooldown = 6;
    return {
      sample(dt) {
        if (screen !== 'game' || !settings.autoQuality) { acc = 0; frames = 0; return; }
        cooldown -= dt;
        acc += dt; frames++;
        if (acc < 4) return;
        const fps = frames / acc;
        acc = 0; frames = 0;
        if (fps >= 34 || cooldown > 0) return;
        cooldown = 10;
        if (settings.quality === 'high') settings.quality = 'mid';
        else if (settings.quality === 'mid') settings.quality = 'low';
        else if (settings.shadows) settings.shadows = false;
        else return;
        writeJson(KEYS.settings, settings);
        applySettings();
        toast('Графика снижена для плавности', 'item');
      },
    };
  })();

  // ==================================================================
  // Вступительная сцена: предыстория, рация, пробуждение у потухшего костра
  // ==================================================================
  const Intro = (function () {
    // shot: план камеры; pose: 0 — лежит, 1 — сидит с рацией, 2 — стоит
    const LINES = [
      { shot: 'aerial', who: '', text: 'Три недели назад с гор спустился туман.', title: true },
      { shot: 'aerial', who: '', text: 'Он был тёплым и пах дождём. Никто не испугался.' },
      { shot: 'forest', who: '', text: 'А потом те, кто его вдохнул, перестали спать. И перестали быть людьми.' },
      { shot: 'forest', who: '', text: 'Днём они прячутся в лесах и пещерах. Ночью выходят на охоту.' },
      { shot: 'wake', who: 'Рация', text: '…кшш… Приём. Кто-нибудь меня слышит?', radio: true, pose: 0 },
      { shot: 'wake', who: 'Рация', text: 'Это Вера, лагерь «Рассвет». Если ты жив — ответь.', radio: true, pose: 0 },
      { shot: 'sit', who: 'Ты', text: 'Голова раскалывается… Где я?', pose: 1 },
      { shot: 'sit', who: 'Вера', text: 'Ты в долине. Ты один пережил ночь у этого костра. Слушай внимательно.', radio: true, pose: 1 },
      { shot: 'sit', who: 'Вера', text: 'Собери дерево и камень. Поставь верстак и сделай топор и оружие.', radio: true, pose: 1 },
      { shot: 'sit', who: 'Вера', text: 'Набери воды во флягу, ешь ягоды с кустов. Огонь их отпугивает.', radio: true, pose: 1 },
      { shot: 'stand', who: 'Вера', text: 'Каждую ночь их будет больше. Продержись, мы тебя найдём… кшш…', radio: true, pose: 2 },
      { shot: 'stand', who: 'Ты', text: 'Ладно. Сначала — укрытие и оружие.', pose: 2 },
    ];
    const SHOTS = {
      // [смещение камеры в начале, в конце, куда смотрит, высота взгляда, час суток]
      aerial: { from: [-130, 75, 170], to: [-50, 42, 70], look: [0, 4, 0], hour: 17.35, abs: true, fog: [160, 900] },
      forest: { from: [0, 0, 0], to: [0, 0, 0], hour: 17.7, forest: true, fog: [45, 260] },
      wake: { from: [2.6, 1.9, 2.3], to: [1.5, 1.05, 1.3], look: [0, 0.4, -0.2] },
      sit: { from: [1.7, 1.25, 2.5], to: [-1.3, 1.2, 2.4], look: [0, 0.85, 0] },
      stand: { from: [-2.6, 2.1, 3.8], to: [-1.4, 2.4, -5.5], look: [0, 1.4, 0] },
    };
    const el = {
      root: $('intro'), who: $('introWho'), text: $('introText'), next: $('introNext'), title: $('introTitle'), skip: $('introSkip'),
    };
    let i = 0, shot = null, shotT = 0, shotLen = 1, chars = 0, lineT = 0, done = false, stage = 0, stageTarget = 0;
    let group = null, props = null, extras = [];

    function buildProps() {
      group = new THREE.Group();
      surface.add(group);
      const gy = (x, z) => getHeight(x, z);
      // Потухший костёр
      const fire = new THREE.Group();
      const fx = P.x + 1.5, fz = P.z + 0.6;
      fire.position.set(fx, gy(fx, fz), fz);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU, st = new THREE.Mesh(GEO.rock, MAT.rockStatic);
        st.scale.setScalar(0.2); st.position.set(Math.cos(a) * 0.6, 0.1, Math.sin(a) * 0.6); st.castShadow = true; fire.add(st);
      }
      const coal = std(0x1c1714);
      for (const a of [0.5, -0.7, 2.0]) {
        const log = new THREE.Mesh(GEO.log, coal); log.position.y = 0.12; log.rotation.set(Math.PI / 2, a, 0, 'YXZ'); fire.add(log);
      }
      const ash = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), std(0x55504a));
      ash.rotation.x = -Math.PI / 2; ash.position.y = 0.02; fire.add(ash);
      group.add(fire);
      // Дымок над костром
      const smokeMat = new THREE.MeshBasicMaterial({ color: 0x9a9690, transparent: true, opacity: 0.25, depthWrite: false });
      const puffs = [];
      for (let k = 0; k < 7; k++) {
        const m = new THREE.Mesh(GEO.blob, smokeMat.clone()); m.userData.ph = k / 7; fire.add(m); puffs.push(m);
      }
      // Рация: на земле, в руке и потом на поясе
      const radioMesh = () => {
        const r = new THREE.Group();
        const body = new THREE.Mesh(roundedBox(0.14, 0.24, 0.07, 0.025), std(0x3c4a34)); r.add(body);
        const grill = new THREE.Mesh(roundedBox(0.1, 0.07, 0.02, 0.008), std(0x1c1f1a)); grill.position.set(0, 0.04, 0.035); r.add(grill);
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.22, 6), std(0x1a1a1a)); ant.position.set(0.04, 0.22, 0); r.add(ant);
        const led = new THREE.Mesh(roundedBox(0.025, 0.02, 0.01, 0.004), new THREE.MeshBasicMaterial({ color: 0x9cff6a })); led.position.set(-0.04, 0.09, 0.037); r.add(led);
        r.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        return r;
      };
      const ground = radioMesh();
      const rx = P.x - 0.75, rz = P.z + 0.2;
      ground.position.set(rx, gy(rx, rz) + 0.04, rz); ground.rotation.set(-Math.PI / 2, 0, 0.7);
      group.add(ground);
      const inHand = radioMesh(); inHand.position.set(0, -0.06, 0.06); inHand.rotation.x = -1.2; inHand.visible = false; handR.add(inHand);
      const onBelt = radioMesh(); onBelt.position.set(0.35, 0.02, 0.06); onBelt.scale.setScalar(0.8); onBelt.visible = false; hero.upper.add(onBelt);
      // Силуэты тварей в вечернем лесу
      const zx = P.x + 34, zz = P.z + 18;
      for (let k = 0; k < 3; k++) {
        const z = makeHuman(ZOMBIE_MATS, 'zombie');
        for (const ex of [-0.095, 0.095]) { const eye = new THREE.Mesh(roundedBox(0.09, 0.07, 0.03, 0.015), MAT.eye); eye.position.set(ex, 0.04, 0.224); z.head.add(eye); }
        const x = zx + k * 2.4, zq = zz + (k - 1) * 1.6;
        z.g.position.set(x, gy(x, zq), zq);
        z.g.rotation.y = -2.3;
        group.add(z.g);
        extras.push({ h: z, x, z: zq, ph: k * 1.3 });
      }
      props = { fire, puffs, ground, inHand, onBelt, zx, zz };
    }

    function start() {
      done = false; i = 0; stage = 0; stageTarget = 0; extras = [];
      buildProps();
      P.face = 0;
      screen = 'intro';
      for (const id of OVERLAYS) $(id).hidden = true;
      hud.root.hidden = true;
      el.root.hidden = false;
      el.root.classList.remove('out');
      requestAnimationFrame(() => el.root.classList.add('on'));
      Sound.play('whoosh');
      showLine(0, true);
    }

    function showLine(n, first) {
      i = n;
      const L = LINES[i];
      if (L.shot !== (shot && shot.name)) {
        const change = () => { shot = Object.assign({ name: L.shot }, SHOTS[L.shot]); shotT = 0; shotLen = LINES.filter((x) => x.shot === L.shot).length * 4.2; };
        if (first || !shot) change();
        else { const f = $('fade'); f.classList.add('on'); setTimeout(() => { change(); setTimeout(() => f.classList.remove('on'), 80); }, 330); }
      }
      if (typeof L.pose === 'number') stageTarget = L.pose;
      el.who.textContent = L.who;
      el.who.hidden = !L.who;
      el.text.textContent = '';
      el.next.classList.remove('show');
      el.title.classList.toggle('show', !!L.title);
      chars = 0; lineT = 0;
      if (L.radio) Sound.play('radio');
    }

    function advance() {
      if (done) return;
      const L = LINES[i];
      if (chars < L.text.length) { chars = L.text.length; el.text.textContent = L.text; return; }
      if (i + 1 < LINES.length) showLine(i + 1);
      else finish();
    }

    function finish() {
      if (done) return;
      done = true;
      el.root.classList.add('out');
      el.root.classList.remove('on');
      props.inHand.visible = false;
      props.onBelt.visible = true;
      props.ground.visible = false;
      for (const e of extras) group.remove(e.h.g);
      extras = [];
      hero.g.rotation.x = 0;
      P.face = 0;
      camYaw = Math.PI; camPitch = 0.45;
      camBlend = 1.6;
      setTimeout(() => { el.root.hidden = true; }, 450);
      showScreen('game');
      toast('Подойди к дереву и нажми на экран', 'good');
    }

    function update(dt) {
      if (done) return;
      const L = LINES[i];
      lineT += dt;
      shotT += dt;
      if (chars < L.text.length) {
        chars = Math.min(L.text.length, chars + dt * 38);
        el.text.textContent = L.text.slice(0, Math.floor(chars));
        if (chars >= L.text.length) el.text.textContent = L.text;
      } else {
        el.next.classList.add('show');
        // Сами листаются, если не нажимать
        if (lineT > L.text.length / 38 + 2.6 + L.text.length * 0.025) advance();
      }
      stage += clamp(stageTarget - stage, -dt * 0.9, dt * 0.9);
      // Дым и твари
      for (const m of props.puffs) {
        const t = (W.clock * 0.25 + m.userData.ph) % 1;
        m.position.set(Math.sin(t * 6 + m.userData.ph * 9) * 0.15, 0.3 + t * 2.6, Math.cos(t * 5) * 0.1);
        m.scale.setScalar(0.08 + t * 0.22);
        m.material.opacity = 0.14 * Math.sin(t * Math.PI);
      }
      for (const e of extras) {
        e.ph += dt * 1.6;
        e.x -= Math.sin(2.3) * dt * 0.7; e.z -= Math.cos(2.3) * dt * 0.7;
        const bob = animateHuman(e.h, e.ph, 0.8, true, false);
        e.h.g.position.set(e.x, getHeight(e.x, e.z) + bob, e.z);
      }
      W.clock += dt;
    }

    const POSES = [
      // лежит на спине
      { gx: -Math.PI / 2, dy: 0.42, upperX: 0, legL: 0.05, legR: -0.08, armLx: -0.25, armLz: -0.35, armRx: -0.2, armRz: 0.35, headX: -0.15 },
      // сидит, ноги вытянуты, у уха рация
      { gx: 0, dy: -0.66, upperX: -0.08, legL: -1.5, legR: -1.42, armLx: -0.35, armLz: -0.2, armRx: -2.05, armRz: -0.75, headX: 0.1 },
      // стоит
      { gx: 0, dy: 0, upperX: 0, legL: 0, legR: 0, armLx: 0, armLz: 0, armRx: 0, armRz: 0, headX: 0 },
    ];
    function pose() {
      animateHuman(hero, 0, 0, false, false);
      const a = Math.min(1, Math.floor(stage)), t = smooth(stage - a), A = POSES[a], B = POSES[Math.min(2, a + 1)];
      const v = (k) => A[k] + (B[k] - A[k]) * t;
      hero.g.rotation.x = v('gx');
      hero.upper.rotation.x = v('upperX');
      hero.legL.rotation.x = v('legL'); hero.legR.rotation.x = v('legR');
      hero.armL.rotation.x = v('armLx'); hero.armL.rotation.z = v('armLz');
      hero.armR.rotation.x = v('armRx'); hero.armR.rotation.z = v('armRz');
      hero.head.rotation.x = v('headX');
      // Встаёт с опорой: при подъёме чуть подаётся вперёд
      if (stage > 1 && stage < 2) hero.upper.rotation.x += Math.sin((stage - 1) * Math.PI) * 0.55;
      handR.rotation.x = 0;
      hero.g.position.set(P.x, P.y + v('dy'), P.z);
      const holding = stage > 0.55 && stage < 1.75;
      props.inHand.visible = holding;
      props.ground.visible = stage <= 0.55;
      props.onBelt.visible = stage >= 1.75;
      swordMesh.visible = ironSwordMesh.visible = axeMesh.visible = bottleMesh.visible = berryMesh.visible = false;
    }

    const camFrom = new THREE.Vector3(), camTo = new THREE.Vector3(), camAt = new THREE.Vector3();
    function cameraUpdate() {
      if (!shot) return;
      const t = smooth(clamp(shotT / shotLen, 0, 1));
      if (shot.forest) {
        // Медленный проезд мимо бредущих в сумерках тварей
        const cx = props.zx + 3, cz = props.zz;
        camFrom.set(cx - 9, 0, cz + 10); camTo.set(cx - 2, 0, cz + 7);
        camera.position.lerpVectors(camFrom, camTo, t);
        camera.position.y = getHeight(camera.position.x, camera.position.z) + 1.8;
        camAt.set(cx, getHeight(cx, cz) + 1.3, cz);
      } else if (shot.abs) {
        camFrom.set(P.x + shot.from[0], 0, P.z + shot.from[2]); camTo.set(P.x + shot.to[0], 0, P.z + shot.to[2]);
        camera.position.lerpVectors(camFrom, camTo, t);
        camera.position.y = Math.max(getHeight(camera.position.x, camera.position.z) + 8, lerp(P.y + shot.from[1], P.y + shot.to[1], t));
        camAt.set(P.x + shot.look[0], P.y + shot.look[1], P.z + shot.look[2]);
      } else {
        camFrom.set(P.x + shot.from[0], P.y + shot.from[1], P.z + shot.from[2]);
        camTo.set(P.x + shot.to[0], P.y + shot.to[1], P.z + shot.to[2]);
        camera.position.lerpVectors(camFrom, camTo, t);
        camAt.set(P.x + shot.look[0], P.y + shot.look[1] + (stage > 1 ? (stage - 1) * 0.5 : 0), P.z + shot.look[2]);
      }
      camera.lookAt(camAt);
    }

    function clear() {
      if (group) { surface.remove(group); group = null; }
      if (props) { handR.remove(props.inHand); hero.upper.remove(props.onBelt); props = null; }
      extras = [];
      el.root.hidden = true;
      el.root.classList.remove('on', 'out');
    }

    el.root.addEventListener('pointerup', (e) => { if (!e.target.closest('#introSkip')) advance(); });
    el.skip.addEventListener('click', () => finish());
    return {
      start, update, pose, cameraUpdate, clear, skip: finish, next: advance,
      hour: () => (shot && shot.hour) || hourNow(),
      // Для общих планов туман дальше, чтобы была видна долина
      fog() { if (shot && shot.fog) { scene.fog.near = shot.fog[0]; scene.fog.far = shot.fog[1]; } },
      active: () => screen === 'intro',
    };
  })();

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
    dust.update(windTime.value);
    waterMat.uniforms.uTime.value += dt;
    clouds.position.x = ((windTime.value * 1.6) % 1040) - 520;

    if (screen === 'game' && !craftOpen && !bagOpen) {
      updateClock(dt);
      updateDrops(dt);
      if (!P.dead) { updatePlayer(dt); updateSurvival(dt); }
      updateZombies(dt);
      updateWorldObjects(dt);
      Sound.ambient(dt, inCave ? 'cave' : 'surface', nightK);
    } else if (inMenu) {
      W.clock += dt;
      camYaw += dt * 0.04;
      updateWorldObjects(dt);
    } else if (screen === 'intro') {
      Intro.update(dt);
    }

    hero.g.rotation.y = P.face;
    if (screen === 'intro') {
      Intro.pose();
    } else if (P.dead) {
      P.deadT += dt;
      hero.g.rotation.x = -Math.min(1, P.deadT / 0.5) * Math.PI / 2;
      hero.g.position.set(P.x, P.y + Math.min(1, P.deadT / 0.5) * 0.25, P.z);
    } else {
      hero.g.rotation.x = 0;
      const bob = animateHuman(hero, P.walk, P.walkAmt, false, P.swimming);
      let dy = P.grounded && !P.swimming ? bob : 0;
      if (!P.grounded && !P.swimming) {
        // В полёте: колени подтянуты, руки разведены для равновесия
        const rising = P.vy > 0;
        hero.legL.rotation.x = rising ? -0.95 : -0.45;
        hero.legR.rotation.x = rising ? 0.4 : -0.15;
        hero.armL.rotation.x = rising ? -0.9 : -0.5; hero.armL.rotation.z = -0.6;
        hero.armR.rotation.x = rising ? -0.9 : -0.5; hero.armR.rotation.z = 0.6;
        hero.upper.rotation.x = rising ? 0.12 : -0.06;
      }
      if (P.jumpPrep > 0) {
        dy -= 0.16;
        hero.upper.rotation.x = 0.28;
        hero.legL.rotation.x = hero.legR.rotation.x = -0.45;
        hero.armL.rotation.x = hero.armR.rotation.x = 0.55;
      }
      if (P.landT > 0) {
        // Приземление: пружинит в коленях
        const k = Math.sin((P.landT / 0.24) * Math.PI);
        dy -= 0.18 * k;
        hero.upper.rotation.x += 0.28 * k;
        hero.legL.rotation.x -= 0.35 * k; hero.legR.rotation.x -= 0.35 * k;
        hero.armL.rotation.x -= 0.35 * k; hero.armR.rotation.x -= 0.35 * k;
      }
      applyAnim();
      dy += animPose.dy;
      const fw = forward();
      hero.g.position.set(P.x + fw.x * animPose.lunge, P.y + dy, P.z + fw.z * animPose.lunge);
      refreshEquipment();
    }

    if (screen === 'intro') Intro.cameraUpdate(); else updateCamera(dt, false, inMenu);
    if (!inCave) { cullChunks(dt); stepGrass(screen === 'game' ? 3 : 6); }
    Perf.sample(dt);
    updateLighting(inMenu ? 17.4 : screen === 'intro' ? Intro.hour() : undefined);
    if (screen === 'intro') Intro.fog();
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

  // Отладка для разработки: открой игру с ?debug=1 в адресе
  if (/[?&]debug=1/.test(location.search)) {
    window.__game = {
      P, W, caveEntrances, settings, drops, res: resources, get caveData() { return cave; },
      tp(x, z) { if (inCave) leaveCave(true); P.x = x; P.z = z; P.y = getHeight(x, z) + 2; updateGrass(true); },
      time(t, night) { W.t = t; W.night = !!night; },
      cave(i) { const e = caveEntrances[i || 0]; P.x = e.ix; P.z = e.iz; enterCave(e); },
      give(k, n) { invAdd(k, n); },
      equip(w) { P.weapon = w; refreshEquipment(); },
      anim(name) { playAnim(name); },
      introNext() { Intro.next(); },
      zombie() { spawnZombieAt(P.x + Math.sin(P.face) * 2, P.z + Math.cos(P.face) * 2, !!inCave); },
      get zombies() { return zombies; },
      breakdown() {
        const out = {};
        scene.traverseVisible((o) => {
          if (!o.isMesh) return;
          const g = o.geometry, tri = (g.index ? g.index.count : g.attributes.position.count) / 3, n = o.isInstancedMesh ? o.count : 1;
          const key = (o.isInstancedMesh ? 'inst:' : '') + (g.type || 'geo') + (o.castShadow ? '+shadow' : '');
          out[key] = (out[key] || 0) + Math.round(tri * n);
        });
        return JSON.stringify(Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 12));
      },
      info() { const i = renderer.info.render; return { calls: i.calls, tris: i.triangles }; },
      camDist() { return camera.position.distanceTo(hero.g.position); },
      rockH(x, z) { return inCave ? caveRockH(x, z) : null; },
      pose(name, t) { playAnim(name); P.anim.t = t * P.anim.dur; P.anim.frozen = true; },
      cam(yaw, pitch, dist) { camYaw = yaw; camPitch = pitch; if (dist) settings.dist = dist; },
      state() { return { inCave, x: P.x, z: P.z, y: P.y, swimming: P.swimming, zombies: zombies.length, res: resources.length }; },
    };
  }

  // Даём браузеру показать «Создаём мир…», а потом строим мир
  setTimeout(boot, 30);
})();
