<script>
  // Deye + батарея (інтеграція Solarman): заряд, звідки живлення, потоки енергії, на скільки вистачить.
  import Icon from './Icon.svelte';
  import { ha, callService } from '../lib/ha.svelte.js';

  const st = (e) => ha.states[e]?.state;
  const n = (e) => { const v = parseFloat(st(e)); return Number.isFinite(v) ? v : null; };
  const soc = $derived(n('sensor.deye_battery'));
  const bat = $derived(n('sensor.deye_battery_power'));      // − заряд / + розряд
  const load = $derived(n('sensor.deye_load_consumption_power'));
  const pv = $derived(n('sensor.deye_pv_power'));
  const grid = $derived(n('sensor.deye_grid_power'));
  const temp = $derived(n('sensor.deye_battery_temperature'));
  const avail = $derived(n('sensor.batareia_dostupna_enerhiia'));
  const hours = $derived(n('sensor.batarei_vystachyt_na'));
  const prog = $derived(st('sensor.prohnoz_na_vidkliuchennia'));
  const mains = $derived(st('binary_sensor.svitlo_merezha'));
  const online = $derived(soc !== null);

  const kw = (w) => (w === null ? '—' : Math.abs(w) >= 1000 ? (Math.abs(w) / 1000).toFixed(1).replace('.', ',') + ' кВт' : Math.round(Math.abs(w)) + ' Вт');
  const h = (x) => { if (x === null) return '—'; const m = Math.round(x * 60); return (m >= 60 ? `${Math.floor(m / 60)} год ` : '') + `${m % 60} хв`; };
  const charging = $derived(bat !== null && bat < -30);
  const discharging = $derived(bat !== null && bat > 30);
  // мережа: за датчиком на вводі, а якщо його нема — за потужністю з мережі
  const onGrid = $derived(mains ? mains === 'on' : (grid ?? 0) > 50);
  const color = $derived(soc === null ? 'var(--muted)' : soc <= 20 ? '#ff453a' : soc <= 40 ? '#ffb020' : '#30d158');
  const batIcon = $derived(soc === null ? 'mdi:battery-unknown' : charging ? 'mdi:battery-charging' : `mdi:battery${soc >= 95 ? '' : '-' + Math.max(10, Math.round(soc / 10) * 10)}`);
  // до повного: решта ємності / потужність заряду (ємність — з налаштування прогнозу; біля 100 % заряд сповільнюється)
  const cap = $derived(n('input_number.deye_battery_capacity') ?? 16);
  const toFull = $derived(charging && soc < 100 ? ((100 - soc) / 100 * cap * 1000) / Math.abs(bat) : null);
  const fullAt = $derived(toFull === null ? '' : new Date(Date.now() + toFull * 3600000).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }));
  const progBad = $derived(prog?.startsWith('Не вистачить'));
  // «Економний заряд»: з мережі — вночі; вдень лише резерв (packages/deye_ekonom.yaml)
  const ekon = $derived(st('input_boolean.deye_ekonom') === 'on');
  const rez = $derived(n('input_number.deye_ekonom_rezerv') ?? 50);
  const hasEkon = $derived(!!ha.states['input_boolean.deye_ekonom']);
  const toggleEkon = () => callService('input_boolean', ekon ? 'turn_off' : 'turn_on', {}, { entity_id: 'input_boolean.deye_ekonom' });
  const setRez = (d) => callService('input_number', 'set_value', { value: Math.min(100, Math.max(30, rez + d)) }, { entity_id: 'input_number.deye_ekonom_rezerv' });
  // зрозуміле пояснення прогнозу: коли, скільки триватиме, скільки треба, що залишиться
  const need = $derived(ha.states['sensor.prohnoz_na_vidkliuchennia']?.attributes?.potribno_kwh ?? null);
  const dur = $derived(n('sensor.naiblyzhche_vidkliuchennia_tryvalist'));
  const nextAt = $derived(st('sensor.svitlo_nastupne_vidkliuchennia'));
  const when = $derived.by(() => {
    if (!onGrid) return 'Поточне відключення';
    if (!nextAt || ['unknown', 'unavailable'].includes(nextAt)) return 'Найближче відключення';
    const d = new Date(nextAt), t = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    const day = d.toDateString() === new Date().toDateString() ? 'сьогодні' : 'завтра';
    return `Відключення ${day} о ${t}`;
  });
  const leftSoc = $derived(need !== null && soc !== null ? Math.max(0, Math.round(soc - need / (cap * (n('input_number.deye_efficiency') ?? 92) / 100) * 100)) : null);
  const kwh = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',') + ' кВт·год';
  const progShow = $derived(prog && !['unknown', 'unavailable', 'Немає даних Deye'].includes(prog) && !prog.startsWith('Відключень'));
</script>

{#if ha.states['sensor.deye_battery']}
  <div class="card" class:bad={!onGrid}>
    {#if !online}
      <div class="head"><span class="ico"><Icon name="mdi:battery-unknown" size={30} /></span><div><div class="big">Deye не на зв'язку</div><div class="sub">Немає даних з інвертора</div></div></div>
    {:else}
      <div class="head">
        <span class="ico" style:color={color}><Icon name={batIcon} size={30} /></span>
        <div class="grow">
          <div class="big">Батарея {Math.round(soc)}%</div>
          <div class="sub">
            {#if charging}Заряджається · {kw(bat)}{:else if discharging}Розряджається · {kw(bat)}{:else}Очікує{/if}
          </div>
        </div>
      </div>
      <div class="bar"><i style:width={`${Math.min(100, Math.max(0, soc))}%`} style:background={color}></i></div>

      <div class="flows">
        <div class="f"><Icon name={onGrid ? 'mdi:transmission-tower' : 'mdi:transmission-tower-off'} size={20} /><b>{onGrid ? kw(grid) : 'немає'}</b><span>Мережа</span></div>
        <div class="f"><Icon name="mdi:solar-power-variant" size={20} /><b>{kw(pv)}</b><span>Сонце</span></div>
        <div class="f"><Icon name="mdi:home-lightning-bolt" size={20} /><b>{kw(load)}</b><span>Будинок</span></div>
      </div>

      {#if temp !== null}<div class="row"><span>Температура батареї</span><b class:cold={temp < 5} class:hot={temp > 45}>{temp.toFixed(1).replace('.', ',')} °C{temp < 5 ? ' · холодна, заряд обмежено' : temp > 45 ? ' · гаряча' : ''}</b></div>{/if}
      <div class="row"><span>Доступно</span><b>{avail === null ? '—' : String(avail).replace('.', ',') + ' кВт·год'}</b></div>
      {#if toFull !== null}<div class="row"><span>До повного заряду</span><b>≈ {h(toFull)} (о {fullAt})</b></div>{/if}
      <div class="row"><span>{onGrid ? 'Без мережі вистачить на' : 'Вистачить ще на'}</span><b>{h(hours)}</b></div>
      {#if hasEkon}
        <div class="ek">
          <button class="sw" class:on={ekon} onclick={toggleEkon} aria-label="Економний заряд"><i></i></button>
          <div class="grow"><b>Заряджати вночі (дешевше)</b>
            <small>{ekon ? `Удень тримає ${Math.round(rez)}%, решту добирає після 23:00. За 3 год до відключення — до 100%.` : 'Вимкнено: заряджає до 100% одразу, коли є світло.'}</small>
          </div>
          {#if ekon}<div class="rz"><button onclick={() => setRez(-10)}>−</button><span>{Math.round(rez)}%</span><button onclick={() => setRez(10)}>+</button></div>{/if}
        </div>
      {/if}
      {#if progShow}
        <div class="prog" class:warn={progBad}>
          <b>{when}{dur ? `, на ${h(dur)}` : ''}</b>
          {#if need !== null && avail !== null}
            <div>Треба ≈ {kwh(need)}, у батареї {kwh(avail)}</div>
            <div>{progBad ? `⚠️ Не вистачить ≈ ${kwh(need - avail)} — економте світло` : `✅ Вистачить, залишиться ≈ ${kwh(avail - need)}${leftSoc !== null ? ` (заряд ~${leftSoc}%)` : ''}`}</div>
          {:else}<div>{prog}</div>{/if}
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .card { background: var(--tile); border-radius: var(--r-tile); padding: 16px; margin-top: var(--gap); }
  .card.bad { background: linear-gradient(160deg, #3a2a14, var(--tile) 70%); }
  .head { display: flex; gap: 14px; align-items: center; }
  .grow { flex: 1; min-width: 0; }
  .ico { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; background: var(--pw); flex: none; }
  .big { font-size: 18px; font-weight: 700; } .sub { color: var(--muted); font-size: 13px; margin-top: 2px; }
  .bar { height: 8px; border-radius: 99px; background: var(--pw); margin: 12px 0 14px; overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 99px; transition: width .4s; }
  .flows { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
  .f { background: var(--pw); border-radius: 14px; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
  .f b { font-size: 15px; } .f span { font-size: 12px; color: var(--muted); }
  .row { display: flex; justify-content: space-between; font-size: 14px; padding: 5px 2px; border-top: 1px solid var(--line); }
  .row span { color: var(--muted); }
  .row .cold { color: #64d2ff; } .row .hot { color: #ff453a; }
  .ek { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 10px 2px 2px; border-top: 1px solid var(--line); }
  .ek b { font-size: 14px; font-weight: 600; } .ek small { display: block; color: var(--muted); font-size: 12px; margin-top: 2px; }
  .sw { all: unset; cursor: pointer; flex: none; width: 46px; height: 28px; border-radius: 99px; background: var(--pw); position: relative; transition: background .2s; }
  .sw i { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: left .2s; }
  .sw.on { background: #30d158; } .sw.on i { left: 21px; }
  .rz { display: flex; align-items: center; gap: 6px; flex: none; }
  .rz button { all: unset; cursor: pointer; width: 30px; height: 30px; border-radius: 50%; background: var(--pw); display: grid; place-items: center; font-size: 18px; }
  .rz span { min-width: 38px; text-align: center; font-weight: 700; }
  .prog { margin-top: 8px; font-size: 13px; line-height: 1.45; padding: 8px 10px; border-radius: 12px; background: rgba(48,209,88,.15); }
  .prog.warn { background: rgba(255,69,58,.18); }
</style>
