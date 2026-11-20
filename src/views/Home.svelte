<script>
  import Tile from '../components/Tile.svelte';
  import Summary from '../components/Summary.svelte';
  import OutageCard from '../components/OutageCard.svelte';
  import Icon from '../components/Icon.svelte';
  import { ha, settings } from '../lib/ha.svelte.js';
  import { buildDevices, deviceForEntity } from '../lib/model.js';
  import { greeting, WEATHER_UK, num } from '../lib/format.js';
  import { ui } from '../lib/ui.svelte.js';

  const devices = $derived(buildDevices(ha));
  const favs = $derived(settings.favorites.filter((e) => ha.states[e]).map((e) => deviceForEntity(devices, e)));
  const weather = $derived(Object.values(ha.states).find((s) => s.entity_id.startsWith('weather.')));
  const hasOutage = $derived(!!ha.states['binary_sensor.svitlo_vidkliuchennia_zaraz']);
</script>

<header class="hero">
  <div>
    <h1>{greeting()}</h1>
    {#if weather}<p>{num(weather.attributes.temperature, 0)}°C • {WEATHER_UK[weather.state] || weather.state}</p>{/if}
  </div>
</header>

<Summary />

{#if hasOutage}
  <h2>Світло від мережі</h2>
  <OutageCard />
{/if}

<h2>Вибрані пристрої</h2>
{#if favs.length}
  <div class="tiles">
    {#each favs as d (d.main)}<Tile device={d} />{/each}
  </div>
{:else}
  <div class="empty">
    <Icon name="mdi:heart-outline" size={32} />
    <p>Відкрий будь-який пристрій у «Кімнатах» і натисни ♥, щоб додати його сюди.</p>
    <button onclick={() => (ui.view = 'rooms')}>До кімнат</button>
  </div>
{/if}

<style>
  .hero { padding: 6px 2px 16px; }
  h1 { font-size: 34px; margin: 0; font-weight: 800; letter-spacing: -.02em; }
  .hero p { margin: 4px 0 0; color: var(--muted); font-size: 18px; }
  h2 { font-size: 24px; margin: 26px 2px 12px; font-weight: 800; }
  .tiles { display: grid; grid-template-columns: repeat(var(--cols), 1fr); gap: 10px; }
  .empty { background: var(--tile); border-radius: var(--r-tile); padding: 24px; text-align: center; color: var(--muted); }
  .empty button { all: unset; cursor: pointer; margin-top: 8px; padding: 10px 18px; border-radius: 14px; background: var(--accent); color: #fff; }
</style>
