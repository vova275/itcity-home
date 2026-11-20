<script>
  // Картка пристрою: вкладки Керування / Параметри / Графіки / Автоматизації / Історія.
  import Icon from './Icon.svelte';
  import Controls from './Controls.svelte';
  import Params from './Params.svelte';
  import Chart from './Chart.svelte';
  import Automations from './Automations.svelte';
  import History from './History.svelte';
  import { ha, settings, saveSettings } from '../lib/ha.svelte.js';
  import { ui, closeSheet } from '../lib/ui.svelte.js';
  import { iconFor } from '../lib/icons.js';

  const device = $derived(ui.sheet);
  const TABS = [
    ['control', 'mdi:tune-variant', 'Керування'],
    ['params', 'mdi:format-list-bulleted', 'Параметри'],
    ['chart', 'mdi:chart-bell-curve-cumulative', 'Графіки'],
    ['auto', 'mdi:robot-outline', 'Автоматизації'],
    ['history', 'mdi:history', 'Історія'],
  ];
  let chartEntity = $state(null);
  const area = $derived(ha.areas.find((a) => a.area_id === device?.area_id)?.name);
  const fav = $derived(device && settings.favorites.includes(device.main));

  function toggleFav() {
    const id = device.main;
    settings.favorites = fav ? settings.favorites.filter((x) => x !== id) : [...settings.favorites, id];
    saveSettings();
  }
  function onKey(e) { if (e.key === 'Escape') closeSheet(); }
</script>

<svelte:window onkeydown={onKey} />

{#if device}
  <div class="backdrop" onclick={closeSheet} role="presentation"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label={device.name}>
    <header>
      <button class="hbtn" onclick={closeSheet} aria-label="Закрити"><Icon name="mdi:chevron-down" /></button>
      <div class="title">
        <Icon name={iconFor(ha.states[device.main], device.registry?.[0])} size={22} />
        <div><b>{device.name}</b>{#if area}<small>{area}</small>{/if}</div>
      </div>
      <button class="hbtn" class:fav onclick={toggleFav} aria-label="Вибране"><Icon name={fav ? 'mdi:heart' : 'mdi:heart-outline'} /></button>
    </header>

    <div class="body">
      {#if ui.sheetTab === 'control'}<Controls {device} />
      {:else if ui.sheetTab === 'params'}<Params {device} onchart={(e) => { chartEntity = e; ui.sheetTab = 'chart'; }} />
      {:else if ui.sheetTab === 'chart'}<Chart {device} bind:entity={chartEntity} />
      {:else if ui.sheetTab === 'auto'}<Automations {device} />
      {:else}<History {device} />{/if}
    </div>

    <nav class="tabs">
      {#each TABS as [id, icon, label]}
        <button class:sel={ui.sheetTab === id} onclick={() => (ui.sheetTab = id)} title={label}>
          <Icon name={icon} size={24} /><span>{label}</span>
        </button>
      {/each}
    </nav>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 50; animation: fade .2s; }
  .sheet {
    position: fixed; z-index: 51; left: 50%; bottom: 0; transform: translateX(-50%);
    width: min(560px, 100vw); height: min(92vh, 860px); background: var(--bg-sheet);
    border-radius: 28px 28px 0 0; display: flex; flex-direction: column; animation: up .25s ease-out;
    padding-bottom: env(safe-area-inset-bottom);
  }
  @media (min-width: 900px) { .sheet { bottom: auto; top: 50%; transform: translate(-50%, -50%); border-radius: 28px; height: min(86vh, 820px); } }
  header { display: flex; align-items: center; gap: 10px; padding: 14px 16px 8px; }
  .hbtn { all: unset; cursor: pointer; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); flex: none; }
  .hbtn.fav { color: #ff375f; }
  .title { flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px; text-align: center; }
  .title div { display: flex; flex-direction: column; } .title b { font-size: 17px; } .title small { color: var(--muted); font-size: 12px; }
  .body { flex: 1; overflow-y: auto; padding: 10px 18px 18px; overscroll-behavior: contain; }
  .tabs { display: grid; grid-template-columns: repeat(5, 1fr); border-top: 1px solid var(--line); padding: 6px 4px; }
  .tabs button { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 0; color: var(--muted); font-size: 10.5px; }
  .tabs button.sel { color: var(--accent); }
  @keyframes up { from { transform: translate(-50%, 40px); opacity: 0; } }
  @keyframes fade { from { opacity: 0; } }
</style>
