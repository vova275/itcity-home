<script>
  // Картка котла (eBUS через ebusd + пакет boiler_control у HA): стан, «HA керує котлом», режим, уставки.
  import Icon from './Icon.svelte';
  import { ha, callService } from '../lib/ha.svelte.js';
  import { num } from '../lib/format.js';

  const S = (e) => ha.states[e];
  const v = (e) => Number(S(e)?.state);
  const ok = (e) => isFinite(v(e));
  const AUTO = 'automation.kotel_nadsilati_zadane_kozhni_2_khv';
  const control = $derived(S(AUTO)?.state === 'on');
  const mode = $derived(S('input_select.kotel_rezhym')?.state);
  const pump = $derived(S('sensor.heating_ebusd_bai_status01_pumpstate')?.state === 'on');
  const demand = $derived(S('binary_sensor.kotlu_potribne_teplo'));
  let showCurve = $state(false);

  const setNum = (e, d) => {
    const s = S(e); if (!s) return;
    const a = s.attributes;
    const x = Math.min(a.max, Math.max(a.min, Number(s.state) + d * (a.step || 1)));
    callService('input_number', 'set_value', { value: x }, { entity_id: e });
  };
</script>

<div class="now">
  <div class="big">
    <small>Подача</small>
    <b>{ok('sensor.kotel_temperatura_podachi') ? num(v('sensor.kotel_temperatura_podachi'), 1) : '—'}°</b>
    <span>задано {ok('sensor.kotel_zadana_podacha') ? num(v('sensor.kotel_zadana_podacha'), 0) : '—'}°</span>
  </div>
  <div class="grid">
    <div><small>Обратка</small><b>{ok('sensor.kotel_temperatura_obratky') ? num(v('sensor.kotel_temperatura_obratky'), 1) : '—'}°</b></div>
    <div><small>Гаряча вода</small><b>{ok('sensor.kotel_temperatura_gvp') ? num(v('sensor.kotel_temperatura_gvp'), 1) : '—'}°</b>
      <span>задано {ok('sensor.kotel_gvp_zadana') ? num(v('sensor.kotel_gvp_zadana'), 0) : '—'}°</span></div>
    <div><small>Тиск</small><b class:warn={ok('sensor.kotel_tysk') && v('sensor.kotel_tysk') < 1}>{ok('sensor.kotel_tysk') ? num(v('sensor.kotel_tysk'), 1) : '—'}</b><span>бар</span></div>
    <div><small>Насос</small><b class="ic" class:on={pump}><Icon name="mdi:pump" size={26} /></b><span>{pump ? 'працює' : 'стоїть'}</span></div>
  </div>
  {#if demand}
    <div class="demand" class:on={demand.state === 'on'}>
      <Icon name="mdi:fire" size={18} />
      {demand.state === 'on' ? `Просять тепла: ${demand.attributes.kimnaty || 'кімнати'}` : 'Кімнати тепла не просять'}
    </div>
  {/if}
</div>

<button class="master" class:on={control} onclick={() => callService('automation', control ? 'turn_off' : 'turn_on', {}, { entity_id: AUTO })}>
  <Icon name={control ? 'mdi:robot' : 'mdi:hand-back-left'} size={26} />
  <span><b>{control ? 'HA керує котлом' : 'Котлом керує панель'}</b>
    <small>{control ? 'HA надсилає задане кожні 2 хв' : 'Увімкни, щоб керувати звідси'}</small></span>
  <i class="sw" class:on={control}><i></i></i>
</button>

<div class="label">Режим</div>
<div class="seg">
  {#each [['Комфорт', 'mdi:sofa', 'Тепло: погода + кімнати'], ['Еко', 'mdi:leaf', 'На 4° прохолодніше'], ['Ручний', 'mdi:hand-back-right', 'Фіксована подача'], ['Вимкнено', 'mdi:power', 'Лише гаряча вода']] as [m, icon, hint]}
    <button class:sel={mode === m} onclick={() => callService('input_select', 'select_option', { option: m }, { entity_id: 'input_select.kotel_rezhym' })}>
      <Icon name={icon} size={22} /><b>{m}</b><small>{hint}</small>
    </button>
  {/each}
</div>

{#if mode === 'Ручний'}
  <div class="setp">
    <span><Icon name="mdi:radiator" size={22} />Подача</span>
    <button onclick={() => setNum('input_number.kotel_podacha_ruchna', -1)}><Icon name="mdi:minus" /></button>
    <b>{num(v('input_number.kotel_podacha_ruchna'), 0)}°</b>
    <button onclick={() => setNum('input_number.kotel_podacha_ruchna', 1)}><Icon name="mdi:plus" /></button>
  </div>
{:else if mode !== 'Вимкнено'}
  <div class="setp">
    <span><Icon name="mdi:calculator-variant" size={22} />Подача зараз</span>
    <b class="wide">{ok('sensor.kotel_rozrakhunkova_podacha') ? num(v('sensor.kotel_rozrakhunkova_podacha'), 0) + '°' : '—'}</b>
  </div>
  <div class="setp">
    <span><Icon name="mdi:sofa" size={22} />1 поверх (зал)</span>
    <button onclick={() => setNum('input_number.kotel_tsil_1_poverkh', -1)}><Icon name="mdi:minus" /></button>
    <b>{num(v('input_number.kotel_tsil_1_poverkh'), 1)}°</b>
    <button onclick={() => setNum('input_number.kotel_tsil_1_poverkh', 1)}><Icon name="mdi:plus" /></button>
  </div>
{/if}
<div class="setp">
  <span><Icon name="mdi:water-thermometer" size={22} />Гаряча вода</span>
  <button onclick={() => setNum('input_number.kotel_gvp', -1)}><Icon name="mdi:minus" /></button>
  <b>{num(v('input_number.kotel_gvp'), 0)}°</b>
  <button onclick={() => setNum('input_number.kotel_gvp', 1)}><Icon name="mdi:plus" /></button>
</div>

{#if mode === 'Комфорт' || mode === 'Еко'}
  <button class="fold" onclick={() => (showCurve = !showCurve)}>
    <Icon name={showCurve ? 'mdi:chevron-up' : 'mdi:chevron-down'} /> Погодна крива
  </button>
  {#if showCurve}
    {#each [['input_number.kotel_kryva_nahyl', 'Нахил'], ['input_number.kotel_kryva_zsuv', 'Зсув'], ['input_number.kotel_podacha_min', 'Мін. подача'], ['input_number.kotel_podacha_max', 'Макс. подача'], ['input_number.kotel_lito', 'Літо: вимикати опалення вище']] as [e, l]}
      <div class="setp small">
        <span>{l}</span>
        <button onclick={() => setNum(e, -1)}><Icon name="mdi:minus" /></button>
        <b>{num(v(e), 1)}</b>
        <button onclick={() => setNum(e, 1)}><Icon name="mdi:plus" /></button>
      </div>
    {/each}
  {/if}
{/if}

{#if S('input_text.kotel_vidpovid')?.state && control}
  <p class="last">Остання команда: {S('input_text.kotel_vidpovid').state}</p>
{/if}

<style>
  .now { background: linear-gradient(160deg, #3a2414, var(--tile) 70%); border-radius: 24px; padding: 18px; }
  .big { display: flex; flex-direction: column; align-items: center; }
  .big small, .grid small { color: var(--muted); font-size: 13px; }
  .big b { font-size: 60px; font-weight: 300; line-height: 1.05; }
  .big span, .grid span { color: var(--muted); font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 14px; text-align: center; }
  .grid div { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; }
  .grid b { font-size: 22px; font-weight: 600; } .grid b.warn { color: var(--danger); }
  .ic { color: var(--muted); } .ic.on { color: #30d158; }
  .demand { margin-top: 12px; display: flex; align-items: center; gap: 6px; justify-content: center; font-size: 13px; color: var(--muted); }
  .demand.on { color: #ff9f0a; }
  .master { all: unset; cursor: pointer; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 12px;
    margin-top: 12px; padding: 14px 16px; border-radius: 20px; background: var(--tile); }
  .master.on { background: color-mix(in srgb, var(--accent) 22%, var(--tile)); }
  .master span { flex: 1; display: flex; flex-direction: column; } .master small { color: var(--muted); font-size: 12px; }
  .sw { width: 46px; height: 28px; border-radius: 14px; background: var(--pw); position: relative; flex: none; }
  .sw i { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: left .2s; }
  .sw.on { background: var(--accent); } .sw.on i { left: 21px; }
  .label { margin: 18px 0 8px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .seg { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .seg button { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 14px 8px; border-radius: 18px; background: var(--tile); text-align: center; }
  .seg button small { color: var(--muted); font-size: 11px; }
  .seg button.sel { background: var(--accent); color: #fff; } .seg button.sel small { color: rgba(255,255,255,.8); }
  .setp { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 10px 12px 10px 16px; border-radius: 18px; background: var(--tile); }
  .setp span { flex: 1; display: flex; align-items: center; gap: 8px; }
  .setp b { font-size: 26px; min-width: 64px; text-align: center; } .setp b.wide { min-width: 0; }
  .setp button { all: unset; cursor: pointer; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); }
  .setp.small b { font-size: 18px; } .setp.small button { width: 36px; height: 36px; }
  .fold { all: unset; cursor: pointer; display: flex; align-items: center; gap: 6px; margin: 14px 4px 0; color: var(--muted); }
  .last { color: var(--muted); font-size: 12px; margin-top: 14px; }
</style>
