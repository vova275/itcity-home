<script>
  // Вкладка «Параметри»: усі показники пристрою; тап — відкрити графік цього параметра.
  import Icon from './Icon.svelte';
  import { ha } from '../lib/ha.svelte.js';
  import { friendly, domainOf } from '../lib/model.js';
  import { stateText, timeAgo } from '../lib/format.js';
  import { iconFor } from '../lib/icons.js';
  import { ui } from '../lib/ui.svelte.js';

  let { device, onchart } = $props();
  const rows = $derived(device.entities.filter((e) => ha.states[e]).map((e) => ({ e, s: ha.states[e] })));
  const numeric = (s) => s && isFinite(Number(s.state)) && s.attributes?.unit_of_measurement;
</script>

<div class="list">
  {#each rows as { e, s } (e)}
    <button class="item" disabled={!numeric(s) && !['binary_sensor', 'climate', 'switch', 'light'].includes(domainOf(e))} onclick={() => onchart?.(e)}>
      <Icon name={iconFor(s)} size={22} />
      <span class="n">{friendly(ha, e).replace(device.name, '').trim() || friendly(ha, e)}<small>{timeAgo(s.last_changed)}</small></span>
      <span class="v">{stateText(s)}</span>
      {#if numeric(s)}<Icon name="mdi:chart-line" size={18} color="var(--muted)" />{/if}
    </button>
  {/each}
</div>

<style>
  .list { display: flex; flex-direction: column; gap: 6px; }
  .item { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--tile); border-radius: 16px; cursor: pointer; }
  .item:disabled { cursor: default; }
  .n { flex: 1; font-size: 15px; display: flex; flex-direction: column; }
  .n small { font-size: 12px; color: var(--muted); }
  .v { font-size: 15px; font-weight: 600; text-align: right; }
</style>
