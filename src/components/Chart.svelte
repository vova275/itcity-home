<script>
  // Вкладка «Графіки» як Insights у Homey: вибір параметра + період Г/Д/Т/М/Р.
  import { ha, send } from '../lib/ha.svelte.js';
  import { friendly } from '../lib/model.js';
  import { num } from '../lib/format.js';

  let { device, entity = $bindable() } = $props();
  const candidates = $derived(device.entities.filter((e) => {
    const s = ha.states[e];
    return s && (isFinite(Number(s.state)) || ['binary_sensor', 'climate', 'switch', 'light', 'fan'].includes(e.split('.')[0]));
  }));
  $effect(() => { if (!entity || !candidates.includes(entity)) entity = candidates[0]; });

  const RANGES = [['Г', 1], ['Д', 24], ['Т', 24 * 7], ['М', 24 * 30], ['Р', 24 * 365]];
  let hours = $state(24);
  let points = $state([]);
  let loading = $state(false);
  let hover = $state(null);

  const st = $derived(entity ? ha.states[entity] : null);
  const unit = $derived(st?.attributes?.unit_of_measurement || '');
  const isClimate = $derived(entity?.startsWith('climate.'));

  async function load() {
    if (!entity) return;
    loading = true; points = [];
    const end = new Date(); const start = new Date(end - hours * 3600e3);
    try {
      if (hours > 24 * 7) {
        const r = await send({ type: 'recorder/statistics_during_period', start_time: start.toISOString(), end_time: end.toISOString(),
          statistic_ids: [entity], period: hours > 24 * 60 ? 'day' : 'hour', types: ['mean', 'state'] });
        points = (r[entity] || []).map((p) => [p.start, p.mean ?? p.state]).filter((p) => p[1] != null);
      } else {
        const r = await send({ type: 'history/history_during_period', start_time: start.toISOString(), end_time: end.toISOString(),
          entity_ids: [entity], minimal_response: !isClimate, no_attributes: !isClimate, significant_changes_only: false });
        const arr = r[entity] || [];
        points = arr.map((p) => {
          const t = (p.lu ?? p.lc ?? 0) * 1000 || Date.parse(p.last_changed || p.last_updated);
          let v = isClimate ? (p.a?.current_temperature ?? p.attributes?.current_temperature) : (p.s ?? p.state);
          if (v === 'on') v = 1; else if (v === 'off') v = 0;
          return [t, Number(v)];
        }).filter((p) => isFinite(p[1]));
      }
    } catch (e) { points = []; }
    loading = false;
  }
  $effect(() => { entity; hours; load(); });

  const W = 600, H = 240, PAD = 28;
  const geo = $derived.by(() => {
    if (points.length < 2) return null;
    const xs = points.map((p) => +new Date(p[0])), ys = points.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (y0 === y1) { y0 -= 1; y1 += 1; }
    const pad = (y1 - y0) * 0.1; y0 -= pad; y1 += pad;
    const X = (x) => PAD + (x - x0) / (x1 - x0 || 1) * (W - PAD - 6);
    const Y = (y) => 8 + (1 - (y - y0) / (y1 - y0)) * (H - 30);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${X(+new Date(p[0])).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    const area = `${line}L${X(x1)},${H - 22}L${X(x0)},${H - 22}Z`;
    const ticks = [y0 + pad, (y0 + y1) / 2, y1 - pad].map((v) => ({ v, y: Y(v) }));
    return { line, area, ticks, X, Y, x0, x1, xs, ys };
  });
  const minV = $derived(points.length ? Math.min(...points.map((p) => p[1])) : null);
  const maxV = $derived(points.length ? Math.max(...points.map((p) => p[1])) : null);
  const avgV = $derived(points.length ? points.reduce((s, p) => s + p[1], 0) / points.length : null);

  function onMove(ev) {
    if (!geo) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width * W;
    let best = 0, bd = Infinity;
    geo.xs.forEach((xx, i) => { const d = Math.abs(geo.X(xx) - x); if (d < bd) { bd = d; best = i; } });
    hover = { x: geo.X(geo.xs[best]), y: geo.Y(geo.ys[best]), v: geo.ys[best], t: geo.xs[best] };
  }
  const fmtT = (t) => new Date(t).toLocaleString('uk-UA', hours > 48 ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' });
</script>

{#if candidates.length > 1}
  <select class="sel" bind:value={entity}>
    {#each candidates as c}<option value={c}>{friendly(ha, c).replace(device.name, '').trim() || friendly(ha, c)}</option>{/each}
  </select>
{/if}

<div class="head">
  <div class="cur">{hover ? num(hover.v) : (st ? num(isClimate ? st.attributes.current_temperature : st.state) : '—')} <span>{isClimate ? '°C' : unit}</span></div>
  <div class="when">{hover ? fmtT(hover.t) : 'зараз'}</div>
</div>

<div class="chart">
  {#if loading}<div class="ph">Завантаження…</div>
  {:else if !geo}<div class="ph">Немає даних за цей період</div>
  {:else}
    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" onpointermove={onMove} onpointerleave={() => (hover = null)}>
      <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--chart)" stop-opacity=".45" /><stop offset="1" stop-color="var(--chart)" stop-opacity="0" /></linearGradient></defs>
      {#each geo.ticks as t}<line x1={PAD} x2={W} y1={t.y} y2={t.y} class="grid" /><text x="2" y={t.y + 4} class="tick">{num(t.v)}</text>{/each}
      <path d={geo.area} fill="url(#g)" />
      <path d={geo.line} fill="none" stroke="var(--chart)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
      {#if hover}<line x1={hover.x} x2={hover.x} y1="0" y2={H - 22} class="cursor" /><circle cx={hover.x} cy={hover.y} r="5" fill="var(--chart)" stroke="#fff" stroke-width="2" />{/if}
    </svg>
  {/if}
</div>

{#if points.length}
  <div class="stats"><span>мін <b>{num(minV)}</b></span><span>сер <b>{num(avgV)}</b></span><span>макс <b>{num(maxV)}</b></span></div>
{/if}

<div class="ranges">
  {#each RANGES as [l, h]}<button class:sel={hours === h} onclick={() => (hours = h)}>{l}</button>{/each}
</div>

<style>
  .sel { width: 100%; padding: 12px; border-radius: 14px; background: var(--tile); color: var(--text); border: 0; font-size: 15px; margin-bottom: 12px; }
  .head { display: flex; align-items: baseline; justify-content: space-between; }
  .cur { font-size: 34px; font-weight: 700; } .cur span { font-size: 16px; color: var(--muted); font-weight: 400; }
  .when { color: var(--muted); }
  .chart { height: 240px; margin: 8px 0; }
  .chart svg { width: 100%; height: 100%; touch-action: none; }
  .ph { height: 100%; display: grid; place-items: center; color: var(--muted); }
  .grid { stroke: var(--line); stroke-width: 1; }
  .tick { fill: var(--muted); font-size: 11px; }
  .cursor { stroke: var(--muted); stroke-dasharray: 3 3; }
  .stats { display: flex; justify-content: space-around; color: var(--muted); font-size: 13px; }
  .stats b { color: var(--text); }
  .ranges { display: grid; grid-template-columns: repeat(5, 1fr); background: var(--tile); border-radius: 18px; padding: 4px; margin-top: 12px; }
  .ranges button { all: unset; cursor: pointer; text-align: center; padding: 10px 0; border-radius: 14px; font-weight: 600; color: var(--muted); }
  .ranges button.sel { background: var(--pw); color: var(--accent); }
</style>
