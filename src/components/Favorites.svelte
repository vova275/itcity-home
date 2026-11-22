<script>
  // «Вибрані пристрої» з режимом редагування: перетягування (миша і палець), прибрати ×, додати +.
  import Tile from './Tile.svelte';
  import Icon from './Icon.svelte';
  import EntityPicker from './EntityPicker.svelte';
  import { ha, settings, saveSettings } from '../lib/ha.svelte.js';
  import { buildDevices, deviceForEntity, domainOf } from '../lib/model.js';
  import { setView } from '../lib/ui.svelte.js';

  const devices = $derived(buildDevices(ha));
  // один пристрій — одна плитка: друга сутність того ж пристрою (напр. витяжка Prana, другий датчик котла) не дублюється
  const favs = $derived.by(() => {
    const seen = new Set();
    return settings.favorites.filter((e) => {
      if (!ha.states[e]) return false;
      const d = devices.find((x) => x.entities.includes(e));
      const key = d?.device?.id || e;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  });
  let edit = $state(false);
  let drag = $state(null);          // { id, x, y, w, h } — що тягнемо і де палець
  let adding = $state(null);

  const HIDE = new Set(['update', 'event', 'tts', 'stt', 'conversation', 'notify', 'todo', 'image']);
  const favDevs = $derived(new Set(favs.map((e) => devices.find((x) => x.entities.includes(e))?.device?.id).filter(Boolean)));
  const addFilter = (e) => !HIDE.has(domainOf(e)) && !settings.favorites.includes(e) && !favDevs.has(devices.find((x) => x.entities.includes(e))?.device?.id);

  function onDown(ev, id) {
    if (!edit) return;
    ev.preventDefault();
    const r = ev.currentTarget.getBoundingClientRect();
    drag = { id, x: ev.clientX, y: ev.clientY, dx: ev.clientX - r.left, dy: ev.clientY - r.top, w: r.width, h: r.height };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  }
  function onMove(ev) {
    if (!drag) return;
    drag.x = ev.clientX; drag.y = ev.clientY;
    const el = document.elementsFromPoint(ev.clientX, ev.clientY).find((x) => x.dataset?.fav && x.dataset.fav !== drag.id);
    if (!el) return;
    const list = [...settings.favorites];
    const from = list.indexOf(drag.id), to = list.indexOf(el.dataset.fav);
    if (from < 0 || to < 0) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    settings.favorites = list;
  }
  function onUp() { if (drag) { drag = null; saveSettings(); } }
  function remove(id) { settings.favorites = settings.favorites.filter((x) => x !== id); saveSettings(); }
  function add(v) { if (v) { settings.favorites = [...settings.favorites, v]; saveSettings(); adding = null; } }
</script>

<div class="hdr">
  <h2>Вибрані пристрої</h2>
  <button class="eb" class:on={edit} onclick={() => { edit = !edit; adding = null; }}>
    <Icon name={edit ? 'mdi:check' : 'mdi:pencil'} size={18} />{edit ? 'Готово' : 'Змінити'}
  </button>
</div>
{#if edit}<p class="hint">Перетягуй плитки, щоб змінити порядок. × — прибрати, + — додати.</p>{/if}

{#if favs.length || edit}
  <div class="tiles" class:edit>
    {#each favs as id (id)}
      <div class="cell" class:dragging={drag?.id === id} data-fav={id}
           onpointerdown={(e) => onDown(e, id)} onpointermove={onMove} onpointerup={onUp} onpointercancel={onUp} role="listitem">
        <Tile device={deviceForEntity(devices, id)} />
        {#if edit}<button class="x" onpointerdown={(e) => e.stopPropagation()} onclick={() => remove(id)} aria-label="Прибрати"><Icon name="mdi:close" size={16} /></button>{/if}
      </div>
    {/each}
    {#if edit}
      <button class="addt" onclick={() => (adding = adding ? null : true)}><Icon name="mdi:plus" size={30} />Додати</button>
    {/if}
  </div>
  {#if edit && adding}
    <div class="picker"><EntityPicker value={null} filter={addFilter} placeholder="Вибери пристрій або датчик" onchange={add} /></div>
  {/if}
{:else}
  <div class="empty">
    <Icon name="mdi:heart-outline" size={32} />
    <p>Натисни «Змінити» → «Додати», або ♥ у картці будь-якого пристрою.</p>
    <button onclick={() => setView('rooms')}>До кімнат</button>
  </div>
{/if}

{#if drag}
  <div class="ghost" style="left:{drag.x - drag.dx}px; top:{drag.y - drag.dy}px; width:{drag.w}px; height:{drag.h}px">
    <Tile device={deviceForEntity(devices, drag.id)} />
  </div>
{/if}

<style>
  .hdr { display: flex; align-items: center; justify-content: space-between; margin: 26px 2px 12px; }
  h2 { font-size: 24px; margin: 0; font-weight: 800; }
  .eb { all: unset; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 12px; background: var(--tile); font-size: 14px; }
  .eb.on { background: var(--accent); color: #fff; }
  .hint { color: var(--muted); font-size: 13px; margin: -4px 2px 10px; }
  .tiles { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: var(--gap); }
  .cell { position: relative; touch-action: auto; min-width: 0; }
  .edit .cell { touch-action: none; cursor: grab; animation: wiggle .35s ease-in-out infinite alternate; }
  .edit .cell :global(.tile) { pointer-events: none; }
  .edit .cell:nth-child(2n) { animation-delay: .17s; }
  .cell.dragging { opacity: .25; animation: none; }
  @keyframes wiggle { from { transform: rotate(-.8deg); } to { transform: rotate(.8deg); } }
  .x { all: unset; cursor: pointer; position: absolute; top: -6px; left: -6px; width: 26px; height: 26px; border-radius: 50%; background: var(--danger); color: #fff;
    display: grid; place-items: center; z-index: 2; box-shadow: 0 2px 6px rgba(0,0,0,.4); }
  .addt { all: unset; cursor: pointer; border: 2px dashed var(--line); border-radius: var(--r-tile); min-height: 136px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 6px; color: var(--muted); }
  .picker { margin-top: 10px; }
  .ghost { position: fixed; z-index: 70; pointer-events: none; transform: scale(1.06); filter: drop-shadow(0 12px 24px rgba(0,0,0,.5)); }
  .empty { background: var(--tile); border-radius: var(--r-tile); padding: 24px; text-align: center; color: var(--muted); }
  .empty button { all: unset; cursor: pointer; margin-top: 8px; padding: 10px 18px; border-radius: 14px; background: var(--accent); color: #fff; }
</style>
