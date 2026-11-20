<script>
  // Налаштування котла в двигуні клімату: керування, погодна крива, корекція за кімнатами, літній режим, присутність.
  import Icon from './Icon.svelte';
  import EntityPicker from './EntityPicker.svelte';
  import { clim, saveClimate } from '../lib/climate.svelte.js';
  let { onclose } = $props();
  const b = $derived(clim.config.boiler);
  let timer;
  const save = () => { clearTimeout(timer); timer = setTimeout(saveClimate, 400); };
  const presenceFilter = (e) => e.startsWith('person.') || e.startsWith('device_tracker.');
  const outdoorFilter = (e) => e.startsWith('weather.') || (e.startsWith('sensor.') && e.includes('outside'));
  const ex = $derived([-15, -5, 0, 5, 10].map((t) => ({ t, f: Math.round(Math.min(b.flow_max, Math.max(b.flow_min, 20 + b.curve_slope * (20 - t) + Number(b.curve_shift)))) })));
</script>

<div class="backdrop" onclick={onclose} role="presentation"></div>
<div class="sheet" role="dialog" aria-modal="true">
  <header>
    <button class="hb" onclick={onclose} aria-label="Закрити"><Icon name="mdi:chevron-down" /></button>
    <b>Котел і загальне</b><span style="width:42px"></span>
  </header>
  <div class="body">
    <label class="row"><span><b>Клімат-контроль працює</b><small>Головний вимикач усіх зон</small></span><input type="checkbox" bind:checked={clim.config.enabled} onchange={save} /></label>
    <label class="row"><span><b>Керувати котлом</b><small>Подача за погодою + корекція за найхолоднішою кімнатою; опалення вимикається, коли тепла ніхто не просить</small></span><input type="checkbox" bind:checked={b.enabled} onchange={save} /></label>
    <label class="row warn"><span><b>Котел: тільки показувати (тест)</b><small>Вимкни, коли перевіриш. Перед цим вимкни автоматизацію «HA керує котлом» у картці котла, щоб не дублювались команди.</small></span><input type="checkbox" bind:checked={b.dry_run} onchange={save} /></label>

    <h3>Погодна крива</h3>
    <label class="row"><span>Нахил</span><input class="num" type="number" step="0.1" bind:value={b.curve_slope} onchange={save} /></label>
    <label class="row"><span>Зсув</span><input class="num" type="number" step="1" bind:value={b.curve_shift} onchange={save} /><span class="u">°C</span></label>
    <label class="row"><span>Мінімальна подача</span><input class="num" type="number" step="1" bind:value={b.flow_min} onchange={save} /><span class="u">°C</span></label>
    <label class="row"><span>Максимальна подача</span><input class="num" type="number" step="1" bind:value={b.flow_max} onchange={save} /><span class="u">°C</span></label>
    <label class="row"><span>Корекція за кімнатою (на кожен °C недогріву)</span><input class="num" type="number" step="0.5" bind:value={b.room_gain} onchange={save} /><span class="u">°C</span></label>
    <div class="curve">{#each ex as p}<div><small>{p.t}° надворі</small><b>{p.f}°</b></div>{/each}</div>

    <h3>Гаряча вода і сезон</h3>
    <label class="row"><span>Гаряча вода</span><input class="num" type="number" step="1" bind:value={b.hwc} onchange={save} /><span class="u">°C</span></label>
    <label class="row"><span>Літній режим, якщо надворі від</span><input class="num" type="number" step="1" bind:value={b.summer_outdoor} onchange={save} /><span class="u">°C</span></label>
    <h3>Вулична температура</h3>
    <EntityPicker bind:value={clim.config.outdoor} filter={outdoorFilter} onchange={save} />

    <h3>Присутність («Нікого вдома»)</h3>
    <EntityPicker multiple bind:value={clim.config.presence} filter={presenceFilter} placeholder="Телефони/люди — коли всі не вдома, вмикається пресет «Нікого вдома»" onchange={save} />
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 50; }
  .sheet { position: fixed; z-index: 51; left: 50%; bottom: 0; transform: translateX(-50%); width: min(620px, 100vw); height: min(92vh, 900px);
    background: var(--bg-sheet); border-radius: 28px 28px 0 0; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }
  header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px 8px; font-size: 18px; }
  .hb { all: unset; cursor: pointer; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); }
  .body { flex: 1; overflow-y: auto; padding: 6px 18px 24px; }
  h3 { margin: 22px 2px 8px; font-size: 14px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--tile); border-radius: 14px; margin-top: 6px; }
  .row span { flex: 1; display: flex; flex-direction: column; } .row small { color: var(--muted); font-size: 12px; }
  .row.warn { background: color-mix(in srgb, #ffd60a 12%, var(--tile)); }
  .row input[type=checkbox] { width: 22px; height: 22px; accent-color: var(--accent); }
  .num { width: 76px; padding: 8px; border-radius: 10px; border: 0; background: var(--pw); color: var(--text); text-align: center; }
  .u { flex: 0 !important; color: var(--muted); }
  .curve { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 8px; }
  .curve div { background: var(--tile); border-radius: 12px; padding: 8px; text-align: center; display: flex; flex-direction: column; }
  .curve small { color: var(--muted); font-size: 11px; } .curve b { font-size: 18px; }
</style>
