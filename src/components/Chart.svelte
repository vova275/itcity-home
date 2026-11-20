<script>
  // Вкладка «Графіки» як Insights у Homey, але з накладанням кількох параметрів з однаковою одиницею
  // (напр. напруга L1/L2/L3 або подача/обратка котла). Періоди Г/Д/Т/М/Р.
  import { ha, send } from '../lib/ha.svelte.js';
  import { friendly } from '../lib/model.js';
  import { num } from '../lib/format.js';

  let { device, entity = $bindable() } = $props();
  const COLORS = ['#bf5af2', '#3d8bff', '#30d158', '#ff9f0a', '#ff453a', '#64d2ff'];

  const isClimate = (e) => e.startsWith('climate.');
  const unitOf = (e) => (isClimate(e) ? '°C' : ha.states[e]?.attributes?.unit_of_measurement || '');
  const candidates = $derived(device.entities.filter((e) => {
    const s = ha.states[e];
    return s && (isFinite(Number(s.state)) || isClimate(e) || ['binary_sensor', 'switch', 'light', 'fan'].includes(e.split('.')[0]));
  }));
  const label = (e) => friendly(ha, e).replace(device.name || '\u0000', '').trim() || friendly(ha, e);

  let selected = $state([]);
  $effect(() => {
    if (entity && candidates.includes(entity) && !selected.includes(entity)) selected = [entity];
    else if (!selected.length && candidates.length) selected = [candidates[0]];
  });
  const unit = $derived(selected.length ? unitOf(selected[0]) : '');

  function toggle(e) {
    if (selected.includes(e)) { if (selected.length > 1) selected = selected.filter((x) => x !== e); }
    else if (unitOf(e) === unit) selected = [...selected, e].slice(-6);
    else selected = [e];            // інша одиниця — починаємо новий графік
    entity = selected[0];
  }

  const RANGES = [['Г', 1], ['Д', 24], ['Т', 24 * 7], ['М', 24 * 30], ['Р', 24 * 365]];
  let hours = $state(24);
  let series = $state([]);          // [{ e, color, points: [[t, v]] }]
  let loading = $state(false);
  let hover = $state(null);

  async function loadOne(e, start, end) {
    if (hours > 24 * 7) {
      const r = await send({ type: 'recorder/statistics_during_period', start_time: start.toISOString(), end_time: end.toISOString(),
        statistic_ids: [e], period: hours > 24 * 60 ? 'day' : 'hour', types: ['mean', 'state'] });
      return (r[e] || []).map((p) => [+new Date(p.start), p.mean ?? p.state]).filter((p) => p[1] != null);
    }
    const r = await send({ type: 'history/history_during_period', start_time: start.toISOString(), end_time: end.toISOString(),
      entity_ids: [e], minimal_response: !isClimate(e), no_attributes: !isClimate(e), significant_changes_only: false });
    return (r[e] || []).map((p) => {
      const t = (p.lu ?? p.lc ?? 0) * 1000 || Date.parse(p.last_changed || p.last_updated);
      let v = isClimate(e) ? (p.a?.current_temperature ?? p.attributes?.current_temperature) : (p.s ?? p.state);
      if (v === 'on') v = 1; else if (v === 'off') v = 0;
      return [t, Number(v)];
    }).filter((p) => isFinite(p[1]));
  }

  async function load() {
    const sel = [...selected];
    if (!sel.length) return;
    loading = true;
    const end = new Date(); const start = new Date(end - hours * 3600e3);
    try {
      const data = await Promise.all(sel.map((e) => loadOne(e, start, end).catch(() => [])));
      series = sel.map((e, i) => ({ e, color: COLORS[i % COLORS.length], points: data[i] }));
    } catch { series = []; }
    loading = false;
  }
  $effect(() => { selected; hours; load(); });

  const W = 600, H = 240, PAD = 34;
  const geo = $derived.by(() => {
    const all = series.flatMap((s) => s.points);
    if (all.length < 2) return null;
    const x0 = Math.min(...all.map((p) => p[0])), x1 = Math.max(...all.map((p) => p[0]));
    let y0 = Math.min(...all.map((p) => p[1])), y1 = Math.max(...all.map((p) => p[1]));
    if (y0 === y1) { y0 -= 1; y1 += 1; }
    const pad = (y1 - y0) * 0.1; y0 -= pad; y1 += pad;
    const X = (x) => PAD + (x - x0) / (x1 - x0 || 1) * (W - PAD - 6);
    const Y = (y) => 8 + (1 - (y - y0) / (y1 - y0)) * (H - 30);
    const lines = series.map((s) => ({ ...s,
      d: s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('') }));
    const area = lines.length === 1 && lines[0].points.length > 1
      ? `${lines[0].d}L${X(lines[0].points.at(-1)[0])},${H - 22}L${X(lines[0].points[0][0])},${H - 22}Z` : null;
    const ticks = [y0 + pad, (y0 + y1) / 2, y1 - pad].map((v) => ({ v, y: Y(v) }));
    return { lines, area, ticks, X, Y, x0, x1 };
  });

  // значення ряду в момент t (останнє відоме)
  const valueAt = (pts, t) => { let v = null; for (const p of pts) { if (p[0] <= t) v = p[1]; else break; } return v ?? pts[0]?.[1]; };

  function onMove(ev) {
    if (!geo) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width * W;
    const t = geo.x0 + (x - PAD) / (W - PAD - 6) * (geo.x1 - geo.x0);
    hover = { x: Math.max(PAD, Math.min(W - 6, x)), t, vals: series.map((s) => ({ e: s.e, color: s.color, v: valueAt(s.points, t) })) };
  }
  const fmtT = (t) => new Date(t).toLocaleString('uk-UA', hours > 48 ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' });
  const cur = (e) => { const s = ha.states[e]; return s ? (isClimate(e) ? s.attributes.current_temperature : s.state) : null; };
</script>

{#if candidates.length > 1}
  <div class="pick">
    {#each candidates as c (c)}
      {@const i = selected.indexOf(c)}
      <button class:sel={i >= 0} class:other={i < 0 && unitOf(c) !== unit} style={i >= 0 ? `--c:${COLORS[i % COLORS.length]}` : ''} onclick={() => toggle(c)}>
        <i></i>{label(c)}
      </button>
    {/each}
  </div>
  <p class="hint">Тап — додати/прибрати лінію. Накладаються параметри з однаковою одиницею ({unit || '—'}).</p>
{/if}

<div class="legend">
  {#each (hover ? hover.vals : series.map((s) => ({ e: s.e, color: s.color, v: Number(cur(s.e)) }))) as l (l.e)}
    <div class="lg"><i style="background:{l.color}"></i><span>{label(l.e)}</span><b>{l.v != null && isFinite(l.v) ? num(l.v) : '—'} {unit}</b></div>
  {/each}
  <div class="when">{hover ? fmtT(hover.t) : 'зараз'}</div>
</div>

<div class="chart">
  {#if loading}<div class="ph">Завантаження…</div>
  {:else if !geo}<div class="ph">Немає даних за цей період</div>
  {:else}
    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="графік" onpointermove={onMove} onpointerleave={() => (hover = null)}>
      <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color={series[0]?.color} stop-opacity=".4" /><stop offset="1" stop-color={series[0]?.color} stop-opacity="0" /></linearGradient></defs>
      {#each geo.ticks as t}<line x1={PAD} x2={W} y1={t.y} y2={t.y} class="grid" /><text x="2" y={t.y + 4} class="tick">{num(t.v)}</text>{/each}
      {#if geo.area}<path d={geo.area} fill="url(#g)" />{/if}
      {#each geo.lines as l (l.e)}
        <path d={l.d} fill="none" stroke={l.color} stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
      {/each}
      {#if hover}
        <line x1={hover.x} x2={hover.x} y1="0" y2={H - 22} class="cursor" />
        {#each hover.vals as v}{#if v.v != null}<circle cx={hover.x} cy={geo.Y(v.v)} r="4.5" fill={v.color} stroke="#fff" stroke-width="2" />{/if}{/each}
      {/if}
    </svg>
  {/if}
</div>

<div class="ranges">
  {#each RANGES as [l, h]}<button class:sel={hours === h} onclick={() => (hours = h)}>{l}</button>{/each}
</div>

<style>
  .pick { display: flex; flex-wrap: wrap; gap: 6px; }
  .pick button { all: unset; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 14px; background: var(--tile); font-size: 13px; }
  .pick button i { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--muted); box-sizing: border-box; }
  .pick button.sel { background: color-mix(in srgb, var(--c) 22%, var(--tile)); }
  .pick button.sel i { background: var(--c); border-color: var(--c); }
  .pick button.other { opacity: .55; }
  .hint { color: var(--muted); font-size: 12px; margin: 6px 2px 10px; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; }
  .lg { display: flex; align-items: center; gap: 6px; font-size: 13px; }
  .lg i { width: 10px; height: 10px; border-radius: 3px; } .lg span { color: var(--muted); } .lg b { font-size: 18px; }
  .when { margin-left: auto; color: var(--muted); font-size: 13px; }
  .chart { height: 240px; margin: 8px 0; }
  .chart svg { width: 100%; height: 100%; touch-action: none; }
  .ph { height: 100%; display: grid; place-items: center; color: var(--muted); }
  .grid { stroke: var(--line); stroke-width: 1; }
  .tick { fill: var(--muted); font-size: 11px; }
  .cursor { stroke: var(--muted); stroke-dasharray: 3 3; }
  .ranges { display: grid; grid-template-columns: repeat(5, 1fr); background: var(--tile); border-radius: 18px; padding: 4px; margin-top: 12px; }
  .ranges button { all: unset; cursor: pointer; text-align: center; padding: 10px 0; border-radius: 14px; font-weight: 600; color: var(--muted); }
  .ranges button.sel { background: var(--pw); color: var(--accent); }
</style>
