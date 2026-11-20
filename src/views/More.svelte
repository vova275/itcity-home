<script>
  // Ще: керування «Вибраним» (порядок, видалення), тема, про застосунок.
  import Icon from '../components/Icon.svelte';
  import { ha, settings, saveSettings } from '../lib/ha.svelte.js';
  import { friendly } from '../lib/model.js';
  import { iconFor } from '../lib/icons.js';

  function move(i, d) {
    const f = [...settings.favorites];
    const j = i + d; if (j < 0 || j >= f.length) return;
    [f[i], f[j]] = [f[j], f[i]];
    settings.favorites = f; saveSettings();
  }
  function remove(i) { settings.favorites = settings.favorites.filter((_, k) => k !== i); saveSettings(); }
  function setTheme(t) { settings.theme = t; saveSettings(); }
</script>

<h1>Ще</h1>

<h2>Вибрані пристрої</h2>
<div class="list">
  {#each settings.favorites as e, i (e)}
    <div class="item">
      <Icon name={iconFor(ha.states[e])} size={22} />
      <span class="n">{friendly(ha, e)}</span>
      <button onclick={() => move(i, -1)} aria-label="вгору"><Icon name="mdi:chevron-up" /></button>
      <button onclick={() => move(i, 1)} aria-label="вниз"><Icon name="mdi:chevron-down" /></button>
      <button onclick={() => remove(i)} aria-label="прибрати"><Icon name="mdi:close" /></button>
    </div>
  {:else}
    <p class="muted">Порожньо. Додавай пристрої сердечком ♥ у їхній картці.</p>
  {/each}
</div>

<h2>Тема</h2>
<div class="seg">
  {#each [['auto', 'Авто'], ['dark', 'Темна'], ['light', 'Світла']] as [t, l]}
    <button class:sel={(settings.theme || 'auto') === t} onclick={() => setTheme(t)}>{l}</button>
  {/each}
</div>

<h2>Про застосунок</h2>
<p class="muted">ITCITY Home 0.1 · Home Assistant {ha.version} · {Object.keys(ha.states).length} сутностей, {ha.areas.length} кімнат</p>
<p class="muted">Код: github.com/vova275/itcity-home</p>

<style>
  h1 { font-size: 34px; font-weight: 800; margin: 6px 2px 16px; }
  h2 { font-size: 20px; font-weight: 800; margin: 22px 2px 10px; }
  .muted { color: var(--muted); }
  .list { display: flex; flex-direction: column; gap: 6px; }
  .item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--tile); border-radius: 16px; }
  .n { flex: 1; }
  .item button { all: unset; cursor: pointer; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); }
  .seg { display: grid; grid-template-columns: repeat(3, 1fr); background: var(--tile); border-radius: 16px; padding: 4px; }
  .seg button { all: unset; cursor: pointer; text-align: center; padding: 10px; border-radius: 12px; }
  .seg button.sel { background: var(--accent); color: #fff; }
</style>
