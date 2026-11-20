<script>
  // Кімнати за поверхами (як «Пристрої» в Homey): секція на кімнату з плитками її пристроїв.
  import Tile from '../components/Tile.svelte';
  import Icon from '../components/Icon.svelte';
  import { ha } from '../lib/ha.svelte.js';
  import { buildDevices, domainOf } from '../lib/model.js';

  const HIDE_DOMAINS = new Set(['update', 'event', 'button', 'tts', 'stt', 'conversation', 'todo', 'notify', 'scene', 'script', 'automation', 'input_text', 'device_tracker', 'image']);
  const devices = $derived(buildDevices(ha).filter((d) => !HIDE_DOMAINS.has(domainOf(d.main))));
  const floors = $derived([...ha.floors].sort((a, b) => (b.level ?? 0) - (a.level ?? 0)));
  const groups = $derived.by(() => {
    const byArea = (aid) => devices.filter((d) => d.area_id === aid).sort((a, b) => a.name.localeCompare(b.name, 'uk'));
    const out = [];
    for (const f of [...floors, { floor_id: null, name: 'Інше' }]) {
      const areas = ha.areas.filter((a) => (a.floor_id || null) === f.floor_id)
        .map((a) => ({ area: a, devs: byArea(a.area_id) })).filter((x) => x.devs.length);
      if (areas.length) out.push({ floor: f, areas });
    }
    return out;
  });
  const unassigned = $derived(devices.filter((d) => !d.area_id && d.device));
  let filter = $state(null);
</script>

<div class="chips">
  <button class:sel={!filter} onclick={() => (filter = null)}>Усі</button>
  {#each ha.areas.filter((a) => devices.some((d) => d.area_id === a.area_id)) as a}
    <button class:sel={filter === a.area_id} onclick={() => (filter = a.area_id)}>{a.name}</button>
  {/each}
</div>

{#each groups as g}
  {#if !filter}<h1>{g.floor.name}</h1>{/if}
  {#each g.areas as { area, devs }}
    {#if !filter || filter === area.area_id}
      <h2><span class="ai"><Icon name={area.icon || 'mdi:floor-plan'} size={20} /></span>{area.name}</h2>
      <div class="tiles">{#each devs as d (d.id)}<Tile device={d} />{/each}</div>
    {/if}
  {/each}
{/each}

{#if !filter && unassigned.length}
  <h2><span class="ai"><Icon name="mdi:help-box-outline" size={20} /></span>Без кімнати</h2>
  <div class="tiles">{#each unassigned as d (d.id)}<Tile device={d} />{/each}</div>
{/if}

<style>
  .chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; scrollbar-width: none; position: sticky; top: 0; z-index: 2; background: var(--bg); padding-top: 4px; }
  .chips button { all: unset; cursor: pointer; white-space: nowrap; padding: 9px 14px; border-radius: 14px; background: var(--tile); font-size: 14px; }
  .chips button.sel { background: var(--accent); color: #fff; }
  h1 { font-size: 30px; font-weight: 800; margin: 22px 2px 4px; }
  h2 { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 800; margin: 18px 2px 10px; }
  .ai { width: 34px; height: 34px; border-radius: 10px; background: var(--tile); display: grid; place-items: center; }
  .tiles { display: grid; grid-template-columns: repeat(var(--cols), 1fr); gap: 10px; }
</style>
