<script>
  // Погода: зараз (температура, стан, вітер, вологість, тиск, хмарність, схід/захід) + погодинно 12 год + 5 днів.
  import Icon from './Icon.svelte';
  import { ha, subscribe } from '../lib/ha.svelte.js';
  import { num, WEATHER_UK } from '../lib/format.js';

  const W_ICON = {
    'clear-night': 'mdi:weather-night', cloudy: 'mdi:weather-cloudy', fog: 'mdi:weather-fog', hail: 'mdi:weather-hail',
    lightning: 'mdi:weather-lightning', 'lightning-rainy': 'mdi:weather-lightning-rainy', partlycloudy: 'mdi:weather-partly-cloudy',
    pouring: 'mdi:weather-pouring', rainy: 'mdi:weather-rainy', snowy: 'mdi:weather-snowy', 'snowy-rainy': 'mdi:weather-snowy-rainy',
    sunny: 'mdi:weather-sunny', windy: 'mdi:weather-windy', 'windy-variant': 'mdi:weather-windy-variant', exceptional: 'mdi:alert-circle-outline',
  };
  const DIRS = ['Пн', 'ПнСх', 'Сх', 'ПдСх', 'Пд', 'ПдЗх', 'Зх', 'ПнЗх'];

  const w = $derived(Object.values(ha.states).find((s) => s.entity_id.startsWith('weather.')));
  const a = $derived(w?.attributes || {});
  const sun = $derived(ha.states['sun.sun']?.attributes || {});
  let hourly = $state([]);
  let daily = $state([]);
  let subscribed = null;

  $effect(() => {
    const id = w?.entity_id;
    if (!id || !ha.connected || subscribed === id) return;
    subscribed = id;
    subscribe({ type: 'weather/subscribe_forecast', entity_id: id, forecast_type: 'hourly' }, (ev) => (hourly = ev.forecast || [])).catch(() => {});
    subscribe({ type: 'weather/subscribe_forecast', entity_id: id, forecast_type: 'daily' }, (ev) => (daily = ev.forecast || [])).catch(() => {});
  });

  const hm = (iso) => new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  const dayName = (iso, i) => (i === 0 ? 'Сьогодні' : new Date(iso).toLocaleDateString('uk-UA', { weekday: 'short' }));
  const windDir = (b) => (b == null ? '' : DIRS[Math.round(((b % 360) / 45)) % 8]);
  const ws = $derived(a.wind_speed != null ? (a.wind_speed_unit === 'km/h' ? a.wind_speed / 3.6 : a.wind_speed) : null);
  // «відчувається як» за вітром (Wind Chill) для холоду
  const feels = $derived.by(() => {
    const t = a.temperature, v = ws != null ? ws * 3.6 : null;
    if (a.apparent_temperature != null) return a.apparent_temperature;
    if (t == null || v == null || t > 10 || v < 5) return null;
    return 13.12 + 0.6215 * t - 11.37 * v ** 0.16 + 0.3965 * t * v ** 0.16;
  });
  const precipNext = $derived(hourly.slice(0, 6).reduce((s, h) => s + (h.precipitation || 0), 0));
</script>

{#if w}
  <div class="wx">
    <div class="now">
      <span class="big-ic"><Icon name={W_ICON[w.state] || 'mdi:weather-partly-cloudy'} size={64} /></span>
      <div class="t">
        <b>{num(a.temperature, 0)}°</b>
        <span>{WEATHER_UK[w.state] || w.state}</span>
        {#if feels != null}<small>відчувається як {num(feels, 0)}°</small>{/if}
      </div>
      {#if daily[0]}<div class="hl"><span>↑ {num(daily[0].temperature, 0)}°</span><span>↓ {num(daily[0].templow, 0)}°</span></div>{/if}
    </div>

    <div class="facts">
      {#if ws != null}<div><Icon name="mdi:weather-windy" size={18} /><span>{num(ws, 1)} м/с {windDir(a.wind_bearing)}</span></div>{/if}
      {#if a.humidity != null}<div><Icon name="mdi:water-percent" size={18} /><span>{num(a.humidity, 0)}%</span></div>{/if}
      {#if a.pressure != null}<div><Icon name="mdi:gauge" size={18} /><span>{num(a.pressure * 0.750062, 0)} мм</span></div>{/if}
      {#if a.cloud_coverage != null}<div><Icon name="mdi:cloud-percent-outline" size={18} /><span>{num(a.cloud_coverage, 0)}%</span></div>{/if}
      {#if sun.next_rising}<div><Icon name="mdi:weather-sunset-up" size={18} /><span>{hm(sun.next_rising)}</span></div>{/if}
      {#if sun.next_setting}<div><Icon name="mdi:weather-sunset-down" size={18} /><span>{hm(sun.next_setting)}</span></div>{/if}
    </div>
    {#if precipNext > 0}<p class="rain"><Icon name="mdi:umbrella" size={16} /> Найближчі 6 год: опади {num(precipNext, 1)} мм</p>{/if}

    {#if hourly.length}
      <div class="hours">
        {#each hourly.slice(0, 12) as h}
          <div class="h">
            <small>{hm(h.datetime).slice(0, 2)}</small>
            <Icon name={W_ICON[h.condition] || 'mdi:weather-cloudy'} size={24} />
            <b>{num(h.temperature, 0)}°</b>
            {#if h.precipitation}<em>{num(h.precipitation, 1)}</em>{/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if daily.length}
      <div class="days">
        {#each daily.slice(0, 5) as d, i}
          <div class="d">
            <span class="dn">{dayName(d.datetime, i)}</span>
            <Icon name={W_ICON[d.condition] || 'mdi:weather-cloudy'} size={22} />
            <span class="pr">{d.precipitation ? num(d.precipitation, 1) + ' мм' : ''}</span>
            <span class="lo">{num(d.templow, 0)}°</span><span class="hi">{num(d.temperature, 0)}°</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .wx { min-width: 0; overflow: hidden; background: linear-gradient(160deg, #1f3a5f, var(--tile) 80%); border-radius: var(--r-tile); padding: 16px; color: var(--text); }
  :global([data-theme='light']) .wx { background: linear-gradient(160deg, #cfe3ff, var(--tile) 80%); }
  .now { display: flex; align-items: center; gap: 14px; }
  .big-ic { color: #ffd60a; flex: none; }
  .t { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .t b { font-size: 48px; font-weight: 300; line-height: 1; } .t span { font-size: 16px; } .t small { color: var(--muted); font-size: 13px; }
  .hl { display: flex; flex-direction: column; text-align: right; font-size: 15px; color: var(--muted); }
  .facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 10px; margin-top: 14px; }
  .facts div { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--muted); min-width: 0; }
  .facts span { color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rain { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; font-size: 13px; color: #64d2ff; }
  .hours { display: flex; gap: 6px; overflow-x: auto; margin-top: 14px; padding-bottom: 4px; scrollbar-width: none; }
  .h { flex: 0 0 52px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0; border-radius: 14px; background: var(--pw); }
  .h small { color: var(--muted); font-size: 12px; } .h b { font-size: 15px; } .h em { font-style: normal; font-size: 10px; color: #64d2ff; }
  .days { margin-top: 12px; display: flex; flex-direction: column; gap: 2px; }
  .d { display: grid; grid-template-columns: 1fr 28px 64px 36px 36px; align-items: center; gap: 6px; padding: 6px 2px; font-size: 15px; }
  .dn { text-transform: capitalize; } .pr { color: #64d2ff; font-size: 12px; text-align: right; }
  .lo { color: var(--muted); text-align: right; } .hi { text-align: right; font-weight: 600; }
</style>
