<script>
  // Вікно-список для зведень на головній: «Освітлення», «Клімат», «Батарейки» — плитки відповідних пристроїв.
  import Icon from './Icon.svelte';
  import Tile from './Tile.svelte';
  import { ha } from '../lib/ha.svelte.js';
  import { buildDevices, deviceForEntity } from '../lib/model.js';
  import { ui, back } from '../lib/ui.svelte.js';

  const devices = $derived(buildDevices(ha));
  const list = $derived(ui.list ? ui.list.entities().map((e) => ({ e, d: deviceForEntity(devices, e) })) : []);
  // групування по кімнатах (поверх → кімната, як у «Кімнатах»); спершу — ті, що потребують уваги
  const low = (e) => { const s = ha.states[e]?.state; return s === 'unavailable' || (isFinite(Number(s)) && Number(s) < 25); };
  // ПК: вікно під кнопкою, з якої відкрили (якщо вміщається), інакше — по центру зверху
  const pop = $derived.by(() => {
    const r = ui.list?.anchor;
    if (typeof window === 'undefined' || !matchMedia('(min-width: 900px) and (hover: hover)').matches) return null;
    const W = Math.min(620, innerWidth - 32);
    const top = r ? Math.max(12, Math.min(r.bottom + 8, innerHeight - 320)) : 80;
    const left = r ? Math.max(16, Math.min(r.left + r.width / 2 - W / 2, innerWidth - W - 16)) : (innerWidth - W) / 2;
    const arrow = r ? Math.max(24, Math.min(W - 24, r.left + r.width / 2 - left)) : null;
    return `--top:${top}px;--left:${left}px;--w:${W}px;--arrow:${arrow ?? -100}px`;
  });
  const groups = $derived.by(() => {
    if (!ui.list?.group) return null;
    const floors = [...ha.floors].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    const fIdx = (fid) => { const i = floors.findIndex((f) => f.floor_id === fid); return i < 0 ? 99 : i; };
    const areaOf = (x) => x.d?.area_id || ha.entities.find((r) => r.entity_id === x.e)?.area_id || null;
    const out = [];
    const attn = list.filter((x) => low(x.e));
    if (attn.length) out.push({ key: '!', title: 'Потребують уваги', sub: 'менше 25 % або немає зв\u2019язку', icon: 'mdi:battery-alert-variant-outline', warn: true, items: attn });
    const by = new Map();
    for (const x of list) { const a = areaOf(x); if (!by.has(a)) by.set(a, []); by.get(a).push(x); }
    const areas = [...by.keys()].map((aid) => ({ aid, a: ha.areas.find((r) => r.area_id === aid) }))
      .sort((p, q) => (fIdx(p.a?.floor_id) - fIdx(q.a?.floor_id)) || (p.a ? 0 : 1) - (q.a ? 0 : 1) || (p.a?.name || '').localeCompare(q.a?.name || '', 'uk'));
    for (const { aid, a } of areas) {
      const fl = floors.find((f) => f.floor_id === a?.floor_id);
      out.push({ key: aid || '-', title: a?.name || 'Без кімнати', sub: fl?.name || '', icon: a?.icon || 'mdi:floor-plan', items: by.get(aid) });
    }
    return out;
  });
</script>

{#if ui.list}
  <div class="backdrop" onclick={back} role="presentation"></div>
  <div class="sheet" class:pop={!!pop} style={pop || ''} role="dialog" aria-modal="true">
    <header>
      <b>{ui.list.title}</b>
      <button onclick={back} aria-label="Закрити"><Icon name="mdi:close" /></button>
    </header>
    <div class="body">
      {#if groups}
        {#each groups as g (g.key)}
          <h3 class:warn={g.warn}><Icon name={g.icon} size={18} />{g.title}{#if g.sub}<small>{g.sub}</small>{/if}<em>{g.items.length}</em></h3>
          <div class="tiles">{#each g.items as { e, d } (e)}<Tile device={d} show={ui.list.show ? e : null} />{/each}</div>
        {/each}
      {:else if list.length}
        <div class="tiles">{#each list as { e, d } (e)}<Tile device={d} show={ui.list.show ? e : null} />{/each}</div>
      {:else}<p class="muted">{ui.list.empty || 'Нічого немає'}</p>{/if}
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 45; }
  .sheet { position: fixed; z-index: 46; left: 50%; bottom: 0; transform: translateX(-50%); width: min(720px, 100vw); max-height: 85vh;
    background: var(--bg-sheet); border-radius: 28px 28px 0 0; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }
  .sheet.pop { top: var(--top); left: var(--left); bottom: auto; transform: none; width: var(--w); max-height: calc(100vh - var(--top) - 16px);
    border-radius: 22px; box-shadow: 0 18px 50px rgba(0,0,0,.55); animation: drop .16s ease-out; }
  .sheet.pop::before { content: ''; position: absolute; top: -7px; left: calc(var(--arrow) - 7px); width: 14px; height: 14px; background: var(--bg-sheet); transform: rotate(45deg); border-radius: 3px; }
  .sheet.pop .tiles { grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); }
  @keyframes drop { from { opacity: 0; transform: translateY(-6px); } }
  header { display: flex; align-items: center; justify-content: space-between; padding: 18px 18px 8px; font-size: 20px; }
  header button { all: unset; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); }
  .body { overflow-y: auto; padding: 8px 16px 20px; }
  .tiles { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: var(--gap); }
  .muted { color: var(--muted); }
  h3 { display: flex; align-items: center; gap: 8px; margin: 18px 2px 10px; font-size: 16px; }
  h3:first-child { margin-top: 4px; }
  h3 small { color: var(--muted); font-weight: 400; font-size: 12px; }
  h3 em { margin-left: auto; font-style: normal; color: var(--muted); font-size: 13px; font-weight: 500; }
  h3.warn { color: #ff453a; }
</style>
