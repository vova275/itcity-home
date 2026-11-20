<script>
  // Вибір однієї або кількох сутностей зі списку (з пошуком і поточним значенням).
  import Icon from './Icon.svelte';
  import { ha } from '../lib/ha.svelte.js';
  import { friendly } from '../lib/model.js';
  import { stateText } from '../lib/format.js';
  import { iconFor } from '../lib/icons.js';

  let { value = $bindable(), filter, multiple = false, placeholder = 'Не вибрано', onchange } = $props();
  let open = $state(false);
  let q = $state('');
  const options = $derived(Object.keys(ha.states).filter(filter)
    .filter((e) => !q || (friendly(ha, e) + ' ' + e).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => friendly(ha, a).localeCompare(friendly(ha, b), 'uk')));
  const selected = $derived(multiple ? value || [] : value ? [value] : []);

  function pick(e) {
    if (multiple) value = selected.includes(e) ? selected.filter((x) => x !== e) : [...selected, e];
    else { value = value === e ? null : e; open = false; }
    onchange?.(value);
  }
</script>

<button class="field" onclick={() => (open = !open)}>
  <span class="vals">
    {#if !selected.length}<span class="ph">{placeholder}</span>{/if}
    {#each selected as e}<span class="chip">{friendly(ha, e)} <em>{stateText(ha.states[e])}</em></span>{/each}
  </span>
  <Icon name={open ? 'mdi:chevron-up' : 'mdi:chevron-down'} />
</button>
{#if open}
  <div class="drop">
    <input placeholder="Пошук…" bind:value={q} />
    <div class="opts">
      {#each options as e (e)}
        <button class:sel={selected.includes(e)} onclick={() => pick(e)}>
          <Icon name={iconFor(ha.states[e])} size={20} />
          <span class="n">{friendly(ha, e)}<small>{e}</small></span>
          <em>{stateText(ha.states[e])}</em>
          {#if selected.includes(e)}<Icon name="mdi:check" size={20} color="var(--accent)" />{/if}
        </button>
      {:else}<p class="ph">Нічого не знайдено</p>{/each}
    </div>
  </div>
{/if}

<style>
  .field { all: unset; cursor: pointer; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 14px; background: var(--pw); }
  .vals { flex: 1; display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 4px 8px; border-radius: 10px; background: var(--tile); font-size: 13px; } .chip em { color: var(--muted); font-style: normal; }
  .ph { color: var(--muted); }
  .drop { margin-top: 6px; background: var(--tile); border-radius: 14px; padding: 8px; }
  .drop input { width: 100%; padding: 10px; border-radius: 10px; border: 0; background: var(--pw); color: var(--text); margin-bottom: 6px; }
  .opts { max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
  .opts button { all: unset; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 10px; }
  .opts button.sel { background: var(--accent-soft); }
  .n { flex: 1; display: flex; flex-direction: column; font-size: 14px; min-width: 0; } .n small { color: var(--muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; }
  .opts em { color: var(--muted); font-style: normal; font-size: 13px; }
</style>
