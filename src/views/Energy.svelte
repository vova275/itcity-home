<script>
  // Енергія: лічильник по фазах, облік день/ніч у кВт·год і гривнях, графік.
  import Icon from '../components/Icon.svelte';
  import Chart from '../components/Chart.svelte';
  import { ha } from '../lib/ha.svelte.js';
  import { num } from '../lib/format.js';
  import { openDevice } from '../lib/ui.svelte.js';

  const v = (e) => ha.states[e]?.state;
  const n = (e, d) => (isFinite(Number(v(e))) ? num(v(e), d) : '—');
  const phases = [1, 2, 3];
  // Deye міряє будинок і під час відключень (лічильник на вводі тоді без живлення) — графік за замовчуванням з нього
  const hasDeye = $derived(!!ha.states['sensor.deye_load_consumption_power']);
  const DEYE = ['sensor.deye_load_consumption_power', 'sensor.deye_battery', 'sensor.deye_battery_power', 'sensor.deye_grid_power',
    'sensor.deye_battery_temperature', 'sensor.deye_vid_batarei_za_den', 'sensor.deye_vid_batarei_za_misiats', 'sensor.zariad_batarei_za_misiats_hrn', 'sensor.deye_load_consumption_l1_power', 'sensor.deye_load_consumption_l2_power', 'sensor.deye_load_consumption_l3_power'];
  const pseudo = $derived({
    id: 'energy', device: null, name: 'Енергія', area_id: null, main: hasDeye ? DEYE[0] : 'sensor.lichylnyk_potuzhnist', registry: [],
    entities: [...(hasDeye ? DEYE : []), 'sensor.lichylnyk_potuzhnist', ...phases.flatMap((p) => [`sensor.lichylnyk_potuzhnist_l${p}`, `sensor.lichylnyk_napruga_l${p}`, `sensor.lichylnyk_strum_l${p}`]),
      'sensor.lichylnyk_enerhiia', 'sensor.energy_month_day', 'sensor.energy_month_night', 'sensor.vartist_elektroenergii_za_misiats'],
  });
  let chartEntity = $state(ha.states['sensor.deye_load_consumption_power'] ? 'sensor.deye_load_consumption_power' : 'sensor.lichylnyk_potuzhnist');
  const meterOk = $derived(isFinite(Number(v('sensor.lichylnyk_potuzhnist'))));
  const gridOff = $derived(v('binary_sensor.svitlo_merezha') === 'off');
  const tariffDay = $derived(v('sensor.potochnii_tarif') === 'День');
</script>

<h1>Енергія</h1>

<button class="now" onclick={() => openDevice(pseudo)}>
  <span class="ico"><Icon name="mdi:meter-electric-outline" size={34} /></span>
  <span><b>{n('sensor.lichylnyk_potuzhnist', 0)} Вт</b><small>зараз · лічильник {n('sensor.lichylnyk_enerhiia', 1)} кВт·год</small></span>
  <span class="tariff" class:night={!tariffDay}><Icon name={tariffDay ? 'mdi:weather-sunny' : 'mdi:weather-night'} size={18} />{n('sensor.tsina_elektroenergii_zaraz', 2)} грн</span>
</button>

{#if hasDeye}
  <div class="home" class:off={gridOff}>
    <span class="ico"><Icon name={gridOff ? 'mdi:home-battery' : 'mdi:home-lightning-bolt'} size={30} /></span>
    <span class="t">
      <b>{n('sensor.deye_load_consumption_power', 0)} Вт</b>
      <small>{gridOff ? 'будинок зараз — від батареї' : 'будинок зараз (інвертор)'} · сьогодні {n('sensor.deye_today_load_consumption', 1)} кВт·год</small>
    </span>
  </div>
  {#if !meterOk}<p class="note">Лічильник на вводі зараз без живлення — споживання показує інвертор Deye.</p>{/if}
{/if}

<div class="phases">
  {#each phases as p}
    <div class="ph">
      <div class="pt">L{p}</div>
      <div class="pw">{n(`sensor.lichylnyk_potuzhnist_l${p}`, 0)}<span> Вт</span></div>
      <div class="pm">{n(`sensor.lichylnyk_napruga_l${p}`, 1)} В · {n(`sensor.lichylnyk_strum_l${p}`, 2)} А</div>
    </div>
  {/each}
</div>

<h2>Облік</h2>
<div class="acc">
  <div class="c"><small>Сьогодні</small><b>{n('sensor.vartist_elektroenergii_za_dobu', 2)} грн</b><span>☀ {n('sensor.energy_day_day', 1)} · ☾ {n('sensor.energy_day_night', 1)} кВт·год</span></div>
  <div class="c"><small>Цей місяць</small><b>{n('sensor.vartist_elektroenergii_za_misiats', 2)} грн</b><span>☀ {n('sensor.energy_month_day', 1)} · ☾ {n('sensor.energy_month_night', 1)} кВт·год</span></div>
</div>

{#if hasDeye}
<h2>Батарея</h2>
<div class="acc">
  <div class="c"><small>Мережа → батарея</small><b>{n('sensor.deye_today_battery_charge', 1)} кВт·год</b><span>сьогодні · за місяць {isFinite(Number(ha.states['sensor.zariad_batarei_za_misiats_hrn']?.attributes?.kwh)) ? num(ha.states['sensor.zariad_batarei_za_misiats_hrn'].attributes.kwh, 1) : '—'} кВт·год = {n('sensor.zariad_batarei_za_misiats_hrn', 2)} грн</span></div>
  <div class="c"><small>Будинок від батареї</small><b>{n('sensor.deye_today_battery_discharge', 1)} кВт·год</b><span>сьогодні · за місяць {n('sensor.deye_vid_batarei_za_misiats', 1)} кВт·год</span></div>
</div>
{/if}

<h2>Графік</h2>
<div class="chartbox"><Chart device={pseudo} bind:entity={chartEntity} /></div>

<style>
  h1 { font-size: 34px; font-weight: 800; margin: 6px 2px 16px; }
  h2 { font-size: 22px; font-weight: 800; margin: 24px 2px 10px; }
  .now { all: unset; cursor: pointer; display: flex; align-items: center; gap: 14px; background: var(--tile); border-radius: var(--r-tile); padding: 16px; width: 100%; box-sizing: border-box; }
  .now > span:nth-child(2) { flex: 1; display: flex; flex-direction: column; }
  .now b { font-size: 30px; } .now small { color: var(--muted); }
  .ico { width: 56px; height: 56px; border-radius: 16px; background: rgba(48,209,88,.18); color: #30d158; display: grid; place-items: center; }
  .tariff { display: flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 12px; background: rgba(255,214,10,.18); color: #ffd60a; font-size: 13px; }
  .tariff.night { background: rgba(94,92,230,.2); color: #a5a3ff; }
  .phases { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
  .ph { background: var(--tile); border-radius: 18px; padding: 12px; }
  .pt { color: var(--muted); font-weight: 700; } .pw { font-size: 22px; font-weight: 700; } .pw span { font-size: 13px; color: var(--muted); }
  .pm { font-size: 12px; color: var(--muted); }
  .acc { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .c { background: var(--tile); border-radius: 18px; padding: 14px; display: flex; flex-direction: column; gap: 2px; }
  .c small { color: var(--muted); } .c b { font-size: 22px; } .c span { font-size: 12px; color: var(--muted); }
  .home { display: flex; align-items: center; gap: 14px; background: var(--tile); border-radius: var(--r-tile); padding: 14px 16px; margin-top: 10px; }
  .home.off { background: linear-gradient(160deg, #3a2a14, var(--tile) 70%); }
  .home .t { display: flex; flex-direction: column; } .home b { font-size: 24px; } .home small { color: var(--muted); }
  .home .ico { width: 48px; height: 48px; background: rgba(255,176,32,.18); color: #ffb020; }
  .note { color: var(--muted); font-size: 13px; margin: 8px 2px 0; }
  .chartbox { background: var(--tile); border-radius: var(--r-tile); padding: 14px; }
</style>
