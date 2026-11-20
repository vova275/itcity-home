<script>
  // Рядок зведень як у Homey: Освітлення, Охорона, Енергія, Клімат, Котел, Батарейки.
  import Icon from './Icon.svelte';
  import { ha } from '../lib/ha.svelte.js';
  import { ui, openDevice } from '../lib/ui.svelte.js';
  import { buildDevices, deviceForEntity } from '../lib/model.js';
  import { num } from '../lib/format.js';

  const S = (e) => ha.states[e];
  const val = (e) => Number(S(e)?.state);
  const lightsOn = $derived(Object.values(ha.states).filter((s) => s.entity_id.startsWith('light.') && s.state === 'on').length);
  const alarm = $derived(S('alarm_control_panel.okhorona')?.state);
  const ALARM = { disarmed: 'Знято', armed_away: 'Під охороною', armed_night: 'Нічний', armed_home: 'Частково', triggered: 'ТРИВОГА' };
  const temps = $derived(['spalnia', 'gostova', 'dytiacha', 'zal'].map((r) => val(`sensor.${r}_temperatura`)).filter(isFinite));
  const hums = $derived(['spalnia', 'gostova', 'dytiacha', 'zal'].map((r) => val(`sensor.${r}_vologist`)).filter(isFinite));
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const lowBat = $derived(Object.values(ha.states).filter((s) => s.attributes?.device_class === 'battery' && !s.entity_id.includes('sm_s928b') && Number(s.state) < 25).length);

  const devices = $derived(buildDevices(ha));
  const open = (e) => openDevice(deviceForEntity(devices, e));
  const list = (title, fn, empty) => (ui.list = { title, entities: fn, empty });
  const all = () => Object.values(ha.states);
  const items = $derived([
    { icon: 'mdi:lightbulb-group', color: '#ffd60a', name: 'Освітлення', val: `Увімкнено: ${lightsOn}`,
      act: () => list('Освітлення', () => all().filter((s) => s.entity_id.startsWith('light.')).map((s) => s.entity_id)) },
    { icon: 'mdi:shield-home', color: alarm === 'disarmed' ? '#8e8e93' : '#30d158', name: 'Охорона', val: ALARM[alarm] || '—', act: () => open('alarm_control_panel.okhorona') },
    { icon: 'mdi:leaf', color: '#30d158', name: 'Енергія', val: isFinite(val('sensor.lichylnyk_potuzhnist')) ? `${num(val('sensor.lichylnyk_potuzhnist') / 1000, 2)} kW` : '—', act: () => (ui.view = 'energy') },
    { icon: 'mdi:thermometer', color: '#ff9f0a', name: 'Клімат', val: temps.length ? `${num(avg(temps), 1)}° | ${Math.round(avg(hums))}%` : '—',
      act: () => list('Клімат', () => [...all().filter((s) => s.entity_id.startsWith('climate.')), ...all().filter((s) => s.entity_id.endsWith('_temperatura'))].map((s) => s.entity_id)) },
    { icon: 'mdi:fire', color: '#ff6b35', name: 'Котел', act: () => open('sensor.kotel_temperatura_podachi'), val: isFinite(val('sensor.kotel_temperatura_podachi')) ? `${num(val('sensor.kotel_temperatura_podachi'), 1)}° • ${num(val('sensor.kotel_tysk'), 1)} бар` : '—' },
    { icon: 'mdi:battery-alert-variant-outline', color: lowBat ? '#ff453a' : '#30d158', name: 'Батарейки', val: lowBat ? `Розряджено: ${lowBat}` : 'Все добре',
      act: () => list('Батарейки', () => all().filter((s) => s.attributes?.device_class === 'battery' && !s.entity_id.includes('sm_s928b')).sort((a, b) => Number(a.state) - Number(b.state)).map((s) => s.entity_id)) },
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
  .sum { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--gap); }
  @media (min-width: 900px) { .sum { grid-template-columns: repeat(3, 1fr); } }
  .it { all: unset; cursor: pointer; display: flex; align-items: center; gap: 12px; background: var(--tile); border-radius: 18px; padding: 14px; min-width: 0; min-height: 64px; box-sizing: border-box; }
  .it:active { transform: scale(.98); }
  .i { flex: none; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--pw); }
  .t { display: flex; flex-direction: column; min-width: 0; }
  .t b { font-size: 16px; } .t small { color: var(--muted); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
