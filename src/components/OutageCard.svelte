<script>
  // Графік відключень (інтеграція ukraine_outages): статус + сітка по пів години на сьогодні/завтра.
  import Icon from './Icon.svelte';
  import { ha, send } from '../lib/ha.svelte.js';

  let { entity = 'binary_sensor.svitlo_vidkliuchennia_zaraz', back = 'sensor.svitlo_uvimknennia', next = 'sensor.svitlo_nastupne_vidkliuchennia', grid = 'binary_sensor.svitlo_merezha' } = $props();
  const s = $derived(ha.states[entity]);
  const a = $derived(s?.attributes || {});
  const plannedOff = $derived(s?.state === 'on');
  // фактичний стан — з енергомонітора на вводі; без нього — за графіком
  const g = $derived(ha.states[grid]);
  const hasGrid = $derived(g && ['on', 'off'].includes(g.state));
  const off = $derived(hasGrid ? g.state === 'off' : plannedOff);
  const mismatch = $derived(hasGrid && off !== plannedOff);
  const since = $derived(hasGrid ? g.last_changed : null);

  // фактичні відключення сьогодні по пів години (історія енергомонітора)
  let actual = $state(null);
  async function loadActual() {
    if (!ha.connected || !ha.states[grid]) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    // напруга фаз з лічильника за день: є хоч на одній фазі >150 В — світло було; немає даних — сіре
    const V = [1, 2, 3].map((i) => `sensor.lichylnyk_napruga_l${i}`);
    try {
      const r = await send({ type: 'history/history_during_period', start_time: start.toISOString(), entity_ids: V, minimal_response: true, no_attributes: true });
      const row = Array(48).fill(null);
      const has = Array.from({ length: 48 }, () => [false, false]);
      for (const e of V) {
        const pts = (r[e] || []).map((x) => [(x.lu ?? x.lc) * 1000, parseFloat(x.s)]);
        for (let i = 0; i < pts.length; i++) {
          const [t0, v] = pts[i]; if (isNaN(v)) continue;
          const t1 = i + 1 < pts.length ? pts[i + 1][0] : Date.now();
          const h0 = Math.max(0, Math.floor((t0 - start.getTime()) / 1800000)), h1 = Math.min(47, Math.floor((t1 - 1 - start.getTime()) / 1800000));
          for (let h = h0; h <= h1; h++) has[h][v > 150 ? 0 : 1] = true;
        }
      }
      // пів години червона, якщо в ній була хвилина без напруги на всіх фазах (спрощено: будь-яке падіння)
      for (let h = 0; h < 48; h++) row[h] = has[h][1] ? 'off' : has[h][0] ? 'on' : null;
      actual = row;
    } catch {}
  }
  $effect(() => { ha.connected; g?.state; loadActual(); const t = setInterval(loadActual, 300000); return () => clearInterval(t); });
  const ago = (iso) => { const m = Math.max(0, Math.round((now - new Date(iso)) / 60000)); return (m >= 60 ? `${Math.floor(m / 60)} год ` : '') + `${m % 60} хв`; };
  let now = $state(Date.now());
  $effect(() => { const t = setInterval(() => (now = Date.now()), 30000); return () => clearInterval(t); });

  const mins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const parse = (lst) => (lst || []).map((iv) => { const [x, y] = iv.replace('–', '-').split('-'); const b = mins(y); return [mins(x), b === 0 ? 1440 : b]; });
  function cells(offL, possL) {
    const o = parse(offL), p = parse(possL);
    return Array.from({ length: 48 }, (_, i) => {
      const a0 = i * 30, a1 = a0 + 30;
      if (o.some(([x, y]) => x < a1 && y > a0)) return 'off';
      if (p.some(([x, y]) => x < a1 && y > a0)) return 'maybe';
      return 'on';
    });
  }
  const left = (iso) => {
    const m = Math.max(0, Math.ceil((new Date(iso) - now) / 60000));
    return (m >= 60 ? `${Math.floor(m / 60)} год ` : '') + `${m % 60} хв`;
  };
  const clock = (iso) => new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  const backSt = $derived(ha.states[back]?.state);
  const nextSt = $derived(ha.states[next]?.state);
  const valid = (v) => v && !['unknown', 'unavailable'].includes(v);
  const curHalf = $derived(Math.floor((new Date(now).getHours() * 60 + new Date(now).getMinutes()) / 30));
  const days = $derived([
    ['Сьогодні', cells(a.today, a.today_possible), true, a.today],
    ...(a.tomorrow ? [['Завтра', cells(a.tomorrow, a.tomorrow_possible), false, a.tomorrow]] : []),
  ]);
</script>

{#if s}
  <div class="card" class:off class:mismatch>
    <div class="head">
      <span class="ico"><Icon name={off ? 'mdi:transmission-tower-off' : 'mdi:transmission-tower'} size={30} /></span>
      <div>
        <div class="big">
          {#if off}Світла немає{#if hasGrid && since} вже {ago(since)}{:else if valid(backSt)} ще {left(backSt)}{/if}
          {:else}Світло є{#if plannedOff}{' '}(за графіком — відключення){:else if valid(nextSt)}{' · відключення через '}{left(nextSt)}{/if}{/if}
        </div>
        <div class="sub">
          {#if off && !plannedOff}⚡ Позапланове відключення{:else if off && valid(backSt)}За графіком увімкнення о {clock(backSt)}{:else if valid(nextSt)}Наступне о {clock(nextSt)}{:else}Відключень не заплановано{/if}
          {#if a.group} · черга {a.group}{/if}
        </div>
      </div>
    </div>
    {#if !(a.today?.length || a.today_possible?.length || a.tomorrow?.length || a.tomorrow_possible?.length || actual?.includes('off'))}
      <!-- без відключень — сітку не показуємо -->
    {:else}
    {#each days as [title, row, isToday, list]}
      <div class="day"><b>{title}</b> <span>{(list || []).join(', ') || 'без відключень'}</span></div>
      <div class="grid">
        {#each row as c, i}
          <div class="cell {c}" class:now={isToday && i === curHalf}>{#if i % 2 === 0}<em>{String(i / 2).padStart(2, '0')}</em>{/if}</div>
        {/each}
      </div>
      {#if isToday && actual}
        <div class="day fact"><b>Фактично</b> <span>за енергомонітором</span></div>
        <div class="grid thin">
          {#each actual as c, i}<div class="cell {c ? 'a' + c : 'none'}" class:now={i === curHalf}></div>{/each}
        </div>
      {/if}
    {/each}
    {/if}
    {#if !a.tomorrow}<div class="sub">Графік на завтра ще не опубліковано</div>{/if}
  </div>
{/if}

<style>
  .card { background: var(--tile); border-radius: var(--r-tile); padding: 16px; }
  .card.off { background: linear-gradient(160deg, #3a1a1d, var(--tile) 70%); }
  .head { display: flex; gap: 14px; align-items: center; margin-bottom: 12px; }
  .ico { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; background: rgba(48,209,88,.18); color: #30d158; flex: none; }
  .off .ico { background: rgba(255,69,58,.2); color: #ff453a; }
  .big { font-size: 18px; font-weight: 700; } .sub { color: var(--muted); font-size: 13px; margin-top: 2px; }
  .day { margin: 12px 0 6px; font-size: 13px; } .day span { color: var(--muted); }
  .grid { display: grid; grid-template-columns: repeat(24, minmax(0, 1fr)); gap: 2px; }
  @media (max-width: 520px) { .grid { grid-template-columns: repeat(12, minmax(0, 1fr)); } }
  .cell { height: 22px; border-radius: 4px; position: relative; }
  .cell em { position: absolute; top: -1px; left: 2px; font-size: 9px; font-style: normal; color: rgba(255,255,255,.75); }
  .cell.on { background: rgba(48,209,88,.55); }
  .cell.off { background: #ff453a; }
  .cell.maybe { background: #ffd60a; } .cell.maybe em { color: #333; }
  .cell.now { outline: 2px solid #fff; outline-offset: -1px; }
  .thin .cell { height: 10px; }
  .cell.aon { background: rgba(48,209,88,.55); } .cell.aoff { background: #ff453a; } .cell.none { background: var(--pw); }
  .fact { margin-top: 6px; }
</style>
