<script>
  // Каркас: телефон — нижня панель; планшет/ПК — бокове меню. Тема темна/світла/авто.
  import Icon from './components/Icon.svelte';
  import DeviceSheet from './components/DeviceSheet.svelte';
  import ListSheet from './components/ListSheet.svelte';
  import Home from './views/Home.svelte';
  import Rooms from './views/Rooms.svelte';
  import Energy from './views/Energy.svelte';
  import More from './views/More.svelte';
  import Climate from './views/Climate.svelte';
  import Automations from './views/Automations.svelte';
  import { ha, settings, connect, loadSettings, saveSettings } from './lib/ha.svelte.js';
  import { ui, setView } from './lib/ui.svelte.js';

  const NAV = [['home', 'mdi:home-variant', 'Дім'], ['rooms', 'mdi:view-grid', 'Кімнати'], ['climate', 'mdi:thermostat', 'Клімат'], ['energy', 'mdi:lightning-bolt', 'Енергія'], ['more', 'mdi:dots-horizontal', 'Ще']];

  // Стартове «Вибране» — як було в Homey, якщо користувач ще нічого не налаштував
  const DEFAULT_FAVS = [
    'light.pidsvitka_kukhnia', 'switch.vulytsia_svitlo', 'sensor.dytiacha_temperatura', 'sensor.spalnia_temperatura',
    'sensor.gostova_temperatura', 'sensor.zal_temperatura', 'sensor.goryshche_temperatura', 'climate.kondytsioner',
    'cover.vorota', 'sensor.garazh_temperatura', 'sensor.lichylnyk_potuzhnist', 'fan.prana_dytiacha', 'sensor.kotel_temperatura_podachi',
    'climate.spalnia', 'climate.gostova', 'climate.dytiacha', 'alarm_control_panel.okhorona', 'camera.vorota',
  ];

  connect();
  loadSettings().then(() => {
    if (!settings.favorites?.length && !settings.initialized) { settings.favorites = DEFAULT_FAVS; settings.initialized = true; saveSettings(); }
  });

  $effect(() => {
    const t = settings.theme || 'auto';
    document.documentElement.dataset.theme = t === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
  });
</script>

<div class="app">
  <aside class="side">
    <div class="brand"><Icon name="mdi:home-heart" size={28} color="var(--accent)" /><b>Дім</b></div>
    {#each NAV as [id, icon, label]}
      <button class:sel={ui.view === id} onclick={() => setView(id)}><Icon name={icon} />{label}</button>
    {/each}
    <div class="conn" class:ok={ha.connected}>{ha.connected ? 'На зв’язку з HA' : 'Підключення…'}</div>
  </aside>

  <main>
    {#if ha.error}<div class="banner">{ha.error}</div>{/if}
    {#if !ha.connected && !Object.keys(ha.states).length}
      <div class="loading"><Icon name="mdi:home-heart" size={56} color="var(--accent)" /><p>Підключаюсь до Home Assistant…</p></div>
    {:else if ui.view === 'home'}<Home />
    {:else if ui.view === 'rooms'}<Rooms />
    {:else if ui.view === 'climate'}<Climate />
    {:else if ui.view === 'automations'}<Automations />
    {:else if ui.view === 'energy'}<Energy />
    {:else}<More />{/if}
  </main>

  <nav class="bottom">
    {#each NAV as [id, icon, label]}
      <button class:sel={ui.view === id} onclick={() => setView(id)}><Icon name={icon} size={26} /><span>{label}</span></button>
    {/each}
  </nav>
</div>

<ListSheet />
<DeviceSheet />

<style>
  .app { display: flex; min-height: 100vh; }
  main { flex: 1; padding: calc(16px + env(safe-area-inset-top)) 16px 96px; max-width: 1400px; margin: 0 auto; width: 100%; box-sizing: border-box; }
  .side { display: none; }
  .bottom {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 40; display: grid; grid-template-columns: repeat(5, 1fr);
    background: var(--nav); backdrop-filter: blur(20px); padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
  }
  .bottom button { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 0; border-radius: 16px; color: var(--muted); font-size: 12px; }
  .bottom button.sel { color: var(--accent); background: var(--accent-soft); }
  .banner { background: #ff453a; color: #fff; padding: 10px 14px; border-radius: 14px; margin-bottom: 12px; }
  .loading { height: 70vh; display: grid; place-items: center; align-content: center; color: var(--muted); }

  @media (min-width: 900px) {
    .side { display: flex; flex-direction: column; gap: 4px; width: 220px; padding: 22px 14px; position: sticky; top: 0; height: 100vh; box-sizing: border-box; border-right: 1px solid var(--line); }
    .brand { display: flex; align-items: center; gap: 10px; font-size: 22px; margin: 0 8px 18px; }
    .side button { all: unset; cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; font-size: 16px; color: var(--muted); }
    .side button.sel { background: var(--tile); color: var(--text); }
    .conn { margin-top: auto; font-size: 12px; color: var(--muted); padding: 8px 14px; }
    .conn.ok::before { content: '● '; color: #30d158; }
    .bottom { display: none; }
    main { padding: 26px 32px; }
  }
</style>
