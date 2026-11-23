<script>
  // Історія відключень світла за період: фактично (за лічильником) і за графіком.
  import Icon from './Icon.svelte';
  import { ui, back } from '../lib/ui.svelte.js';
  import { out, loadOutages, dayStart, addDays, keyOf, clip, sum, halfHours, planMinutes, planMinutesIn, planCells, dur, hm } from '../lib/outages.svelte.js';

  const today = dayStart(Date.now());
  const monthStart = (t, n = 0) => { const d = new Date(t); d.setDate(1); d.setMonth(d.getMonth() + n); return dayStart(d); };
  const PERIODS = [
    ['7', '7 днів', () => [addDays(today, -6), addDays(today, 1)]],
    ['30', '30 днів', () => [addDays(today, -29), addDays(today, 1)]],
    ['m', 'Цей місяць', () => [monthStart(today), addDays(today, 1)]],
    ['pm', 'Минулий місяць', () => [monthStart(today, -1), monthStart(today)]],
    ['all', 'Усе', () => [dayStart(Math.min(today, ...out.events.map((x) => x.s), ...Object.keys(out.plans).map((k) => new Date(k + 'T00:00').getTime()))), addDays(today, 1)]],
    ['c', 'Свій', null],
  ];
  let sel = $state('7');
  let from = $state(keyOf(addDays(today, -6))), to = $state(keyOf(today));
  let now = $state(Date.now());

  $effect(() => { if (ui.outages) { now = Date.now(); loadOutages(); } });

  const range = $derived.by(() => {
    if (sel === 'c') { const a = new Date(from + 'T00:00').getTime(), b = addDays(new Date(to + 'T00:00').getTime(), 1); return isFinite(a) && isFinite(b) && b > a ? [a, b] : [today, addDays(today, 1)]; }
    return PERIODS.find((p) => p[0] === sel)[2]();
  });
  const dataFrom = $derived(out.since ?? (out.events[0]?.s ?? now));
  const segs = $derived(clip(out.events, range[0], Math.min(range[1], now), now));
  const days = $derived.by(() => {
    const r = [];
    for (let d = addDays(range[1], -1); d >= range[0]; d = addDays(d, -1)) {
      const s = clip(out.events, d, addDays(d, 1), now), plan = out.plans[keyOf(d)];
      const nodata = addDays(d, 1) <= dataFrom;
      // для сьогодні графік рахуємо лише до «зараз», щоб порівнювати з фактом чесно
      const upto = d === today ? Math.floor((now - d) / 60000) : 1440;
      const cells = halfHours(out.events, d, now).map((c, i) => (d + (i + 1) * 1800e3 <= dataFrom ? null : c));
      r.push({ d, nodata, segs: s, off: sum(s), cells, plan, planCells: planCells(plan), planMin: plan ? planMinutes(plan) : null, planDone: nodata || !plan ? 0 : planMinutesIn(plan, Math.max(0, Math.ceil((dataFrom - d) / 60000)), upto) });
    }
    return r;
  });
  const total = $derived(sum(segs));
  const longest = $derived(segs.reduce((m, [s, e]) => Math.max(m, e - s), 0));
  // період, за який реально є дані
  const span = $derived(Math.max(60000, Math.min(range[1], now) - Math.max(range[0], dataFrom)));
  const nDays = $derived(Math.max(1, span / 86400e3));
  const planTotal = $derived(days.reduce((t, x) => t + x.planDone, 0) * 60000);
  const hasPlan = $derived(days.some((x) => x.plan));
  const dname = (d) => new Date(d).toLocaleDateString('uk-UA', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const pct = (ms) => Math.round(ms / span * 100);
</script>

{#if ui.outages}
  <div class="backdrop" onclick={back} role="presentation"></div>
  <div class="sheet" role="dialog" aria-modal="true">
    <header>
      <b>Відключення світла</b>
      <button onclick={back} aria-label="Закрити"><Icon name="mdi:close" /></button>
    </header>
    <div class="body">
      <div class="chips">
        {#each PERIODS as [id, label]}<button class:sel={sel === id} onclick={() => (sel = id)}>{label}</button>{/each}
      </div>
      {#if sel === 'c'}
        <div class="custom"><input type="date" bind:value={from} max={to} /> — <input type="date" bind:value={to} min={from} max={keyOf(today)} /></div>
      {/if}

      <div class="stats">
        <div class="st red"><span>Без світла</span><b>{dur(total)}</b><em>{pct(total)}% часу</em></div>
        <div class="st"><span>Відключень</span><b>{segs.length}</b><em>найдовше {longest ? dur(longest) : '—'}</em></div>
        <div class="st"><span>В середньому</span><b>{dur(total / nDays)}</b><em>за добу</em></div>
        {#if hasPlan}<div class="st yel"><span>За графіком</span><b>{dur(planTotal)}</b><em>{Math.abs(total - planTotal) < 15 * 60000 ? 'фактично майже так само' : total > planTotal ? 'фактично більше на ' + dur(total - planTotal) : 'фактично менше на ' + dur(planTotal - total)}</em></div>{/if}
      </div>

      {#if !out.loaded}<p class="muted">Завантаження…</p>
      {:else}
        <div class="legend"><i class="l-off"></i>фактично без світла <i class="l-plan"></i>за графіком</div>
        {#each days as x (x.d)}
          <div class="day">
            <div class="dh"><b>{dname(x.d)}</b>
              <span>{#if x.nodata}немає даних{:else if x.off}<span class="red">{dur(x.off)}</span>{:else}без відключень{/if}{#if x.planMin != null}{' · за графіком '}{x.planMin ? dur(x.planMin * 60000) : '0'}{/if}</span>
            </div>
            <div class="bar plan">{#each x.planCells as c}<div class:p={c}></div>{/each}</div>
            <div class="bar">{#each x.cells as c}<div class={c || 'none'}></div>{/each}</div>
            {#if x.segs.length}<div class="ivs">{x.segs.map(([s, e]) => `${hm(s)}–${e >= now - 60000 && out.events.at(-1)?.e == null ? 'зараз' : hm(e)} (${dur(e - s)})`).join(', ')}</div>{/if}
          </div>
        {/each}
        <p class="muted small">Дані є з {new Date(dataFrom).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}, журнал зберігається назавжди. Сірим — немає даних. Графік за сьогодні враховано до поточного часу.</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 45; }
  .sheet { position: fixed; z-index: 46; left: 50%; bottom: 0; transform: translateX(-50%); width: min(720px, 100vw); max-height: 90vh;
    background: var(--bg-sheet); border-radius: 28px 28px 0 0; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }
  header { display: flex; align-items: center; justify-content: space-between; padding: 18px 18px 8px; font-size: 20px; }
  header button { all: unset; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); }
  .body { overflow-y: auto; padding: 8px 16px 24px; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chips button { all: unset; cursor: pointer; padding: 7px 12px; border-radius: 999px; background: var(--pw); font-size: 13px; }
  .chips button.sel { background: #fff; color: #000; font-weight: 600; }
  .custom { margin-top: 10px; display: flex; gap: 8px; align-items: center; color: var(--muted); }
  .custom input { background: var(--pw); color: inherit; border: 0; border-radius: 10px; padding: 7px 10px; font: inherit; color-scheme: dark; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin: 14px 0; }
  .st { background: var(--tile); border-radius: 16px; padding: 10px 12px; display: flex; flex-direction: column; }
  .st span, .st em { color: var(--muted); font-size: 12px; font-style: normal; } .st b { font-size: 20px; margin: 2px 0; }
  .st.red b { color: #ff453a; } .st.yel b { color: #ffd60a; }
  .legend { font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .legend i { display: inline-block; width: 14px; height: 8px; border-radius: 2px; margin-left: 6px; }
  .l-off { background: #ff453a; } .l-plan { background: #ffd60a; }
  .day { padding: 10px 0; border-top: 1px solid var(--pw); }
  .dh { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; margin-bottom: 6px; } .dh > span { color: var(--muted); text-align: right; }
  .red { color: #ff453a !important; }
  .bar { display: grid; grid-template-columns: repeat(48, minmax(0, 1fr)); gap: 1px; }
  .bar div { height: 12px; border-radius: 2px; }
  .bar.plan div { height: 4px; margin-bottom: 2px; background: transparent; } .bar.plan div.p { background: #ffd60a; }
  .bar .on { background: rgba(48,209,88,.5); } .bar .off { background: #ff453a; } .bar .none { background: var(--pw); }
  .ivs { font-size: 12px; color: var(--muted); margin-top: 5px; }
  .muted { color: var(--muted); } .small { font-size: 12px; margin-top: 14px; }
</style>
