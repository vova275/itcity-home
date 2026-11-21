<script>
  // Клімат: реальний стан — котел (керує HA, режими) і термостати кімнат (керують клапанами).
  // Тап по картці — повна картка пристрою (графіки, параметри, налаштування котла).
  import Icon from '../components/Icon.svelte';
  import { ha, callService } from '../lib/ha.svelte.js';
  import { buildDevices, deviceForEntity } from '../lib/model.js';
  import { openDevice } from '../lib/ui.svelte.js';
  import { num } from '../lib/format.js';

  const S = (e) => ha.states[e];
  const devices = $derived(buildDevices(ha));
  const open = (e) => { const d = deviceForEntity(devices, e); if (d) openDevice(d); };

  const regOf = $derived(Object.fromEntries(ha.entities.map((e) => [e.entity_id, e])));
  const areaName = (id) => ha.areas.find((a) => a.area_id === id)?.name;
  // термостати кімнат (не кондиціонер)
  const rooms = $derived(Object.values(ha.states)
    .filter((s) => s.entity_id.startsWith('climate.') && !regOf[s.entity_id]?.hidden_by && s.attributes.hvac_modes?.includes('heat') && !s.attributes.hvac_modes?.includes('cool'))
    .sort((a, b) => (a.attributes.friendly_name || '').localeCompare(b.attributes.friendly_name || '')));
  const ac = $derived(Object.values(ha.states).filter((s) => s.entity_id.startsWith('climate.') && s.attributes.hvac_modes?.includes('cool')));

  const mode = $derived(S('input_select.kotel_rezhym')?.state);
  const control = $derived(S('automation.kotel_nadsilati_zadane_kozhni_2_khv')?.state === 'on');
  const flowNow = $derived(S('sensor.kotel_temperatura_podachi')?.state);
  const flowSet = $derived(S('sensor.kotel_rozrakhunkova_podacha'));
  const outdoor = $derived(S('weather.golovna')?.attributes?.temperature);
  const flame = $derived(Object.values(ha.states).find((s) => /ebusd_bai_flame$/.test(s.entity_id))?.state === 'on');
  const boilerEnt = $derived(['sensor.kotel_temperatura_podachi', 'sensor.heating_ebusd_bai_status01_temp'].find((e) => S(e)));
  const MODES = ['Комфорт', 'Еко', 'Ручний', 'Літо', 'Відпустка', 'Вимкнено'];
  // який клапан гребінки перекриває кімнату (задано в packages/climate.yaml, heater термостата)
  const VALVE = { 'climate.spalnia': 'switch.opalennia_kanal_1', 'climate.gostova': 'switch.opalennia_kanal_2' };
  const NO_VALVE = ['climate.dytiacha']; // батарея завжди відкрита, термостат лише просить тепла в котла

  function nudge(s, d) {
    const step = s.attributes.target_temp_step || 0.5;
    callService('climate', 'set_temperature', { temperature: Math.round(((s.attributes.temperature ?? 21) + d * step) * 10) / 10 }, { entity_id: s.entity_id });
  }
  const heating = (s) => s.attributes.hvac_action === 'heating';
  const floor1 = $derived([['Зал', 'sensor.zal_temperatura'], ['Кухня', 'sensor.kukhnia_temperatura_fibaro']].filter(([, e]) => S(e) && !isNaN(Number(S(e).state))));
</script>

<h1>Клімат</h1>

<button class="boiler" class:on={flame} onclick={() => boilerEnt && open(boilerEnt)}>
  <span class="bi"><Icon name="mdi:water-boiler" size={30} /></span>
  <span class="bt">
    <b>Котел · {control ? (mode || '—') : 'керує панель котла'}</b>
    <small>
      Подача {flowNow != null && !isNaN(Number(flowNow)) ? num(flowNow, 0) + '°' : '—'}
      {#if control && flowSet && mode !== 'Вимкнено'} (задано {num(flowSet.state, 0)}°){/if}
      · надворі {outdoor != null ? num(outdoor, 1) + '°' : '—'}{flame ? ' · 🔥 горить' : ''}
    </small>
  </span>
  <Icon name="mdi:chevron-right" size={22} />
</button>
{#if control}
  <div class="seg">
    {#each MODES as m}
      <button class:sel={mode === m} onclick={() => callService('input_select', 'select_option', { option: m }, { entity_id: 'input_select.kotel_rezhym' })}>{m}</button>
    {/each}
  </div>
{/if}

<h2>2 поверх</h2>
<div class="zones">
  {#each rooms as s (s.entity_id)}
    {@const a = s.attributes}
    <div class="zone" class:heat={heating(s)} class:off={s.state === 'off'}>
      <button class="zh" onclick={() => open(s.entity_id)}>
        <b>{a.friendly_name}</b><Icon name="mdi:chevron-right" size={20} />
      </button>
      <div class="temp">{a.current_temperature != null ? num(a.current_temperature, 1) : '—'}<span>°</span></div>
      <div class="tgt">
        <button class="rb" onclick={() => nudge(s, -1)} aria-label="Менше"><Icon name="mdi:minus" /></button>
        <span>до <b>{a.temperature != null ? num(a.temperature, 1) : '—'}°</b></span>
        <button class="rb" onclick={() => nudge(s, 1)} aria-label="Більше"><Icon name="mdi:plus" /></button>
      </div>
      <div class="why">
        <Icon name={heating(s) ? 'mdi:fire' : s.state === 'off' ? 'mdi:power' : 'mdi:check-circle-outline'} size={16} />
        {#if NO_VALVE.includes(s.entity_id)}
          {heating(s) ? 'гріє · просить тепла в котла' : 'тепло'} · батарея без клапана
        {:else}
          {s.state === 'off' ? 'вимкнено' : heating(s) ? 'гріє (клапан відкритий)' : 'тепло, клапан закритий'}
        {/if}
      </div>
      <div class="valve">
        <Icon name="mdi:pipe-valve" size={15} />
        {#if VALVE[s.entity_id]}Клапан: Sonoff 4CH {VALVE[s.entity_id].replace(/.*kanal_/, 'канал ')} · {S(VALVE[s.entity_id])?.state === 'on' ? 'відкритий' : 'закритий'}
        {:else}Без клапана (регулюється вручну на батареї){/if}
      </div>
    </div>
  {/each}
</div>
{#if mode === 'Відпустка'}<p class="note"><Icon name="mdi:airplane" size={18} /> Відпустка: кімнати 2 поверху тримають 12° (від замерзання), котел на мінімумі, гаряча вода 35°. Тепла підлога 1 поверху — як виставлено на гребінці.</p>{/if}
{#if mode === 'Літо'}<p class="note"><Icon name="mdi:white-balance-sunny" size={18} /> Літо: батареї з клапанами перекриті, котел гріє лише теплу підлогу ({num(flowSet?.state, 0)}°). Батарею в Дитячій (без клапана) закрий вручну.</p>{/if}

{#if floor1.length}
  <h2>1 поверх <small>тепла підлога · змішувач на гребінці</small></h2>
  <div class="mini">
    {#each floor1 as [n, e]}
      <button onclick={() => open(e)}><span>{n}</span><b>{num(S(e).state, 1)}°</b></button>
    {/each}
  </div>
{/if}

{#if ac.length}
  <h2>Кондиціонер</h2>
  <div class="mini">
    {#each ac as s (s.entity_id)}
      <button onclick={() => open(s.entity_id)}><span>{s.attributes.friendly_name}</span><b>{s.state === 'off' ? 'Вимк.' : num(s.attributes.temperature, 0) + '°'}</b></button>
    {/each}
  </div>
{/if}

<style>
  h1 { font-size: 34px; font-weight: 800; margin: 6px 2px 16px; }
  h2 { font-size: 20px; margin: 22px 2px 10px; } h2 small { font-size: 13px; font-weight: 400; color: var(--muted); margin-left: 6px; }
  .boiler { all: unset; cursor: pointer; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 14px; padding: 16px;
    border-radius: var(--r-tile); background: var(--tile); }
  .boiler.on { background: linear-gradient(160deg, #4a2a12, var(--tile) 75%); }
  .bi { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; background: rgba(255,107,53,.18); color: #ff6b35; flex: none; }
  .bt { flex: 1; display: flex; flex-direction: column; min-width: 0; } .bt b { font-size: 17px; } .bt small { color: var(--muted); font-size: 13px; }
  .seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
  .seg button { all: unset; cursor: pointer; text-align: center; padding: 12px 2px; border-radius: 14px; background: var(--tile); font-size: clamp(12px, 3.6vw, 14px); min-width: 0; overflow-wrap: anywhere; }
  .seg button.sel { background: var(--accent); color: #fff; }
  .zones { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--gap); }
  .zone { background: var(--tile); border-radius: var(--r-tile); padding: 16px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .zone.heat { background: linear-gradient(160deg, #5a2c0e, var(--tile) 70%); }
  .zone.off { opacity: .6; }
  .zh { all: unset; cursor: pointer; display: flex; align-items: center; gap: 8px; min-width: 0; } .zh b { font-size: 18px; flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .rb { all: unset; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); }
  .temp { font-size: 56px; font-weight: 300; line-height: 1; text-align: center; margin: 6px 0; } .temp span { font-size: 28px; vertical-align: top; }
  .tgt { display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 16px; } .tgt b { font-size: 22px; }
  .why { display: flex; align-items: center; gap: 6px; justify-content: center; color: var(--muted); font-size: 13px; text-align: center; }
  .valve { display: flex; align-items: center; gap: 6px; justify-content: center; color: var(--muted); font-size: 12px; opacity: .85; }
  .note { display: flex; gap: 8px; align-items: flex-start; margin: 12px 2px 0; padding: 12px 14px; border-radius: 16px; background: color-mix(in srgb, #ffd60a 12%, var(--tile)); font-size: 14px; }
  .mini { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--gap); }
  .mini button { all: unset; cursor: pointer; box-sizing: border-box; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 14px 16px; border-radius: 18px; background: var(--tile); min-width: 0; }
  .mini b { font-size: 20px; flex: none; } .mini span { color: var(--muted); min-width: 0; overflow-wrap: anywhere; line-height: 1.2; }
</style>
