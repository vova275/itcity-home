<script>
  // Вікно-список для зведень на головній: «Освітлення», «Клімат», «Батарейки» — плитки відповідних пристроїв.
  import Icon from './Icon.svelte';
  import Tile from './Tile.svelte';
  import { ha } from '../lib/ha.svelte.js';
  import { buildDevices, deviceForEntity } from '../lib/model.js';
  import { ui, back } from '../lib/ui.svelte.js';

  const devices = $derived(buildDevices(ha));
  const list = $derived(ui.list ? ui.list.entities().map((e) => ({ e, d: deviceForEntity(devices, e) })) : []);
</script>

{#if ui.list}
  <div class="backdrop" onclick={back} role="presentation"></div>
  <div class="sheet" role="dialog" aria-modal="true">
    <header>
      <b>{ui.list.title}</b>
      <button onclick={back} aria-label="Закрити"><Icon name="mdi:close" /></button>
    </header>
    <div class="body">
      {#if list.length}
        <div class="tiles">{#each list as { e, d } (e)}<Tile device={d} show={ui.list.show ? e : null} />{/each}</div>
      {:else}<p class="muted">{ui.list.empty || 'Нічого немає'}</p>{/if}
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 45; }
  .sheet { position: fixed; z-index: 46; left: 50%; bottom: 0; transform: translateX(-50%); width: min(720px, 100vw); max-height: 85vh;
    background: var(--bg-sheet); border-radius: 28px 28px 0 0; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }
  header { display: flex; align-items: center; justify-content: space-between; padding: 18px 18px 8px; font-size: 20px; }
  header button { all: unset; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); }
  .body { overflow-y: auto; padding: 8px 16px 20px; }
  .tiles { display: grid; grid-template-columns: repeat(var(--cols), 1fr); gap: var(--gap); }
  .muted { color: var(--muted); }
</style>
