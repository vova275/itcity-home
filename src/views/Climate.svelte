<script>
  // Клімат: котел + зони (кімнати). Тап по ⚙ — налаштування зони.
  import Icon from '../components/Icon.svelte';
  import ZoneSettings from '../components/ZoneSettings.svelte';
  import BoilerSettings from '../components/BoilerSettings.svelte';
  import { clim, startClimatePolling, zoneAction, saveClimate, PRESET_UK } from '../lib/climate.svelte.js';
  import { pushLayer, back } from '../lib/ui.svelte.js';
  import { num } from '../lib/format.js';

  $effect(() => startClimatePolling());
  let editing = $state(null);       // id зони або 'boiler'
  const openEdit = (id) => { editing = id; pushLayer(() => (editing = null)); };

  function addZone() {
    const id = 'z' + Date.now().toString(36);
    clim.config.zones.push({ id, name: 'Нова кімната' });
    saveClimate().then(() => openEdit(id));
  }
  const st = (id) => clim.status?.zones?.[id] || {};
  function nudge(z, d) {
    const cur = st(z.id).target ?? z.presets?.comfort ?? 21;
    zoneAction(z.id, 'target', { target: Math.round((cur + d) * 2) / 2 });
  }
</script>

<h1>Клімат</h1>

{#if !clim.config}
  <p class="muted">{clim.error || 'Завантаження…'}</p>
{:else}
  {@const b = clim.status?.boiler || {}}
  <button class="boiler" class:on={b.heating} onclick={() => openEdit('boiler')}>
    <span class="bi"><Icon name="mdi:water-boiler" size={30} /></span>
    <span class="bt">
      <b>Котел {b.heating ? `гріє · подача ${b.flow}°` : b.summer ? '— літній режим' : 'чекає'}</b>
      <small>
        Надворі {b.outdoor != null ? num(b.outdoor, 1) + '°' : '—'}
        {#if b.zones?.length} · просять: {b.zones.join(', ')}{/if}
        · {!clim.config.boiler.enabled ? 'керування вимкнено' : clim.config.boiler.dry_run ? 'тільки показую' : 'HA керує'}
      </small>
    </span>
    <Icon name="mdi:cog" size={22} />
  </button>

  <div class="zones">
    {#each clim.config.zones as z (z.id)}
      {@const s = st(z.id)}
      <div class="zone" class:heat={s.heating} class:off={!z.enabled}>
        <div class="zh">
          <b>{z.name}</b>
          {#if z.dry_run}<span class="badge">тест</span>{/if}
          <button class="ib" onclick={() => openEdit(z.id)} aria-label="Налаштування"><Icon name="mdi:cog" size={20} /></button>
        </div>
        <div class="temp">{s.temp != null ? num(s.temp, 1) : '—'}<span>°</span></div>
        <div class="tgt">
          <button class="rb" onclick={() => nudge(z, -0.5)}><Icon name="mdi:minus" /></button>
          <span>до <b>{s.target != null ? num(s.target, 1) : '—'}°</b></span>
          <button class="rb" onclick={() => nudge(z, 0.5)}><Icon name="mdi:plus" /></button>
        </div>
        <div class="why">
          <Icon name={s.heating ? 'mdi:fire' : s.note?.startsWith('відкрите') ? 'mdi:window-open-variant' : 'mdi:pause-circle-outline'} size={16} />
          {s.heating ? (z.dry_run ? 'гріла б' : 'гріє') : 'не гріє'} · {s.note || s.reason || PRESET_UK[s.preset] || ''}
        </div>
        <div class="acts">
          <button onclick={() => zoneAction(z.id, 'boost', { minutes: 60, delta: 2 })}><Icon name="mdi:rocket-launch" size={18} />+2° на годину</button>
          {#if s.reason === 'вручну' || s.reason === 'буст'}
            <button onclick={() => zoneAction(z.id, 'clear')}><Icon name="mdi:calendar-sync" size={18} />За розкладом</button>
          {/if}
        </div>
      </div>
    {/each}
    <button class="add" onclick={addZone}><Icon name="mdi:plus" size={28} />Додати кімнату</button>
  </div>
{/if}

{#if editing === 'boiler'}<BoilerSettings onclose={back} />
{:else if editing}<ZoneSettings id={editing} onclose={back} />{/if}

<style>
  h1 { font-size: 34px; font-weight: 800; margin: 6px 2px 16px; }
  .muted { color: var(--muted); }
  .boiler { all: unset; cursor: pointer; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 14px; padding: 16px;
    border-radius: var(--r-tile); background: var(--tile); }
  .boiler.on { background: linear-gradient(160deg, #4a2a12, var(--tile) 75%); }
  .bi { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; background: rgba(255,107,53,.18); color: #ff6b35; flex: none; }
  .bt { flex: 1; display: flex; flex-direction: column; min-width: 0; } .bt b { font-size: 17px; } .bt small { color: var(--muted); font-size: 13px; }
  .zones { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--gap); margin-top: var(--gap); }
  .zone { background: var(--tile); border-radius: var(--r-tile); padding: 16px; display: flex; flex-direction: column; gap: 6px; }
  .zone.heat { background: linear-gradient(160deg, #5a2c0e, var(--tile) 70%); }
  .zone.off { opacity: .6; }
  .zh { display: flex; align-items: center; gap: 8px; } .zh b { font-size: 18px; flex: 1; }
  .badge { font-size: 11px; padding: 3px 8px; border-radius: 8px; background: rgba(255,214,10,.2); color: #ffd60a; }
  .ib, .rb { all: unset; cursor: pointer; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); }
  .temp { font-size: 56px; font-weight: 300; line-height: 1; text-align: center; margin: 6px 0; } .temp span { font-size: 28px; vertical-align: top; }
  .tgt { display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 16px; } .tgt b { font-size: 22px; }
  .why { display: flex; align-items: center; gap: 6px; justify-content: center; color: var(--muted); font-size: 13px; text-align: center; }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .acts button { all: unset; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 12px; background: var(--pw); font-size: 13px; }
  .add { all: unset; cursor: pointer; border: 2px dashed var(--line); border-radius: var(--r-tile); min-height: 160px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 8px; color: var(--muted); }
</style>
