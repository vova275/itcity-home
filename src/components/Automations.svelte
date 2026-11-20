<script>
  // Вкладка «Автоматизації»: сценарії, у яких бере участь пристрій (search/related), з перемикачем.
  import Icon from './Icon.svelte';
  import { ha, send, callService } from '../lib/ha.svelte.js';
  import { timeAgo } from '../lib/format.js';

  let { device } = $props();
  let ids = $state([]);
  let loading = $state(true);

  async function load() {
    loading = true;
    const set = new Set();
    try {
      const reqs = device.device
        ? [send({ type: 'search/related', item_type: 'device', item_id: device.device.id })]
        : device.entities.map((e) => send({ type: 'search/related', item_type: 'entity', item_id: e }));
      for (const r of await Promise.all(reqs)) (r.automation || []).forEach((a) => set.add(a));
    } catch {}
    ids = [...set]; loading = false;
  }
  $effect(() => { device; load(); });
</script>

{#if loading}<p class="muted">Шукаю…</p>
{:else if !ids.length}<p class="muted">Цей пристрій не бере участі в жодній автоматизації.</p>
{:else}
  <div class="list">
    {#each ids as id (id)}
      {@const s = ha.states[id]}
      <div class="item">
        <Icon name="mdi:robot" size={22} />
        <span class="n">{s?.attributes?.friendly_name || id}<small>{s?.attributes?.last_triggered ? 'спрацювала ' + timeAgo(s.attributes.last_triggered) : 'ще не спрацьовувала'}</small></span>
        <button class="run" title="Запустити" onclick={() => callService('automation', 'trigger', {}, { entity_id: id })}><Icon name="mdi:play" size={20} /></button>
        <button class="sw" class:on={s?.state === 'on'} aria-label="увімк./вимк." onclick={() => callService('automation', 'toggle', {}, { entity_id: id })}><i></i></button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .muted { color: var(--muted); }
  .list { display: flex; flex-direction: column; gap: 6px; }
  .item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--tile); border-radius: 16px; }
  .n { flex: 1; font-size: 15px; display: flex; flex-direction: column; } .n small { font-size: 12px; color: var(--muted); }
  .run { all: unset; cursor: pointer; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); }
  .sw { all: unset; cursor: pointer; width: 46px; height: 28px; border-radius: 14px; background: var(--pw); position: relative; }
  .sw i { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: left .2s; }
  .sw.on { background: var(--accent); } .sw.on i { left: 21px; }
</style>
