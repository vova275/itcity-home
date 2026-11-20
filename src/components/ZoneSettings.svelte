<script>
  // Налаштування зони клімату: датчики, клапан, пресети, розклад, вікна, тонкі параметри.
  import Icon from './Icon.svelte';
  import EntityPicker from './EntityPicker.svelte';
  import { ha } from '../lib/ha.svelte.js';
  import { clim, saveClimate, PRESET_UK, DAYS_UK } from '../lib/climate.svelte.js';

  let { id, onclose } = $props();
  const z = $derived(clim.config?.zones.find((x) => x.id === id));

  // Ajax міряє температуру процесора, а не кімнати — такі сутності не пропонуємо
  const devOf = (e) => ha.devices.find((d) => d.id === ha.entities.find((x) => x.entity_id === e)?.device_id);
  const isAjax = (e) => (devOf(e)?.manufacturer || '').toLowerCase().includes('ajax');
  const tempFilter = (e) => e.startsWith('sensor.') && ha.states[e].attributes?.device_class === 'temperature'
    && !isAjax(e) && !e.includes('ebusd') && !e.startsWith('sensor.kotel');
  const valveFilter = (e) => e.startsWith('switch.') || e.startsWith('input_boolean.');
  const windowFilter = (e) => e.startsWith('binary_sensor.') && ['window', 'door', 'opening', 'garage_door'].includes(ha.states[e].attributes?.device_class);
  const coolFilter = (e) => e.startsWith('climate.');

  let timer;
  const save = () => { clearTimeout(timer); timer = setTimeout(saveClimate, 400); };
  function remove() {
    if (!confirm(`Видалити зону «${z.name}»?`)) return;
    clim.config.zones = clim.config.zones.filter((x) => x.id !== id);
    saveClimate(); onclose();
  }
  function addStep() { z.schedule = [...z.schedule, { days: [1, 2, 3, 4, 5, 6, 7], from: '07:00', preset: 'comfort' }]; save(); }
  function toggleDay(s, d) { s.days = s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort(); save(); }
</script>

{#if z}
  <div class="backdrop" onclick={onclose} role="presentation"></div>
  <div class="sheet" role="dialog" aria-modal="true">
    <header>
      <button class="hb" onclick={onclose} aria-label="Закрити"><Icon name="mdi:chevron-down" /></button>
      <input class="title" bind:value={z.name} oninput={save} />
      <button class="hb danger" onclick={remove} aria-label="Видалити"><Icon name="mdi:delete-outline" /></button>
    </header>
    <div class="body">
      <label class="row"><span><b>Зона увімкнена</b></span><input type="checkbox" bind:checked={z.enabled} onchange={save} /></label>
      <label class="row warn"><span><b>Тільки показувати (тест)</b><small>Рахує рішення, але клапаном не керує. Вимкни, коли перевіриш і вимкнеш відповідні Flow у Homey.</small></span>
        <input type="checkbox" bind:checked={z.dry_run} onchange={save} /></label>

      <h3>Датчики температури</h3>
      <EntityPicker multiple bind:value={z.sensors} filter={tempFilter} placeholder="Вибери датчик(и)" onchange={save} />
      {#if z.sensors.length > 1}
        <div class="seg">
          {#each [['avg', 'Середнє'], ['min', 'Найхолодніший'], ['max', 'Найтепліший']] as [k, l]}
            <button class:sel={z.combine === k} onclick={() => { z.combine = k; save(); }}>{l}</button>
          {/each}
        </div>
      {/if}
      <label class="row"><span>Поправка датчика</span><input class="num" type="number" step="0.1" bind:value={z.offset} onchange={save} /><span class="u">°C</span></label>

      <h3>Чим гріти</h3>
      <EntityPicker bind:value={z.valve} filter={valveFilter} placeholder="Клапан / реле (необов'язково)" onchange={save} />
      <label class="row"><span>Опалення завжди відкрите<small>(як у Дитячій — зона лише просить тепла в котла)</small></span><input type="checkbox" bind:checked={z.always_open} onchange={save} /></label>
      <label class="row"><span>Клапан нормально відкритий (інверсія)</span><input type="checkbox" bind:checked={z.valve_inverted} onchange={save} /></label>

      <h3>Температури</h3>
      <div class="presets">
        {#each Object.keys(PRESET_UK) as p}
          <label><small>{PRESET_UK[p]}</small><input class="num" type="number" step="0.5" bind:value={z.presets[p]} onchange={save} /></label>
        {/each}
      </div>

      <h3>Розклад</h3>
      {#each z.schedule as s, i}
        <div class="step">
          <div class="days">{#each DAYS_UK as d, k}<button class:sel={s.days.includes(k + 1)} onclick={() => toggleDay(s, k + 1)}>{d}</button>{/each}</div>
          <div class="line">
            з <input type="time" bind:value={s.from} onchange={save} />
            <select bind:value={s.preset} onchange={save}>{#each Object.keys(PRESET_UK) as p}<option value={p}>{PRESET_UK[p]}</option>{/each}</select>
            <button class="hb small" onclick={() => { z.schedule = z.schedule.filter((_, k) => k !== i); save(); }} aria-label="прибрати"><Icon name="mdi:close" size={18} /></button>
          </div>
        </div>
      {/each}
      <button class="addb" onclick={addStep}><Icon name="mdi:plus" />Додати крок</button>

      <h3>Відкрите вікно</h3>
      <EntityPicker multiple bind:value={z.window_sensors} filter={windowFilter} placeholder="Датчики вікон/дверей (необов'язково)" onchange={save} />
      <label class="row"><span>Пауза, якщо температура впала за 10 хв на</span><input class="num" type="number" step="0.1" bind:value={z.window_drop} onchange={save} /><span class="u">°C</span></label>

      <h3>Охолодження</h3>
      <EntityPicker bind:value={z.cooler} filter={coolFilter} placeholder="Кондиціонер (поки лише для відображення)" onchange={save} />

      <h3>Тонкі налаштування</h3>
      <label class="row"><span>Гістерезис</span><input class="num" type="number" step="0.1" bind:value={z.hysteresis} onchange={save} /><span class="u">°C</span></label>
      <label class="row"><span>Мінімальний час роботи клапана</span><input class="num" type="number" step="1" bind:value={z.min_cycle_min} onchange={save} /><span class="u">хв</span></label>
      <label class="row"><span>Датчик «мовчить» довше — закрити клапан</span><input class="num" type="number" step="5" bind:value={z.stale_min} onchange={save} /><span class="u">хв</span></label>
      <label class="row"><span>Захист від замерзання нижче</span><input class="num" type="number" step="0.5" bind:value={z.frost} onchange={save} /><span class="u">°C</span></label>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 50; }
  .sheet { position: fixed; z-index: 51; left: 50%; bottom: 0; transform: translateX(-50%); width: min(620px, 100vw); height: min(92vh, 900px);
    background: var(--bg-sheet); border-radius: 28px 28px 0 0; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }
  header { display: flex; align-items: center; gap: 10px; padding: 14px 16px 8px; }
  .title { flex: 1; font-size: 20px; font-weight: 700; text-align: center; background: transparent; border: 0; color: var(--text); }
  .hb { all: unset; cursor: pointer; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); flex: none; }
  .hb.small { width: 34px; height: 34px; } .hb.danger { color: var(--danger); }
  .body { flex: 1; overflow-y: auto; padding: 6px 18px 24px; }
  h3 { margin: 22px 2px 8px; font-size: 14px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--tile); border-radius: 14px; margin-top: 6px; }
  .row span { flex: 1; display: flex; flex-direction: column; } .row small { color: var(--muted); font-size: 12px; }
  .row.warn { background: color-mix(in srgb, #ffd60a 12%, var(--tile)); }
  .row input[type=checkbox] { width: 22px; height: 22px; accent-color: var(--accent); }
  .num { width: 76px; padding: 8px; border-radius: 10px; border: 0; background: var(--pw); color: var(--text); text-align: center; }
  .u { flex: 0 !important; color: var(--muted); }
  .seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; }
  .seg button { all: unset; cursor: pointer; text-align: center; padding: 9px; border-radius: 12px; background: var(--tile); font-size: 13px; }
  .seg button.sel { background: var(--accent); color: #fff; }
  .presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .presets label { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px; background: var(--tile); border-radius: 14px; }
  .presets small { color: var(--muted); font-size: 12px; }
  .step { background: var(--tile); border-radius: 14px; padding: 10px; margin-top: 6px; }
  .days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .days button { all: unset; cursor: pointer; text-align: center; padding: 6px 0; border-radius: 8px; background: var(--pw); font-size: 12px; }
  .days button.sel { background: var(--accent); color: #fff; }
  .line { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .line input, .line select { padding: 8px; border-radius: 10px; border: 0; background: var(--pw); color: var(--text); }
  .line select { flex: 1; }
  .addb { all: unset; cursor: pointer; display: flex; align-items: center; gap: 6px; margin-top: 8px; padding: 10px 14px; border-radius: 12px; background: var(--pw); }
</style>
