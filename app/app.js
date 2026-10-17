'use strict';
/* Kepr — визуальное банковское приложение. Все деньги и данные вымышленные. */
const KEY = 'kepr-v2';
const NB = ' ';
const D = 86400000;

/* ---------- утилиты ---------- */
const $ = (s, r = document) => r.querySelector(s);
const nf = (d) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n, d = 2) => nf(d).format(n).replace(/ /g, NB) + NB + '₽';
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));
const r2 = (n) => Math.round(n * 100) / 100;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- справочники ---------- */
const CATS = {
  'Супермаркеты': ['🛒', '#2fd06b'], 'Рестораны': ['🍔', '#ff7a18'], 'Транспорт': ['🚕', '#ffdd2d'],
  'Развлечения': ['🎬', '#a855f7'], 'Связь': ['📱', '#3b82f6'], 'Покупки': ['🛍️', '#ec4899'],
  'Здоровье': ['💊', '#14b8a6'], 'Дом': ['🏠', '#60a5fa'], 'Переводы': ['↗️', '#8e8e93'],
  'Пополнение': ['➕', '#2fd06b'], 'Проценты': ['💰', '#ffdd2d'], 'Свои счета': ['🔁', '#8e8e93'], 'Инвестиции': ['📈', '#3b82f6'],
};
const MERCH = [
  ['Пятёрочка', 'Супермаркеты', 300, 2500], ['Перекрёсток', 'Супермаркеты', 500, 4000], ['ВкусВилл', 'Супермаркеты', 300, 2000],
  ['Вкусно — и точка', 'Рестораны', 200, 900], ['Кофемания', 'Рестораны', 300, 1500], ['Яндекс Go', 'Транспорт', 200, 900],
  ['Netflix', 'Развлечения', 799, 799], ['МТС', 'Связь', 500, 500], ['Wildberries', 'Покупки', 500, 6000],
  ['Аптека', 'Здоровье', 200, 2000], ['Метро', 'Транспорт', 60, 120], ['Кинотеатр', 'Развлечения', 400, 1200],
];
const CONTACTS = [
  { n: 'Мама', e: '👩', ph: '+7 900 111-22-33' }, { n: 'Папа', e: '👨', ph: '+7 900 222-33-44' },
  { n: 'Иван Петров', e: '🧑', ph: '+7 911 123-45-67' }, { n: 'Катя', e: '👧', ph: '+7 921 765-43-21' },
  { n: 'Макс', e: '🧔', ph: '+7 931 555-00-11' }, { n: 'Оля', e: '👩‍🦰', ph: '+7 905 777-88-99' },
];
const PAY_CATS = [
  { n: 'Мобильная связь', e: '📱', c: 'Связь', f: 'Номер телефона', ph: '+7' },
  { n: 'Интернет и ТВ', e: '🌐', c: 'Связь', f: 'Номер договора', ph: '' },
  { n: 'ЖКХ', e: '🏠', c: 'Дом', f: 'Лицевой счёт', ph: '' },
  { n: 'Электричество', e: '💡', c: 'Дом', f: 'Номер счётчика', ph: '' },
  { n: 'Штрафы ГИБДД', e: '🚗', c: 'Транспорт', f: 'Номер постановления', ph: '' },
  { n: 'Налоги', e: '🧾', c: 'Дом', f: 'ИНН', ph: '' },
  { n: 'Образование', e: '🎓', c: 'Развлечения', f: 'Номер договора', ph: '' },
  { n: 'Благотворительность', e: '💛', c: 'Переводы', f: 'Фонд', ph: '' },
];
const STORIES = [
  ['🔥', 'Кэшбэк до 30%', 'linear-gradient(135deg,#ff7a18,#af002d)', 'Кэшбэк у партнёров', 'Активируйте предложения во вкладке «Город» и получайте баллы за покупки.'],
  ['💎', 'Премиум', 'linear-gradient(135deg,#3b82f6,#1e3a8a)', 'Kepr Premium', 'Повышенный кэшбэк, бесплатные переводы и личный менеджер. Всё это — виртуально.'],
  ['📈', 'Инвестиции', 'linear-gradient(135deg,#2fd06b,#046c3a)', 'Начните инвестировать', 'Откройте вкладку «Инвестиции» на главной и купите первые акции за виртуальные рубли.'],
  ['✈️', 'Путешествия', 'linear-gradient(135deg,#a855f7,#4c1d95)', 'Путешествуйте выгодно', 'Кэшбэк на билеты и отели. Это демо — отпуск тоже виртуальный.'],
  ['🎁', 'Подарки', 'linear-gradient(135deg,#ec4899,#831843)', 'Пригласите друга', 'Дарите виртуальные бонусы друзьям. Реальных денег здесь нет.'],
];
const OFFERS = [
  { id: 'o1', brand: 'Пятёрочка', pct: 10, cat: 'Супермаркеты', grad: 'linear-gradient(135deg,#ef4444,#7f1d1d)', min: 400, max: 3000 },
  { id: 'o2', brand: 'Яндекс Go', pct: 7, cat: 'Транспорт', grad: 'linear-gradient(135deg,#eab308,#854d0e)', min: 200, max: 900 },
  { id: 'o3', brand: 'Кофемания', pct: 15, cat: 'Рестораны', grad: 'linear-gradient(135deg,#a16207,#451a03)', min: 300, max: 1500 },
  { id: 'o4', brand: 'Кинотеатр', pct: 20, cat: 'Развлечения', grad: 'linear-gradient(135deg,#8b5cf6,#3b0764)', min: 400, max: 1200 },
  { id: 'o5', brand: 'Аптека', pct: 5, cat: 'Здоровье', grad: 'linear-gradient(135deg,#14b8a6,#134e4a)', min: 200, max: 2000 },
];
const STOCKS0 = [
  { t: 'SBER', n: 'Сбербанк', p: 312.4 }, { t: 'YDEX', n: 'Яндекс', p: 4120 }, { t: 'GAZP', n: 'Газпром', p: 168.2 },
  { t: 'LKOH', n: 'Лукойл', p: 7210 }, { t: 'TCSG', n: 'Фин-Групп', p: 3050 }, { t: 'AAPL', n: 'Apple', p: 17800 }, { t: 'TSLA', n: 'Tesla', p: 21500 },
];
const BOT = [
  [/карт|заблок|заморо/i, 'Заморозить карту можно на экране карты: нажмите «Заморозить» — операции будут отклоняться.'],
  [/перевод|отправ/i, 'Переводы доступны на вкладке «Платежи» и кнопкой «Перевести» на главной. Это демо — деньги виртуальные 🙂'],
  [/кэшб|бонус|скидк/i, 'Активируйте предложения во вкладке «Город» — кэшбэк придёт баллами после покупки.'],
  [/инвест|акци|брокер/i, 'Раздел «Инвестиции» открывается с главной. Цены меняются случайно, это симуляция.'],
  [/привет|здравств|добр/i, 'Здравствуйте! Чем могу помочь?'],
  [/спасибо|благодар/i, 'Всегда рады помочь! 💛'],
];

/* ---------- состояние ---------- */
function seed() {
  const r = rng(7), ops = [], now = Date.now();
  for (let i = 0; i < 44; i++) {
    const m = MERCH[Math.floor(r() * MERCH.length)];
    const a = r2(m[2] + r() * (m[3] - m[2]));
    ops.push({ id: uid(), t: m[0], c: m[1], a: -a, d: now - r() * 29 * D, acc: 'black' });
  }
  const t = new Date(); t.setHours(10, 0, 0, 0);
  ops.push({ id: uid(), t: 'Зарплата', c: 'Пополнение', a: 95000, d: t.getTime() - 2 * D, acc: 'black' });
  ops.push({ id: uid(), t: 'Зарплата', c: 'Пополнение', a: 95000, d: t.getTime() - 17 * D, acc: 'black' });
  const prices = {};
  STOCKS0.forEach((s) => {
    let p = s.p; const h = [];
    for (let i = 0; i < 40; i++) { p *= 1 + (r() - 0.5) * 0.03; h.push(r2(p)); }
    prices[s.t] = h;
  });
  return {
    pin: null, accrued: Date.now(), points: 1240, frozen: false,
    acc: [
      { id: 'black', kind: 'card', name: 'Kepr Black', bal: 84250.5, num: '5536 9141 2287 4821', cvv: '372', exp: '09/29' },
      { id: 'save', kind: 'save', name: 'Накопительный счёт', bal: 150000, rate: 16 },
    ],
    ops, notes: [{ id: uid(), t: 'Добро пожаловать в Kepr', s: 'Это демо: все деньги виртуальные.', d: now, unread: true }],
    offers: {}, seen: {}, inv: { cash: 20000, hold: { SBER: 50, YDEX: 2 }, prices }, chat: [{ w: 'in', t: 'Здравствуйте! Я помощник Kepr. Спросите про карты, переводы, кэшбэк или инвестиции.' }],
  };
}
let S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
if (!S || !S.acc) S = seed();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
const acc = (id) => S.acc.find((a) => a.id === id);
const isMonth = (d) => { const a = new Date(d), b = new Date(); return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear(); };

function accrue() {
  const sv = acc('save'), days = Math.floor((Date.now() - S.accrued) / D);
  if (days > 0) {
    const g = r2(sv.bal * sv.rate / 100 / 365 * days);
    if (g > 0) { sv.bal = r2(sv.bal + g); addOp({ t: 'Проценты по накопительному', c: 'Проценты', a: g, acc: 'save' }); }
    S.accrued += days * D;
  }
}
function addOp(o) {
  const op = { id: uid(), d: Date.now(), ...o };
  S.ops.push(op);
  if (!o.silent && o.c !== 'Свои счета') S.notes.unshift({ id: uid(), t: o.a > 0 ? 'Поступление' : 'Операция по карте', s: `${o.t} · ${signed(o.a)}`, d: op.d, unread: true });
  return op;
}
function spend(accId, a) { const x = acc(accId); if (a > x.bal + 1e-9) return false; x.bal = r2(x.bal - a); return true; }

/* ---------- маленькие SVG ---------- */
function donut(data, size = 120) {
  const tot = data.reduce((s, d) => s + d.v, 0) || 1, R = 46, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = data.map((d) => { const len = d.v / tot * C; const s = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${d.c}" stroke-width="14" stroke-dasharray="${Math.max(len - 2, 0)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`; off += len; return s; }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 120"><circle r="${R}" cx="60" cy="60" fill="none" stroke="#2c2c2e" stroke-width="14"/>${arcs}</svg>`;
}
function spark(h, w = 64, ht = 26) {
  const mn = Math.min(...h), mx = Math.max(...h), up = h[h.length - 1] >= h[0];
  const pts = h.map((v, i) => `${(i / (h.length - 1) * w).toFixed(1)},${(ht - (v - mn) / ((mx - mn) || 1) * ht).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${ht}" viewBox="0 0 ${w} ${ht}"><polyline points="${pts}" fill="none" stroke="${up ? '#2fd06b' : '#ff5a5f'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
function chart(h) {
  const w = 340, ht = 150, mn = Math.min(...h), mx = Math.max(...h), up = h[h.length - 1] >= h[0], col = up ? '#2fd06b' : '#ff5a5f';
  const pts = h.map((v, i) => `${(i / (h.length - 1) * w).toFixed(1)},${(ht - 8 - (v - mn) / ((mx - mn) || 1) * (ht - 16)).toFixed(1)}`);
  return `<svg class="chart" viewBox="0 0 ${w} ${ht}" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".35"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><polygon points="0,${ht} ${pts.join(' ')} ${w},${ht}" fill="url(#g)"/><polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

/* ---------- роутер страниц ---------- */
const pages = [];
const actions = {};
let tab = 'home';
function toast(m, err) { const t = $('#toast'); t.textContent = m; t.classList.toggle('err', !!err); t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2000); }
function push(render, opts = {}) {
  const el = document.createElement('div');
  el.className = 'page' + (opts.up ? ' up' : '');
  el.render = render; el.st = opts.st || {}; el.fixed = !!opts.fixed;
  el.innerHTML = render(el);
  $('#app').appendChild(el); pages.push(el);
  el.getBoundingClientRect(); el.classList.add('in');
  if (opts.mount) opts.mount(el);
  return el;
}
function pop() {
  const el = pages.pop(); if (!el) return;
  if (el.onclose) el.onclose();
  el.classList.remove('in'); setTimeout(() => el.remove(), 280);
}
function popAll() { while (pages.length) pop(); }
const topPage = () => pages[pages.length - 1];
const head = (title, right = '') => `<div class="head"><button class="back" data-a="back">‹</button><h2>${esc(title)}</h2>${right}</div>`;
function refresh() {
  save();
  renderTab(tab);
  pages.forEach((p) => { if (!p.fixed) { const sc = p.scrollTop; p.innerHTML = p.render(p); p.scrollTop = sc; if (p.after) p.after(p); } });
}
actions.back = () => pop();
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const f = actions[el.dataset.a]; if (f) f(el.dataset.p, el, e);
});

/* ---------- общие блоки ---------- */
function opRow(o) {
  const c = CATS[o.c] || ['💳', '#888'];
  const time = new Date(o.d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `<button class="item" data-a="op" data-p="${o.id}"><div class="ico">${c[0]}</div><div class="grow"><b>${esc(o.t)}</b><small>${o.c} · ${time}</small></div><div class="right ${o.a > 0 ? 'plus' : ''}">${signed(o.a)}${o.cb ? `<small>+${o.cb} баллов</small>` : ''}</div></button>`;
}
function dayLabel(ts) {
  const k = (x) => new Date(x).setHours(0, 0, 0, 0), diff = Math.round((k(Date.now()) - k(ts)) / D);
  if (diff === 0) return 'Сегодня'; if (diff === 1) return 'Вчера';
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
function groupedOps(list) {
  let last = '', h = '', buf = '';
  const flush = () => { if (buf) h += `<div class="card">${buf}</div>`; buf = ''; };
  list.forEach((o) => { const l = dayLabel(o.d); if (l !== last) { flush(); h += `<div class="day">${l}</div>`; last = l; } buf += opRow(o); });
  flush(); return h || '<p class="muted">Операций нет</p>';
}
const sortedOps = () => S.ops.slice().sort((a, b) => b.d - a.d);
function accMini(a) { return a.kind === 'save' ? 'g' : a.kind === 'inv' ? 'b' : 'y'; }
function spending() {
  const sp = {}; let tot = 0;
  S.ops.filter((o) => o.a < 0 && isMonth(o.d) && o.c !== 'Свои счета' && o.c !== 'Инвестиции').forEach((o) => { sp[o.c] = (sp[o.c] || 0) - o.a; tot -= o.a; });
  return { tot, list: Object.entries(sp).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ c, v, col: (CATS[c] || [0, '#888'])[1] })) };
}
function invValue() { return S.inv.cash + Object.entries(S.inv.hold).reduce((s, [t, q]) => s + q * last(t), 0); }
const last = (t) => { const h = S.inv.prices[t]; return h[h.length - 1]; };

/* ---------- вкладки ---------- */
function renderTab(t) {
  const el = $('#s-' + t); if (!el) return;
  const sc = el.scrollTop;
  if (t === 'home') el.innerHTML = homeHTML();
  if (t === 'pay') el.innerHTML = payHTML();
  if (t === 'city') el.innerHTML = cityHTML();
  if (t === 'chat') { el.innerHTML = chatHTML(); }
  if (t === 'shop') el.innerHTML = shopHTML();
  if (t !== 'chat') el.scrollTop = sc;
}
function go(t) {
  tab = t;
  if (t === 'chat') { const b = $('nav .nb'); if (b) b.remove(); }
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 's-' + t));
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
  renderTab(t);
  if (t === 'chat') { const s = $('#s-chat'); s.scrollTop = s.scrollHeight; }
}
document.querySelectorAll('nav button').forEach((b) => b.onclick = () => { popAll(); go(b.dataset.t); });

function homeHTML() {
  const sp = spending(), unread = S.notes.filter((n) => n.unread).length;
  const monthIn = { 0: 'январе', 1: 'феврале', 2: 'марте', 3: 'апреле', 4: 'мае', 5: 'июне', 6: 'июле', 7: 'августе', 8: 'сентябре', 9: 'октябре', 10: 'ноябре', 11: 'декабре' }[new Date().getMonth()];
  const prod = (a) => {
    const last4 = a.num ? a.num.slice(-4) : '';
    return `<button class="prod" data-a="acc" data-p="${a.id}"><div class="rub ${a.kind === 'save' ? 'gr' : ''}">${a.kind === 'save' ? '%' : '₽'}</div><div><div class="pbal ${a.bal ? '' : 'z'}">${money(a.bal)}</div><div class="pname">${a.name.replace('Kepr ', '')}${a.frozen ? ' · заморожена' : ''}</div>${last4 ? `<div class="thumb ${a.frozen ? 'fz' : ''}">${last4}</div>` : ''}</div></button>`;
  };
  return `
  <div class="hello"><div class="avatar g" data-a="profile">И</div><button class="name" data-a="profile">Иван <span>›</span></button><button class="bell" data-a="notes">🔔${unread ? `<b>${unread}</b>` : ''}</button></div>
  <button class="search" data-a="search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>Поиск</button>
  <div class="stories">${STORIES.map((s, i) => `<button class="story ${S.seen[i] ? 'seen' : ''}" style="background:${s[2]}" data-a="story" data-p="${i}"><span>${s[0]}</span>${s[1]}</button>`).join('')}</div>
  <div class="two">
    <button class="tile2" data-a="allops"><b>Все операции</b>${sp.tot ? `<small>Траты в ${monthIn}</small><div class="tot">${money(sp.tot, 0)}</div>` : `<small>Нет трат<br>в ${monthIn}</small>`}<div class="seg2">${sp.list.length ? sp.list.map((d) => `<i style="flex:${d.v};background:${d.col}"></i>`).join('') : '<i style="flex:1"></i>'}</div></button>
    <button class="tile2" data-a="cashback"><b>Кэшбэк<br>и бонусы</b><div class="logos"><i style="background:#14b86a">🛒</i><i style="background:#3b2f6b">☕</i><i style="background:#1b5e3a">💊</i></div></button>
  </div>
  ${S.acc.map(prod).join('')}
  <button class="prod" data-a="invest"><div class="rub bl">📈</div><div><div class="pbal">${money(invValue())}</div><div class="pname">Инвестиции</div></div></button>
  <button class="wide" data-a="credits"><div class="wico">💸</div><div><b>Кредиты</b><span>Деньги от банка и рейтинг</span></div></button>
  <div class="two">
    <button class="tile2 art" data-a="acc" data-p="save"><b>Копить</b><em>🐷</em></button>
    <button class="tile2 art tall" data-a="soon"><b>Сим-карта</b><em>📶</em></button>
    <button class="tile2 art" data-a="buy" data-p="o4"><b>🎧 и 🎬<br>с кэшбэком</b><em>🍿</em></button>
    <button class="tile2 art" data-a="soon"><b>Выпустить<br>карту</b><em>💳</em></button>
  </div>`;
}
actions.tab = (t) => go(t);

function payHTML() {
  return `<h1>Платежи</h1>
  <div class="grid">
    <button class="tile" data-a="transfer"><i>👤</i>Перевод по телефону<small>Клиенту Kepr или в другой банк</small></button>
    <button class="tile" data-a="own"><i>🔁</i>Между своими<small>Карта и накопительный</small></button>
    <button class="tile" data-a="tocard"><i>💳</i>По номеру карты<small>На любую карту</small></button>
    <button class="tile" data-a="topup"><i>➕</i>Пополнить<small>Виртуально, из воздуха</small></button>
  </div>
  <div class="sect">Категории</div>
  <div class="card">${PAY_CATS.map((c, i) => `<button class="item" data-a="svc" data-p="${i}"><div class="ico">${c.e}</div><div class="grow"><b>${c.n}</b></div><span class="muted">›</span></button>`).join('')}</div>`;
}
function cityHTML() {
  return `<h1>Город</h1><p class="muted" style="margin-top:-6px">Активируйте предложение и совершите покупку — баллы придут сразу.</p>
  ${OFFERS.map((o) => {
    const on = S.offers[o.id];
    return `<div class="offer" style="background:${o.grad}"><h3>${o.brand}</h3><div>${o.cat}</div><div class="pct">${o.pct}% баллами</div>
    <div class="btns"><button class="${on ? 'g' : ''}" data-a="offer" data-p="${o.id}">${on ? '✓ Активировано' : 'Активировать'}</button><button data-a="buy" data-p="${o.id}">Купить</button></div></div>`;
  }).join('')}`;
}
function chatHTML() {
  return `<h1>Чат</h1><div class="chat" id="chatlist">${S.chat.map((m) => `<div class="msg ${m.w}">${esc(m.t)}</div>`).join('')}</div>
  <form class="chatbar" id="chatform"><input class="field" id="chatin" placeholder="Сообщение" autocomplete="off"><button>➤</button></form>`;
}
function shopHTML() {
  const t = (e, n, sub, a, p = '') => `<button class="tile" data-a="${a}" data-p="${p}"><i>${e}</i>${n}<small>${sub}</small></button>`;
  return `<h1>Витрина</h1><div class="grid">
    ${t('🐷', 'Копить', 'Накопительный счёт', 'acc', 'save')}${t('📈', 'Инвестиции', 'Акции за виртуальные ₽', 'invest')}
    ${t('💸', 'Кредиты', 'Деньги от банка', 'credits')}${t('🛡️', 'Страхование', 'Скоро', 'soon')}
    ${t('📶', 'Сим-карта', 'Скоро', 'soon')}${t('✈️', 'Путешествия', 'Скоро', 'soon')}
    ${t('🎬', 'Кино', 'Кэшбэк 20%', 'buy', 'o4')}${t('💳', 'Выпустить карту', 'Скоро', 'soon')}
  </div>`;
}
function profileHTML() {
  return `${head('Профиль')}
  <div class="card pad row"><div class="avatar g" style="width:56px;height:56px;font-size:22px">И</div><div><b>Иван</b><div class="muted">+7 900 000-00-00</div></div></div>
  <div class="card">
    <button class="item" data-a="limits"><div class="ico">📊</div><div class="grow"><b>Лимиты</b></div><span class="muted">›</span></button>
    <button class="item" data-a="setpin"><div class="ico">🔒</div><div class="grow"><b>Код-пароль</b><small>${S.pin ? 'Установлен' : 'Любой 4-значный код'}</small></div><span class="muted">›</span></button>
    <button class="item" data-a="lock"><div class="ico">🔐</div><div class="grow"><b>Заблокировать приложение</b></div></button>
    <button class="item" data-a="soon"><div class="ico">💬</div><div class="grow"><b>Поддержка</b></div><span class="muted">›</span></button>
  </div>
  <p class="muted" style="font-size:13px;text-align:center;line-height:1.4">Kepr — учебное приложение. Это не банк: реальных денег, карт и платежей здесь нет.</p>
  <button class="btn2" data-a="reset">Сбросить демо-данные</button>`;
}
actions.profile = () => push(() => profileHTML());
actions.credits = () => push(() => `${head('Кредиты')}<div class="card pad"><b style="font-size:20px">Кредитный рейтинг</b><div class="big" style="color:var(--green)">742</div><div class="muted">Хороший · обновлено сегодня (демо)</div></div><div class="card pad"><b>Кредит наличными</b><div class="muted" style="margin:4px 0 12px">До 1 000 000 ₽ — виртуально</div><button class="primary" data-a="soon">Оформить</button></div>`);
actions.cashback = () => push(() => `${head('Кэшбэк и бонусы')}<div class="cb"><span>Баллы кэшбэка</span><b>${nf(0).format(S.points).replace(/ /g, NB)} баллов</b><small>1 балл = 1 ₽ в «Городе»</small></div><button class="primary" data-a="gocity">Предложения партнёров</button>`);
actions.gocity = () => { popAll(); go('city'); };
actions.soon = () => toast('Раздел в разработке');
actions.limits = () => push((el) => `${head('Лимиты')}<div class="card pad"><b>Переводы в месяц</b><div class="muted" style="margin:4px 0 8px">Использовано ${money(-S.ops.filter((o) => o.c === 'Переводы' && o.a < 0 && isMonth(o.d)).reduce((s, o) => s + o.a, 0), 0)} из 1 000 000 ₽</div><div class="bar"><div style="width:${Math.min(100, -S.ops.filter((o) => o.c === 'Переводы' && o.a < 0 && isMonth(o.d)).reduce((s, o) => s + o.a, 0) / 10000)}%;background:var(--yellow)"></div></div></div>`);
actions.reset = () => { if (confirm('Сбросить все демо-данные?')) { popAll(); S = seed(); refresh(); toast('Данные сброшены'); } };

/* ---------- сторис, уведомления, поиск ---------- */
actions.story = (i) => {
  i = +i; S.seen[i] = 1; save();
  const s = STORIES[i];
  const el = push(() => `<div class="story-full" style="background:${s[2]}"><div class="prog"><div id="pg"></div></div><button class="back" data-a="back" style="margin-top:14px;background:#0004">✕</button><h1>${s[3]}</h1><p>${s[4]}</p><button class="primary" style="background:#fff" data-a="back">Понятно</button></div>`, { up: true, fixed: true, mount: (e) => { setTimeout(() => { const p = $('#pg', e); if (p) p.style.width = '100%'; }, 30); e.tm = setTimeout(() => { if (topPage() === e) pop(); }, 4100); } });
  el.style.padding = '0'; el.onclose = () => { clearTimeout(el.tm); renderTab('home'); };
};
actions.notes = () => {
  push(() => `${head('Уведомления')}${S.notes.length ? `<div class="card">${S.notes.slice(0, 30).map((n) => `<div class="item"><div class="ico">🔔</div><div class="grow"><b>${esc(n.t)}</b><small>${esc(n.s)}</small></div><small class="muted">${dayLabel(n.d)}</small></div>`).join('')}</div>` : '<p class="muted">Пока пусто</p>'}`);
  S.notes.forEach((n) => (n.unread = false)); save(); renderTab('home');
};
actions.search = () => {
  push((el) => {
    const q = (el.st.q || '').toLowerCase();
    const res = q ? sortedOps().filter((o) => (o.t + o.c).toLowerCase().includes(q)).slice(0, 30) : [];
    return `${head('Поиск')}<input class="field" id="q" placeholder="Операции, категории" value="${esc(el.st.q || '')}" autofocus><div id="res">${q ? `<div class="card">${res.map(opRow).join('') || '<p class="muted" style="padding:10px 0">Ничего не найдено</p>'}</div>` : '<p class="muted">Начните вводить название магазина или категорию</p>'}</div>`;
  }, { fixed: true, mount: (el) => { const i = $('#q', el); i.focus(); i.oninput = () => { el.st.q = i.value; const q = i.value.toLowerCase(); const res = q ? sortedOps().filter((o) => (o.t + o.c).toLowerCase().includes(q)).slice(0, 30) : []; $('#res', el).innerHTML = q ? `<div class="card">${res.map(opRow).join('') || '<p class="muted" style="padding:10px 0">Ничего не найдено</p>'}</div>` : ''; }; } });
};

/* ---------- операции ---------- */
actions.allops = () => push(() => { const sp = spending(); return `${head('Все операции')}<div class="card pad"><div class="donutbox">${donut(sp.list)}<div class="legend"><b style="font-size:20px">${money(sp.tot, 0)}</b>${sp.list.slice(0, 4).map((d) => `<div><i style="background:${d.col}"></i>${d.c}</div>`).join('')}</div></div></div>${groupedOps(sortedOps())}`; });
actions.op = (id) => {
  const o = S.ops.find((x) => x.id === id); if (!o) return;
  const c = CATS[o.c] || ['💳'];
  push(() => `${head('Операция')}<div class="success" style="padding-top:10px"><div class="ico" style="width:72px;height:72px;font-size:34px">${c[0]}</div><h2 style="margin:12px 0 2px">${esc(o.t)}</h2><div class="big ${o.a > 0 ? 'plus' : ''}">${signed(o.a)}</div>
  <div class="lines"><div><span>Категория</span><span>${o.c}</span></div><div><span>Дата</span><span>${new Date(o.d).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span></div><div><span>Счёт</span><span>${(acc(o.acc) || { name: 'Инвестиции' }).name}</span></div>${o.cb ? `<div><span>Кэшбэк</span><span class="plus">+${o.cb} баллов</span></div>` : ''}<div><span>Статус</span><span class="plus">Выполнено</span></div></div></div>`);
};

/* ---------- счета и карта ---------- */
actions.acc = (id) => {
  const a = acc(id);
  if (a.kind === 'card') return cardPage();
  push(() => {
    const b = acc(id);
    const accr = r2(b.bal * b.rate / 100 / 365 * 30);
    return `${head(b.name)}<div class="muted">Баланс</div><div class="big">${money(b.bal)}</div><div class="muted">Ставка до ${b.rate}% годовых · ~${money(accr)} за 30 дней</div>
    <div class="actions" style="grid-template-columns:1fr 1fr"><button class="act" data-a="tosave"><i>➕</i>Пополнить</button><button class="act" data-a="fromsave"><i>➖</i>Снять</button></div>
    <div class="sect">Операции</div>${groupedOps(sortedOps().filter((o) => o.acc === id).slice(0, 15))}`;
  });
};
function cardPage() {
  push((el) => {
    const a = acc('black'), f = S.frozen, st = el.st;
    return `${head('Карта')}<div class="bankcard ${f ? 'frozen' : ''}"><div class="logo">KEPR</div><div>${a.name}</div><div class="num">${st.show ? a.num : '•••• ' + a.num.slice(-4)}</div><div class="pay">${st.show ? a.exp + '  CVV ' + a.cvv : 'MIR'}</div></div>
    <div class="muted">Баланс</div><div class="big">${money(a.bal)}</div>
    <div class="card" style="margin-top:12px">
      <button class="item" data-a="showcard"><div class="ico">👁️</div><div class="grow"><b>${st.show ? 'Скрыть' : 'Показать'} реквизиты</b></div></button>
      <div class="item"><div class="ico">❄️</div><div class="grow"><b>Заморозить карту</b><small>Операции будут отклоняться</small></div><button class="toggle ${f ? 'on' : ''}" data-a="freeze"></button></div>
      <button class="item" data-a="soon"><div class="ico">🍎</div><div class="grow"><b>Добавить в Wallet</b></div><span class="muted">›</span></button>
      <button class="item" data-a="soon"><div class="ico">🔢</div><div class="grow"><b>Сменить PIN-код</b></div><span class="muted">›</span></button>
    </div>
    <div class="sect">Операции по карте</div>${groupedOps(sortedOps().filter((o) => o.acc === 'black').slice(0, 15))}`;
  });
}
actions.showcard = () => { const p = topPage(); p.st.show = !p.st.show; refresh(); };
actions.freeze = () => { S.frozen = !S.frozen; refresh(); toast(S.frozen ? 'Карта заморожена' : 'Карта разморожена'); };

/* ---------- ввод суммы (общий) ---------- */
function amountPage(o) {
  const el = push((e) => {
    const st = e.st;
    return `${head(o.title)}${o.sub ? `<div class="muted" style="text-align:center">${o.sub}</div>` : ''}
    ${o.accs ? `<div class="muted" style="margin:10px 0 6px">${o.accLabel || 'Списать с'}</div><div class="chips">${o.accs().map((a) => `<button class="chip ${st.src === a.id ? 'on' : ''}" data-a="src" data-p="${a.id}">${a.name}<small>${money(a.bal)}</small></button>`).join('')}</div>` : ''}
    <div class="amount" id="amt">${st.v ? st.v.replace('.', ',') : '0'} ${o.unit || '₽'}</div>
    ${o.hint ? `<div class="muted" style="text-align:center;min-height:20px" id="hint">${o.hint(st)}</div>` : ''}
    <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, o.int ? '' : ',', 0, '⌫'].map((k) => `<button data-a="key" data-p="${k}" ${k === '' ? 'disabled style="visibility:hidden"' : ''}>${k}</button>`).join('')}</div>
    <button class="primary" id="go" ${parseFloat(st.v) > 0 ? '' : 'disabled'} data-a="confirm">${o.ok || 'Продолжить'}</button>`;
  }, { fixed: true, st: { v: '', src: o.accs ? o.accs()[0].id : null }, mount: null });
  el.opts = o;
}
actions.src = (id) => { const p = topPage(); p.st.src = id; const v = p.st.v; p.innerHTML = p.render(p); };
actions.key = (k) => {
  const p = topPage(), st = p.st, o = p.opts; let v = st.v;
  if (k === '⌫') v = v.slice(0, -1);
  else if (k === ',') { if (v && !v.includes('.')) v += '.'; }
  else { if (v === '0') v = ''; const dec = v.includes('.') ? v.split('.')[1].length : 0; if (v.replace('.', '').length < 9 && dec < 2) v += k; }
  st.v = v;
  $('#amt', p).textContent = (v ? v.replace('.', ',') : '0') + ' ' + (o.unit || '₽');
  $('#go', p).disabled = !(parseFloat(v) > 0);
  const h = $('#hint', p); if (h && o.hint) h.textContent = o.hint(st);
};
actions.confirm = () => {
  const p = topPage(), a = parseFloat(p.st.v), o = p.opts;
  if (!(a > 0)) return;
  if (o.accs) { const src = acc(p.st.src); if (a > src.bal + 1e-9) { toast('Недостаточно средств', true); return; } }
  const rc = o.onOk(a, p.st.src);
  if (rc) successPage(rc);
};
function successPage(rc) {
  refresh();
  push(() => `<div class="success"><div class="check">✓</div><h2 style="margin:18px 0 4px">${esc(rc.title)}</h2><div class="big">${rc.amount}</div>
  <div class="lines">${(rc.lines || []).map(([k, v]) => `<div><span>${k}</span><span>${esc(v)}</span></div>`).join('')}</div>
  <button class="primary" style="margin-top:24px" data-a="done">Готово</button></div>`, { fixed: true });
  try { navigator.vibrate && navigator.vibrate(30); } catch (e) { /* noop */ }
}
actions.done = () => { popAll(); refresh(); };
const cardAccs = () => S.acc.filter((a) => a.kind === 'card' || a.kind === 'save');

/* ---------- переводы ---------- */
actions.transfer = () => push((el) => `${head('Перевод')}<input class="field" id="phone" placeholder="Номер телефона или имя" inputmode="tel">
  <div class="muted" style="margin-bottom:8px">Контакты</div><div class="card">${CONTACTS.map((c, i) => `<button class="item" data-a="to" data-p="${i}"><div class="ico">${c.e}</div><div class="grow"><b>${c.n}</b><small>${c.ph}</small></div></button>`).join('')}</div>`, { fixed: true });
actions.to = (i) => {
  const c = CONTACTS[+i];
  amountPage({
    title: c.n, sub: c.ph, accs: cardAccs, ok: 'Перевести',
    onOk: (a, src) => {
      if (!spend(src, a)) return null;
      addOp({ t: 'Перевод: ' + c.n, c: 'Переводы', a: -a, acc: src });
      return { title: 'Перевод отправлен', amount: money(a), lines: [['Получатель', c.n], ['Телефон', c.ph], ['Комиссия', '0 ₽']] };
    },
  });
};
actions.tocard = () => push(() => `${head('Перевод на карту')}<input class="field" id="cn" placeholder="Номер карты" inputmode="numeric" maxlength="19"><button class="primary" data-a="tocard2">Далее</button>`, {
  fixed: true, mount: (el) => { const i = $('#cn', el); i.oninput = () => { i.value = i.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); }; },
});
actions.tocard2 = () => {
  const n = $('#cn', topPage()).value;
  if (n.replace(/\s/g, '').length !== 16) return toast('Введите 16 цифр карты', true);
  amountPage({
    title: 'Перевод на карту', sub: '•••• ' + n.slice(-4), accs: cardAccs, ok: 'Перевести',
    onOk: (a, src) => { if (!spend(src, a)) return null; addOp({ t: 'Перевод на карту •' + n.slice(-4), c: 'Переводы', a: -a, acc: src }); return { title: 'Перевод отправлен', amount: money(a), lines: [['Карта', '•••• ' + n.slice(-4)], ['Комиссия', '0 ₽']] }; },
  });
};
const moveOwn = (from, to) => amountPage({
    title: 'Между своими', sub: acc(from).name + ' → ' + acc(to).name, ok: 'Перевести',
    accs: () => [acc(from)],
    onOk: (a) => { if (!spend(from, a)) return null; acc(to).bal = r2(acc(to).bal + a); addOp({ t: 'Перевод на «' + acc(to).name + '»', c: 'Свои счета', a: -a, acc: from }); addOp({ t: 'Перевод с «' + acc(from).name + '»', c: 'Свои счета', a: a, acc: to }); return { title: 'Переведено', amount: money(a), lines: [['Откуда', acc(from).name], ['Куда', acc(to).name]] }; },
});
actions.own = () => {
  push(() => `${head('Между своими')}<div class="card"><button class="item" data-a="mv" data-p="black:save"><div class="ico">➡️</div><div class="grow"><b>С карты на накопительный</b></div></button><button class="item" data-a="mv" data-p="save:black"><div class="ico">⬅️</div><div class="grow"><b>С накопительного на карту</b></div></button></div>`, { fixed: true });
};
actions.mv = (p) => { const [f, t] = p.split(':'); moveOwn(f, t); };
actions.tosave = () => amountPage({ title: 'Пополнить накопительный', sub: 'С карты Kepr Black', accs: () => [acc('black')], ok: 'Пополнить', onOk: (a) => { if (!spend('black', a)) return null; acc('save').bal = r2(acc('save').bal + a); addOp({ t: 'Пополнение накопительного', c: 'Свои счета', a: -a, acc: 'black' }); addOp({ t: 'Пополнение со счёта Kepr Black', c: 'Свои счета', a, acc: 'save' }); return { title: 'Пополнено', amount: money(a), lines: [['Счёт', 'Накопительный']] }; } });
actions.fromsave = () => amountPage({ title: 'Снять с накопительного', sub: 'На карту Kepr Black', accs: () => [acc('save')], ok: 'Снять', onOk: (a) => { if (!spend('save', a)) return null; acc('black').bal = r2(acc('black').bal + a); addOp({ t: 'Снятие с накопительного', c: 'Свои счета', a: -a, acc: 'save' }); addOp({ t: 'Поступление с накопительного', c: 'Свои счета', a, acc: 'black' }); return { title: 'Снято', amount: money(a), lines: [['На счёт', 'Kepr Black']] }; } });
actions.topup = () => amountPage({ title: 'Пополнение', sub: 'Виртуальные деньги на карту Kepr Black', ok: 'Пополнить', onOk: (a) => { acc('black').bal = r2(acc('black').bal + a); addOp({ t: 'Пополнение', c: 'Пополнение', a, acc: 'black' }); return { title: 'Деньги зачислены', amount: money(a), lines: [['Счёт', 'Kepr Black'], ['Источник', 'Демо']] }; } });

/* ---------- платежи ---------- */
actions.svc = (i) => {
  const s = PAY_CATS[+i];
  push(() => `${head(s.n)}<div class="success" style="padding-top:0"><div class="ico" style="width:64px;height:64px;font-size:30px">${s.e}</div></div><div style="height:16px"></div><input class="field" id="f1" placeholder="${s.f}" value="${s.ph}"><button class="primary" data-a="svc2" data-p="${i}">Далее</button>`, { fixed: true });
};
actions.svc2 = (i) => {
  const s = PAY_CATS[+i], v = $('#f1', topPage()).value.trim();
  if (v.length < 3) return toast('Заполните поле «' + s.f + '»', true);
  amountPage({ title: s.n, sub: v, accs: cardAccs, ok: 'Оплатить', onOk: (a, src) => { if (!spend(src, a)) return null; addOp({ t: s.n, c: s.c, a: -a, acc: src }); return { title: 'Платёж выполнен', amount: money(a), lines: [['Услуга', s.n], [s.f, v], ['Комиссия', '0 ₽']] }; } });
};

/* ---------- город / кэшбэк ---------- */
actions.offer = (id) => { S.offers[id] = !S.offers[id]; refresh(); toast(S.offers[id] ? 'Предложение активировано' : 'Предложение отключено'); };
actions.buy = (id) => {
  const o = OFFERS.find((x) => x.id === id), r = Math.random();
  const price = Math.round(o.min + r * (o.max - o.min));
  amountPage({
    title: o.brand, sub: 'Демо-покупка с кэшбэком', accs: () => [acc('black')], ok: 'Оплатить',
    hint: (st) => { const a = parseFloat(st.v) || 0; return a ? `Кэшбэк: ${Math.floor(a * (S.offers[id] ? o.pct : 1) / 100)} баллов` : `Например, ${price} ₽`; },
    onOk: (a) => {
      if (S.frozen) { toast('Карта заморожена', true); return null; }
      if (!spend('black', a)) return null;
      const pct = S.offers[id] ? o.pct : 1, cb = Math.floor(a * pct / 100);
      S.points += cb; addOp({ t: o.brand, c: o.cat, a: -a, acc: 'black', cb });
      return { title: 'Покупка оплачена', amount: money(a), lines: [['Магазин', o.brand], ['Кэшбэк', `+${cb} баллов (${pct}%)`]] };
    },
  });
};

/* ---------- инвестиции ---------- */
function investHTML() {
  const ph = Object.keys(S.inv.hold).filter((t) => S.inv.hold[t] > 0);
  const stocksVal = ph.reduce((s, t) => s + S.inv.hold[t] * last(t), 0);
  const row = (s, q) => { const h = S.inv.prices[s.t], ch = (h[h.length - 1] / h[h.length - 2] - 1) * 100; return `<button class="item" data-a="stock" data-p="${s.t}"><div class="ico">${s.t.slice(0, 2)}</div><div class="grow"><b>${s.n}</b><small>${q ? q + ' шт.' : s.t}</small></div>${spark(h)}<div class="right">${money(q ? q * last(s.t) : last(s.t))}<small class="${ch >= 0 ? 'plus' : 'red'}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%</small></div></button>`; };
  return `${head('Инвестиции')}<div class="muted">Стоимость портфеля</div><div class="big">${money(invValue())}</div><div class="muted">Свободно ${money(S.inv.cash)} · бумаги ${money(stocksVal)}</div>
  <div class="actions" style="grid-template-columns:1fr 1fr"><button class="act" data-a="invdep"><i>➕</i>Пополнить счёт</button><button class="act" data-a="invout"><i>➖</i>Вывести</button></div>
  <div class="sect">Мои бумаги</div><div class="card">${ph.map((t) => row(STOCKS0.find((s) => s.t === t), S.inv.hold[t])).join('') || '<p class="muted" style="padding:10px 0">Пока нет бумаг</p>'}</div>
  <div class="sect">Рынок <span class="tag">симуляция</span></div><div class="card">${STOCKS0.map((s) => row(s, 0)).join('')}</div>`;
}
actions.invest = () => { push(() => investHTML()).live = true; };
actions.invdep = () => amountPage({ title: 'Пополнить брокерский счёт', sub: 'С карты Kepr Black', accs: () => [acc('black')], ok: 'Пополнить', onOk: (a) => { if (!spend('black', a)) return null; S.inv.cash = r2(S.inv.cash + a); addOp({ t: 'Пополнение брокерского счёта', c: 'Инвестиции', a: -a, acc: 'black' }); return { title: 'Счёт пополнен', amount: money(a), lines: [['Брокерский счёт', money(S.inv.cash)]] }; } });
actions.invout = () => amountPage({ title: 'Вывод с брокерского счёта', sub: `Доступно ${money(S.inv.cash)}`, ok: 'Вывести', onOk: (a) => { if (a > S.inv.cash) { toast('Недостаточно средств', true); return null; } S.inv.cash = r2(S.inv.cash - a); acc('black').bal = r2(acc('black').bal + a); addOp({ t: 'Вывод с брокерского счёта', c: 'Инвестиции', a, acc: 'black' }); return { title: 'Выведено', amount: money(a), lines: [['На карту', 'Kepr Black']] }; } });
actions.stock = (t) => {
  const s = STOCKS0.find((x) => x.t === t);
  push(() => {
    const h = S.inv.prices[t], q = S.inv.hold[t] || 0, ch = (h[h.length - 1] / h[0] - 1) * 100;
    return `${head(s.t)}<div class="muted">${s.n}</div><div class="big">${money(last(t))}</div><div class="${ch >= 0 ? 'plus' : 'red'}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)}% за период</div>${chart(h)}
    <div class="card pad" style="margin-top:14px"><div class="row between"><span class="muted">В портфеле</span><b>${q} шт. · ${money(q * last(t))}</b></div><div class="row between" style="margin-top:8px"><span class="muted">Свободно</span><b>${money(S.inv.cash)}</b></div></div>
    <div class="grid"><button class="primary" data-a="trade" data-p="buy:${t}">Купить</button><button class="primary alt" data-a="trade" data-p="sell:${t}">Продать</button></div>`;
  });
};
actions.trade = (p) => {
  const [side, t] = p.split(':'), s = STOCKS0.find((x) => x.t === t), buy = side === 'buy';
  amountPage({
    title: (buy ? 'Купить ' : 'Продать ') + s.t, sub: `Цена ${money(last(t))}`, unit: 'шт.', int: true, ok: buy ? 'Купить' : 'Продать',
    hint: (st) => { const q = parseInt(st.v) || 0; return q ? `≈ ${money(q * last(t))}` : (buy ? `Доступно ${Math.floor(S.inv.cash / last(t))} шт.` : `В портфеле ${S.inv.hold[t] || 0} шт.`); },
    onOk: (q) => {
      q = Math.floor(q); const cost = r2(q * last(t));
      if (q < 1) return null;
      if (buy) { if (cost > S.inv.cash) { toast('Недостаточно средств на брокерском счёте', true); return null; } S.inv.cash = r2(S.inv.cash - cost); S.inv.hold[t] = (S.inv.hold[t] || 0) + q; }
      else { if (q > (S.inv.hold[t] || 0)) { toast('Недостаточно бумаг', true); return null; } S.inv.hold[t] -= q; S.inv.cash = r2(S.inv.cash + cost); }
      S.notes.unshift({ id: uid(), t: buy ? 'Покупка бумаг' : 'Продажа бумаг', s: `${s.t} · ${q} шт. · ${money(cost)}`, d: Date.now(), unread: true });
      return { title: buy ? 'Бумаги куплены' : 'Бумаги проданы', amount: money(cost), lines: [['Бумага', s.n], ['Количество', q + ' шт.'], ['Цена', money(last(t))]] };
    },
  });
};
setInterval(() => {
  if (!pages.some((p) => p.live || p.querySelector('.chart'))) return;
  STOCKS0.forEach((s) => { const h = S.inv.prices[s.t]; h.push(r2(Math.max(1, h[h.length - 1] * (1 + (Math.random() - 0.5) * 0.012)))); if (h.length > 60) h.shift(); });
  save();
  pages.forEach((p) => { if (!p.fixed) { const sc = p.scrollTop; p.innerHTML = p.render(p); p.scrollTop = sc; } });
}, 2500);

/* ---------- чат ---------- */
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'chatform') return;
  e.preventDefault();
  const i = $('#chatin'), t = i.value.trim(); if (!t) return;
  S.chat.push({ w: 'out', t }); save(); renderTab('chat'); $('#chatin').focus();
  const reply = (BOT.find(([re]) => re.test(t)) || [0, 'Передал ваш вопрос специалисту. Это демо — ответит бот 🙂'])[1];
  setTimeout(() => { S.chat.push({ w: 'in', t: reply }); save(); if (tab === 'chat') { renderTab('chat'); const s = $('#s-chat'); s.scrollTop = s.scrollHeight; } }, 700);
  const s = $('#s-chat'); s.scrollTop = s.scrollHeight;
});

/* ---------- экран блокировки ---------- */
let pinBuf = '';
function lockHTML(msg) {
  const dots = [0, 1, 2, 3].map((i) => `<i class="${i < pinBuf.length ? 'f' : ''}"></i>`).join('');
  return `<div class="lav"><svg width="30" height="30" viewBox="0 0 24 24" fill="#d6d6d6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></div><div class="lname">${msg || 'Иван'}</div>
  <div class="dots" id="dots">${dots}</div><div class="lhint">${S.pin ? '' : 'Демо: подойдёт любой 4-значный код'}</div>
  <div class="lkeys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<button data-a="pin" data-p="${k}">${k}</button>`).join('')}<button class="exit" data-a="lockexit">Выйти</button><button data-a="pin" data-p="0">0</button><button id="lk-last" data-a="faceid">${FACE}</button></div>`;
}
const FACE = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#9a9a9f" stroke-width="1.5" stroke-linecap="round"><path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2"/><path d="M9 9v1.5M15 9v1.5M12 9.5v3.2h-1M9 15.5c1.8 1.5 4.2 1.5 6 0"/></svg>';
const BKSP = '<svg width="34" height="34" viewBox="0 0 24 24" fill="#9a9a9f"><path d="M8 5h12a2 2 0 012 2v10a2 2 0 01-2 2H8l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5" stroke="#000" stroke-width="1.8" stroke-linecap="round"/></svg>';
function pinUI() {
  $('#dots').innerHTML = [0, 1, 2, 3].map((i) => `<i class="${i < pinBuf.length ? 'f' : ''}"></i>`).join('');
  const b = $('#lk-last'); b.dataset.a = pinBuf ? 'pin' : 'faceid'; b.dataset.p = '⌫'; b.innerHTML = pinBuf ? BKSP : FACE;
}
actions.lockexit = () => toast('Это демо — выйти некуда 🙂');
function showLock(msg) { pinBuf = ''; const l = $('#lock'); l.innerHTML = lockHTML(msg); l.classList.remove('hide'); }
actions.lock = () => { popAll(); showLock(); };
actions.faceid = () => { toast('Face ID: распознано (демо)'); $('#lock').classList.add('hide'); };
actions.pin = (k) => {
  if (k === '⌫') pinBuf = pinBuf.slice(0, -1); else if (pinBuf.length < 4) pinBuf += k;
  pinUI();
  if (pinBuf.length === 4) {
    if (S.pin && pinBuf !== S.pin) { const d = $('#dots'); d.classList.add('shake'); setTimeout(() => { pinBuf = ''; d.classList.remove('shake'); pinUI(); }, 380); return; }
    setTimeout(() => $('#lock').classList.add('hide'), 120);
  }
};
actions.setpin = () => {
  push(() => `${head('Код-пароль')}<p class="muted">Придумайте 4 цифры. Если оставить пустым — подойдёт любой код.</p><input class="field" id="np" inputmode="numeric" maxlength="4" placeholder="••••" type="password"><button class="primary" data-a="setpin2">Сохранить</button>`, { fixed: true });
};
actions.setpin2 = () => {
  const v = $('#np', topPage()).value;
  if (v && !/^\d{4}$/.test(v)) return toast('Нужно 4 цифры', true);
  S.pin = v || null; save(); pop(); refresh(); toast(v ? 'Код сохранён' : 'Код отключён');
};

/* ---------- старт ---------- */
accrue(); save();
go('home');
showLock();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__kepr = { S: () => S, actions, push, pages, go };
