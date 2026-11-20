<script>
  // Вкладка «Керування»: великий контрол головної сутності + інші керовані сутності пристрою.
  import Icon from './Icon.svelte';
  import { ha, callService } from '../lib/ha.svelte.js';
  import { domainOf, isOn, friendly } from '../lib/model.js';
  import { stateText, HVAC_UK, FAN_UK, num } from '../lib/format.js';
  import { iconFor } from '../lib/icons.js';

  let { device } = $props();
  const main = $derived(ha.states[device.main]);
  const d = $derived(domainOf(device.main));
  const a = $derived(main?.attributes || {});
  const CONTROL = new Set(['switch', 'light', 'fan', 'select', 'number', 'input_boolean', 'input_number', 'input_select', 'button', 'cover', 'climate', 'automation']);
  const others = $derived(device.entities.filter((e) => e !== device.main && CONTROL.has(domainOf(e)) && ha.states[e]));

  const svc = (domain, service, data = {}, entity = device.main) => callService(domain, service, data, { entity_id: entity });

  function setTemp(delta) {
    const step = a.target_temp_step || (d === 'climate' ? 0.5 : 1);
    const t = Math.min(a.max_temp ?? 35, Math.max(a.min_temp ?? 5, (a.temperature ?? 20) + delta * step));
    svc('climate', 'set_temperature', { temperature: Math.round(t * 10) / 10 });
  }
  let bri = $state(null);
  $effect(() => { if (main && d === 'light') bri = main.state === 'on' ? Math.round((a.brightness ?? 255) / 2.55) : 0; });
</script>

{#if !main}
  <p class="muted">Немає даних</p>
{:else if d === 'climate'}
  <div class="thermo" class:heat={main.state === 'heat' || a.hvac_action === 'heating'} class:cool={main.state === 'cool'}>
    <div class="cur">{a.current_temperature != null ? num(a.current_temperature, 1) + '°' : '—'}<small>зараз</small></div>
    <div class="target">
      <button class="round" onclick={() => setTemp(-1)}><Icon name="mdi:minus" /></button>
      <div class="big">{a.temperature != null ? num(a.temperature, 1) : '—'}<span>°</span></div>
      <button class="round" onclick={() => setTemp(1)}><Icon name="mdi:plus" /></button>
    </div>
    <div class="muted center">{a.hvac_action ? `Зараз: ${stateText({ ...main, state: a.hvac_action, entity_id: 'x.x' })}` : ''}</div>
  </div>
  <div class="label">Режим</div>
  <div class="chips">
    {#each a.hvac_modes || [] as m}
      <button class="chip" class:sel={main.state === m} onclick={() => svc('climate', 'set_hvac_mode', { hvac_mode: m })}>{HVAC_UK[m] || m}</button>
    {/each}
  </div>
  {#if a.fan_modes}
    <div class="label">Вентилятор</div>
    <div class="chips">
      {#each a.fan_modes as m}
        <button class="chip" class:sel={a.fan_mode === m} onclick={() => svc('climate', 'set_fan_mode', { fan_mode: m })}>{FAN_UK[m] || m}</button>
      {/each}
    </div>
  {/if}
  {#if a.swing_modes}
    <div class="label">Жалюзі вгору-вниз</div>
    <select class="sel" value={a.swing_mode} onchange={(e) => svc('climate', 'set_swing_mode', { swing_mode: e.currentTarget.value })}>
      {#each a.swing_modes as m}<option value={m}>{m}</option>{/each}
    </select>
  {/if}
  {#if a.swing_horizontal_modes}
    <div class="label">Жалюзі вліво-вправо</div>
    <select class="sel" value={a.swing_horizontal_mode} onchange={(e) => svc('climate', 'set_swing_horizontal_mode', { swing_horizontal_mode: e.currentTarget.value })}>
      {#each a.swing_horizontal_modes as m}<option value={m}>{m}</option>{/each}
    </select>
  {/if}
{:else if d === 'light'}
  <button class="bigtoggle" class:on={isOn(main)} onclick={() => svc('light', 'toggle')}>
    <Icon name={iconFor(main)} size={44} /><span>{isOn(main) ? 'Увімкнено' : 'Вимкнено'}</span>
  </button>
  {#if a.supported_color_modes && !a.supported_color_modes.includes('onoff')}
    <div class="label">Яскравість {bri}%</div>
    <input class="range" type="range" min="1" max="100" bind:value={bri}
           onchange={() => svc('light', 'turn_on', { brightness_pct: bri })} />
  {/if}
{:else if d === 'fan'}
  <button class="bigtoggle" class:on={isOn(main)} onclick={() => svc('fan', 'toggle')}>
    <Icon name="mdi:fan" size={44} /><span>{isOn(main) ? `Увімкнено • ${a.percentage ?? ''}%` : 'Вимкнено'}</span>
  </button>
  {#if a.percentage != null}
    <div class="label">Швидкість {a.percentage}%</div>
    <input class="range" type="range" min="0" max="100" step={a.percentage_step || 1} value={a.percentage}
           onchange={(e) => svc('fan', 'set_percentage', { percentage: Number(e.currentTarget.value) })} />
  {/if}
{:else if d === 'cover'}
  <div class="row3">
    <button class="act" onclick={() => svc('cover', 'open_cover')}><Icon name="mdi:arrow-up" />Відкрити</button>
    <button class="act" onclick={() => svc('cover', 'stop_cover')}><Icon name="mdi:stop" />Стоп</button>
    <button class="act" onclick={() => svc('cover', 'close_cover')}><Icon name="mdi:arrow-down" />Закрити</button>
  </div>
  <p class="center big2">{stateText(main)}</p>
{:else if d === 'alarm_control_panel'}
  <p class="center big2">{stateText(main)}</p>
  <div class="row3">
    <button class="act" onclick={() => svc('alarm_control_panel', 'alarm_arm_away')}><Icon name="mdi:shield-lock" />Охорона</button>
    <button class="act" onclick={() => svc('alarm_control_panel', 'alarm_arm_night')}><Icon name="mdi:shield-moon" />Ніч</button>
    <button class="act" onclick={() => svc('alarm_control_panel', 'alarm_disarm')}><Icon name="mdi:shield-off" />Зняти</button>
  </div>
{:else if ['switch', 'input_boolean', 'automation', 'media_player'].includes(d)}
  <button class="bigtoggle" class:on={isOn(main)} onclick={() => svc('homeassistant', 'toggle')}>
    <Icon name={iconFor(main)} size={44} /><span>{isOn(main) ? 'Увімкнено' : 'Вимкнено'}</span>
  </button>
{:else}
  <div class="value">
    <Icon name={iconFor(main)} size={36} />
    <div class="big">{stateText(main)}</div>
  </div>
{/if}

{#if others.length}
  <div class="label">Інші налаштування</div>
  <div class="list">
    {#each others as e (e)}
      {@const s = ha.states[e]}
      {@const dd = domainOf(e)}
      <div class="item">
        <Icon name={iconFor(s)} size={22} />
        <span class="iname">{friendly(ha, e).replace(device.name, '').trim() || friendly(ha, e)}</span>
        {#if ['switch', 'input_boolean', 'light', 'fan', 'automation'].includes(dd)}
          <button class="sw" class:on={isOn(s)} onclick={() => svc('homeassistant', 'toggle', {}, e)} aria-label="перемкнути"><i></i></button>
        {:else if dd === 'select' || dd === 'input_select'}
          <select class="sel small" value={s.state} onchange={(ev) => svc(dd, 'select_option', { option: ev.currentTarget.value }, e)}>
            {#each s.attributes.options || [] as o}<option value={o}>{o}</option>{/each}
          </select>
        {:else if dd === 'number' || dd === 'input_number'}
          <input class="numin" type="number" value={s.state} min={s.attributes.min} max={s.attributes.max} step={s.attributes.step}
                 onchange={(ev) => svc(dd, 'set_value', { value: Number(ev.currentTarget.value) }, e)} />
        {:else if dd === 'button'}
          <button class="chip" onclick={() => svc('button', 'press', {}, e)}>Натиснути</button>
        {:else}
          <span class="muted">{stateText(s)}</span>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .muted { color: var(--muted); } .center { text-align: center; }
  .label { margin: 18px 0 8px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .thermo { background: var(--tile); border-radius: 24px; padding: 20px; text-align: center; }
  .thermo.heat { background: linear-gradient(160deg, #ff7a1a, #f05a0a); }
  .thermo.cool { background: linear-gradient(160deg, #2f9bff, #1f6fe0); }
  .cur { font-size: 18px; opacity: .85; display: flex; flex-direction: column; align-items: center; }
  .cur small { font-size: 12px; opacity: .8; }
  .target { display: flex; align-items: center; justify-content: center; gap: 22px; margin: 8px 0; }
  .big { font-size: 64px; font-weight: 300; line-height: 1; }
  .big span { font-size: 32px; vertical-align: top; }
  .big2 { font-size: 22px; margin: 14px 0; }
  .round { all: unset; cursor: pointer; width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.18); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { all: unset; cursor: pointer; padding: 10px 14px; border-radius: 14px; background: var(--tile); font-size: 14px; }
  .chip.sel { background: var(--accent); color: #fff; }
  .sel { width: 100%; padding: 12px; border-radius: 14px; background: var(--tile); color: var(--text); border: 0; font-size: 15px; }
  .sel.small { width: auto; max-width: 50%; padding: 8px; }
  .bigtoggle { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%;
    box-sizing: border-box; padding: 28px; border-radius: 24px; background: var(--tile); font-size: 18px; }
  .bigtoggle.on { background: var(--accent); color: #fff; }
  .range { width: 100%; accent-color: var(--accent); height: 34px; }
  .row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .act { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 8px;
    border-radius: 18px; background: var(--tile); font-size: 14px; }
  .value { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px; background: var(--tile); border-radius: 24px; }
  .value .big { font-size: 40px; font-weight: 400; text-align: center; }
  .list { display: flex; flex-direction: column; gap: 6px; }
  .item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--tile); border-radius: 16px; }
  .iname { flex: 1; font-size: 15px; }
  .sw { all: unset; cursor: pointer; width: 46px; height: 28px; border-radius: 14px; background: var(--pw); position: relative; }
  .sw i { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: left .2s; }
  .sw.on { background: var(--accent); } .sw.on i { left: 21px; }
  .numin { width: 80px; padding: 8px; border-radius: 10px; border: 0; background: var(--pw); color: var(--text); font-size: 15px; }
</style>
