'use strict';
// HALT check, if-then plans (+ hard-time banner), urge logging, urge curve,
// rewards & savings. Loaded before app.js; everything runs after app.js loads.

/* ───────────── HALT (+ Bored, Stressed) ───────────── */
const HALT = [
  ['hungry', 'Hungry', '🍽️', 'Eat something real — even a quick snack takes the edge off.'],
  ['angry', 'Angry', '😤', 'Move it out of your body: a fast walk, or write down what you’d like to say.'],
  ['lonely', 'Lonely', '🫂', 'Reach out — text someone, even just “hey, how’s your day?”'],
  ['tired', 'Tired', '😴', 'This may be a rest problem, not a willpower problem. Lie down for 10 minutes.'],
  ['bored', 'Bored', '🥱', 'Pick one thing from your list and do it for just 2 minutes.'],
  ['stressed', 'Stressed', '😣', 'Breathe out longer than you breathe in, five times. Then one small next step.'],
];
const haltInfo = k => HALT.find(h => h[0] === k);
const haltChips = (keys = []) => keys.map(haltInfo).filter(Boolean).map(([, l, e]) => `<span class="halt-chip">${e} ${l}</span>`).join('');

// Multi-select HALT buttons editing obj[key]; shows a tip for each one picked.
function bindHaltField(host, obj, key = 'halt', onChange) {
  const draw = () => {
    const sel = obj[key] || [];
    host.innerHTML = `<div class="halt-grid">${HALT.map(([k, l, e]) =>
      `<button type="button" class="halt-btn ${sel.includes(k) ? 'on' : ''}" data-h="${k}"><span>${e}</span>${l}</button>`).join('')}</div>
      ${sel.length ? `<div class="halt-tips">${sel.map(k => { const [, l, e, tip] = haltInfo(k); return `<div><b>${e} ${l}:</b> ${tip}</div>`; }).join('')}</div>` : ''}`;
  };
  host.onclick = e => {
    const b = e.target.closest('[data-h]'); if (!b) return;
    const sel = obj[key] || [];
    obj[key] = sel.includes(b.dataset.h) ? sel.filter(x => x !== b.dataset.h) : [...sel, b.dataset.h];
    draw(); onChange?.();
  };
  draw();
}

/* ───────────── hardest time (from urge history) ───────────── */
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW_LONG = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];
const dowOf = ms => (new Date(ms).getDay() + 6) % 7;         // Monday = 0
const hourName = h => (h % 12 || 12) + (h % 24 < 12 ? ' AM' : ' PM');

// Busiest day × 3-hour block, once there's enough history to mean something.
function hardestWindow(t) {
  const ev = urgeEvents(t);
  if (ev.length < 4) return null;
  const g = Array.from({ length: 7 }, () => Array(8).fill(0));
  ev.forEach(e => { g[dowOf(e.at)][Math.floor(new Date(e.at).getHours() / 3)]++; });
  let best = null;
  g.forEach((row, d) => row.forEach((n, b) => { if (n >= 2 && n > (best?.n || 0)) best = { day: d, from: b * 3, to: (b * 3 + 3) % 24, n }; }));
  return best;
}
const inHardestWindow = (w, now = Date.now()) => w && dowOf(now) === w.day && Math.floor(new Date(now).getHours() / 3) * 3 === w.from;

/* ───────────── if-then plans ───────────── */
// plan: { id, ifText, thenText, days: [0-6, Mon=0] (empty = any day), from, to (hours, null = any time) }
const planSentence = p => `If ${p.ifText}, then I will ${p.thenText}.`;
const hasWindow = p => p.days.length > 0 || p.from != null;
function planActive(p, now = Date.now()) {
  if (!hasWindow(p)) return false;
  if (p.days.length && !p.days.includes(dowOf(now))) return false;
  if (p.from == null) return true;
  const h = new Date(now).getHours();
  return p.from < p.to ? h >= p.from && h < p.to : h >= p.from || h < p.to;
}
function windowLabel(p) {
  const days = !p.days.length ? 'Any day' : p.days.length === 7 ? 'Every day'
    : [0, 1, 2, 3, 4].every(d => p.days.includes(d)) && p.days.length === 5 ? 'Weekdays'
      : p.days.length === 2 && p.days.includes(5) && p.days.includes(6) ? 'Weekends'
        : p.days.map(d => DOW[d]).join(', ');
  return p.from == null ? days : `${days}, ${hourName(p.from)}–${hourName(p.to)}`;
}

// Heads-up banner for right now: an active plan, or your historically hardest window.
function headsUpHTML(t, now = Date.now()) {
  const active = t.plans.filter(p => planActive(p, now));
  if (active.length) {
    return `<div class="headsup" data-headsup="${t.id}">
      <div class="hu-top">⚠️ Heads up — this is one of your planned-for times</div>
      ${active.map(p => `<div class="hu-plan">${esc(planSentence(p))}</div>`).join('')}
    </div>`;
  }
  const hw = hardestWindow(t);
  if (inHardestWindow(hw, now)) {
    return `<div class="headsup" data-headsup="${t.id}">
      <div class="hu-top">⚠️ ${DOW_LONG[hw.day]}, ${hourName(hw.from)}–${hourName(hw.to)} is usually one of your hardest times</div>
      <button class="link-btn" data-plan-hard="${t.id}">Make an if-then plan for it →</button>
    </div>`;
  }
  return '';
}
function bindHeadsUp(root) {
  $$('[data-plan-hard]', root).forEach(b => b.onclick = e => {
    e.stopPropagation();
    const t = getTimer(b.dataset.planHard), hw = hardestWindow(t);
    openPlanSheet(t, null, hw ? { days: [hw.day], from: hw.from, to: hw.to } : {});
  });
}

function plansSectionHTML(t) {
  return `<section class="card">
    <div class="section-title">🧭 If-then plans <button class="link-btn" id="addPlan">+ Add plan</button></div>
    <p class="ins-head">Deciding in advance — “if this happens, I’ll do that” — is one of the best-proven ways to change a habit. Add a time window and you’ll get a heads-up when it’s coming.</p>
    ${t.plans.length ? t.plans.map(p => `
      <button class="plan-card ${planActive(p) ? 'active' : ''}" data-plan="${p.id}">
        <span class="pc-text">${esc(planSentence(p))}</span>
        <span class="pc-when">${hasWindow(p) ? `⏰ ${windowLabel(p)}` : 'No time window — tap to add one'}</span>
      </button>`).join('') : '<div class="ins-empty">No plans yet.</div>'}
  </section>`;
}
function bindPlansSection(t) {
  $('#addPlan') && ($('#addPlan').onclick = () => openPlanSheet(t));
  $$('[data-plan]').forEach(b => b.onclick = () => openPlanSheet(t, t.plans.find(p => p.id === b.dataset.plan)));
}

function openPlanSheet(t, p, prefill = {}) {
  const d = { ifText: '', thenText: '', days: [], from: null, to: null, ...(p || {}), ...prefill };
  const hw = hardestWindow(t);
  const hourOpts = sel => Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${sel === h ? 'selected' : ''}>${hourName(h)}</option>`).join('');
  openSheet(`
    <h3>${p ? 'Edit plan' : 'New if-then plan'}</h3>
    <form id="pf">
      <label class="field"><span>If…</span><input name="ifText" required maxlength="140" placeholder="it's Sunday night and I'm bored" value="${esc(d.ifText)}"></label>
      <label class="field"><span>…then I will</span><input name="thenText" required maxlength="140" placeholder="text Sam and go for a walk" value="${esc(d.thenText)}"></label>
      <div class="field"><span>When does this usually happen? (optional)</span>
        <div class="quick" id="pDays">${DOW.map((n, i) => `<button type="button" data-v="${i}" class="${d.days.includes(i) ? 'on' : ''}">${n}</button>`).join('')}</div>
        <label class="pin-check" style="margin:10px 0 0"><input type="checkbox" id="pTimeOn" ${d.from != null ? 'checked' : ''}> Between specific hours</label>
        <div class="time-row" id="pTimes" ${d.from != null ? '' : 'hidden'}>
          <select name="from" class="select">${hourOpts(d.from ?? 21)}</select><span>to</span><select name="to" class="select">${hourOpts(d.to ?? 0)}</select>
        </div>
        ${hw ? `<button type="button" class="link-btn" id="pHard">Use my hardest time: ${DOW_LONG[hw.day]}, ${hourName(hw.from)}–${hourName(hw.to)}</button>` : ''}
        <div class="hint">You'll see this plan as a heads-up during that window, and whenever you ride a wave.</div>
      </div>
      <div class="stack">
        <button class="btn block" type="submit">Save plan</button>
        ${p ? '<button class="btn danger block" type="button" id="pDel">Delete plan</button>' : ''}
      </div>
    </form>`, sheet => {
    const f = $('#pf', sheet);
    let days = [...d.days];
    const drawDays = () => $$('#pDays button', sheet).forEach(b => b.classList.toggle('on', days.includes(+b.dataset.v)));
    $('#pDays', sheet).onclick = e => { const b = e.target.closest('button'); if (!b) return; const v = +b.dataset.v; days = days.includes(v) ? days.filter(x => x !== v) : [...days, v].sort(); drawDays(); };
    $('#pTimeOn', sheet).onchange = e => { $('#pTimes', sheet).hidden = !e.target.checked; };
    $('#pHard', sheet) && ($('#pHard', sheet).onclick = () => {
      days = [hw.day]; drawDays();
      $('#pTimeOn', sheet).checked = true; $('#pTimes', sheet).hidden = false;
      f.elements.from.value = hw.from; f.elements.to.value = hw.to;
    });
    if (!p) setTimeout(() => f.elements.ifText.focus(), 250);
    f.onsubmit = e => {
      e.preventDefault();
      const timed = $('#pTimeOn', sheet).checked;
      const vals = { ifText: f.elements.ifText.value.trim().replace(/^if\s+/i, ''), thenText: f.elements.thenText.value.trim().replace(/^(then\s+)?(i will|i'll)\s+/i, ''), days, from: timed ? +f.elements.from.value : null, to: timed ? +f.elements.to.value : null };
      if (timed && vals.from === vals.to) return toast('Pick a start and end hour that differ');
      if (p) Object.assign(p, vals); else t.plans.push({ id: uid(), at: Date.now(), ...vals });
      save(); closeSheet(true); render();
    };
    $('#pDel', sheet) && ($('#pDel', sheet).onclick = () => {
      const i = t.plans.indexOf(p); t.plans.splice(i, 1); save(); closeSheet(true); render();
      toast('Plan deleted', [{ label: 'Undo', fn: () => { t.plans.splice(i, 0, p); save(); render(); } }]);
    });
  });
}

// Plans shown when an urge hits: ones active right now first.
function plansForWaveHTML(t) {
  if (!t.plans.length) return '';
  const sorted = [...t.plans].sort((a, b) => planActive(b) - planActive(a)).slice(0, 4);
  return `<div class="card plans-in-wave"><div class="section-title">🧭 Your if-then plans</div>
    ${sorted.map(p => `<div class="piw ${planActive(p) ? 'active' : ''}">${planActive(p) ? '<span class="now-tag">now</span>' : ''}${esc(planSentence(p))}</div>`).join('')}</div>`;
}

/* ───────────── urge intensity during a wave ───────────── */
// w.ratings = [{ m: minutes since start, v: 1-10 }]
const RATE_EVERY = 150000; // 2.5 minutes (plain number: this file loads before app.js defines MIN)
function waveCurveSVG(ratings, { w = 300, h = 110 } = {}) {
  if (!ratings || ratings.length < 2) return '';
  const maxM = Math.max(1, ...ratings.map(r => r.m)), pl = 22, pr = 8, pt = 10, pb = 18;
  const X = m => pl + m / maxM * (w - pl - pr), Y = v => pt + (1 - (v - 1) / 9) * (h - pt - pb);
  const pts = ratings.map(r => `${X(r.m).toFixed(1)},${Y(r.v).toFixed(1)}`).join(' ');
  const peak = ratings.reduce((a, r) => (r.v > a.v ? r : a), ratings[0]);
  return `<svg viewBox="0 0 ${w} ${h}" class="curve">
    ${[1, 5, 10].map(v => `<line class="grid" x1="${pl}" x2="${w - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${pl - 4}" y="${Y(v) + 3.5}" text-anchor="end">${v}</text>`).join('')}
    <polyline points="${pts}" class="curve-line"/>
    ${ratings.map(r => `<circle cx="${X(r.m)}" cy="${Y(r.v)}" r="4" class="curve-dot"/>`).join('')}
    <text class="axis" x="${X(peak.m)}" y="${Y(peak.v) - 8}" text-anchor="middle">peak ${peak.v}</text>
    <text class="axis" x="${pl}" y="${h - 4}">0 min</text><text class="axis" x="${w - pr}" y="${h - 4}" text-anchor="end">${Math.round(maxM)} min</text>
  </svg>`;
}

// Average urge by minute across waves you rode out (for Insights).
function urgeCurve(t) {
  const waves = t.waves.filter(w => w.outcome === 'rode' && (w.ratings || []).length >= 3);
  if (waves.length < 2) return null;
  const buckets = {};
  waves.forEach(w => w.ratings.forEach(r => { const k = Math.round(r.m); (buckets[k] = buckets[k] || []).push(r.v); }));
  const pts = Object.entries(buckets).map(([m, vs]) => ({ m: +m, v: vs.reduce((a, b) => a + b, 0) / vs.length, n: vs.length }))
    .filter(p => p.n >= 1).sort((a, b) => a.m - b.m);
  const peak = pts.reduce((a, p) => (p.v > a.v ? p : a), pts[0]);
  const below = pts.find(p => p.m > peak.m && p.v < 5);
  return { pts, peak, below, n: waves.length };
}

/* ───────────── quick urge log ───────────── */
function openUrgeLog(t) {
  const u = { intensity: null, halt: [], emotions: [], note: '' };
  openSheet(`
    <h3>Log an urge</h3>
    <p class="sub">Noticing an urge — without acting on it — is the skill. This takes 15 seconds.</p>
    <form id="uf">
      <div class="field"><span>How strong is it?</span>${ratingHTML('intensity', null)}</div>
      <div class="field"><span>Are you…</span><div id="uHalt"></div></div>
      <div class="field"><span>😶 Feelings (optional)</span><div class="emo-field" id="uEmo"></div></div>
      <label class="field"><span>📓 What's going on? (optional)</span><textarea name="note" class="autogrow journal" maxlength="5000" rows="4" placeholder="What set it off, what's on your mind, how your body feels — write as much as you want."></textarea></label>
      <div class="stack">
        <button class="btn block" type="submit">Log it</button>
        <button class="btn secondary block" type="button" id="uWave">🌊 Ride this one out instead</button>
      </div>
    </form>`, sheet => {
    bindHaltField($('#uHalt', sheet), u);
    bindEmoField($('#uEmo', sheet), u, 'emotions', 'What are you feeling?', 'Name the feeling');
    $('[data-rating]', sheet).onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      u.intensity = +b.dataset.v; $$('[data-rating] button', sheet).forEach(x => x.classList.toggle('on', x === b));
    };
    const f = $('#uf', sheet);
    autogrow(sheet);
    f.onsubmit = e => {
      e.preventDefault();
      t.urges.push({ id: uid(), at: Date.now(), intensity: u.intensity, halt: u.halt, emotions: u.emotions, note: f.elements.note.value.trim() });
      save(); closeSheet(true); render();
      toast('Urge logged. You noticed it — that’s the skill. 💪');
    };
    $('#uWave', sheet).onclick = () => {
      closeSheet();
      startWave(t);
      Object.assign(state.wave, { before: u.intensity, halt: u.halt, emotions: u.emotions });
      save(); renderWave();
    };
  });
}
// Edit a past urge log: time, intensity, HALT, feelings, journal.
function openUrgeEntrySheet(t, u) {
  const d = { intensity: u.intensity, halt: [...(u.halt || [])], emotions: [...(u.emotions || [])] };
  openSheet(`
    <h3>✍️ Urge</h3>
    <form id="uef">
      <label class="field"><span>When</span><input name="at" type="datetime-local" required value="${toLocalInput(u.at)}" max="${toLocalInput(Date.now())}"></label>
      <div class="field"><span>How strong was it?</span>${ratingHTML('intensity', u.intensity)}</div>
      <div class="field"><span>Were you…</span><div id="ueHalt"></div></div>
      <div class="field"><span>😶 Feelings</span><div class="emo-field" id="ueEmo"></div></div>
      <label class="field"><span>📓 Journal</span><textarea name="note" class="autogrow journal" maxlength="5000" rows="4" placeholder="Add context — what was happening, what you did next, what you'd want to remember.">${esc(u.note || '')}</textarea></label>
      <div class="stack">
        <button class="btn block" type="submit">Save</button>
        <button class="btn danger block" type="button" id="delUrge">Delete entry</button>
      </div>
    </form>`, sheet => {
    bindHaltField($('#ueHalt', sheet), d);
    bindEmoField($('#ueEmo', sheet), d, 'emotions', 'What were you feeling?', 'Add feelings');
    $('[data-rating]', sheet).onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      d.intensity = d.intensity === +b.dataset.v ? null : +b.dataset.v;
      $$('[data-rating] button', sheet).forEach(x => x.classList.toggle('on', +x.dataset.v === d.intensity));
    };
    autogrow(sheet);
    const f = $('#uef', sheet);
    f.onsubmit = e => {
      e.preventDefault();
      const at = fromLocalInput(f.elements.at.value);
      Object.assign(u, { ...d, at: isFinite(at) ? Math.min(at, Date.now()) : u.at, note: f.elements.note.value.trim() });
      save(); closeSheet(true); render(); toast('Saved');
    };
    $('#delUrge', sheet).onclick = () => {
      const i = t.urges.indexOf(u); t.urges.splice(i, 1); save(); closeSheet(true); render();
      toast('Urge deleted', [{ label: 'Undo', fn: () => { t.urges.splice(i, 0, u); save(); render(); } }]);
    };
  });
}

/* ───────────── rewards & savings ───────────── */
// Estimated uses avoided, money saved, and time reclaimed, vs your pre-quit baseline.
function savingsInfo(t, now = Date.now()) {
  if (!t.usesPerDay) return null;
  const days = Math.max(0, (now - t.startAt) / D);
  const avoided = Math.max(0, t.usesPerDay * days - t.slips.filter(s => s.level !== 'tiny').length);
  return { avoided, money: t.costPerUse ? avoided * t.costPerUse : null, hours: t.timePerUse ? avoided * t.timePerUse : null };
}
const money = n => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: n < 100 ? 2 : 0 });

function rewardsSectionHTML(t, now = Date.now()) {
  const net = netAt(t, now);
  const sv = savingsInfo(t, now);
  return `<section class="card">
    <div class="section-title">🎁 Rewards & savings <button class="link-btn" id="addReward">+ Add reward</button></div>
    ${sv ? `<div class="savings">
      ${sv.money != null ? `<div><b>${money(sv.money)}</b><span>saved</span></div>` : ''}
      ${sv.hours != null ? `<div><b>${Math.round(sv.hours)}h</b><span>reclaimed</span></div>` : ''}
      <div><b>${Math.round(sv.avoided)}</b><span>uses avoided</span></div>
    </div><div class="muted small">Estimated from your pre-quit baseline in Edit timer.</div>`
      : `<p class="ins-head">Add your pre-quit habits in <b>Edit timer → Savings</b> to see money and time reclaimed.</p>`}
    ${t.rewards.length ? `<div class="rewards">${[...t.rewards].sort((a, b) => a.ms - b.ms).map(r => {
      const pctDone = Math.max(0, Math.min(1, net / r.ms));
      return `<div class="reward ${r.claimedAt ? 'claimed' : r.unlockedAt ? 'unlocked' : ''}" data-reward="${r.id}">
        <div class="rw-top"><span class="rw-text">${r.claimedAt ? '✅' : r.unlockedAt ? '🎉' : '🎁'} ${esc(r.text)}</span><span class="rw-ms">${rewardLabel(r.ms)}</span></div>
        ${r.claimedAt ? `<div class="muted small">Claimed ${fmtDate(r.claimedAt)} — you earned it.</div>`
          : r.unlockedAt ? `<button class="btn rw-claim" data-claim="${r.id}">Claim it</button>`
            : `<div class="rw-bar"><i style="width:${(pctDone * 100).toFixed(1)}%"></i></div><div class="muted small">${fmtShort(r.ms - net)} to go</div>`}
      </div>`;
    }).join('')}</div>` : '<div class="ins-empty">Set a reward for a milestone — something you’ll actually look forward to.</div>'}
  </section>`;
}
const rewardLabel = ms => MILESTONES.find(m => m.ms === ms)?.label || fmtShort(ms);
function bindRewards(t) {
  $('#addReward') && ($('#addReward').onclick = () => openRewardSheet(t));
  $$('[data-claim]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const r = t.rewards.find(x => x.id === b.dataset.claim);
    r.claimedAt = Date.now(); save(); render(); toast('🎁 Enjoy it — you earned this.');
  });
  $$('[data-reward]').forEach(el => el.onclick = e => {
    if (e.target.closest('[data-claim]')) return;
    openRewardSheet(t, t.rewards.find(x => x.id === el.dataset.reward));
  });
}
function openRewardSheet(t, r) {
  let ms = r?.ms ?? 7 * D;
  openSheet(`
    <h3>${r ? 'Edit reward' : 'New reward'}</h3>
    <form id="rwf">
      <label class="field"><span>Reward</span><input name="text" required maxlength="80" placeholder="e.g. new headphones, a nice dinner out" value="${esc(r?.text || '')}"></label>
      <div class="field"><span>Unlocks at (net time)</span>
        <div class="quick" id="rwMs">${MILESTONES.map(m => `<button type="button" data-v="${m.ms}" class="${ms === m.ms ? 'on' : ''}">${m.e} ${m.label}</button>`).join('')}</div></div>
      <div class="stack">
        <button class="btn block" type="submit">Save</button>
        ${r ? '<button class="btn danger block" type="button" id="rwDel">Delete reward</button>' : ''}
      </div>
    </form>`, sheet => {
    $('#rwMs', sheet).onclick = e => { const b = e.target.closest('button'); if (!b) return; ms = +b.dataset.v; $$('#rwMs button', sheet).forEach(x => x.classList.toggle('on', x === b)); };
    const f = $('#rwf', sheet);
    f.onsubmit = e => {
      e.preventDefault();
      const text = f.elements.text.value.trim(); if (!text) return;
      const reached = netAt(t, Date.now()) >= ms;
      if (r) Object.assign(r, { text, ms, unlockedAt: r.unlockedAt || (reached ? Date.now() : null) });
      else t.rewards.push({ id: uid(), text, ms, unlockedAt: reached ? Date.now() : null, claimedAt: null });
      save(); closeSheet(true); render();
    };
    $('#rwDel', sheet) && ($('#rwDel', sheet).onclick = () => { t.rewards = t.rewards.filter(x => x !== r); save(); closeSheet(true); render(); });
  });
}
// Called from tick(): unlock rewards whose milestone was just reached.
function checkRewardUnlocks(now) {
  for (const t of state.timers) {
    const net = netAt(t, now);
    const r = t.rewards.find(x => !x.unlockedAt && net >= x.ms);
    if (r) {
      r.unlockedAt = now; save();
      celebrate(t, { e: '🎁', label: 'Reward unlocked', text: `${rewardLabel(r.ms)} of net progress. You earned “${r.text}” — go claim it.` });
      return true;
    }
  }
  return false;
}
