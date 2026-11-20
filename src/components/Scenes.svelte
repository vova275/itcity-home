<script>
  // «Сценарії» на головній: швидкі кнопки (скрипти, сцени, автоматизації) + перехід до всіх автоматизацій.
  import Icon from './Icon.svelte';
  import EntityPicker from './EntityPicker.svelte';
  import { ha, settings, saveSettings, callService } from '../lib/ha.svelte.js';
  import { setView } from '../lib/ui.svelte.js';
  import { domainOf, friendly } from '../lib/model.js';

  const SYSTEM = ['script.spovishchennia'];
  const list = $derived((settings.scenes ?? Object.keys(ha.states).filter((e) => (e.startsWith('script.') || e.startsWith('scene.')) && !SYSTEM.includes(e)))
    .filter((e) => ha.states[e]));
  let edit = $state(false);
  let flash = $state(null);

  async function run(e) {
    const d = domainOf(e);
    if (d === 'script') await callService('script', 'turn_on', {}, { entity_id: e });
    else if (d === 'scene') await callService('scene', 'turn_on', {}, { entity_id: e });
    else if (d === 'automation') await callService('automation', 'trigger', {}, { entity_id: e });
    flash = e; setTimeout(() => (flash = null), 1200);
  }
  function setList(arr) { settings.scenes = arr; saveSettings(); }
  const icon = (e) => ha.states[e]?.attributes?.icon || (domainOf(e) === 'scene' ? 'mdi:palette' : domainOf(e) === 'automation' ? 'mdi:robot' : 'mdi:play-circle');
  const filter = (e) => ['script', 'scene', 'automation'].includes(domainOf(e)) && !list.includes(e);
</script>

<div class="hdr">
  <h2>Сценарії</h2>
  <div class="btns">
    <button class="eb" onclick={() => setView('automations')}><Icon name="mdi:robot-outline" size={18} />Усі</button>
    <button class="eb" class:on={edit} onclick={() => (edit = !edit)}><Icon name={edit ? 'mdi:check' : 'mdi:pencil'} size={18} /></button>
  </div>
</div>

<div class="scenes">
  {#each list as e (e)}
    <button class="sc" class:ok={flash === e} onclick={() => !edit && run(e)}>
      <span class="i"><Icon name={flash === e ? 'mdi:check' : icon(e)} size={24} /></span>
      <span class="n">{friendly(ha, e)}</span>
      {#if edit}<span class="x" role="button" tabindex="0" onclick={() => setList(list.filter((x) => x !== e))} onkeydown={() => {}}><Icon name="mdi:close" size={16} /></span>{/if}
    </button>
  {:else}
    <p class="muted">Сценаріїв ще немає. Натисни ✏ і додай скрипт, сцену чи автоматизацію — запускатимуться одним дотиком.</p>
  {/each}
</div>
{#if edit}
  <div class="picker"><EntityPicker value={null} {filter} placeholder="Додати сценарій (скрипт / сцену / автоматизацію)" onchange={(v) => v && setList([...list, v])} /></div>
{/if}

<style>
  .hdr { display: flex; align-items: center; justify-content: space-between; margin: 26px 2px 12px; }
  h2 { font-size: 24px; margin: 0; font-weight: 800; }
  .btns { display: flex; gap: 8px; }
  .eb { all: unset; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 12px; background: var(--tile); font-size: 14px; }
  .eb.on { background: var(--accent); color: #fff; }
  .scenes { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--gap); }
  .sc { all: unset; cursor: pointer; position: relative; display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 18px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 30%, var(--tile)), var(--tile)); min-height: 56px; }
  .sc:active { transform: scale(.97); }
  .sc.ok { background: color-mix(in srgb, #30d158 35%, var(--tile)); }
  .i { width: 38px; height: 38px; border-radius: 12px; background: var(--pw); display: grid; place-items: center; flex: none; }
  .n { font-size: 14px; font-weight: 600; line-height: 1.2; }
  .x { position: absolute; top: -6px; right: -6px; width: 24px; height: 24px; border-radius: 50%; background: var(--danger); color: #fff; display: grid; place-items: center; }
  .muted { color: var(--muted); grid-column: 1 / -1; }
  .picker { margin-top: 10px; }
</style>
