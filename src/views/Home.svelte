<script>
  import Summary from '../components/Summary.svelte';
  import OutageCard from '../components/OutageCard.svelte';
  import CameraCard from '../components/CameraCard.svelte';
  import Favorites from '../components/Favorites.svelte';
  import Scenes from '../components/Scenes.svelte';
  import { ha } from '../lib/ha.svelte.js';
  import { greeting, WEATHER_UK, num } from '../lib/format.js';

  const weather = $derived(Object.values(ha.states).find((s) => s.entity_id.startsWith('weather.')));
  const hasOutage = $derived(!!ha.states['binary_sensor.svitlo_vidkliuchennia_zaraz']);
  const cameras = $derived(Object.keys(ha.states).filter((e) => e.startsWith('camera.') && ha.states[e].state !== 'unavailable'));
</script>

<header class="hero">
  <div>
    <h1>{greeting()}</h1>
    {#if weather}<p>{num(weather.attributes.temperature, 0)}°C • {WEATHER_UK[weather.state] || weather.state}</p>{/if}
  </div>
</header>

<Summary />

<div class="duo">
  {#if hasOutage}
    <section><h2>Світло від мережі</h2><OutageCard /></section>
  {/if}
  {#if cameras.length}
    <section><h2>Камери</h2><div class="cams">{#each cameras as c (c)}<CameraCard entity={c} />{/each}</div></section>
  {/if}
</div>

<Scenes />
<Favorites />

<style>
  .hero { padding: 6px 2px 16px; }
  h1 { font-size: 34px; margin: 0; font-weight: 800; letter-spacing: -.02em; }
  .hero p { margin: 4px 0 0; color: var(--muted); font-size: 18px; }
  h2 { font-size: 24px; margin: 26px 2px 12px; font-weight: 800; }
  .duo { display: grid; gap: 0 var(--gap); }
  @media (min-width: 900px) { .duo { grid-template-columns: 1fr 1fr; } }
  .cams { display: grid; gap: var(--gap); }
</style>
