<script>
  // Вкладка «Графіки»: числові параметри — лінією (можна накласти кілька з однаковою одиницею),
  // увімк./вимк. — смугами під графіком. Шкала часу, мін/сер/макс за період, для термостата — уставка і нагрів.
  import { ha, send } from '../lib/ha.svelte.js';
  import { friendly } from '../lib/model.js';
  import { num } from '../lib/format.js';

  let { device, entity = $bindable() } = $props();
  const COLORS = ['#bf5af2', '#3d8bff', '#30d158', '#ff9f0a', '#ff453a', '#64d2ff'];
  const ONOFF = ['binary_sensor', 'switch', 'light', 'fan', 'input_boolean', 'automation'];

  const dom = (e) => e.split('.')[0];
  const isClimate = (e) => dom(e) === 'climate';
  const isOnOff = (e) => ONOFF.includes(dom(e));
  const unitOf = (e) => (isClimate(e) ? '°C' : ha.states[e]?.attributes?.unit_of_measurement || '');
  const numeric = $derived(device.entities.filter((e) => { const s = ha.states[e]; return s && !isOnOff(e) && (isClimate(e) || isFinite(Number(s.state))); }));
  const onoff = $derived(device.entities.filter((e) => ha.states[e] && isOnOff(e)));
  const label = (e) => friendly(ha, e).replace(device.name || '\u0000', '').replace(/^[,\s]+/, '').trim() || friendly(ha, e);
  // як назвати стан «увімкнено» для різних датчиків
  const ON_WORD = { motion: 'рух', occupancy: 'присутність', door: 'відчинено', window: 'відчинено', opening: 'відчинено', garage_door: 'відчинено',
    moisture: 'протікання', smoke: 'дим', gas: 'газ', heat: 'нагрів', power: 'є', plug: 'увімкнено', battery: 'розряджена', problem: 'проблема', connectivity: 'на зв’язку' };
  const onWord = (e) => (dom(e) === 'binary_sensor' ? ON_WORD[ha.states[e]?.attributes?.device_class] || 'увімкнено' : 'увімкнено');

  let lines = $state([]);   // вибрані числові
  let bars = $state([]);    // вибрані увімк./вимк.
  $effect(() => {
    if (entity && !lines.includes(entity) && !bars.includes(entity)) {
      if (isOnOff(entity)) { bars = [entity]; lines = []; } else { lines = [entity]; bars = []; }
    } else if (!lines.length && !bars.length) {
      // спершу головна сутність пристрою (рух, вимикач…), інакше перше числове
      const m = device.main;
      if (m && onoff.includes(m)) bars = [m];
      else if (m && numeric.includes(m)) {
        lines = [m];
        // датчик руху/дверей/протікання з температурою — одразу показуємо і смугу події
        const ev = onoff.find((e) => dom(e) === 'binary_sensor' && ['motion', 'occupancy', 'door', 'window', 'opening', 'moisture', 'smoke'].includes(ha.states[e]?.attributes?.device_class));
        if (ev) bars = [ev];
      }
      else if (numeric.length) lines = [numeric[0]]; else if (onoff.length) bars = [onoff[0]];
    }
  });
  const unit = $derived(lines.length ? unitOf(lines[0]) : '');

  function toggleLine(e) {
    if (lines.includes(e)) lines = lines.filter((x) => x !== e);
    else if (lines.length && unitOf(e) !== unit) lines = [e];      // інша одиниця — новий графік
    else lines = [...lines, e].slice(-6);
    entity = lines[0] ?? bars[0];
  }
  function toggleBar(e) {
    bars = bars.includes(e) ? bars.filter((x) => x !== e) : [...bars, e].slice(-6);
    entity = lines[0] ?? bars[0];
  }

  const RANGES = [['Година', 1], ['Доба', 24], ['Тиждень', 168], ['Місяць', 720], ['Рік', 8760]];
  let hours = $state(24);
  let data = $state({ lines: [], bars: [], t0: 0, t1: 0, stats: false });
  let loading = $state(false);
  let hover = $state(null);

  // ---------- завантаження ----------
  async function hist(ids, start, end, attrs) {
    if (!ids.length) return {};
    return send({ type: 'history/history_during_period', start_time: start.toISOString(), end_time: end.toISOString(),
      entity_ids: ids, minimal_response: !attrs, no_attributes: !attrs, significant_changes_only: false });
  }
  const ts = (p) => (p.lu ?? p.lc ?? 0) * 1000 || Date.parse(p.last_changed || p.last_updated);

  async function load() {
    const L = [...lines], B = [...bars], h = hours;
    if (!L.length && !B.length) return;
    loading = true;
    const end = new Date(), start = new Date(end - h * 3600e3);
    const useStats = h > 24;
    const out = { lines: [], bars: [], t0: +start, t1: +end, stats: useStats };
    try {
      // числові: до доби — кожна зміна; більше — погодинна/добова статистика (якщо є)
      let st = {};
      const statIds = L.filter((e) => !isClimate(e));
      if (useStats && statIds.length) {
        st = await send({ type: 'recorder/statistics_during_period', start_time: start.toISOString(), end_time: end.toISOString(),
          statistic_ids: statIds, period: h > 24 * 60 ? 'day' : 'hour', types: ['mean', 'min', 'max', 'state'] }).catch(() => ({}));
      }
      const needHist = L.filter((e) => isClimate(e) || !(st[e]?.length));
      const hNum = await hist(needHist.filter((e) => !isClimate(e)), start, end, false);
      const hCl = await hist(needHist.filter(isClimate), start, end, true);
      L.forEach((e, i) => {
        const color = COLORS[i % COLORS.length];
        if (st[e]?.length) {
          const half = h > 24 * 60 ? 43200e3 : 1800e3;   // точка — посередині години/доби
          const pts = st[e].map((p) => [+new Date(p.start) + half, p.mean ?? p.state, p.min ?? p.mean ?? p.state, p.max ?? p.mean ?? p.state]).filter((p) => p[1] != null);
          out.lines.push({ e, color, pts, step: false });
        } else if (isClimate(e)) {
          const pts = [], target = [], heat = [];
          for (const p of hCl[e] || []) {
            const t = Math.max(ts(p), +start), a = p.a || p.attributes || {}, s = p.s ?? p.state;
            pts.push([t, a.current_temperature ?? null]);
            target.push([t, s === 'off' ? null : a.temperature ?? null]);
            heat.push([t, a.hvac_action === 'heating' ? 'on' : 'off']);
          }
          out.lines.push({ e, color, pts, step: true });
          if (target.some((p) => p[1] != null)) out.lines.push({ e: e + '#target', color, pts: target, step: true, dashed: true, name: 'Задано' });
          if (heat.some((p) => p[1] === 'on')) out.bars.push({ e: e + '#heat', name: 'Нагрів', word: 'гріє', color: '#ff9f0a', segs: segments(heat, +start, +end) });
        } else {
          const pts = (hNum[e] || []).map((p) => { const v = Number(p.s ?? p.state); return [Math.max(ts(p), +start), isFinite(v) && (p.s ?? p.state) !== '' ? v : null]; });
          out.lines.push({ e, color, pts, step: true });
        }
      });
      // увімк./вимк.
      const hB = await hist(B, start, end, false);
      B.forEach((e, i) => {
        const raw = (hB[e] || []).map((p) => [Math.max(ts(p), +start), p.s ?? p.state]);
        out.bars.push({ e, name: label(e), word: onWord(e), color: COLORS[(L.length + i) % COLORS.length], segs: segments(raw, +start, +end) });
      });
    } catch {}
    data = out;
    loading = false;
  }
  // [[t, 'on'|'off'|…]] → відрізки «увімкнено» і «немає даних»
  function segments(raw, t0, t1) {
    const on = [], na = [];
    raw.forEach(([t, s], i) => {
      const e = i + 1 < raw.length ? raw[i + 1][0] : t1;
      if (e <= t) return;
      if (s === 'on' || s === 'open') on.push([t, e]);
      else if (s === 'unavailable' || s === 'unknown' || s == null) na.push([t, e]);
    });
    return { on, na, total: on.reduce((x, [s, e]) => x + e - s, 0), count: on.length };
  }
  $effect(() => { lines; bars; hours; load(); });

  // ---------- геометрія ----------
  const W = 600, H = 220, L0 = 40, R0 = 8, T0 = 10, B0 = 24, BH = 18;
  const niceStep = (span, n) => { const raw = span / n, p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw); };
  const X = (t) => L0 + (t - data.t0) / (data.t1 - data.t0 || 1) * (W - L0 - R0);
  const geo = $derived.by(() => {
    const vals = data.lines.flatMap((s) => s.pts.flatMap((p) => [p[1], p[2], p[3]])).filter((v) => v != null && isFinite(v));
    if (!vals.length) return null;
    let y0 = Math.min(...vals), y1 = Math.max(...vals);
    if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; }
    const step = niceStep(y1 - y0, 4);
    y0 = Math.floor(y0 / step) * step; y1 = Math.ceil(y1 / step) * step;
    const Y = (v) => T0 + (1 - (v - y0) / (y1 - y0)) * (H - T0 - B0);
    const yt = []; for (let v = y0; v <= y1 + step / 2; v += step) yt.push({ v: Math.round(v / step) * step, y: Y(v) });
    const path = (pts, step) => {
      let d = '', pen = false;
      pts.forEach((p, i) => {
        if (p[1] == null) { pen = false; return; }
        const x = X(p[0]), y = Y(p[1]);
        if (!pen) d += `M${x.toFixed(1)},${y.toFixed(1)}`;
        else d += step ? `H${x.toFixed(1)}V${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`;
        pen = true;
        if (step && i === pts.length - 1) d += `H${X(data.t1).toFixed(1)}`;   // останнє значення тягнемо до «зараз»
      });
      return d;
    };
    const band = (pts) => {
      const ok = pts.filter((p) => p[2] != null && p[3] != null);
      if (ok.length < 2) return null;
      return 'M' + ok.map((p) => `${X(p[0]).toFixed(1)},${Y(p[3]).toFixed(1)}`).join('L') + 'L' + [...ok].reverse().map((p) => `${X(p[0]).toFixed(1)},${Y(p[2]).toFixed(1)}`).join('L') + 'Z';
    };
    const paths = data.lines.map((s) => ({ ...s, d: path(s.pts, s.step), band: data.stats && !s.dashed ? band(s.pts) : null }));
    const solo = paths.filter((p) => !p.dashed).length === 1 && !paths[0].band && paths[0].d;
    // заливка під лінією — окремо для кожного безперервного шматка
    const area = solo ? paths[0].d.split('M').filter(Boolean).map((sub) => {
      const x0 = sub.split(',')[0];
      return `M${sub}V${H - B0}H${x0}Z`;
    }).join('') : null;
    return { Y, yt, paths, area };
  });

  const DAY = 86400e3;
  function timeTicks(t0, t1) {
    const span = t1 - t0, out = [];
    if (!span) return out;
    if (span > 40 * DAY) {           // рік — місяці
      const d = new Date(t0); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() + 1);
      for (; +d < t1; d.setMonth(d.getMonth() + 2)) out.push({ t: +d, l: d.toLocaleDateString('uk-UA', { month: 'short' }) });
      return out;
    }
    let stepMs, fmt;
    if (span <= 2 * 3600e3) { stepMs = 15 * 60e3; fmt = { hour: '2-digit', minute: '2-digit' }; }
    else if (span <= 1.1 * DAY) { stepMs = 4 * 3600e3; fmt = { hour: '2-digit', minute: '2-digit' }; }
    else if (span <= 8 * DAY) { stepMs = DAY; fmt = { weekday: 'short' }; }
    else { stepMs = 5 * DAY; fmt = { day: 'numeric', month: '2-digit' }; }
    const d = new Date(t0);
    if (stepMs >= DAY) { d.setHours(0, 0, 0, 0); d.setTime(+d + DAY); }
    else { d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); if (stepMs > 3600e3) { d.setMinutes(0); while (d.getHours() % 4 || +d < t0) d.setTime(+d + 3600e3); } }
    for (; +d < t1 - stepMs * 0.3; d.setTime(+d + stepMs)) out.push({ t: +d, l: d.toLocaleString('uk-UA', fmt) });
    return out;
  }
  const xt = $derived(timeTicks(data.t0, data.t1));

  // ---------- підсумки за період (зважені за часом) ----------
  function summary(s) {
    const { t0, t1 } = data;
    let mn = Infinity, mx = -Infinity, acc = 0, w = 0;
    s.pts.forEach((p, i) => {
      if (p[1] == null) return;
      mn = Math.min(mn, p[2] ?? p[1]); mx = Math.max(mx, p[3] ?? p[1]);
      const e = s.step ? (i + 1 < s.pts.length ? s.pts[i + 1][0] : t1) : p[0] + 1;
      const d = s.step ? Math.max(0, Math.min(e, t1) - Math.max(p[0], t0)) : 1;
      acc += p[1] * d; w += d;
    });
    return isFinite(mn) ? { mn, mx, avg: w ? acc / w : null } : null;
  }
  const dur = (ms) => { const m = Math.round(ms / 60000); if (m < 60) return `${m} хв`; const h = Math.floor(m / 60); return h >= 48 ? `${(Math.round(h / 2.4) / 10).toString().replace('.', ',')} дн` : `${h} год` + (m % 60 ? ` ${m % 60} хв` : ''); };

  // ---------- наведення ----------
  const valueAt = (s, t) => { let v = null; for (const p of s.pts) { if (p[0] <= t) v = p[1]; else break; } return v; };
  const barAt = (b, t) => (b.segs.on.some(([s, e]) => s <= t && t < e) ? b.word : b.segs.na.some(([s, e]) => s <= t && t < e) ? 'немає даних' : 'ні');
  function onMove(ev) {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = Math.max(L0, Math.min(W - R0, (ev.clientX - r.left) / r.width * W));
    hover = { x, t: data.t0 + (x - L0) / (W - L0 - R0) * (data.t1 - data.t0) };
  }
  const fmtT = (t) => new Date(t).toLocaleString('uk-UA', hours > 24 ? { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' });
  const nameOf = (s) => s.name || label(s.e);
  const curVal = (e) => { const s = ha.states[e]; return s ? (isClimate(e) ? s.attributes.current_temperature : s.state) : null; };
  const plotH = $derived(geo ? H : 0);
  const totalH = $derived(plotH + data.bars.length * (BH + 6) + (geo ? 4 : B0 + 4));
</script>

{#if numeric.length + onoff.length > 1}
  <div class="pick">
    {#if numeric.length}
      <div class="grp">Значення <span>· можна накласти кілька з однаковою одиницею</span></div>
      <div class="chips">
        {#each numeric as c (c)}
          {@const i = lines.indexOf(c)}
          <button class:sel={i >= 0} class:other={i < 0 && lines.length && unitOf(c) !== unit} style={i >= 0 ? `--c:${COLORS[i % COLORS.length]}` : ''} onclick={() => toggleLine(c)}>
            <i></i>{label(c)}{#if unitOf(c)}<small>{unitOf(c)}</small>{/if}
          </button>
        {/each}
      </div>
    {/if}
    {#if onoff.length}
      <div class="grp">Увімк. / вимк. <span>· смугами під графіком</span></div>
      <div class="chips">
        {#each onoff as c (c)}
          {@const i = bars.indexOf(c)}
          <button class:sel={i >= 0} style={i >= 0 ? `--c:${COLORS[(lines.length + i) % COLORS.length]}` : ''} onclick={() => toggleBar(c)}><i class="sq"></i>{label(c)}</button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<div class="ranges">
  {#each RANGES as [l, h]}<button class:sel={hours === h} onclick={() => (hours = h)}>{l}</button>{/each}
</div>

<!-- значення: зараз або в точці під пальцем -->
<div class="legend">
  <div class="when">{hover ? fmtT(hover.t) : 'Зараз'}</div>
  {#each data.lines as s (s.e)}
    {@const v = hover ? valueAt(s, hover.t) : s.dashed ? s.pts.at(-1)?.[1] : Number(curVal(s.e))}
    <div class="lg"><i style="background:{s.color}" class:dash={s.dashed}></i><span>{nameOf(s)}</span><b>{v != null && isFinite(v) ? num(v) : '—'}<small> {unit}</small></b></div>
  {/each}
  {#each data.bars as b (b.e)}
    <div class="lg"><i class="sq" style="background:{b.color}"></i><span>{b.name}</span><b class="w">{barAt(b, hover ? hover.t : data.t1 - 1)}</b></div>
  {/each}
</div>

<div class="chart">
  {#if loading && !data.lines.length && !data.bars.length}<div class="ph">Завантаження…</div>
  {:else if !geo && !data.bars.length}<div class="ph">Немає даних за цей період</div>
  {:else}
    <svg viewBox="0 0 {W} {totalH}" role="img" aria-label="графік" class:dim={loading}
      onpointermove={onMove} onpointerdown={onMove} onpointerleave={() => (hover = null)}>
      <defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color={geo?.paths[0]?.color} stop-opacity=".3" /><stop offset="1" stop-color={geo?.paths[0]?.color} stop-opacity="0" /></linearGradient></defs>
      {#if geo}
        {#each geo.yt as t}<line x1={L0} x2={W - R0} y1={t.y} y2={t.y} class="grid" /><text x={L0 - 6} y={t.y + 4} class="tick" text-anchor="end">{num(t.v)}</text>{/each}
        {#if geo.area}<path d={geo.area} fill="url(#cg)" />{/if}
        {#each geo.paths as p (p.e)}
          {#if p.band}<path d={p.band} fill={p.color} opacity=".18" />{/if}
          <path d={p.d} fill="none" stroke={p.color} stroke-width={p.dashed ? 1.5 : 2.2} stroke-dasharray={p.dashed ? '5 4' : null} opacity={p.dashed ? 0.85 : 1} stroke-linejoin="round" />
        {/each}
      {/if}
      <!-- шкала часу -->
      {#each xt as t}
        <line x1={X(t.t)} x2={X(t.t)} y1={T0} y2={geo ? H - B0 : 4} class="vgrid" />
        <text x={X(t.t)} y={geo ? H - 6 : totalH - 6} class="tick" text-anchor="middle">{t.l}</text>
      {/each}
      <!-- смуги увімк./вимк. -->
      {#each data.bars as b, j (b.e)}
        {@const y = plotH + j * (BH + 6) + 2}
        <rect x={L0} y={y} width={W - L0 - R0} height={BH} rx="4" class="track" />
        {#each b.segs.na as [s, e]}<rect x={X(s)} y={y} width={Math.max(1, X(e) - X(s))} height={BH} class="na" />{/each}
        {#each b.segs.on as [s, e]}<rect x={X(s)} y={y} width={Math.max(1.5, X(e) - X(s))} height={BH} rx="2" fill={b.color} />{/each}
      {/each}
      {#if hover}
        <line x1={hover.x} x2={hover.x} y1="0" y2={totalH} class="cursor" />
        {#if geo}{#each geo.paths as p (p.e)}{@const v = valueAt(p, hover.t)}{#if v != null}<circle cx={hover.x} cy={geo.Y(v)} r="4" fill={p.color} stroke="#fff" stroke-width="1.5" />{/if}{/each}{/if}
      {/if}
    </svg>
  {/if}
</div>

<!-- підсумки за період -->
<div class="sums">
  {#each data.lines.filter((s) => !s.dashed) as s (s.e)}
    {@const x = summary(s)}
    {#if x}
      <div class="sm"><div class="nm"><i style="background:{s.color}"></i><span>{nameOf(s)}</span><small>за період</small></div>
        <em>мін <b>{num(x.mn)}</b></em><em>сер <b>{x.avg != null ? num(x.avg) : '—'}</b></em><em>макс <b>{num(x.mx)}</b></em><em>{unit}</em></div>
    {/if}
  {/each}
  {#each data.bars as b (b.e)}
    <div class="sm"><div class="nm"><i class="sq" style="background:{b.color}"></i><span>{b.name}</span><small>за період</small></div>
      <em>{b.word} <b>{dur(b.segs.total)}</b></em><em>разів <b>{b.segs.count}</b></em></div>
  {/each}
  {#if data.stats && data.lines.some((s) => s.pts.some((p) => p[2] != null))}<p class="note">Лінія — середнє за кожну {hours > 24 * 60 ? 'добу' : 'годину'}, світла смуга — від мінімуму до максимуму.</p>{/if}
</div>

<style>
  .pick { display: grid; gap: 4px; margin-bottom: 8px; }
  .grp { font-size: 12px; font-weight: 600; margin: 4px 2px 2px; } .grp span { color: var(--muted); font-weight: 400; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips button { all: unset; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 7px 11px; border-radius: 14px; background: var(--tile); font-size: 13px; }
  .chips button small { color: var(--muted); font-size: 11px; }
  .chips button i { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--muted); box-sizing: border-box; }
  .chips button i.sq { border-radius: 3px; }
  .chips button.sel { background: color-mix(in srgb, var(--c) 22%, var(--tile)); }
  .chips button.sel i { background: var(--c); border-color: var(--c); }
  .chips button.other { opacity: .5; }
  .ranges { display: grid; grid-template-columns: repeat(5, 1fr); background: var(--tile); border-radius: 16px; padding: 4px; margin: 6px 0 12px; }
  .ranges button { all: unset; cursor: pointer; text-align: center; padding: 8px 0; border-radius: 12px; font-weight: 600; font-size: 13px; color: var(--muted); }
  .ranges button.sel { background: var(--pw); color: var(--accent); }
  .legend { display: flex; flex-wrap: wrap; gap: 2px 14px; align-items: baseline; min-height: 44px; }
  .when { width: 100%; color: var(--muted); font-size: 12px; }
  .lg { display: flex; align-items: center; gap: 6px; font-size: 13px; }
  .lg i { width: 10px; height: 10px; border-radius: 50%; flex: none; } .lg i.sq { border-radius: 3px; }
  .lg i.dash { height: 3px; border-radius: 0; width: 12px; }
  .lg span { color: var(--muted); } .lg b { font-size: 18px; } .lg b small { font-size: 12px; color: var(--muted); font-weight: 400; } .lg b.w { font-size: 15px; }
  .chart { margin: 6px 0 4px; min-height: 40px; }
  .chart svg { width: 100%; height: auto; display: block; touch-action: pan-y; transition: opacity .2s; } .chart svg.dim { opacity: .5; }
  .ph { height: 200px; display: grid; place-items: center; color: var(--muted); }
  .grid { stroke: var(--line); stroke-width: 1; } .vgrid { stroke: var(--line); stroke-width: 1; stroke-dasharray: 2 4; }
  .tick { fill: var(--muted); font-size: 11px; }
  .track { fill: var(--pw); } .na { fill: rgba(140,140,140,.3); }
  .cursor { stroke: #fff; stroke-opacity: .5; stroke-dasharray: 3 3; }
  .sums { display: grid; gap: 6px; margin-top: 8px; }
  .sm { display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 14px; background: var(--tile); border-radius: 12px; padding: 8px 12px; font-size: 13px; }
  .sm .nm { width: 100%; display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
  .sm i { width: 10px; height: 10px; border-radius: 50%; } .sm i.sq { border-radius: 3px; }
  .sm span { color: var(--muted); } .sm small { color: var(--muted); opacity: .7; margin-left: auto; font-size: 11.5px; }
  .sm em { font-style: normal; color: var(--muted); } .sm em b { color: var(--text, #fff); font-size: 15px; }
  .note { color: var(--muted); font-size: 11.5px; margin: 2px; }
</style>
