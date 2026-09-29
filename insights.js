'use strict';
// Insights view for one timer. Loaded before app.js; everything here runs only when
// renderInsights() is called, so it can use app.js helpers ($, esc, fmtShort, …).

const INS_WEEKS = 8;
const insUI = { heat: 'all' };

/* ───────────── time helpers ───────────── */
function weekStart(ms) {
  const d = new Date(ms); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.getTime();
}
const addDays = (ms, n) => { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); };
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LONG = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];
const hourLabel = h => (h % 12 || 12) + (h < 12 ? ' AM' : ' PM');
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);

function weeksFor(t, now) {
  const cur = weekStart(now), first = weekStart(t.startAt), out = [];
  for (let i = INS_WEEKS - 1; i >= 0; i--) {
    const start = addDays(cur, -7 * i);
    if (start < first) continue;
    out.push({ start, end: addDays(start, 7), current: i === 0 });
  }
  return out;
}
const inRange = (at, w) => at >= w.start && at < w.end;

// Every urge moment: waves (by when they began) + slips that weren't the end of a wave.
function urgeEvents(t) {
  const waveSlipEnds = t.waves.filter(w => w.outcome === 'slipped').map(w => w.at);
  return [
    ...t.waves.map(w => ({ at: w.at - (w.minutes || 0) * MIN, slip: w.outcome === 'slipped' })),
    ...t.slips.filter(s => !waveSlipEnds.some(x => Math.abs(x - s.at) < 5 * MIN)).map(s => ({ at: s.at, slip: true })),
    ...(t.urges || []).map(u => ({ at: u.at, slip: false })),
  ];
}

function tally(arrs) {
  const m = {};
  arrs.flat().forEach(k => { if (k) m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

/* ───────────── chart pieces ───────────── */
const LEVEL_SERIES = [
  ['tiny', 'Emergency', 30], ['low', 'A little', 50], ['med', 'Medium', 75], ['high', 'A lot', 100],
]; // one hue (danger), lighter → darker by severity

// Stacked vertical bars. series: [{ label, color, values[] }]
function barChart({ labels, series, tips, yFmt = v => v, height = 170 }) {
  const W = 340, H = height, pl = 30, pr = 6, pt = 10, pb = 22;
  const totals = labels.map((_, i) => series.reduce((a, s) => a + s.values[i], 0));
  const max = Math.max(1, ...totals);
  const step = niceStep(max, 3), top = Math.ceil(max / step) * step;
  const slot = (W - pl - pr) / labels.length, bw = Math.min(24, slot * 0.58);
  const Y = v => pt + (1 - v / top) * (H - pt - pb);
  let g = '';
  for (let v = 0; v <= top + 1e-9; v += step) {
    g += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${pl - 5}" y="${Y(v) + 4}" text-anchor="end">${yFmt(+v.toFixed(2))}</text>`;
  }
  labels.forEach((l, i) => {
    const cx = pl + slot * i + slot / 2;
    let base = 0;
    series.forEach(s => {
      const v = s.values[i]; if (!v) return;
      const y1 = Y(base + v), y0 = Y(base);
      g += `<rect x="${cx - bw / 2}" y="${y1}" width="${bw}" height="${Math.max(0, y0 - y1 - (base + v < totals[i] ? 2 : 0))}" rx="3" fill="${s.color}"/>`;
      base += v;
    });
    g += `<text class="axis" x="${cx}" y="${H - 6}" text-anchor="middle">${l}</text>`;
    g += `<rect x="${cx - slot / 2}" y="0" width="${slot}" height="${H}" fill="transparent" data-tip="${esc(tips[i])}"/>`;
  });
  return `<div class="ins-chart"><svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg><div class="tip"></div></div>`;
}

const legend = items => `<div class="legend">${items.map(([label, color, ring]) =>
  `<span><i style="${ring ? `border:2px solid ${color};background:var(--surface)` : `background:${color}`}"></i>${label}</span>`).join('')}</div>`;

// 100% horizontal bar with labeled segments
function shareBar(parts) {
  const total = parts.reduce((a, p) => a + p.n, 0);
  if (!total) return '';
  return `<div class="share-bar">${parts.filter(p => p.n).map(p =>
    `<span style="flex:${p.n};background:${p.color};color:${p.ink || 'var(--ink)'}" data-tip="${esc(`${p.label}: ${p.n} (${pct(p.n, total)}%)`)}">${pct(p.n, total) >= 14 ? pct(p.n, total) + '%' : ''}</span>`).join('')}</div>`;
}

function bindTips(root) {
  const show = e => {
    const el = e.target.closest('[data-tip]'), box = e.target.closest('.ins-chart, .heat, .share-wrap');
    $$('.tip.show', root).forEach(x => { if (!box || !box.contains(x)) x.classList.remove('show'); });
    if (!el || !box) return;
    const tip = $('.tip', box); if (!tip) return;
    const br = box.getBoundingClientRect(), er = el.getBoundingClientRect();
    tip.innerHTML = el.dataset.tip;
    tip.style.left = Math.max(60, Math.min(br.width - 60, er.left - br.left + er.width / 2)) + 'px';
    tip.style.top = Math.max(-40, er.top - br.top - 44) + 'px';
    tip.classList.add('show');
  };
  root.addEventListener('pointerdown', show);
  root.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') show(e); });
}

/* ───────────── the view ───────────── */
function renderInsights(t) {
  const now = Date.now();
  const weeks = weeksFor(t, now);
  const wl = weeks.map(w => w.current ? 'Now' : new Date(w.start).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }));
  const dangerMix = p => `color-mix(in oklab, var(--danger) ${p}%, var(--surface))`;

  // weekly numbers
  const perWeek = weeks.map(w => {
    const slips = t.slips.filter(s => inRange(s.at, w));
    const waves = t.waves.filter(x => inRange(x.at, w));
    const span = Math.max(0, Math.min(w.end, now) - Math.max(w.start, t.startAt));
    const pen = slips.reduce((a, s) => a + s.hours * H, 0);
    return {
      slips, byLevel: Object.fromEntries(LEVEL_SERIES.map(([k]) => [k, slips.filter(s => (s.level || 'med') === k).length])),
      rode: waves.filter(x => x.outcome === 'rode').length, waveSlipped: waves.filter(x => x.outcome === 'slipped').length,
      kept: span ? Math.max(0, (span - pen) / span) : null, penH: pen / H,
    };
  });
  const cur = perWeek.at(-1) || { slips: [], rode: 0, kept: null }, prev = perWeek.at(-2);

  // trend: last 4 weeks vs the 4 before
  const sum = arr => arr.reduce((a, w) => a + w.slips.length, 0);
  const recent = perWeek.slice(-4), earlier = perWeek.slice(-8, -4);
  let trend = '';
  if (earlier.length >= 2) {
    const a = sum(recent) / recent.length, b = sum(earlier) / earlier.length;
    trend = b === 0 ? (a === 0 ? 'No slips in either stretch — steady.' : `Up from zero over the last ${recent.length} weeks.`)
      : a < b ? `<b class="good">↓ ${Math.round((1 - a / b) * 100)}% fewer slips</b> per week than the ${earlier.length} weeks before.`
        : a > b ? `<b class="bad">↑ ${Math.round((a / b - 1) * 100)}% more slips</b> per week than the ${earlier.length} weeks before. Look at the heatmap and triggers below for why.`
          : 'Same slip rate as the weeks before.';
  } else trend = 'Trends appear once you have a few weeks of history.';

  const weekYoung = weeks.length && now - weeks.at(-1).start < 2 * D;
  const delta = (a, b, lowerIsBetter) => {
    if (b == null) return '';
    if (weekYoung) return `<span class="muted">${b} last week · week just started</span>`;
    const d = a - b; if (!d) return '<span class="muted">same as last week</span>';
    const good = lowerIsBetter ? d < 0 : d > 0;
    return `<span class="${good ? 'good' : 'bad'}">${d > 0 ? '↑' : '↓'} ${Math.abs(d)} vs last week</span>`;
  };

  // waves
  const rated = t.waves.filter(w => w.outcome === 'rode' && w.before && w.after);
  const avgDrop = rated.length ? (rated.reduce((a, w) => a + (w.before - w.after), 0) / rated.length).toFixed(1) : null;
  const totalWaves = t.waves.length, rodeAll = t.waves.filter(w => w.outcome === 'rode').length;

  // heatmap
  const events = urgeEvents(t).filter(e => insUI.heat === 'all' || e.slip);
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  const slipGrid = Array.from({ length: 7 }, () => Array(24).fill(0));
  events.forEach(e => { const d = new Date(e.at), r = (d.getDay() + 6) % 7, c = d.getHours(); grid[r][c]++; if (e.slip) slipGrid[r][c]++; });
  const hmax = Math.max(1, ...grid.flat());
  let hardest = null;   // busiest day × 3-hour window
  for (let r = 0; r < 7; r++) for (let b = 0; b < 8; b++) {
    const n = grid[r].slice(b * 3, b * 3 + 3).reduce((a, x) => a + x, 0);
    if (n > (hardest?.n || 0)) hardest = { r, b, n };
  }
  const byHour = Array(24).fill(0).map((_, h) => grid.reduce((a, row) => a + row[h], 0));
  const byDay = grid.map(row => row.reduce((a, x) => a + x, 0));
  const peakHour = byHour.indexOf(Math.max(...byHour)), peakDay = byDay.indexOf(Math.max(...byDay));
  const heatColor = n => n ? `color-mix(in oklab, var(${insUI.heat === 'all' ? '--wave' : '--danger'}) ${20 + Math.round(n / hmax * 80)}%, var(--surface2))` : 'var(--surface2)';

  // triggers
  const before = tally(t.slips.map(s => s.feltBefore || []));
  const rodeFeel = tally(t.waves.filter(w => w.outcome === 'rode').map(w => w.emotions || []));
  const quadCount = q => t.slips.flatMap(s => s.feltBefore || []).filter(w => EMOTION_BY_WORD[w]?.quad === q).length;

  // HALT: share of slips / all urges with each state
  const slipHalts = t.slips.filter(s => s.halt?.length);
  const urgeHalts = [...t.slips, ...t.waves, ...(t.urges || [])].filter(x => x.halt?.length);
  const haltRows = HALT.map(([k, l, e]) => ({ k, l, e, slips: slipHalts.filter(s => s.halt.includes(k)).length, all: urgeHalts.filter(x => x.halt.includes(k)).length }))
    .filter(r => r.all).sort((a, b) => b.slips - a.slips || b.all - a.all);
  const topHalt = haltRows[0];
  const curve = urgeCurve(t);

  // what works
  const works = tally(t.waves.filter(w => w.outcome === 'rode').map(w => w.done || []));
  const worksMax = works[0]?.[1] || 1;

  // reflections
  const reflected = t.slips.filter(s => s.worth);
  const wN = k => reflected.filter(s => s.worth === k).length;
  const impacts = t.slips.filter(s => s.impact);
  const iN = k => impacts.filter(s => s.impact === k).length;
  const pairs = sortedSlips(t).reverse().filter(s => s.expect && s.actual).slice(0, 5);
  const decisions = sortedSlips(t).reverse().filter(s => s.nextTime).slice(0, 5);

  const empty = msg => `<div class="ins-empty">${msg}</div>`;
  const chipsWithCounts = list => list.length ? `<div class="chips">${list.slice(0, 6).map(([w, n]) => `${emoChips([w])}<span class="cnt">×${n}</span>`).join('')}</div>` : '<div class="muted small">Nothing logged yet</div>';

  app.innerHTML = `
    <header class="bar">
      <button class="icon-btn" id="backBtn" aria-label="Back">${ICON.back}</button>
      <h2>Insights · ${esc(t.name)}</h2>
      <span style="width:40px"></span>
    </header>

    <div class="stats ins-top">
      <div class="stat"><div class="v">${cur.slips.length}</div><div class="k">Slips this week</div><div class="d">${delta(cur.slips.length, prev?.slips.length, true)}</div></div>
      <div class="stat"><div class="v">${cur.rode}</div><div class="k">Waves ridden this week</div><div class="d">${delta(cur.rode, prev?.rode, false)}</div></div>
      <div class="stat"><div class="v">${cur.kept == null ? '—' : Math.round(cur.kept * 100) + '%'}</div><div class="k">Time kept this week</div><div class="d">${prev?.kept != null && cur.kept != null ? `${Math.round(prev.kept * 100)}% last week` : ''}</div></div>
      <div class="stat"><div class="v">${totalWaves ? pct(rodeAll, totalWaves) + '%' : '—'}</div><div class="k">Of waves ridden out</div><div class="d">${avgDrop ? `urge drops ${avgDrop} pts on avg` : ''}</div></div>
    </div>

    <section class="card">
      <div class="section-title">Slips per week</div>
      <p class="ins-head">${trend}</p>
      ${weeks.length ? barChart({
        labels: wl,
        series: LEVEL_SERIES.map(([k, , p]) => ({ color: dangerMix(p), values: perWeek.map(w => w.byLevel[k]) })),
        tips: perWeek.map((w, i) => `<b>Week of ${fmtDate(weeks[i].start)}</b><br>${w.slips.length} slip${w.slips.length === 1 ? '' : 's'} · −${+w.penH.toFixed(1)}h` + LEVEL_SERIES.filter(([k]) => w.byLevel[k]).map(([k, l]) => `<br>${l}: ${w.byLevel[k]}`).join('')),
      }) + legend(LEVEL_SERIES.filter(([k]) => perWeek.some(w => w.byLevel[k])).map(([, l, p]) => [l, dangerMix(p)])) : empty('No weeks yet')}
    </section>

    <section class="card">
      <div class="section-title">Waves per week</div>
      <p class="ins-head">${totalWaves ? `You've ridden out <b>${rodeAll} of ${totalWaves}</b> waves.${avgDrop ? ` When you ride it out, the urge drops by <b>${avgDrop} points</b> on average.` : ''}` : 'Start a 🌊 wave when an urge hits — the results show up here.'}</p>
      ${totalWaves ? barChart({
        labels: wl,
        series: [{ color: 'var(--wave)', values: perWeek.map(w => w.rode) }, { color: 'var(--danger)', values: perWeek.map(w => w.waveSlipped) }],
        tips: perWeek.map((w, i) => `<b>Week of ${fmtDate(weeks[i].start)}</b><br>Rode out: ${w.rode}<br>Slipped: ${w.waveSlipped}`),
      }) + legend([['Rode it out', 'var(--wave)'], ['Slipped', 'var(--danger)']]) : ''}
    </section>

    <section class="card">
      <div class="section-title">Your urge curve</div>
      ${curve ? `<p class="ins-head">Across ${curve.n} waves you rode out, urges peaked around <b>minute ${curve.peak.m}</b> (avg ${curve.peak.v.toFixed(1)}/10)${curve.below ? ` and dropped below 5 by <b>minute ${curve.below.m}</b>` : ''}. The wave passes.</p>
        <div class="ins-chart">${waveCurveSVG(curve.pts.map(p => ({ m: p.m, v: +p.v.toFixed(1) })), { w: 340, h: 150 })}</div>`
        : empty('Rate the urge a few times during your next waves (“How strong is it now?”) — after two waves, your typical curve shows up here.')}
    </section>

    <section class="card">
      <div class="section-title">Time kept per week</div>
      <p class="ins-head">The share of each week's clean time you kept after penalties.</p>
      ${barChart({
        labels: wl,
        series: [{ color: 'var(--accent)', values: perWeek.map(w => w.kept == null ? 0 : Math.round(w.kept * 100)) }],
        tips: perWeek.map((w, i) => `<b>Week of ${fmtDate(weeks[i].start)}</b><br>${w.kept == null ? '—' : Math.round(w.kept * 100) + '% kept'} · −${+w.penH.toFixed(1)}h`),
        yFmt: v => v + '%', height: 150,
      })}
    </section>

    <section class="card">
      <div class="section-title">When urges hit
        <span class="seg-ctl" id="heatCtl"><button data-v="all" class="${insUI.heat === 'all' ? 'on' : ''}">All urges</button><button data-v="slips" class="${insUI.heat === 'slips' ? 'on' : ''}">Slips</button></span>
      </div>
      ${events.length ? `
        <p class="ins-head">Your hardest time: <b>${DAY_LONG[hardest.r]}, ${hourLabel(hardest.b * 3)}–${hourLabel((hardest.b * 3 + 3) % 24)}</b> (${hardest.n} ${insUI.heat === 'all' ? 'urge' : 'slip'}${hardest.n === 1 ? '' : 's'}).
          Busiest hour overall: <b>${hourLabel(peakHour)}</b>. Busiest day: <b>${DAY_LONG[peakDay]}</b>.</p>
        <div class="heat">
          <div class="heat-grid">
            ${grid.map((row, r) => `<span class="hl">${DAY_NAMES[r]}</span>` + row.map((n, h) =>
              `<i style="background:${heatColor(n)}" data-tip="${esc(`<b>${DAY_NAMES[r]} ${hourLabel(h)}</b><br>${n} ${insUI.heat === 'all' ? `urge${n === 1 ? '' : 's'}${slipGrid[r][h] ? ` · ${slipGrid[r][h]} slipped` : ''}` : `slip${n === 1 ? '' : 's'}`}`)}"></i>`).join('')).join('')}
            <span></span>${['12a', '6a', '12p', '6p'].map(l => `<span class="hx">${l}</span>`).join('')}
          </div>
          <div class="tip"></div>
        </div>
        <div class="heat-scale"><span>Fewer</span><i style="background:${heatColor(0)}"></i><i style="background:${heatColor(hmax * .33)}"></i><i style="background:${heatColor(hmax * .66)}"></i><i style="background:${heatColor(hmax)}"></i><span>More</span></div>
        <p class="muted small">Plan ahead for these windows: line up an activity, a person to text, or a change of place before they arrive.</p>`
        : empty('Log waves and slips to see when urges tend to hit.')}
    </section>

    <section class="card">
      <div class="section-title">Triggers</div>
      <div class="ins-sub">Feelings before slips</div>${chipsWithCounts(before)}
      ${before.length ? `<div class="share-wrap">${shareBar(['red', 'yellow', 'blue', 'green'].map(q => ({ label: QUADRANTS[q].label, n: quadCount(q), color: `var(--q-${q})`, ink: `var(--q-${q}-ink)` })))}<div class="tip"></div></div>
        ${legend(['red', 'yellow', 'blue', 'green'].filter(q => quadCount(q)).map(q => [QUADRANTS[q].label, `var(--q-${q})`]))}` : ''}
      <div class="ins-sub" style="margin-top:16px">Feelings in waves you rode out</div>${chipsWithCounts(rodeFeel)}
    </section>

    <section class="card">
      <div class="section-title">HALT check</div>
      ${haltRows.length ? `<p class="ins-head">${topHalt.slips ? `<b>${pct(topHalt.slips, slipHalts.length)}%</b> of your slips (with a HALT check) happened when you were <b>${topHalt.l.toLowerCase()}</b>. ${haltInfo(topHalt.k)[3]}` : 'How often each state shows up with your urges:'}</p>
        <ul class="hbar-list">${haltRows.map(r => `<li><span class="hb-l">${r.e} ${r.l}</span><span class="hb-track"><i style="width:${pct(r.slips || r.all, slipHalts.length || urgeHalts.length)}%;background:var(${r.slips ? '--danger' : '--wave'})"></i></span><span class="hb-n">${r.slips ? pct(r.slips, slipHalts.length) + '%' : r.all}</span></li>`).join('')}</ul>
        <div class="muted small">${slipHalts.length ? `% of ${slipHalts.length} slips` : `count of ${urgeHalts.length} urges`} with a HALT check.</div>`
        : empty('Tap HALT (Hungry, Angry, Lonely, Tired, Bored, Stressed) when you log an urge or slip — patterns show up here.')}
    </section>

    <section class="card">
      <div class="section-title">What works</div>
      ${works.length ? `<p class="ins-head">Activities you completed during waves you rode out:</p>
        <ul class="hbar-list">${works.slice(0, 7).map(([a, n]) => `<li><span class="hb-l">${esc(a)}</span><span class="hb-track"><i style="width:${n / worksMax * 100}%"></i></span><span class="hb-n">${n}</span></li>`).join('')}</ul>`
        : empty('Check off activities during a wave to learn what actually helps you.')}
    </section>

    <section class="card">
      <div class="section-title">Reflection patterns</div>
      ${reflected.length ? `
        <p class="ins-big">It didn't give you what you hoped for <b>${wN('no')} of ${reflected.length}</b> times${wN('meh') ? `, and only partly <b>${wN('meh')}</b> more` : ''}.</p>
        <div class="share-wrap">${shareBar([
          { label: "Didn't deliver", n: wN('no'), color: 'var(--danger)', ink: '#fff' },
          { label: 'Partly', n: wN('meh'), color: 'var(--gold)', ink: '#1a1200' },
          { label: 'Delivered', n: wN('yes'), color: 'var(--muted)', ink: '#fff' },
        ])}<div class="tip"></div></div>
        ${legend([["Didn't deliver", 'var(--danger)'], ['Partly', 'var(--gold)'], ['Delivered', 'var(--muted)']])}`
        : empty('Reflect on a slip (“Did it deliver?”) and the pattern shows up here.')}
      ${impacts.length ? `
        <div class="ins-sub" style="margin-top:18px">Effect on who you're becoming</div>
        <div class="share-wrap">${shareBar([
          { label: 'Hurt', n: iN('hurt'), color: 'var(--danger)', ink: '#fff' },
          { label: 'Net neutral', n: iN('neutral'), color: 'var(--surface2)' },
          { label: 'Helped', n: iN('helped'), color: 'var(--accent)', ink: 'var(--accent-ink)' },
        ])}<div class="tip"></div></div>
        ${legend([['Hurt', 'var(--danger)'], ['Net neutral', 'var(--surface2)'], ['Helped', 'var(--accent)']])}` : ''}
      ${pairs.length ? `<div class="ins-sub" style="margin-top:18px">What you hoped vs. what happened</div>
        ${pairs.map(s => `<div class="pair">
          <div class="pair-date">${fmtDate(s.at)}${s.worth ? ` <span class="worth ${s.worth}">${worthLabel(s.worth)}</span>` : ''}</div>
          <div class="pair-row"><span>Hoped</span>${esc(s.expect)}</div>
          <div class="pair-row"><span>Got</span>${esc(s.actual)}</div></div>`).join('')}` : ''}
      ${decisions.length ? `<div class="ins-sub" style="margin-top:18px">Your next-time decisions</div>
        <ul class="decisions">${decisions.map(s => `<li>${esc(s.nextTime)}<span>${fmtDate(s.at)}</span></li>`).join('')}</ul>` : ''}
    </section>
  `;
  $('#backBtn').onclick = () => { location.hash = '#/t/' + t.id; };
  $$('#heatCtl button').forEach(b => b.onclick = () => { insUI.heat = b.dataset.v; renderInsights(t); });
  bindTips(app);
}
