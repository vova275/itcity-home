<script>
  // Вкладка «Історія»: журнал подій пристрою за 3 доби.
  import { ha, send } from '../lib/ha.svelte.js';
  import { friendly } from '../lib/model.js';
  import { stateText } from '../lib/format.js';

  let { device } = $props();
  let events = $state([]);
  let loading = $state(true);
  let failed = $state(false);
  let days = $state(1);

  async function load() {
    loading = true; failed = false;
    try {
      const start = new Date(Date.now() - days * 86400e3).toISOString();
      const r = await send({ type: 'logbook/get_events', start_time: start, entity_ids: device.entities });
      events = r.slice(-200).reverse();
    } catch { failed = true; }
    loading = false;
  }
  $effect(() => { device; days; load(); });

  const day = (t) => new Date(t * 1000).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = (t) => new Date(t * 1000).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  const label = (ev) => ev.message || stateText({ entity_id: ev.entity_id || 'x.x', state: ev.state, attributes: ha.states[ev.entity_id]?.attributes || {} });
</script>

{#if loading && !events.length}<p class="muted">Завантаження…</p>
{:else if failed}<p class="muted">Не вдалося завантажити. <button class="more" onclick={load}>Повторити</button></p>
{:else if !events.length}<p class="muted">За {days === 1 ? 'добу' : 'тиждень'} подій немає. {#if days < 7}<button class="more" onclick={() => (days = 7)}>Показати за тиждень</button>{/if}</p>
{:else}
  {#each events as ev, i}
    {#if i === 0 || day(ev.when) !== day(events[i - 1].when)}<div class="day">{day(ev.when)}</div>{/if}
    <div class="ev">
      <span class="t">{time(ev.when)}</span>
      <span class="dot"></span>
      <span class="m">
        {#if device.entities.length > 1 && ev.entity_id}<b>{friendly(ha, ev.entity_id).replace(device.name, '').trim()}</b> {/if}{label(ev)}
        {#if ev.context_user_id || ev.context_event_type}<small>{ev.context_event_type === 'automation_triggered' ? 'автоматизація' : ev.context_user_id ? 'користувач' : ''}</small>{/if}
      </span>
    </div>
  {/each}
  {#if days < 7}<button class="more" onclick={() => (days = 7)}>Показати за тиждень</button>{/if}
{/if}

<style>
  .muted { color: var(--muted); }
  .more { all: unset; cursor: pointer; display: block; margin: 14px auto 0; padding: 10px 18px; border-radius: 14px; background: var(--tile); color: var(--accent); text-align: center; }
  .muted .more { display: inline-block; margin: 0 0 0 6px; }
  .day { margin: 16px 0 6px; font-size: 13px; color: var(--muted); text-transform: capitalize; }
  .ev { display: flex; gap: 12px; align-items: baseline; padding: 6px 0; }
  .t { width: 44px; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex: none; transform: translateY(-1px); }
  .m { flex: 1; font-size: 15px; } .m small { color: var(--muted); margin-left: 6px; font-size: 12px; }
</style>
