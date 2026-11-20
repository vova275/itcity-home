<script>
  // Усі автоматизації (аналог Flow у Homey): пошук, увімк./вимк., запуск, коли спрацювала.
  import Icon from '../components/Icon.svelte';
  import { ha, callService } from '../lib/ha.svelte.js';
  import { timeAgo } from '../lib/format.js';

  let q = $state('');
  let only = $state('all');
  const list = $derived(Object.values(ha.states).filter((s) => s.entity_id.startsWith('automation.'))
    .filter((s) => only === 'all' || (only === 'on' ? s.state === 'on' : s.state !== 'on'))
    .filter((s) => !q || (s.attributes.friendly_name || '').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.attributes.friendly_name || '').localeCompare(b.attributes.friendly_name || '', 'uk')));
  // групи за префіксом до «:» («Світло: …», «Котел: …»)
  const groups = $derived.by(() => {
    const m = new Map();
    for (const s of list) {
      const n = s.attributes.friendly_name || s.entity_id;
      const g = n.includes(':') ? n.split(':')[0].trim() : 'Інше';
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(s);
    }
    return [...m];
  });
  const short = (n) => (n.includes(':') ? n.split(':').slice(1).join(':').trim() : n);
</script>

<h1>Сценарії</h1>
<input class="search" placeholder="Пошук…" bind:value={q} />
<div class="seg">
  {#each [['all', 'Усі'], ['on', 'Увімкнені'], ['off', 'Вимкнені']] as [k, l]}<button class:sel={only === k} onclick={() => (only = k)}>{l}</button>{/each}
</div>

{#each groups as [g, items]}
  <h2>{g}</h2>
  <div class="list">
    {#each items as s (s.entity_id)}
      <div class="item" class:off={s.state !== 'on'}>
        <Icon name="mdi:robot" size={22} />
        <span class="n">{short(s.attributes.friendly_name || s.entity_id)}
          <small>{s.attributes.last_triggered ? 'спрацювала ' + timeAgo(s.attributes.last_triggered) : 'ще не спрацьовувала'}</small></span>
        <button class="run" title="Запустити" onclick={() => callService('automation', 'trigger', {}, { entity_id: s.entity_id })}><Icon name="mdi:play" size={20} /></button>
        <button class="sw" class:on={s.state === 'on'} aria-label="увімк./вимк." onclick={() => callService('automation', 'toggle', {}, { entity_id: s.entity_id })}><i></i></button>
      </div>
    {/each}
  </div>
{/each}

<style>
  h1 { font-size: 34px; font-weight: 800; margin: 6px 2px 14px; }
  h2 { font-size: 18px; font-weight: 800; margin: 20px 2px 8px; color: var(--muted); }
  .search { width: 100%; padding: 12px 14px; border-radius: 14px; border: 0; background: var(--tile); color: var(--text); font-size: 15px; }
  .seg { display: grid; grid-template-columns: repeat(3, 1fr); background: var(--tile); border-radius: 14px; padding: 4px; margin-top: 10px; }
  .seg button { all: unset; cursor: pointer; text-align: center; padding: 8px; border-radius: 10px; font-size: 14px; }
  .seg button.sel { background: var(--accent); color: #fff; }
  .list { display: flex; flex-direction: column; gap: 6px; }
  .item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--tile); border-radius: 16px; }
  .item.off { opacity: .6; }
  .n { flex: 1; font-size: 15px; display: flex; flex-direction: column; min-width: 0; } .n small { font-size: 12px; color: var(--muted); }
  .run { all: unset; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); flex: none; }
  .sw { all: unset; cursor: pointer; width: 46px; height: 28px; border-radius: 14px; background: var(--pw); position: relative; flex: none; }
  .sw i { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: left .2s; }
  .sw.on { background: var(--accent); } .sw.on i { left: 21px; }
</style>
