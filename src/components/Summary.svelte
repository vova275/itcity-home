<script>
  // Рядок зведень як у Homey: Освітлення, Охорона, Енергія, Клімат, Котел, Батарейки.
  import Icon from './Icon.svelte';
  import { ha } from '../lib/ha.svelte.js';
  import { ui, openDevice, openList, setView } from '../lib/ui.svelte.js';
  import { buildDevices, deviceForEntity } from '../lib/model.js';
  import { num } from '../lib/format.js';

  const S = (e) => ha.states[e];
  const val = (e) => Number(S(e)?.state);
  // справжнє світло: без прихованих, службових і членів груп (щоб не рахувати двічі)
  const regOf = $derived(Object.fromEntries(ha.entities.map((e) => [e.entity_id, e])));
  const inGroup = $derived(new Set(Object.values(ha.states).filter((s) => s.entity_id.startsWith('light.') && Array.isArray(s.attributes.entity_id)).flatMap((s) => s.attributes.entity_id)));
  const nonLightDevs = $derived(new Set(ha.entities.filter((e) => e.device_id && /^(climate|fan|media_player|water_heater|vacuum)\./.test(e.entity_id)).map((e) => e.device_id)));
  const LIGHTISH = /світл|вулиц|тераса|підсвіт|гірлянд|lamp|light/i;
  const isLight = (s) => {
    const r = regOf[s.entity_id];
    if (r?.hidden_by || r?.entity_category) return false;
    if (s.entity_id.startsWith('light.')) return !inGroup.has(s.entity_id);
    // підсвітка дисплея кондиціонера тощо — не світло: пропускаємо вимикачі пристроїв з climate/fan/media
    if (r?.device_id && nonLightDevs.has(r.device_id)) return false;
    return s.entity_id.startsWith('switch.') && LIGHTISH.test((s.attributes.friendly_name || '') + ' ' + (r?.icon || s.attributes.icon || ''));
  };
  const lightsOn = $derived(Object.values(ha.states).filter((s) => isLight(s) && s.state === 'on').length);
  const alarm = $derived(S('alarm_control_panel.okhorona')?.state);
  const ALARM = { disarmed: 'Знято', armed_away: 'Під охороною', armed_night: 'Нічний', armed_home: 'Частково', triggered: 'ТРИВОГА' };
  const temps = $derived(['spalnia', 'gostova', 'dytiacha', 'zal'].map((r) => val(`sensor.${r}_temperatura`)).filter(isFinite));
  const hums = $derived(['spalnia', 'gostova', 'dytiacha', 'zal'].map((r) => val(`sensor.${r}_vologist`)).filter(isFinite));
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const lowBat = $derived(Object.values(ha.states).filter((s) => s.attributes?.device_class === 'battery' && !s.entity_id.includes('sm_s928b') && (s.state === 'unavailable' || Number(s.state) < 25)).length);

  const devices = $derived(buildDevices(ha));
  const open = (e) => openDevice(deviceForEntity(devices, e));
  const list = (title, fn, empty, show = false, group = false) => openList({ title, entities: fn, empty, show, group });
  const all = () => Object.values(ha.states);
  const items = $derived([
    { icon: 'mdi:lightbulb-group', color: '#ffd60a', name: 'Освітлення', val: `Увімкнено: ${lightsOn}`,
      act: () => list('Освітлення', () => all().filter(isLight).map((s) => s.entity_id)) },
    { icon: 'mdi:shield-home', color: alarm === 'disarmed' ? '#8e8e93' : '#30d158', name: 'Охорона', val: ALARM[alarm] || '—', act: () => open('alarm_control_panel.okhorona') },
    { icon: 'mdi:leaf', color: '#30d158', name: 'Енергія', val: isFinite(val('sensor.lichylnyk_potuzhnist')) ? `${num(val('sensor.lichylnyk_potuzhnist') / 1000, 2)} kW` : '—', act: () => setView('energy') },
    { icon: 'mdi:thermometer', color: '#ff9f0a', name: 'Клімат', val: temps.length ? `${num(avg(temps), 1)}° | ${Math.round(avg(hums))}%` : '—',
      act: () => list('Клімат', () => [...all().filter((s) => s.entity_id.startsWith('climate.')), ...all().filter((s) => s.entity_id.endsWith('_temperatura'))].map((s) => s.entity_id), '', true) },
    { icon: 'mdi:fire', color: '#ff6b35', name: 'Котел', act: () => open('sensor.kotel_temperatura_podachi'), val: isFinite(val('sensor.kotel_temperatura_podachi')) ? `${num(val('sensor.kotel_temperatura_podachi'), 1)}° • ${num(val('sensor.kotel_tysk'), 1)} бар` : '—' },
    { icon: 'mdi:battery-alert-variant-outline', color: lowBat ? '#ff453a' : '#30d158', name: 'Батарейки', val: lowBat ? `Потребують уваги: ${lowBat}` : 'Все добре',
      act: () => list('Батарейки', () => all().filter((s) => s.attributes?.device_class === 'battery' && !s.entity_id.includes('sm_s928b')).sort((a, b) => (Number(a.state) || 0) - (Number(b.state) || 0)).map((s) => s.entity_id), 'Пристроїв з батарейками немає', true, true) },
  ]);
</script>

<div class="sum">
  {#each items as it}
    <button class="it" onclick={it.act}>
      <span class="i" style="color:{it.color}"><Icon name={it.icon} size={28} /></span>
      <span class="t"><b>{it.name}</b><small>{it.val}</small></span>
    </button>
  {/each}
</div>

<style>
  .sum { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gap); }
  @media (min-width: 900px) { .sum { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  .it { all: unset; cursor: pointer; display: flex; align-items: center; gap: 12px; background: var(--tile); border-radius: 18px; padding: 14px; min-width: 0; min-height: 64px; box-sizing: border-box; }
  .it:active { transform: scale(.98); }
  .i { flex: none; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--pw); }
  .t { display: flex; flex-direction: column; min-width: 0; }
  .t b { font-size: clamp(14px, 4vw, 16px); overflow-wrap: anywhere; } .t small { color: var(--muted); font-size: clamp(12px, 3.6vw, 14px); line-height: 1.25;
    overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
