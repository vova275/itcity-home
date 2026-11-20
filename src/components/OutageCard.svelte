<script>
  // Графік відключень (інтеграція ukraine_outages): статус + сітка по пів години на сьогодні/завтра.
  import Icon from './Icon.svelte';
  import { ha } from '../lib/ha.svelte.js';

  let { entity = 'binary_sensor.svitlo_vidkliuchennia_zaraz', back = 'sensor.svitlo_uvimknennia', next = 'sensor.svitlo_nastupne_vidkliuchennia' } = $props();
  const s = $derived(ha.states[entity]);
  const a = $derived(s?.attributes || {});
  const off = $derived(s?.state === 'on');
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
  <div class="card" class:off>
    <div class="head">
      <span class="ico"><Icon name={off ? 'mdi:transmission-tower-off' : 'mdi:transmission-tower'} size={30} /></span>
      <div>
        <div class="big">
          {#if off}Світла немає{#if valid(backSt)} ще {left(backSt)}{/if}
          {:else}Світло є{#if valid(nextSt)} · відключення через {left(nextSt)}{/if}{/if}
        </div>
        <div class="sub">
          {#if off && valid(backSt)}Увімкнення о {clock(backSt)}{:else if valid(nextSt)}Наступне о {clock(nextSt)}{:else}Відключень не заплановано{/if}
          {#if a.group} · черга {a.group}{/if}
        </div>
      </div>
    </div>
    {#each days as [title, row, isToday, list]}
      <div class="day"><b>{title}</b> <span>{(list || []).join(', ') || 'без відключень'}</span></div>
      <div class="grid">
        {#each row as c, i}
          <div class="cell {c}" class:now={isToday && i === curHalf}>{#if i % 2 === 0}<em>{String(i / 2).padStart(2, '0')}</em>{/if}</div>
        {/each}
      </div>
    {/each}
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
</style>
