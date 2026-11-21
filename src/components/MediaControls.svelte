<script>
  // Медіаплеєр + пульт (Android TV Remote / Chromecast): що грає, ⏮⏯⏭, гучність, джерело, D-pad, YouTube.
  import Icon from './Icon.svelte';
  import { ha, callService } from '../lib/ha.svelte.js';
  import { domainOf } from '../lib/model.js';

  let { device } = $props();
  const players = $derived(device.entities.filter((e) => domainOf(e) === 'media_player' && ha.states[e]));
  // активний плеєр — той, що грає, інакше перший з даними
  const mp = $derived(players.find((e) => ha.states[e].state === 'playing') || players.find((e) => ha.states[e].attributes.media_title) || players[0]);
  const s = $derived(mp ? ha.states[mp] : null);
  const a = $derived(s?.attributes || {});
  const remote = $derived(device.entities.find((e) => domainOf(e) === 'remote' && ha.states[e]));
  const playing = $derived(s?.state === 'playing');
  const art = $derived(a.entity_picture ? a.entity_picture : null);

  // LG webOS: окремої сутності remote немає — кнопки через сервіс webostv.button
  const lg = $derived(players.find((e) => ha.entities.find((x) => x.entity_id === e)?.platform === 'webostv'));
  const LG_KEYS = { DPAD_UP: 'UP', DPAD_DOWN: 'DOWN', DPAD_LEFT: 'LEFT', DPAD_RIGHT: 'RIGHT', DPAD_CENTER: 'ENTER', BACK: 'BACK', HOME: 'HOME',
    VOLUME_DOWN: 'VOLUMEDOWN', VOLUME_UP: 'VOLUMEUP', CHANNEL_UP: 'CHANNELUP', CHANNEL_DOWN: 'CHANNELDOWN', MUTE: 'MUTE', MENU: 'MENU' };
  const hasPad = $derived(!!remote || !!lg);
  const mpc = (service, data = {}) => callService('media_player', service, data, { entity_id: mp });
  const key = (command) => remote
    ? callService('remote', 'send_command', { command }, { entity_id: remote })
    : callService('webostv', 'button', { entity_id: lg, button: LG_KEYS[command] || command });
  const app = (activity) => remote
    ? callService('remote', 'turn_on', { activity }, { entity_id: remote })
    : callService('media_player', 'select_source', { source: 'YouTube' }, { entity_id: lg });
  const power = () => remote ? callService('remote', 'toggle', {}, { entity_id: remote })
    : callService('media_player', ha.states[lg]?.state === 'off' ? 'turn_on' : 'turn_off', {}, { entity_id: lg });
  let vol = $state(null);
  $effect(() => { if (a.volume_level != null) vol = Math.round(a.volume_level * 100); });
</script>

{#if s}
  <div class="now" class:playing>
    {#if art}<img src={art} alt="" />{:else}<div class="ph"><Icon name="mdi:music" size={40} /></div>{/if}
    <div class="meta">
      <b>{a.media_title || (s.state === 'off' ? 'Вимкнено' : s.state === 'idle' ? 'Очікує' : 'Нічого не грає')}</b>
      <small>{a.media_artist || a.app_name || a.source || ''}</small>
    </div>
  </div>

  <div class="ctrl">
    <button onclick={() => mpc('media_previous_track')} aria-label="Попередній"><Icon name="mdi:skip-previous" size={30} /></button>
    <button class="big" onclick={() => mpc('media_play_pause')} aria-label="Пауза/грати"><Icon name={playing ? 'mdi:pause' : 'mdi:play'} size={40} /></button>
    <button onclick={() => mpc('media_next_track')} aria-label="Наступний"><Icon name="mdi:skip-next" size={30} /></button>
  </div>

  {#if a.volume_level != null}
    <div class="vol">
      <button class="sm" onclick={() => mpc('volume_mute', { is_volume_muted: !a.is_volume_muted })} aria-label="Без звуку">
        <Icon name={a.is_volume_muted ? 'mdi:volume-off' : 'mdi:volume-high'} size={22} />
      </button>
      <input type="range" min="0" max="100" bind:value={vol} onchange={() => mpc('volume_set', { volume_level: vol / 100 })} />
      <span>{vol}%</span>
    </div>
  {/if}

  {#if a.source_list?.length}
    <select class="sel" value={a.source} onchange={(e) => mpc('select_source', { source: e.currentTarget.value })}>
      {#each a.source_list as src}<option value={src}>{src}</option>{/each}
    </select>
  {/if}
{/if}

{#if hasPad}
  <div class="label">Пульт</div>
  <div class="apps">
    <button onclick={() => app('https://www.youtube.com')}><Icon name="mdi:youtube" size={22} color="#ff0033" />YouTube</button>
    <button onclick={power}><Icon name="mdi:power" size={22} />Живлення</button>
  </div>
  <div class="pad">
    <span></span><button onclick={() => key('DPAD_UP')}><Icon name="mdi:chevron-up" size={30} /></button><span></span>
    <button onclick={() => key('DPAD_LEFT')}><Icon name="mdi:chevron-left" size={30} /></button>
    <button class="ok" onclick={() => key('DPAD_CENTER')}>OK</button>
    <button onclick={() => key('DPAD_RIGHT')}><Icon name="mdi:chevron-right" size={30} /></button>
    <span></span><button onclick={() => key('DPAD_DOWN')}><Icon name="mdi:chevron-down" size={30} /></button><span></span>
  </div>
  <div class="row3">
    <button onclick={() => key('BACK')}><Icon name="mdi:arrow-left" size={22} />Назад</button>
    <button onclick={() => key('HOME')}><Icon name="mdi:home" size={22} />Додому</button>
    <button onclick={() => key('VOLUME_DOWN')}><Icon name="mdi:volume-minus" size={22} /></button>
  </div>
  {#if lg}
    <div class="row3">
      <button onclick={() => key('CHANNEL_DOWN')}><Icon name="mdi:chevron-double-down" size={22} />Канал</button>
      <button onclick={() => key('CHANNEL_UP')}><Icon name="mdi:chevron-double-up" size={22} />Канал</button>
      <button onclick={() => key('VOLUME_UP')}><Icon name="mdi:volume-plus" size={22} /></button>
    </div>
    <div class="row3">
      <button onclick={() => key('MUTE')}><Icon name="mdi:volume-off" size={22} />Тиша</button>
      <button onclick={() => key('MENU')}><Icon name="mdi:cog" size={22} />Меню</button>
      <button onclick={() => mpc('select_source', { source: 'HDMI1' })}><Icon name="mdi:video-input-hdmi" size={22} />HDMI1</button>
    </div>
  {/if}
{/if}

<style>
  .now { display: flex; gap: 14px; align-items: center; background: var(--tile); border-radius: 22px; padding: 14px; }
  .now.playing { background: linear-gradient(150deg, color-mix(in srgb, var(--accent) 30%, var(--tile)), var(--tile)); }
  .now img, .ph { width: 76px; height: 76px; border-radius: 14px; object-fit: cover; flex: none; }
  .ph { display: grid; place-items: center; background: var(--pw); color: var(--muted); }
  .meta { display: flex; flex-direction: column; min-width: 0; } .meta b { font-size: 17px; } .meta small { color: var(--muted); }
  .ctrl { display: flex; justify-content: center; align-items: center; gap: 22px; margin: 16px 0 6px; }
  .ctrl button, .sm { all: unset; cursor: pointer; width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); }
  .ctrl .big { width: 72px; height: 72px; background: var(--accent); color: #fff; }
  .sm { width: 40px; height: 40px; flex: none; }
  .vol { display: flex; align-items: center; gap: 10px; margin-top: 8px; } .vol input { flex: 1; accent-color: var(--accent); } .vol span { width: 44px; text-align: right; color: var(--muted); }
  .sel { width: 100%; margin-top: 10px; padding: 12px; border-radius: 14px; background: var(--tile); color: var(--text); border: 0; }
  .label { margin: 18px 0 8px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .apps, .row3 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .row3 { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 10px; }
  .apps button, .row3 button { all: unset; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 16px; background: var(--tile); }
  .pad { display: grid; grid-template-columns: repeat(3, 64px); grid-template-rows: repeat(3, 64px); gap: 6px; justify-content: center; margin-top: 12px; }
  .pad button { all: unset; cursor: pointer; display: grid; place-items: center; border-radius: 18px; background: var(--tile); }
  .pad .ok { border-radius: 50%; background: var(--accent); color: #fff; font-weight: 700; }
</style>
