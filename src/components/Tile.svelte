<script>
  // Плитка в стилі Homey: іконка зверху, кнопка живлення справа, назва і стан унизу.
  // Тап по плитці — картка пристрою; тап по кнопці живлення — увімкнути/вимкнути.
  import Icon from './Icon.svelte';
  import { ha, callService } from '../lib/ha.svelte.js';
  import { iconFor } from '../lib/icons.js';
  import { stateText } from '../lib/format.js';
  import { isOn, domainOf, TOGGLE_DOMAINS } from '../lib/model.js';
  import { openDevice } from '../lib/ui.svelte.js';

  // show — показати стан іншої сутності пристрою (напр. заряд батареї в списку «Батарейки»)
  let { device, name = null, icon = null, show = null } = $props();

  const st = $derived(ha.states[device.main]);
  const shown = $derived(show ? ha.states[show] : st);
  const low = $derived(shown?.attributes?.device_class === 'battery' && Number(shown.state) < 25);
  const reg = $derived(device.registry?.find((r) => r.entity_id === device.main));
  const on = $derived(isOn(st));
  const dom = $derived(domainOf(device.main));
  const canToggle = $derived(TOGGLE_DOMAINS.has(dom) && st?.state !== 'unavailable');
  const unavailable = $derived(!st || st.state === 'unavailable');
  // температура + тиск (котел): «48,5 °C • 1,5 bar»
  const extra = $derived.by(() => {
    if (show || st?.attributes?.device_class !== 'temperature') return '';
    const p = (device.entities || []).map((e) => ha.states[e]).find((x) => x?.attributes?.device_class === 'pressure' && x.attributes.unit_of_measurement === 'bar' && isFinite(Number(x.state)));
    return p ? ' • ' + stateText(p) : '';
  });
  let busy = $state(false);

  async function toggle(e) {
    e.stopPropagation();
    busy = true;
    try {
      if (dom === 'climate') await callService('climate', on ? 'turn_off' : 'turn_on', {}, { entity_id: device.main });
      else if (dom === 'cover') await callService('cover', 'toggle', {}, { entity_id: device.main });
      else await callService('homeassistant', 'toggle', {}, { entity_id: device.main });
    } finally { busy = false; }
  }
</script>

<button class="tile" class:on class:unavailable onclick={() => openDevice(device)}>
  <div class="top">
    <span class="ico" class:on><Icon name={icon || (show ? iconFor(shown) : iconFor(st, reg))} size={28} /></span>
    {#if canToggle}
      <span class="pw" class:on class:busy role="button" tabindex="0" aria-label="Увімкнути/вимкнути"
            onclick={toggle} onkeydown={(e) => e.key === 'Enter' && toggle(e)}>
        <Icon name="mdi:power" size={20} />
      </span>
    {/if}
  </div>
  <div class="name">{name || device.name || st?.attributes?.friendly_name || device.main}</div>
  <div class="state" class:alert={unavailable || low}>{unavailable && !show ? '⚠ Недоступно' : stateText(shown) + extra}</div>
</button>

<style>
  .tile {
    all: unset; box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column;
    background: var(--tile); border-radius: var(--r-tile); padding: 14px 14px 13px; min-height: 136px; min-width: 0; width: 100%;
    transition: background .2s, transform .1s; position: relative; overflow: hidden;
  }
  .tile:active { transform: scale(.97); }
  .tile.on { background: var(--tile-on); }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; flex: 1; min-height: 40px; min-width: 0; }
  .ico { flex: none; }
  @media (max-width: 480px) { .tile { padding: 12px; min-height: 128px; } .pw { width: 34px; height: 34px; } .name { font-size: 14px; } }
  @media (min-width: 600px) { .tile { aspect-ratio: 1 / 1; } }
  .ico { color: var(--text); opacity: .9; }
  .ico.on { color: var(--accent-warm); opacity: 1; }
  .pw {
    width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; flex: none; margin: -4px -4px 0 0;
    background: var(--pw); color: var(--text); transition: background .2s;
  }
  .pw.on { background: var(--accent-soft); color: var(--accent); }
  .pw.busy { opacity: .5; }
  .name {
    font-size: 15px; font-weight: 600; line-height: 1.22; margin-top: 10px; overflow-wrap: break-word; hyphens: auto;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .state { font-size: 13px; color: var(--muted); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .state.alert { color: var(--danger); }
  .unavailable { opacity: .75; }
</style>
