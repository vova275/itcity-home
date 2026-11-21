<script>
  // Камера наживо: HLS-потік від HA (camera/stream) + hls.js (Safari/iOS — нативно); тап — на весь екран.
  // Без знімків ISAPI: Hikvision віддає «Device Busy» при частих запитах.
  import Icon from './Icon.svelte';
  import Hls from 'hls.js';
  import { ha, send } from '../lib/ha.svelte.js';
  import { pushLayer, back } from '../lib/ui.svelte.js';

  let { entity, name = null } = $props();
  const st = $derived(ha.states[entity]);
  let full = $state(false);
  let error = $state('');
  let video = $state();
  let bigVideo = $state();

  // повертає функцію очищення
  function play(el) {
    let h = null, dead = false, timer;
    const start = async () => {
      try {
        const r = await send({ type: 'camera/stream', entity_id: entity, format: 'hls' });
        if (dead) return;
        if (!Hls.isSupported() && el.canPlayType('application/vnd.apple.mpegurl')) { el.src = r.url; error = ''; return; }
        if (!Hls.isSupported()) { error = 'Браузер не підтримує відео'; return; }
        h = new Hls({ liveSyncDurationCount: 2 });
        h.loadSource(r.url); h.attachMedia(el);
        h.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) { h.destroy(); h = null; timer = setTimeout(start, 4000); } });
        error = '';
      } catch { error = 'Камера недоступна'; timer = setTimeout(start, 10000); }
    };
    start();
    return () => { dead = true; clearTimeout(timer); h?.destroy(); el.removeAttribute('src'); };
  }
  $effect(() => { if (video && ha.connected) return play(video); });
  $effect(() => { if (full && bigVideo) return play(bigVideo); });
</script>

{#if st}
  <button class="cam" onclick={() => { full = true; pushLayer(() => (full = false)); }}>
    <video bind:this={video} muted autoplay playsinline></video>
    {#if error}<span class="err">{error}</span>{/if}
    <span class="lbl"><Icon name="mdi:cctv" size={18} />{name || st.attributes.friendly_name?.replace(/^IP CAMERA\s*/, '') || 'Камера'}<i class="dot"></i></span>
  </button>
  {#if full}
    <div class="full" role="dialog" aria-modal="true">
      <video bind:this={bigVideo} muted autoplay playsinline controls></video>
      <button class="x" onclick={back} aria-label="Закрити"><Icon name="mdi:close" /></button>
    </div>
  {/if}
{/if}

<style>
  .cam { all: unset; cursor: pointer; display: block; position: relative; border-radius: var(--r-tile); overflow: hidden; background: #000; aspect-ratio: 16 / 9; width: 100%; }
  .cam video { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
  .err { position: absolute; inset: 0; display: grid; place-items: center; color: #aaa; font-size: 14px; }
  .lbl { position: absolute; left: 10px; bottom: 10px; display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 12px;
    background: rgba(0,0,0,.55); backdrop-filter: blur(8px); color: #fff; font-size: 14px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #ff453a; animation: blink 1.6s infinite; }
  @keyframes blink { 50% { opacity: .3; } }
  .full { position: fixed; inset: 0; z-index: 60; background: #000; display: grid; place-items: center; }
  .full video { max-width: 100%; max-height: 100%; width: 100%; }
  .x { all: unset; cursor: pointer; position: absolute; top: calc(14px + env(safe-area-inset-top)); right: 14px; width: 44px; height: 44px; border-radius: 50%;
    background: rgba(255,255,255,.2); color: #fff; display: grid; place-items: center; }
</style>
