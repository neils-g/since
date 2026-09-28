'use strict';

/* ───────────── constants ───────────── */
const KEY = 'since.v1';
const SEC = 1000, MIN = 60 * SEC, H = 60 * MIN, D = 24 * H;

const MILESTONES = [
  { ms: D, label: '1 day', e: '🌱' },
  { ms: 3 * D, label: '3 days', e: '🌿' },
  { ms: 7 * D, label: '1 week', e: '⭐' },
  { ms: 14 * D, label: '2 weeks', e: '🔥' },
  { ms: 30 * D, label: '30 days', e: '🏅' },
  { ms: 60 * D, label: '60 days', e: '💪' },
  { ms: 90 * D, label: '90 days', e: '🏆' },
  { ms: 180 * D, label: '6 months', e: '🚀' },
  { ms: 365 * D, label: '1 year', e: '👑' },
  { ms: 730 * D, label: '2 years', e: '💎' },
];

const DEFAULT_ALTS = [
  'Go for a 10-minute walk',
  'Drink a big glass of cold water',
  'Text or call someone',
  '20 push-ups or a quick stretch',
  'Splash cold water on your face',
  'Write down what triggered this',
  'Change rooms or step outside',
  'Put on a song and just listen',
];
const DEFAULT_MSG = "You've felt this before and it passed. This urge will rise, peak, and fade. Future you is counting on you right now.";

// Urge surfing / relapse-prevention prompts, rotated during a wave.
const WAVE_TIPS = [
  'Urges are like waves: they build, peak, and fade — usually within 15–30 minutes — whether or not you act on them.',
  'Notice where you feel it in your body. Chest? Hands? Stomach? Just observe it with curiosity, like watching a wave.',
  'Name it: “I’m having an urge.” You are the one noticing the urge — you are not the urge.',
  'HALT check: are you Hungry, Angry, Lonely, or Tired? Take care of that need instead.',
  'Play the tape forward: how will you feel an hour after giving in? Tomorrow morning?',
  'Rate the urge in your head right now, 1–10. Watch how the number moves.',
  'Change your state: stand up, move rooms, get some cold water or fresh air.',
  'Every wave you ride out teaches your brain the urge doesn’t have to be obeyed. The next one gets easier.',
];

const ICON = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

/* ───────────── state ───────────── */
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

function normalizeTimer(t) {
  return {
    id: t.id || uid(),
    name: String(t.name || 'Untitled'),
    startAt: +t.startAt || Date.now(),
    penaltyHours: t.penaltyHours != null ? +t.penaltyHours : 4,
    // Penalty levels: hours + what counts as that level (written ahead of time).
    pen: (() => {
      const med = t.pen?.med ?? (t.penaltyHours != null ? +t.penaltyHours : 4);
      const low = t.pen?.low ?? Math.min(3, med);
      return { tiny: t.pen?.tiny ?? Math.min(1, low), low, med, high: t.pen?.high ?? Math.max(6, med) };
    })(),
    penDesc: { tiny: '', low: '', med: '', high: '', ...(t.penDesc || {}) },
    waveMin: +t.waveMin || 10,
    message: t.message != null ? String(t.message) : DEFAULT_MSG,
    alts: Array.isArray(t.alts) ? t.alts.map(String) : DEFAULT_ALTS.slice(),
    slips: Array.isArray(t.slips) ? t.slips.map(s => ({ ...s, id: s.id || uid(), at: +s.at, hours: +s.hours, note: String(s.note || ''), expect: String(s.expect || ''), actual: String(s.actual || '') })) : [],
    waves: Array.isArray(t.waves) ? t.waves : [],
    celebrated: t.celebrated != null ? t.celebrated : -1,
    createdAt: +t.createdAt || Date.now(),
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.timers)) return { ...s, timers: s.timers.map(normalizeTimer) };
  } catch (e) { /* fall through */ }
  return { timers: [], wave: null, hideInstall: false, prefs: {} };
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save — storage is full or blocked'); }
}
const ui = { range: '30', month: null };
const getTimer = id => state.timers.find(t => t.id === id);

/* ───────────── math ───────────── */
const penaltyMs = (t, until = Infinity) => t.slips.reduce((a, s) => (s.at <= until ? a + s.hours * H : a), 0);
const netAt = (t, time) => time - t.startAt - penaltyMs(t, time);
const sortedSlips = t => [...t.slips].sort((a, b) => a.at - b.at);
// Slips that are ready for a "how did it actually go?" reflection.
const pendingReflections = (t, now = Date.now()) =>
  sortedSlips(t).filter(s => s.at < now - 30 * MIN && !s.actual && !s.worth && !s.skipReflect);

function milestoneInfo(net) {
  let i = -1;
  MILESTONES.forEach((m, k) => { if (net >= m.ms) i = k; });
  const next = MILESTONES[i + 1];
  const prev = i >= 0 ? MILESTONES[i].ms : 0;
  const pct = next ? Math.max(0, Math.min(1, (net - prev) / (next.ms - prev))) : 1;
  return { reached: i, next, pct };
}

function stats(t, now) {
  const slips = sortedSlips(t);
  const elapsed = Math.max(0, now - t.startAt);
  const net = netAt(t, now);
  const pen = penaltyMs(t);
  const last = slips.length ? slips[slips.length - 1].at : t.startAt;
  let longest = 0, prev = t.startAt;
  for (const s of slips) { longest = Math.max(longest, s.at - prev); prev = s.at; }
  longest = Math.max(longest, now - prev);
  const wk = slips.filter(s => s.at > now - 7 * D).length;
  const prevWk = slips.filter(s => s.at > now - 14 * D && s.at <= now - 7 * D).length;
  const rode = t.waves.filter(w => w.outcome === 'rode');
  const rated = rode.filter(w => w.before && w.after);
  const avg = k => rated.length ? Math.round(rated.reduce((a, w) => a + w[k], 0) / rated.length * 10) / 10 : null;
  return {
    net, elapsed, pen, clean: now - last, longest, wk, prevWk,
    kept: elapsed > 0 ? net / elapsed : 1,
    avgGap: slips.length ? elapsed / slips.length : null,
    rode: rode.length, waves: t.waves.length, avgBefore: avg('before'), avgAfter: avg('after'),
  };
}

/* ───────────── formatting ───────────── */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
function parts(ms) {
  const neg = ms < 0; ms = Math.abs(ms);
  return { neg, d: Math.floor(ms / D), h: Math.floor(ms % D / H), m: Math.floor(ms % H / MIN), s: Math.floor(ms % MIN / SEC) };
}
function fmtShort(ms) {
  const p = parts(ms), sign = p.neg ? '−' : '';
  if (p.d) return `${sign}${p.d}d ${p.h}h`;
  if (p.h) return `${sign}${p.h}h ${p.m}m`;
  return `${sign}${p.m}m`;
}
function clockHTML(ms, secs = true) {
  const p = parts(ms);
  const seg = (v, u) => `<span class="seg"><b>${v}</b><small>${u}</small></span>`;
  let h = p.neg ? '<span class="sign">−</span>' : '';
  if (p.d) h += seg(p.d, 'd');
  h += seg(p.h, 'h') + seg(pad(p.m), 'm');
  if (secs) h += seg(pad(p.s), 's');
  return h;
}
const hrs = h => (Number.isInteger(h) ? h : h.toFixed(1)) + 'h';
function fmtDate(ms) {
  const d = new Date(ms), sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
}
const fmtTime = ms => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtDateTime = ms => `${fmtDate(ms)}, ${fmtTime(ms)}`;
const toLocalInput = ms => { const d = new Date(ms); return new Date(ms - d.getTimezoneOffset() * MIN).toISOString().slice(0, 16); };
const fromLocalInput = s => new Date(s).getTime();

/* ───────────── dom helpers ───────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');

function toast(msg, actions = [], ms = 5000) {
  $('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="msg">${esc(msg)}</span>` + actions.map((a, i) => `<button data-i="${i}">${esc(a.label)}</button>`).join('');
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    el.remove(); actions[+b.dataset.i].fn();
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function openSheet(html, mount) {
  closeSheet();
  const bd = document.createElement('div');
  bd.className = 'backdrop';
  bd.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div><button class="icon-btn sheet-x" aria-label="Close">${ICON.close}</button>${html}</div>`;
  bd.addEventListener('click', e => { if (e.target === bd || e.target.closest('.sheet-x')) closeSheet(true); });
  document.body.appendChild(bd);
  document.body.classList.add('sheet-open');
  const sheet = $('.sheet', bd);

  // Swipe down to dismiss — from anywhere once the sheet is scrolled to the top.
  let y0 = null, dy = 0, pulling = false;
  sheet.addEventListener('touchstart', e => {
    if (e.target.closest('input, textarea, select')) { y0 = null; return; }
    y0 = e.touches[0].clientY; dy = 0; pulling = false;
  }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (!pulling && dy > 6 && sheet.scrollTop <= 0) pulling = true;
    if (pulling) {
      e.preventDefault();
      sheet.style.transition = 'none';
      sheet.style.transform = `translateY(${Math.max(0, dy)}px)`;
    }
  }, { passive: false });
  sheet.addEventListener('touchend', () => {
    if (y0 == null) return;
    y0 = null;
    sheet.style.transition = '';
    if (pulling && dy > 90) closeSheet(true);
    else sheet.style.transform = '';
    pulling = false;
  });
  mount?.(sheet);
}
function closeSheet(animate) {
  const bd = $('.backdrop'); if (!bd) return;
  document.body.classList.remove('sheet-open');
  if (!animate) return bd.remove();
  bd.classList.add('closing');
  $('.sheet', bd).style.transform = 'translateY(100%)';
  setTimeout(() => bd.remove(), 220);
}

/* ───────────── actions ───────────── */
const LEVELS = [['low', 'A little', '🟡'], ['med', 'Medium', '🟠'], ['high', 'A lot', '🔴']];
// Kept apart from LEVELS on purpose: a deliberate, confirm-first option — never a ready choice.
const EMERGENCY = ['tiny', 'Emergency use', '⚕︎'];
const EMERGENCY_DEF = 'Only to ease real withdrawal symptoms — not for cravings, boredom, or stress.';
const ALL_LEVELS = [...LEVELS, EMERGENCY];
const emergDef = t => t.penDesc.tiny || EMERGENCY_DEF;
const levelLabel = l => (ALL_LEVELS.find(x => x[0] === l) || [])[1] || '';
const penRange = t => `−${hrs(t.pen.low)}–${hrs(t.pen.high)}`;

// Ask how big the slip was, then log it with that level's penalty.
function chooseSlip(t, extra = {}, onLogged) {
  openSheet(`
    <h3>How much did you slip?</h3>
    <p class="sub">Be honest — a smaller slip costs less, so there's always a reason to stop early.</p>
    <div class="stack level-pick">
      ${LEVELS.map(([k, label, e]) => `
        <button class="level-btn ${k}" data-level="${k}">
          <span class="lv-e">${e}</span>
          <span class="lv-txt"><b>${label}</b>${t.penDesc[k] ? `<small>${esc(t.penDesc[k])}</small>` : ''}</span>
          <span class="lv-h">−${hrs(t.pen[k])}</span>
        </button>`).join('')}
    </div>
    <div class="emerg-wrap"><button class="emerg-link" id="emergLink">Emergency use only — withdrawal relief (−${hrs(t.pen.tiny)})</button></div>`, sheet => {
    $('#emergLink', sheet).onclick = () => {
      // Swap the sheet's content for the confirmation step (keep the grabber and close button)
      [...sheet.children].forEach(c => { if (!c.classList.contains('grabber') && !c.classList.contains('sheet-x')) c.remove(); });
      sheet.insertAdjacentHTML('beforeend', `
        <h3>Emergency use</h3>
        <div class="emerg-card">
          <p><b>${esc(emergDef(t))}</b></p>
          <p>This exists so that easing genuinely rough withdrawal doesn't cost you as much as a full slip. If what you're feeling is an urge or a craving, that's a wave — you can ride it.</p>
        </div>
        <p class="sub">Is this to relieve real withdrawal symptoms?</p>
        <div class="stack">
          <button class="btn block" id="emergBack">No, go back</button>
          <button class="btn block secondary" id="emergWave">It's a craving — ride the wave instead</button>
          <button class="emerg-confirm" data-level="tiny">Yes, withdrawal relief — log −${hrs(t.pen.tiny)}</button>
        </div>`);
      $('#emergBack', sheet).onclick = () => chooseSlip(t, extra, onLogged);
      $('#emergWave', sheet).onclick = () => { closeSheet(); if (!state.wave) startWave(t); };
      bindLevels();
    };
    const bindLevels = () => $$('[data-level]', sheet).forEach(b => b.onclick = () => {
      const level = b.dataset.level, cur = getTimer(t.id);
      closeSheet();
      if (!cur) return;
      onLogged?.();
      addSlip(cur, Date.now(), { ...extra, level, hours: cur.pen[level] });
    });
    bindLevels();
  });
}

function addSlip(t, at = Date.now(), extra = {}) {
  const slip = { id: uid(), at, hours: t.pen.med, level: 'med', note: '', expect: '', actual: '', worth: null, ...extra };
  t.slips.push(slip);
  save(); render();
  toast(`−${hrs(slip.hours)} penalty logged`, [
    { label: 'Add details', fn: () => openSlipSheet(t, slip, 'note') },
    { label: 'Undo', fn: () => { t.slips = t.slips.filter(s => s !== slip); save(); render(); } },
  ], 7000);
  return slip;
}

/* ───────────── views ───────────── */
function render() {
  const m = location.hash.match(/^#\/t\/(.+)$/);
  const t = m && getTimer(m[1]);
  if (m && !t) { location.hash = ''; return; }
  t ? renderDetail(t) : renderHome();
  renderWave();
  tick();
}

function isIOSBrowser() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches;
}

function renderHome() {
  const now = Date.now();
  const install = isIOSBrowser() && !state.hideInstall
    ? `<div class="card install"><b>Install on your iPhone:</b> tap <b>Share</b> <span aria-hidden="true">⎋</span> then <b>Add to Home Screen</b>. It'll open full-screen like a normal app.<button class="link-btn" id="hideInstall">Got it</button></div>` : '';
  app.innerHTML = `
    <header class="bar">
      <h1>Since</h1>
      <div class="right">
        <button class="icon-btn" id="settingsBtn" aria-label="Settings">${ICON.gear}</button>
        <button class="icon-btn primary" id="addBtn" aria-label="New timer">${ICON.plus}</button>
      </div>
    </header>
    ${install}
    ${state.timers.length ? state.timers.map(t => timerCard(t, now)).join('') : `
      <div class="empty">
        <div class="big">⏳</div>
        <h2>No timers yet</h2>
        <div>Track how long since you quit something. Slip up? Take a penalty instead of starting over.</div>
        <button class="btn" id="emptyAdd">Create your first timer</button>
      </div>`}
  `;
  $('#addBtn').onclick = $('#emptyAdd') ? ($('#emptyAdd').onclick = () => openTimerSheet()) : () => openTimerSheet();
  $('#settingsBtn').onclick = openSettings;
  $('#hideInstall') && ($('#hideInstall').onclick = () => { state.hideInstall = true; save(); render(); });
  $$('.timer-card').forEach(el => el.addEventListener('click', e => {
    const id = el.dataset.id, t = getTimer(id);
    if (e.target.closest('[data-slip]')) return chooseSlip(t);
    if (e.target.closest('[data-wave]')) return startWave(t);
    if (e.target.closest('[data-reflect]')) return openSlipSheet(t, pendingReflections(t)[0], 'reflect');
    location.hash = '#/t/' + id;
  }));
}

function timerCard(t, now) {
  return `
    <article class="card timer-card" data-id="${t.id}">
      <div class="card-top"><h3>${esc(t.name)}</h3><span class="chip">${penRange(t)} per slip</span></div>
      <div class="clock" data-live="clock" data-id="${t.id}"></div>
      <div class="sub" data-live="sub" data-id="${t.id}"></div>
      <div class="progress"><i data-live="bar" data-id="${t.id}"></i></div>
      <div class="next" data-live="next" data-id="${t.id}"></div>
      ${pendingReflections(t, now).length ? `<button class="reflect-pill" data-reflect>📝 ${pendingReflections(t, now).length} reflection${pendingReflections(t, now).length === 1 ? '' : 's'} waiting — how did it go?</button>` : ''}
      <div class="btn-row">
        <button class="wave-btn" data-wave>🌊 Ride the wave</button>
        <button class="slip-btn" data-slip>I slipped</button>
      </div>
    </article>`;
}

function renderDetail(t) {
  const now = Date.now(), st = stats(t, now);
  const mi = milestoneInfo(st.net);
  const wkDelta = st.wk - st.prevWk;
  const wkNote = !st.wk && !st.prevWk ? 'none in 2 weeks' : wkDelta === 0 ? 'same as last week' : wkDelta < 0 ? `↓ ${-wkDelta} vs last week` : `↑ ${wkDelta} vs last week`;
  const events = [
    ...t.slips.map(s => ({ kind: 'slip', at: s.at, s })),
    ...t.waves.map(w => ({ kind: 'wave', at: w.at, w })),
  ].sort((a, b) => b.at - a.at);

  app.innerHTML = `
    <header class="bar">
      <button class="icon-btn" id="backBtn" aria-label="Back">${ICON.back}</button>
      <h2>${esc(t.name)}</h2>
      <button class="icon-btn" id="editBtn" aria-label="Edit timer">${ICON.edit}</button>
    </header>

    <section class="card hero">
      <div class="clock big" data-live="clock" data-id="${t.id}"></div>
      <div class="sub">net time since ${fmtDateTime(t.startAt)}</div>
      <div class="progress"><i data-live="bar" data-id="${t.id}"></i></div>
      <div class="next" data-live="next" data-id="${t.id}"></div>
      <div class="btn-row">
        <button class="wave-btn lg" id="waveBtn">🌊 Ride the wave</button>
        <button class="slip-btn lg" id="slipBtn">I slipped</button>
      </div>
    </section>

    ${(() => {
      const pend = pendingReflections(t, now); if (!pend.length) return '';
      const s = pend[0];
      return `<section class="card reflect-card">
        <div class="section-title">📝 How did it actually go?${pend.length > 1 ? ` <span class="chip">${pend.length} waiting</span>` : ''}</div>
        <div class="sub">Slip on ${fmtDateTime(s.at)}</div>
        ${s.expect ? `<div class="expect"><span>You expected:</span> ${esc(s.expect)}</div>` : ''}
        <div class="row"><button class="btn" id="reflectBtn">Reflect now</button><button class="btn secondary" id="skipReflect">Skip</button></div>
      </section>`;
    })()}

    <section class="card">
      <div class="section-title">Trend · net time
        <span class="seg-ctl" role="tablist">
          ${[['7', '7D'], ['30', '30D'], ['all', 'All']].map(([v, l]) => `<button data-range="${v}" class="${ui.range === v ? 'on' : ''}">${l}</button>`).join('')}
        </span>
      </div>
      <div class="chart-wrap" id="chart"></div>
      <div class="legend"><span><i class="lg-slip"></i>Slip</span><span><i class="lg-wave"></i>Wave ridden</span><span><i class="lg-line"></i>Net time</span></div>
    </section>

    <section class="card">
      <div class="section-title">Calendar
        <span class="cal-nav"><button class="icon-btn sm" id="calPrev" aria-label="Previous month">${ICON.back}</button><button class="icon-btn sm flip" id="calNext" aria-label="Next month">${ICON.back}</button></span>
      </div>
      ${calendarHTML(t, now)}
      <div class="legend"><span><i class="lg-clean"></i>Clean day</span><span><i class="lg-slip"></i>Slip</span><span><i class="lg-wave"></i>Wave ridden</span><span>📝 Reflection</span></div>
    </section>

    <section class="card">
      <div class="section-title">Stats</div>
      <div class="stats">
        <div class="stat"><div class="v" data-live="clean" data-id="${t.id}"></div><div class="k">Current clean stretch</div></div>
        <div class="stat"><div class="v">${fmtShort(st.longest)}</div><div class="k">Longest clean stretch</div></div>
        <div class="stat"><div class="v">${Math.round(st.kept * 100)}%</div><div class="k">Of time kept</div><div class="d">${fmtShort(st.pen)} lost to ${t.slips.length} slip${t.slips.length === 1 ? '' : 's'}</div></div>
        <div class="stat"><div class="v">${st.wk}</div><div class="k">Slips last 7 days</div><div class="d">${wkNote}</div></div>
        <div class="stat"><div class="v">${st.avgGap ? fmtShort(st.avgGap) : '—'}</div><div class="k">Avg time between slips</div></div>
        <div class="stat"><div class="v">${st.rode}${st.waves ? `<small class="of"> / ${st.waves}</small>` : ''}</div><div class="k">Waves ridden out</div><div class="d">${st.avgBefore != null ? `urge ${st.avgBefore} → ${st.avgAfter} on avg` : 'use 🌊 when an urge hits'}</div></div>
        ${(() => {
          const r = t.slips.filter(s => s.worth);
          if (!r.length) return '';
          const n = k => r.filter(s => s.worth === k).length;
          return `<div class="stat wide"><div class="v">${n('no')} of ${r.length}</div><div class="k">Slips you later said were <b>not worth it</b></div><div class="d">${n('yes')} worth it · ${n('meh')} meh</div></div>`;
        })()}
        ${(() => {
          const tally = arrs => { const m = {}; arrs.flat().forEach(w => { if (EMOTION_BY_WORD[w]) m[w] = (m[w] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5); };
          const top = tally([...t.slips.map(s => s.feltBefore || []), ...t.waves.map(w => w.emotions || [])]);
          if (!top.length) return '';
          return `<div class="stat wide"><div class="k" style="margin:0 0 8px">Feelings that show up with your urges</div><div class="chips">${top.map(([w, n]) => `${emoChips([w])}<span class="cnt">×${n}</span>`).join('')}</div></div>`;
        })()}
      </div>
    </section>

    <section class="card">
      <div class="section-title">Milestones</div>
      <div class="ms-grid">
        ${MILESTONES.map((m, i) => `<div class="ms ${i <= mi.reached ? 'done' : i === mi.reached + 1 ? 'next' : ''}"><span class="e">${m.e}</span>${m.label}</div>`).join('')}
      </div>
    </section>

    <section class="card">
      <div class="section-title">History <button class="link-btn" id="pastSlip">+ Log past slip</button></div>
      ${events.length ? `<ul class="hist">${events.map(ev => ev.kind === 'slip' ? `
        <li data-slip-id="${ev.s.id}">
          <span class="dot"></span>
          <div><div class="when">${fmtDateTime(ev.at)}${ev.s.worth ? ` <span class="worth ${ev.s.worth}">${worthLabel(ev.s.worth)}</span>` : ''}</div>${ev.s.note ? `<div class="note">${esc(ev.s.note)}</div>` : ''}${ev.s.expect ? `<div class="note">🔮 ${esc(ev.s.expect)}</div>` : ''}${ev.s.actual ? `<div class="note">📝 ${esc(ev.s.actual)}</div>` : ''}${feelRow(ev.s.feltBefore, ev.s.feltAfter)}</div>
          <span class="pen">${ev.s.level ? `<small class="lv-tag">${levelLabel(ev.s.level)}</small>` : ''}−${hrs(ev.s.hours)}</span>
        </li>` : `
        <li data-wave-id="${ev.w.id}">
          <span class="dot ${ev.w.outcome === 'rode' ? 'wave' : ''}"></span>
          <div><div class="when">${fmtDateTime(ev.at)}</div><div class="note">${ev.w.outcome === 'rode' ? '🌊 Rode out' : 'Wave → slipped'} a ${ev.w.minutes}-min wave${ev.w.before ? ` · urge ${ev.w.before}${ev.w.after ? ` → ${ev.w.after}` : ''}` : ''}</div>${feelRow(ev.w.emotions)}</div>
          <span class="pen ok">${ev.w.outcome === 'rode' ? 'win' : ''}</span>
        </li>`).join('')}</ul>` : `<div class="empty-hist">No slips yet. Keep it going.</div>`}
    </section>
  `;
  $('#backBtn').onclick = () => { location.hash = ''; };
  $('#editBtn').onclick = () => openTimerSheet(t);
  $('#slipBtn').onclick = () => chooseSlip(t);
  $('#waveBtn').onclick = () => startWave(t);
  $('#pastSlip').onclick = () => openSlipSheet(t, null);
  $('#reflectBtn') && ($('#reflectBtn').onclick = () => openSlipSheet(t, pendingReflections(t)[0], 'reflect'));
  $('#skipReflect') && ($('#skipReflect').onclick = () => { pendingReflections(t)[0].skipReflect = true; save(); render(); });
  const shiftMonth = n => { const m = ui.month || thisMonth(); const d = new Date(m.y, m.m + n, 1); ui.month = { y: d.getFullYear(), m: d.getMonth() }; render(); };
  $('#calPrev').onclick = () => shiftMonth(-1);
  $('#calNext').onclick = () => shiftMonth(1);
  $$('[data-day]').forEach(c => c.onclick = () => openDaySheet(t, +c.dataset.day));
  $$('[data-range]').forEach(b => b.onclick = () => { ui.range = b.dataset.range; render(); });
  $$('[data-slip-id]').forEach(li => li.onclick = () => openSlipSheet(t, t.slips.find(s => s.id === li.dataset.slipId)));
  $$('[data-wave-id]').forEach(li => li.onclick = () => openWaveEntrySheet(t, t.waves.find(w => w.id === li.dataset.waveId)));
  drawChart(t);
}

/* ───────────── live updates ───────────── */
function tick() {
  const now = Date.now();
  $$('[data-live]').forEach(el => {
    const t = getTimer(el.dataset.id); if (!t) return;
    const net = netAt(t, now);
    switch (el.dataset.live) {
      case 'clock': el.innerHTML = clockHTML(net); el.classList.toggle('neg', net < 0); break;
      case 'sub': {
        const last = t.slips.length ? Math.max(...t.slips.map(s => s.at)) : null;
        el.textContent = last
          ? `Clean ${fmtShort(now - last)} since last slip · ${t.slips.length} slip${t.slips.length === 1 ? '' : 's'}`
          : `Since ${fmtDate(t.startAt)} · no slips yet`;
        break;
      }
      case 'bar': el.style.width = (milestoneInfo(net).pct * 100).toFixed(2) + '%'; break;
      case 'next': {
        const mi = milestoneInfo(net);
        el.textContent = mi.next ? `Next: ${mi.next.e} ${mi.next.label} in ${fmtShort(mi.next.ms - net)}` : 'Every milestone reached 👑';
        break;
      }
      case 'clean': {
        const last = t.slips.length ? Math.max(...t.slips.map(s => s.at)) : t.startAt;
        el.textContent = fmtShort(now - last);
        break;
      }
    }
  });
  checkCelebrations(now);
  tickWave(now);
}

function checkCelebrations(now) {
  if ($('.celebrate')) return;
  for (const t of state.timers) {
    const r = milestoneInfo(netAt(t, now)).reached;
    if (r > t.celebrated) {
      t.celebrated = r; save();
      celebrate(t, MILESTONES[r]);
      return;
    }
  }
}

function celebrate(t, m) {
  const el = document.createElement('div');
  el.className = 'celebrate';
  el.innerHTML = `<div class="box"><div class="e">${m.e}</div><h3>${m.label}!</h3><p>${esc(t.name)} — ${m.label} of net progress. That's real.</p><button class="btn block">Keep going</button></div>`;
  el.onclick = e => { if (e.target === el || e.target.closest('button')) el.remove(); };
  document.body.appendChild(el);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#4cc9a0', '#f0c050', '#ff6b5e', '#6aa8ff', '#c38bff'];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
    c.style.animationDelay = Math.random() * .4 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4000);
  }
}

/* ───────────── themes ───────────── */
// Preview colors for the settings swatches: [bg, surface, accent] for light and dark.
const THEMES = [
  { id: 'evergreen', name: 'Evergreen', light: ['#f6f5f2', '#ffffff', '#17805f'], dark: ['#0f1012', '#1a1b1f', '#4cc9a0'] },
  { id: 'dusk', name: 'Dusk', light: ['#f5f3fb', '#ffffff', '#6d4ee0'], dark: ['#121025', '#1c1936', '#a78bfa'] },
  { id: 'sunrise', name: 'Sunrise', light: ['#fff6ee', '#fffdfb', '#e8603c'], dark: ['#1a120e', '#251a15', '#ff8a65'] },
  { id: 'ocean', name: 'Ocean', light: ['#eef5fa', '#ffffff', '#0e7c9a'], dark: ['#0a1520', '#10202e', '#38bdf8'] },
  { id: 'mono', name: 'Mono', light: ['#fafafa', '#ffffff', '#0a0a0a'], dark: ['#000000', '#111111', '#fafafa'] },
];
const prefs = () => ({ theme: 'evergreen', mode: 'system', font: 'standard', ...(state.prefs || {}) });
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const p = prefs(), root = document.documentElement;
  const dark = p.mode === 'dark' || (p.mode === 'system' && darkMQ.matches);
  root.dataset.theme = p.theme;
  root.dataset.font = p.font;
  root.toggleAttribute('data-dark', dark);
  const th = THEMES.find(x => x.id === p.theme) || THEMES[0];
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', (dark ? th.dark : th.light)[0]);
}
darkMQ.addEventListener?.('change', applyTheme);
function setPref(k, v) { state.prefs = { ...prefs(), [k]: v }; save(); applyTheme(); }

/* ───────────── emotions ───────────── */
const MAX_EMOS = 3;
const emoStyle = e => `--q:var(--q-${e.quad});--mix:${18 + e.intensity * 15}%;`;
const emoChips = (words = []) => words.filter(w => EMOTION_BY_WORD[w])
  .map(w => `<span class="emo-chip" style="--q:var(--q-${EMOTION_BY_WORD[w].quad})">${esc(w)}</span>`).join('');
const emoField = (words = [], label = 'Name the feeling') =>
  `${emoChips(words)}<button type="button" class="add-emo">${words.length ? 'Edit' : '+ ' + label}</button>`;

// Mount an emotion field inside `host` that edits obj[key].
function bindEmoField(host, obj, key, title, label) {
  const draw = () => {
    host.innerHTML = emoField(obj[key] || [], label);
    $('.add-emo', host).onclick = () => openEmotionPicker({ title, selected: obj[key] || [], onDone: sel => { obj[key] = sel; draw(); host.dispatchEvent(new Event('emochange')); } });
  };
  draw();
}

function openEmotionPicker({ title = 'How are you feeling?', selected = [], onDone }) {
  const pk = { sel: [...selected], focus: null, view: 'quads', quad: null, q: '' };
  const el = document.createElement('div');
  el.className = 'emo-screen';
  document.body.appendChild(el);
  const finish = ok => { el.remove(); if (ok) onDone(pk.sel); };
  const toggle = w => {
    if (pk.sel.includes(w)) pk.sel = pk.sel.filter(x => x !== w);
    else if (pk.sel.length < MAX_EMOS) pk.sel.push(w);
    else return toast(`Pick up to ${MAX_EMOS} — remove one first`);
    refresh();
  };
  const selBar = () => pk.sel.length
    ? pk.sel.map(w => `<button class="emo-chip x" data-rm="${esc(w)}" style="--q:var(--q-${EMOTION_BY_WORD[w].quad})">${esc(w)} ✕</button>`).join('')
    : '<span class="muted">Pick up to 3 feelings</span>';

  function refresh() {
    const sb = $('#eSel', el); if (sb) sb.innerHTML = selBar();
    $$('[data-w]', el).forEach(b => { b.classList.toggle('on', pk.sel.includes(b.dataset.w)); b.classList.toggle('focus', pk.focus === b.dataset.w); });
    const done = $('#eDone', el); if (done) done.textContent = pk.sel.length ? `Done (${pk.sel.length})` : 'Done';
    const det = $('#eDetail', el);
    if (det) {
      const e = EMOTION_BY_WORD[pk.focus];
      det.innerHTML = e ? `
        <div class="ed-top"><span class="ed-dot" style="--q:var(--q-${e.quad})"></span><b>${esc(e.word)}</b><span class="muted">${QUADRANTS[e.quad].label}</span></div>
        <p>${esc(e.desc)}</p>
        <button class="btn block ${pk.sel.includes(e.word) ? 'secondary' : ''}" id="eToggle">${pk.sel.includes(e.word) ? 'Remove' : `Choose “${esc(e.word)}”`}</button>`
        : '<p class="muted center">Tap a feeling to see what it means.<br>Tap it again to choose it.</p>';
      $('#eToggle', det) && ($('#eToggle', det).onclick = () => toggle(e.word));
    }
  }

  function draw() {
    const head = left => `<header class="bar">${left}<h2>${esc(title)}</h2><button class="done-btn" id="eDone">Done</button></header>`;
    const closeBtn = `<button class="icon-btn" id="eClose" aria-label="Cancel">${ICON.close}</button>`;
    const backBtn = `<button class="icon-btn" id="eBack" aria-label="Back">${ICON.back}</button>`;
    if (pk.view === 'quads') {
      el.innerHTML = `${head(closeBtn)}
        <div class="emo-body">
          <p class="lead">Which color is closest to how you feel?</p>
          <div class="quad-axis">↑ More energy</div>
          <div class="quad-grid">
            ${['red', 'yellow', 'blue', 'green'].map(q => `
              <button class="quad-tile" data-q="${q}" style="--q:var(--q-${q});--qi:var(--q-${q}-ink)">
                <b>${QUADRANTS[q].label.replace(' · ', '<br>')}</b><small>${QUADRANTS[q].hint}</small>
              </button>`).join('')}
          </div>
          <div class="quad-axis">↓ Less energy</div>
          <div class="quad-axis-x"><span>← Unpleasant</span><span>Pleasant →</span></div>
          <div class="emo-sel" id="eSel"></div>
          <button class="btn secondary block" id="eList">Browse all feelings as a list</button>
        </div>`;
      $$('.quad-tile', el).forEach(b => b.onclick = () => { pk.view = 'grid'; pk.quad = b.dataset.q; draw(); });
      $('#eList', el).onclick = () => { pk.view = 'list'; draw(); };
    } else {
      el.innerHTML = `${head(backBtn)}
        <div class="emo-sel" id="eSel"></div>
        <div class="emo-tabs"><span class="seg-ctl"><button data-view="grid" class="${pk.view === 'grid' ? 'on' : ''}">Map</button><button data-view="list" class="${pk.view === 'list' ? 'on' : ''}">List</button></span></div>
        ${pk.view === 'grid' ? `
          <div class="emo-scroll" id="eScroll"><div class="emo-grid">
            ${EMOTIONS.map(e => `<button class="emo${e.word.length > 9 ? ' long' : ''}" data-w="${esc(e.word)}" data-strong="${e.intensity >= 3 ? 1 : 0}" style="${emoStyle(e)}grid-row:${e.row + 1 + (e.row >= 5 ? 1 : 0)};grid-column:${e.col + 1 + (e.col >= 5 ? 1 : 0)}">${esc(e.word)}</button>`).join('')}
          </div></div>
          <div class="emo-detail" id="eDetail"></div>` : `
          <div class="emo-scroll list">
            <input class="emo-search" id="eSearch" type="search" placeholder="Search feelings or descriptions" value="${esc(pk.q)}">
            ${Object.keys(QUADRANTS).map(q => `
              <h4 class="emo-h" data-qh="${q}"><span class="ed-dot" style="--q:var(--q-${q})"></span>${QUADRANTS[q].label}</h4>
              ${EMOTIONS.filter(e => e.quad === q).sort((a, b) => a.word.localeCompare(b.word)).map(e => `
                <button class="emo-row" data-w="${esc(e.word)}" data-q="${q}" style="--q:var(--q-${q})">
                  <span class="ed-dot"></span><span class="er-txt"><b>${esc(e.word)}</b><small>${esc(e.desc)}</small></span><span class="er-check">✓</span>
                </button>`).join('')}`).join('')}
          </div>`}`;
      $('#eBack', el).onclick = () => { pk.view = 'quads'; pk.focus = null; draw(); };
      $$('[data-view]', el).forEach(b => b.onclick = () => { pk.view = b.dataset.view; draw(); });
      if (pk.view === 'grid') {
        $$('.emo', el).forEach(b => b.onclick = () => { if (pk.focus === b.dataset.w) toggle(b.dataset.w); else { pk.focus = b.dataset.w; refresh(); } });
        // Start scrolled to the chosen quadrant
        const sc = $('#eScroll', el), anchor = { red: [2, 2], yellow: [2, 7], blue: [7, 2], green: [7, 7] }[pk.quad || 'red'];
        const a = EMOTIONS.find(e => e.row === anchor[0] && e.col === anchor[1]);
        const ab = $(`[data-w="${a.word}"]`, el);
        requestAnimationFrame(() => { sc.scrollLeft = ab.offsetLeft + ab.offsetWidth / 2 - sc.clientWidth / 2; sc.scrollTop = ab.offsetTop + ab.offsetHeight / 2 - sc.clientHeight / 2; });
      } else {
        $$('.emo-row', el).forEach(b => b.onclick = () => toggle(b.dataset.w));
        const filter = () => {
          const q = pk.q.toLowerCase();
          $$('.emo-row', el).forEach(r => { const e = EMOTION_BY_WORD[r.dataset.w]; r.hidden = !!q && !(e.word.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q)); });
          $$('[data-qh]', el).forEach(h => { h.hidden = !$$(`.emo-row[data-q="${h.dataset.qh}"]`, el).some(r => !r.hidden); });
        };
        $('#eSearch', el).oninput = e => { pk.q = e.target.value; filter(); };
        filter();
      }
    }
    $('#eClose', el) && ($('#eClose', el).onclick = () => finish(false));
    $('#eDone', el).onclick = () => finish(true);
    el.onclick = e => { const b = e.target.closest('[data-rm]'); if (b) toggle(b.dataset.rm); };
    refresh();
  }
  draw();
}

/* ───────────── calendar ───────────── */
const thisMonth = () => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; };
const dayStart = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const nextDay = ms => { const d = new Date(ms); d.setDate(d.getDate() + 1); return d.getTime(); };

function eventsOnDay(t, day) {
  const end = nextDay(day), inDay = x => x.at >= day && x.at < end;
  return { slips: t.slips.filter(inDay).sort((a, b) => a.at - b.at), waves: t.waves.filter(inDay).sort((a, b) => a.at - b.at) };
}

function calendarHTML(t, now) {
  const { y, m } = ui.month || thisMonth();
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
  const today = dayStart(now), startDay = dayStart(t.startAt);
  const wd = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' }));
  let cells = '';
  for (let i = 0; i < first.getDay(); i++) cells += '<div class="cal-cell pad"></div>';
  for (let n = 1; n <= days; n++) {
    const day = new Date(y, m, n).getTime();
    const { slips, waves } = eventsOnDay(t, day);
    const rode = waves.filter(w => w.outcome === 'rode').length;
    const tracked = day >= startDay && day <= today;
    const cls = ['cal-cell'];
    if (!tracked) cls.push('off');
    else if (slips.length) cls.push('slipped');
    else if (day < today || now - day > 0) cls.push('clean');
    if (day === today) cls.push('today');
    const reflected = slips.some(s => s.actual || s.worth);
    const marks = (slips.length ? `<i class="m-slip">${slips.length > 1 ? slips.length : ''}</i>` : '') + (rode ? '<i class="m-wave"></i>' : '') + (reflected ? '<i class="m-note">📝</i>' : '');
    const has = slips.length || waves.length;
    cells += `<${has ? 'button' : 'div'} class="${cls.join(' ')}" ${has ? `data-day="${day}"` : ''} aria-label="${new Date(day).toDateString()}${has ? `: ${slips.length} slips, ${rode} waves ridden` : ''}"><span class="dn">${n}</span><span class="marks">${marks}</span></${has ? 'button' : 'div'}>`;
  }
  const title = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return `<div class="cal-title">${title}</div><div class="cal">${wd.map(d => `<div class="cal-wd">${d}</div>`).join('')}${cells}</div>`;
}

function openDaySheet(t, day) {
  const { slips, waves } = eventsOnDay(t, day);
  const title = new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  openSheet(`
    <h3>${title}</h3>
    ${slips.map(s => `
      <div class="day-entry slip" data-sid="${s.id}">
        <div class="de-head"><span class="dot"></span><b>Slip · ${fmtTime(s.at)}${s.level ? ` · ${levelLabel(s.level)}` : ''}</b><span class="pen">−${hrs(s.hours)}</span></div>
        ${s.note ? `<div class="de-row"><span>Trigger</span>${esc(s.note)}</div>` : ''}
        ${s.feltBefore?.length ? `<div class="de-row"><span>😶 Feeling before</span><div class="chips">${emoChips(s.feltBefore)}</div></div>` : ''}
        <div class="de-row"><span>🔮 Expected</span>${s.expect ? esc(s.expect) : '<em>—</em>'}</div>
        <div class="de-row"><span>📝 Actually</span>${s.actual ? esc(s.actual) : '<em>not reflected yet</em>'}</div>
        ${s.feltAfter?.length ? `<div class="de-row"><span>💭 Feeling after</span><div class="chips">${emoChips(s.feltAfter)}</div></div>` : ''}
        ${s.worth ? `<div class="de-row"><span>Verdict</span><span class="worth ${s.worth}">${worthLabel(s.worth)}</span></div>` : ''}
        <button class="link-btn" data-edit="${s.id}">${s.actual ? 'Edit' : 'Reflect now'}</button>
      </div>`).join('')}
    ${waves.map(w => `
      <div class="day-entry wave">
        <div class="de-head"><span class="dot wave"></span><b>${w.outcome === 'rode' ? '🌊 Rode out a wave' : 'Wave → slipped'} · ${fmtTime(w.at)}</b></div>
        <div class="de-row"><span>Length</span>${w.minutes} min${w.before ? ` · urge ${w.before} → ${w.after || '?'}` : ''}</div>
        ${w.emotions?.length ? `<div class="de-row"><span>Feeling</span><div class="chips">${emoChips(w.emotions)}</div></div>` : ''}
        ${w.expect ? `<div class="de-row"><span>🔮 Predicted</span>${esc(w.expect)}</div>` : ''}
        ${w.done?.length ? `<div class="de-row"><span>Did instead</span>${w.done.map(esc).join(', ')}</div>` : ''}
      </div>`).join('')}
  `, sheet => {
    $$('[data-edit]', sheet).forEach(b => b.onclick = () => {
      const s = t.slips.find(x => x.id === b.dataset.edit);
      openSlipSheet(t, s, s.actual ? 'note' : 'reflect');
    });
  });
}

/* ───────────── chart ───────────── */
function niceStep(range, count) {
  const raw = range / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

function drawChart(t) {
  const wrap = $('#chart'); if (!wrap) return;
  const now = Date.now();
  const span = { '7': 7 * D, '30': 30 * D, all: Infinity }[ui.range];
  const x0 = Math.max(t.startAt, now - span), x1 = now;
  if (x1 - x0 < 5 * MIN) { wrap.innerHTML = '<div class="chart-empty">The chart fills in as time passes.</div>'; return; }

  // Net time rises 1:1 with the clock and drops by the penalty at each slip.
  let v = netAt(t, x0), prevT = x0;
  const pts = [[x0, v]], slipMarks = [];
  for (const s of sortedSlips(t)) {
    if (s.at <= x0 || s.at > x1) continue;
    v += s.at - prevT; pts.push([s.at, v]);
    v -= s.hours * H; pts.push([s.at, v]);
    slipMarks.push({ t: s.at, v, s });
    prevT = s.at;
  }
  v += x1 - prevT; pts.push([x1, v]);
  const waveMarks = t.waves.filter(w => w.outcome === 'rode' && w.at > x0 && w.at <= x1).map(w => ({ t: w.at, v: netAt(t, w.at), w }));

  const vals = pts.map(p => p[1]);
  const maxAbs = Math.max(...vals.map(Math.abs));
  const unit = maxAbs < 2 * D ? H : D, uLabel = unit === H ? 'h' : 'd';
  let lo = Math.min(0, ...vals) / unit, hi = Math.max(...vals, unit) / unit;
  const step = niceStep(hi - lo || 1, 4);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;

  const W = wrap.clientWidth || 320, HT = 200, pl = 36, pr = 10, pt = 10, pb = 24;
  const X = tm => pl + (tm - x0) / (x1 - x0) * (W - pl - pr);
  const Y = val => pt + (1 - (val / unit - lo) / (hi - lo)) * (HT - pt - pb);

  let grid = '';
  for (let g = lo; g <= hi + 1e-9; g += step) {
    const y = Y(g * unit).toFixed(1);
    grid += `<line class="${Math.abs(g) < 1e-9 && lo < 0 ? 'zero' : 'grid'}" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/>`;
    grid += `<text class="axis" x="${pl - 6}" y="${+y + 4}" text-anchor="end">${+g.toFixed(2)}${uLabel}</text>`;
  }
  const short = x1 - x0 < 2 * D;
  let xt = '';
  const nX = W < 400 ? 3 : 4;
  for (let i = 0; i <= nX; i++) {
    const tm = x0 + (x1 - x0) * i / nX;
    const anchor = i === 0 ? 'start' : i === nX ? 'end' : 'middle';
    xt += `<text class="axis" x="${X(tm).toFixed(1)}" y="${HT - 6}" text-anchor="${anchor}">${i === nX ? 'Now' : short ? fmtTime(tm) : fmtDate(tm)}</text>`;
  }
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
  const area = `${line}L${X(x1).toFixed(1)},${Y(0).toFixed(1)}L${X(x0).toFixed(1)},${Y(0).toFixed(1)}Z`;
  const dots = slipMarks.map(m => `<circle class="slipdot" r="4.5" cx="${X(m.t).toFixed(1)}" cy="${Y(m.v).toFixed(1)}"/>`).join('')
    + waveMarks.map(m => `<circle class="wavedot" r="4.5" cx="${X(m.t).toFixed(1)}" cy="${Y(m.v).toFixed(1)}"/>`).join('');

  wrap.innerHTML = `
    <svg width="${W}" height="${HT}" viewBox="0 0 ${W} ${HT}" role="img" aria-label="Net time trend for ${esc(t.name)}">
      ${grid}${xt}
      <path class="area" d="${area}"/><path class="line" d="${line}"/>
      <g class="hov" style="display:none"><line class="xh" y1="${pt}" y2="${HT - pb}"/><circle class="hdot" r="5"/></g>
      ${dots}
      <rect x="${pl}" y="0" width="${W - pl - pr}" height="${HT}" fill="transparent" class="hit"/>
    </svg>
    <div class="tip"></div>`;

  const svg = $('svg', wrap), hov = $('.hov', svg), tip = $('.tip', wrap);
  const show = e => {
    const r = svg.getBoundingClientRect();
    const px = Math.max(pl, Math.min(W - pr, e.clientX - r.left));
    const all = [...slipMarks.map(m => ({ ...m, k: 'slip' })), ...waveMarks.map(m => ({ ...m, k: 'wave' }))];
    const near = all.map(m => ({ m, d: Math.abs(X(m.t) - px) })).filter(o => o.d < 14).sort((a, b) => a.d - b.d)[0]?.m;
    const tm = near ? near.t : x0 + (px - pl) / (W - pl - pr) * (x1 - x0);
    const val = near ? near.v : netAt(t, tm);
    const cx = X(tm), cy = Y(val);
    hov.style.display = '';
    $('.xh', hov).setAttribute('x1', cx); $('.xh', hov).setAttribute('x2', cx);
    $('.hdot', hov).setAttribute('cx', cx); $('.hdot', hov).setAttribute('cy', cy);
    tip.innerHTML = near?.k === 'slip'
      ? `<b>Slip −${hrs(near.s.hours)}</b> · ${fmtDateTime(tm)}${near.s.note ? `<br>${esc(near.s.note.slice(0, 60))}` : ''}`
      : near?.k === 'wave'
        ? `<b>🌊 Rode out a wave</b><br>${fmtDateTime(tm)}${near.w.before ? ` · urge ${near.w.before}→${near.w.after || '?'}` : ''}`
        : `<b>${fmtShort(val)}</b> net<br>${fmtDateTime(tm)}`;
    tip.style.left = Math.max(70, Math.min(W - 70, cx)) + 'px';
    tip.style.top = Math.max(-44, cy - 58) + 'px';
    tip.classList.add('show');
  };
  const hide = () => { hov.style.display = 'none'; tip.classList.remove('show'); };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', hide);
}
let resizeT;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { const m = location.hash.match(/^#\/t\/(.+)$/); m && getTimer(m[1]) && drawChart(getTimer(m[1])); }, 150); });

/* ───────────── sheets ───────────── */
function openTimerSheet(t) {
  const isNew = !t;
  const d = t || { name: '', startAt: Date.now(), pen: { tiny: 1, low: 3, med: 4, high: 6 }, penDesc: { tiny: '', low: '', med: '', high: '' }, waveMin: 10, message: DEFAULT_MSG, alts: DEFAULT_ALTS };
  openSheet(`
    <h3>${isNew ? 'New timer' : 'Edit timer'}</h3>
    <form id="tf">
      <label class="field"><span>What are you quitting?</span><input name="name" required maxlength="60" placeholder="e.g. Doomscrolling" value="${esc(d.name)}"></label>
      <label class="field"><span>Quit date & time</span><input name="start" type="datetime-local" required value="${toLocalInput(d.startAt)}" max="${toLocalInput(Date.now())}">
        <div class="hint">Backdate it if you already started.</div></label>
      <div class="field"><span>Penalty per slip (hours)</span>
        <div class="pen-grid">${LEVELS.map(([k, label, e]) => `
          <label class="pen-cell"><small>${e} ${label}</small><input name="pen_${k}" type="number" inputmode="decimal" min="0" max="8760" step="0.5" required value="${d.pen[k]}"></label>`).join('')}
        </div>
        <div class="hint">Changing these only affects future slips.</div></div>
      <div class="field emerg-field"><span>⚕︎ Emergency use penalty (hours)</span>
        <div class="emerg-row"><input name="pen_tiny" type="number" inputmode="decimal" min="0" max="8760" step="0.5" required value="${d.pen.tiny}">
        <div class="hint">Kept separate from the main choices and always asks you to confirm.</div></div>
        <label class="pen-desc-row" style="margin-top:8px"><small>What counts</small><textarea name="desc_tiny" maxlength="200" rows="2" placeholder="${EMERGENCY_DEF}">${esc(d.penDesc.tiny || EMERGENCY_DEF)}</textarea></label></div>
      <div class="field"><span>What counts as each level? <em class="muted">(optional, but decide now while you're clear-headed)</em></span>
        ${LEVELS.map(([k, label, e]) => `<label class="pen-desc-row"><small>${e} ${label}</small><input name="desc_${k}" maxlength="80" placeholder="e.g. ${{ low: 'under 15 minutes', med: 'up to an hour', high: 'lost the evening' }[k]}" value="${esc(d.penDesc[k])}"></label>`).join('')}
      </div>
      <label class="field"><span>🌊 Ride-the-wave length (minutes)</span><input name="wave" type="number" inputmode="numeric" min="1" max="120" required value="${d.waveMin}">
        <div class="quick" data-for="wave">${[5, 10, 15, 20].map(m => `<button type="button" data-v="${m}" class="${+d.waveMin === m ? 'on' : ''}">${m} min</button>`).join('')}</div></label>
      <label class="field"><span>Message to yourself (shown when an urge hits)</span><textarea name="msg" maxlength="500">${esc(d.message)}</textarea></label>
      <label class="field"><span>Alternative activities (one per line)</span><textarea name="alts" rows="6">${esc(d.alts.join('\n'))}</textarea></label>
      <div class="stack">
        <button class="btn block" type="submit">${isNew ? 'Start timer' : 'Save'}</button>
        ${isNew ? '' : '<button class="btn danger block" type="button" id="delTimer">Delete timer</button>'}
      </div>
    </form>`, sheet => {
    const f = $('#tf', sheet);
    $$('.quick', sheet).forEach(q => q.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      f.elements[q.dataset.for].value = b.dataset.v;
      $$('button', q).forEach(x => x.classList.toggle('on', x === b));
    }));
    if (isNew) setTimeout(() => f.elements.name.focus(), 250);
    f.onsubmit = e => {
      e.preventDefault();
      const startAt = Math.min(fromLocalInput(f.elements.start.value), Date.now());
      if (!isFinite(startAt)) return toast('Pick a valid date');
      const vals = {
        name: f.elements.name.value.trim() || 'Untitled',
        startAt,
        pen: Object.fromEntries(ALL_LEVELS.map(([k]) => [k, Math.max(0, +f.elements['pen_' + k].value || 0)])),
        penDesc: Object.fromEntries(ALL_LEVELS.map(([k]) => [k, f.elements['desc_' + k].value.trim()])),
        waveMin: Math.max(1, Math.round(+f.elements.wave.value || 10)),
        message: f.elements.msg.value.trim(),
        alts: f.elements.alts.value.split('\n').map(s => s.trim()).filter(Boolean),
      };
      if (isNew) {
        const nt = normalizeTimer(vals);
        nt.celebrated = milestoneInfo(netAt(nt, Date.now())).reached; // don't celebrate backdated time
        state.timers.push(nt);
        save(); closeSheet(); location.hash = '#/t/' + nt.id;
      } else {
        if (t.slips.some(s => s.at < startAt)) return toast('Some slips are before that date — delete them first');
        Object.assign(t, vals); save(); closeSheet(); render();
      }
    };
    $('#delTimer', sheet) && ($('#delTimer', sheet).onclick = () => {
      if (!confirm(`Delete “${t.name}” and all its history? This can't be undone.`)) return;
      state.timers = state.timers.filter(x => x !== t);
      save(); closeSheet(); location.hash = '';
      render();
    });
  });
}

const feelRow = (before = [], after = []) => (before.length || after.length)
  ? `<div class="chips">${emoChips(before)}${after.length ? `<span class="arrow">→</span>${emoChips(after)}` : ''}</div>` : '';

const WORTH = [['yes', 'Worth it'], ['meh', 'Meh'], ['no', 'Not worth it']];
const worthLabel = v => (WORTH.find(w => w[0] === v) || [])[1] || '';

function openSlipSheet(t, slip, focus) {
  const isNew = !slip;
  const d = slip || { at: Date.now(), hours: t.pen.med, level: 'med', note: '', expect: '', actual: '', worth: null };
  const reflectOnly = focus === 'reflect';
  openSheet(`
    <h3>${reflectOnly ? 'How did it actually go?' : isNew ? 'Log a past slip' : 'Slip'}</h3>
    ${reflectOnly ? `<p class="sub">Slip on ${fmtDateTime(d.at)}. Be honest — this is just for you.</p>` : ''}
    <form id="sf">
      <div ${reflectOnly ? 'hidden' : ''}>
      <label class="field"><span>When</span><input name="at" type="datetime-local" required value="${toLocalInput(d.at)}" min="${toLocalInput(t.startAt)}" max="${toLocalInput(Date.now())}"></label>
      <label class="field"><span>How much? / Penalty (hours)</span>
        <div class="quick" id="lvl">${ALL_LEVELS.map(([k, label, e]) => `<button type="button" data-v="${k}" class="${d.level === k ? 'on' : ''}">${e} ${label} · ${hrs(t.pen[k])}</button>`).join('')}</div>
        <input name="hours" type="number" inputmode="decimal" min="0" step="0.5" required value="${d.hours}" style="margin-top:8px"></label>
      <label class="field"><span>Trigger / note (optional)</span><textarea name="note" maxlength="500" placeholder="What triggered it? How were you feeling?">${esc(d.note)}</textarea></label>
      </div>
      <div class="field"><span>😶 How I was feeling beforehand</span><div class="emo-field" id="feltBefore"></div></div>
      <label class="field"><span>🔮 What I thought would happen</span><textarea name="expect" maxlength="1000" placeholder="What did you expect doing it would be like?">${esc(d.expect)}</textarea></label>
      <label class="field"><span>📝 What actually happened</span><textarea name="actual" maxlength="1000" placeholder="How did you feel after? What did it cost you?">${esc(d.actual)}</textarea></label>
      <div class="field"><span>💭 How I feel now, after</span><div class="emo-field" id="feltAfter"></div></div>
      <div class="field"><span>Was it worth it?</span>
        <div class="quick" id="worth">${WORTH.map(([v, l]) => `<button type="button" data-v="${v}" class="${d.worth === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="stack">
        <button class="btn block" type="submit">Save</button>
        ${isNew || reflectOnly ? '' : '<button class="btn danger block" type="button" id="delSlip">Delete slip (refund penalty)</button>'}
      </div>
    </form>`, sheet => {
    const f = $('#sf', sheet);
    let worth = d.worth;
    let level = d.level || null;
    $('#lvl', sheet).onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      level = b.dataset.v; f.elements.hours.value = t.pen[level];
      $$('#lvl button', sheet).forEach(x => x.classList.toggle('on', x === b));
    };
    const felt = { feltBefore: [...(d.feltBefore || [])], feltAfter: [...(d.feltAfter || [])] };
    bindEmoField($('#feltBefore', sheet), felt, 'feltBefore', 'How were you feeling?', 'Add feelings');
    bindEmoField($('#feltAfter', sheet), felt, 'feltAfter', 'How do you feel now?', 'Add feelings');
    $('#worth', sheet).onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      worth = worth === b.dataset.v ? null : b.dataset.v;
      $$('#worth button', sheet).forEach(x => x.classList.toggle('on', x.dataset.v === worth));
    };
    if (focus) setTimeout(() => f.elements[reflectOnly ? 'actual' : 'note'].focus(), 250);
    f.onsubmit = e => {
      e.preventDefault();
      const at = fromLocalInput(f.elements.at.value);
      if (!isFinite(at) || at < t.startAt || at > Date.now() + MIN) return toast('Time must be between the quit date and now');
      const vals = {
        at: Math.min(at, Date.now()), hours: Math.max(0, +f.elements.hours.value || 0), note: f.elements.note.value.trim(),
        expect: f.elements.expect.value.trim(), actual: f.elements.actual.value.trim(), worth, ...felt, level,
      };
      if (isNew) t.slips.push({ id: uid(), ...vals }); else Object.assign(slip, vals);
      save(); closeSheet(); render();
    };
    $('#delSlip', sheet) && ($('#delSlip', sheet).onclick = () => {
      t.slips = t.slips.filter(s => s !== slip); save(); closeSheet(); render();
      toast('Slip deleted', [{ label: 'Undo', fn: () => { t.slips.push(slip); save(); render(); } }]);
    });
  });
}

function openWaveEntrySheet(t, w) {
  openSheet(`
    <h3>${w.outcome === 'rode' ? '🌊 Wave ridden' : 'Wave'}</h3>
    <p class="sub">${fmtDateTime(w.at)} · ${w.minutes} min${w.before ? ` · urge ${w.before} → ${w.after || '?'}` : ''}</p>
    ${w.done?.length ? `<p class="sub">Did: ${w.done.map(esc).join(', ')}</p>` : ''}
    <button class="btn danger block" id="delWave">Delete entry</button>`, sheet => {
    $('#delWave', sheet).onclick = () => { t.waves = t.waves.filter(x => x !== w); save(); closeSheet(); render(); };
  });
}

function openSettings() {
  openSheet(`
    <h3>Settings</h3>
    <div class="section-title">Theme</div>
    <div class="theme-grid">${THEMES.map(th => {
      const c = document.documentElement.hasAttribute('data-dark') ? th.dark : th.light;
      return `<button class="theme-sw ${prefs().theme === th.id ? 'on' : ''}" data-theme-id="${th.id}" style="background:${c[0]}">
        <span class="ts-card" style="background:${c[1]}"><i style="background:${c[2]}"></i><i style="background:${c[2]};opacity:.35;width:60%"></i></span>
        <span class="ts-name" style="color:${c[2]}">${th.name}</span></button>`;
    }).join('')}</div>
    <div class="set-row"><span>Appearance</span><span class="seg-ctl" id="modeCtl">${[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<button data-v="${v}" class="${prefs().mode === v ? 'on' : ''}">${l}</button>`).join('')}</span></div>
    <div class="set-row"><span>Font</span><span class="seg-ctl" id="fontCtl">${[['standard', 'Standard'], ['rounded', 'Rounded']].map(([v, l]) => `<button data-v="${v}" class="${prefs().font === v ? 'on' : ''}">${l}</button>`).join('')}</span></div>
    <div class="section-title" style="margin-top:22px">Backup</div>
    <p class="sub">Your data lives only on this device. Export a backup now and then (especially before switching phones or clearing Safari data).</p>
    <div class="stack">
      <button class="btn block" id="exportBtn">Export backup</button>
      <label class="btn secondary block" style="display:block;text-align:center">Import backup<input type="file" id="importIn" accept="application/json,.json" hidden></label>
    </div>`, sheet => {
    const reopen = () => { const top = sheet.scrollTop; render(); openSettings(); $('.sheet').scrollTop = top; };
    $$('[data-theme-id]', sheet).forEach(b => b.onclick = () => { setPref('theme', b.dataset.themeId); reopen(); });
    $$('#modeCtl button', sheet).forEach(b => b.onclick = () => { setPref('mode', b.dataset.v); reopen(); });
    $$('#fontCtl button', sheet).forEach(b => b.onclick = () => { setPref('font', b.dataset.v); reopen(); });
    $('#exportBtn', sheet).onclick = exportData;
    $('#importIn', sheet).onchange = e => importData(e.target.files[0]);
  });
}

async function exportData() {
  const name = `since-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify({ app: 'since', version: 1, exportedAt: Date.now(), timers: state.timers }, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Since backup' }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importData(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.timers)) throw new Error('bad');
    if (!confirm(`Replace your current ${state.timers.length} timer(s) with ${data.timers.length} from this backup?`)) return;
    state.timers = data.timers.map(normalizeTimer);
    state.timers.forEach(t => { t.celebrated = Math.max(t.celebrated, milestoneInfo(netAt(t, Date.now())).reached); });
    save(); closeSheet(); location.hash = ''; render();
    toast('Backup restored');
  } catch (e) { toast("That file doesn't look like a Since backup"); }
}

/* ───────────── ride the wave ───────────── */
let wakeLock = null, audioCtx = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* not supported / denied */ }
}
function chime() {
  try {
    if (!audioCtx) return;
    [0, .25, .5].forEach((d, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = [523.25, 659.25, 783.99][i];
      g.gain.setValueAtTime(.0001, audioCtx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(.2, audioCtx.currentTime + d + .03);
      g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + d + 1.2);
      o.connect(g).connect(audioCtx.destination);
      o.start(audioCtx.currentTime + d); o.stop(audioCtx.currentTime + d + 1.3);
    });
  } catch (e) { /* ignore */ }
}

function startWave(t) {
  state.wave = { timerId: t.id, phase: 'setup', minutes: t.waveMin, before: null, after: null, done: [] };
  save(); renderWave();
}
function endWave() {
  state.wave = null; save(); keepAwake(false);
  $('#wave')?.remove(); document.body.style.overflow = '';
}

const ratingHTML = (name, val) => `<div class="rating" data-rating="${name}">${Array.from({ length: 10 }, (_, i) => `<button type="button" data-v="${i + 1}" class="${val === i + 1 ? 'on' : ''}">${i + 1}</button>`).join('')}</div><div class="rating-scale"><span>mild</span><span>overwhelming</span></div>`;

function renderWave() {
  const w = state.wave;
  let el = $('#wave');
  if (!w) { el?.remove(); return; }
  const t = getTimer(w.timerId);
  if (!t) { endWave(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'wave'; el.className = 'wave-screen'; document.body.appendChild(el); }
  document.body.style.overflow = 'hidden';
  el.dataset.phase = w.phase;
  const head = `<header class="bar"><button class="icon-btn" id="wClose" aria-label="Close">${ICON.close}</button><h2>🌊 Ride the wave</h2><span style="width:40px"></span></header>`;

  if (w.phase === 'setup') {
    el.innerHTML = `${head}<div class="wave-body">
      <p class="lead">An urge is a wave. It rises, peaks, and passes — you don't have to act on it. Let's ride this one out.</p>
      <div class="card"><div class="section-title">How strong is the urge right now?</div>${ratingHTML('before', w.before)}</div>
      <div class="card"><div class="section-title">What are you feeling underneath it?</div><div class="emo-field" id="wEmo"></div></div>
      <div class="card"><div class="section-title">Ride it for</div>
        <div class="quick" id="wMin">${[5, 10, 15, 20, 30].map(m => `<button type="button" data-v="${m}" class="${w.minutes === m ? 'on' : ''}">${m} min</button>`).join('')}</div></div>
      <button class="btn block big-btn" id="wStart">Start riding</button>
    </div>`;
    bindEmoField($('#wEmo', el), w, 'emotions', 'What are you feeling?', 'Name the feeling');
    $('#wEmo', el).addEventListener('emochange', save);
    $('#wMin', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; w.minutes = +b.dataset.v; save(); renderWave(); };
    $('#wStart', el).onclick = () => {
      try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { /* no audio */ }
      w.phase = 'run'; w.startAt = Date.now(); w.endAt = w.startAt + w.minutes * MIN;
      save(); keepAwake(true); renderWave();
    };
  } else if (w.phase === 'run') {
    el.innerHTML = `${head}<div class="wave-body">
      <div class="ring-wrap">
        <svg viewBox="0 0 220 220" class="ring"><circle cx="110" cy="110" r="96" class="ring-bg"/><circle cx="110" cy="110" r="96" class="ring-fg" id="wRing"/></svg>
        <div class="breath"><div class="bubble"></div></div>
        <div class="ring-center"><div class="count num" id="wCount"></div><div class="breath-txt" id="wBreath"></div></div>
      </div>
      ${w.emotions?.length ? `<div class="emo-running">Feeling ${emoChips(w.emotions)} — that makes sense. Let it be there.</div>` : ''}
      ${t.message ? `<div class="card msg-card"><div class="section-title">Note to self</div><div class="msg">${esc(t.message)}</div></div>` : ''}
      <div class="card tip-card"><div class="section-title">Try this</div><div id="wTip" class="wtip"></div></div>
      ${t.alts.length ? `<div class="card"><div class="section-title">Do one of these instead</div>
        <ul class="alts">${t.alts.map((a, i) => `<li><label><input type="checkbox" data-alt="${i}" ${w.done.includes(a) ? 'checked' : ''}><span>${esc(a)}</span></label></li>`).join('')}</ul></div>` : ''}
      <div class="card"><div class="section-title">Play the tape forward</div>
        <label class="field" style="margin:0"><span>If I do it, what do I think will happen? How will I feel after — in an hour, tomorrow?</span>
        <textarea id="wExpect" maxlength="1000" placeholder="e.g. It'll feel good for 10 minutes, then I'll feel foggy and annoyed at myself and lose the evening.">${esc(w.expect || '')}</textarea></label></div>
      <div class="stack">
        <button class="btn block secondary" id="wEarly">The urge has passed — finish now</button>
        <button class="btn block danger ghost" id="wChoose">I'm choosing to do it</button>
      </div>
    </div>`;
    $('#wExpect', el).oninput = e => { w.expect = e.target.value; save(); };
    $('#wChoose', el).onclick = () => {
      const mins = Math.max(1, Math.round((Date.now() - w.startAt) / MIN));
      const extra = { expect: w.expect || '', feltBefore: w.emotions || [] };
      // Only end the wave once a level is picked; closing the sheet keeps you riding.
      chooseSlip(t, extra, () => {
        t.waves.push({ id: uid(), at: Date.now(), minutes: mins, before: w.before, after: null, done: w.done, expect: w.expect || '', emotions: w.emotions || [], outcome: 'slipped' });
        endWave();
      });
    };
    $$('[data-alt]', el).forEach(cb => cb.onchange = () => {
      const a = t.alts[+cb.dataset.alt];
      w.done = cb.checked ? [...new Set([...w.done, a])] : w.done.filter(x => x !== a);
      save();
    });
    $('#wEarly', el).onclick = () => { w.phase = 'done'; w.endedAt = Date.now(); save(); keepAwake(false); renderWave(); };
  } else {
    const mins = Math.max(1, Math.round(((w.endedAt || w.endAt) - w.startAt) / MIN));
    el.innerHTML = `${head}<div class="wave-body">
      <div class="done-hero"><div class="e">🌊</div><h3>You stayed with it for ${mins} minute${mins === 1 ? '' : 's'}.</h3>
      <p class="sub">That takes real strength. How strong is the urge now?</p></div>
      <div class="card">${w.before ? `<div class="section-title">Before: ${w.before}/10 · Now:</div>` : ''}${ratingHTML('after', w.after)}</div>
      <div class="stack">
        <button class="btn block big-btn" id="wWin">I rode it out 🌊</button>
        <button class="btn block secondary" id="wMore">Still strong — 5 more minutes</button>
        <button class="btn block danger" id="wSlip">I slipped</button>
      </div>
    </div>`;
    const log = outcome => {
      t.waves.push({ id: uid(), at: Date.now(), minutes: mins, before: w.before, after: w.after, done: w.done, expect: w.expect || '', emotions: w.emotions || [], outcome });
    };
    $('#wWin', el).onclick = () => { log('rode'); endWave(); render(); toast('Wave ridden. That counts. 💪'); };
    $('#wMore', el).onclick = () => { w.phase = 'run'; w.endAt = Date.now() + 5 * MIN; delete w.endedAt; save(); keepAwake(true); renderWave(); };
    $('#wSlip', el).onclick = () => { const extra = { expect: w.expect || '', feltBefore: w.emotions || [] }; chooseSlip(t, extra, () => { log('slipped'); endWave(); }); };
  }

  $$('[data-rating]', el).forEach(r => r.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    w[r.dataset.rating] = +b.dataset.v; save();
    $$('button', r).forEach(x => x.classList.toggle('on', x === b));
  });
  $('#wClose', el).onclick = () => {
    if (w.phase === 'run' && !confirm('Stop riding this wave? It won’t be logged.')) return;
    endWave();
  };
  tickWave(Date.now());
}

function tickWave(now) {
  const w = state.wave;
  if (!w || w.phase !== 'run') return;
  const el = $('#wave'); if (!el) return;
  const total = w.endAt - w.startAt, left = Math.max(0, w.endAt - now);
  const ring = $('#wRing', el);
  if (ring) {
    const C = 2 * Math.PI * 96;
    ring.style.strokeDasharray = C;
    ring.style.strokeDashoffset = C * (1 - left / total);
  }
  const c = $('#wCount', el);
  if (c) c.textContent = `${Math.floor(left / MIN)}:${pad(Math.floor(left % MIN / SEC))}`;
  // 10 s breathing cycle: 4 s in, 6 s out (matches the CSS bubble animation)
  const phase = ((now - w.startAt) / SEC) % 10;
  const b = $('#wBreath', el); if (b) b.textContent = phase < 4 ? 'breathe in…' : 'breathe out…';
  const tipEl = $('#wTip', el);
  const tipTxt = WAVE_TIPS[Math.floor((now - w.startAt) / (40 * SEC)) % WAVE_TIPS.length];
  if (tipEl && tipEl.textContent !== tipTxt) tipEl.textContent = tipTxt;
  if (left <= 0) { w.phase = 'done'; save(); keepAwake(false); chime(); renderWave(); }
}

/* ───────────── boot ───────────── */
applyTheme();
addEventListener('hashchange', render);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  // Only reload if storage changed elsewhere (another tab) — reloading replaces the
  // objects that open sheets are holding on to.
  let raw = null; try { raw = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
  if (raw && raw !== JSON.stringify(state)) { state = load(); closeSheet(); }
  applyTheme(); render();
  if (state.wave?.phase === 'run') keepAwake(true);
});
render();
setInterval(tick, 250);
navigator.storage?.persist?.();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
