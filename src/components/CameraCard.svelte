<script>
  // Камера на головній: знімок оновлюється кожні 5 с; тап — живе відео (MJPEG) на весь екран.
  import Icon from './Icon.svelte';
  import { ha } from '../lib/ha.svelte.js';

  let { entity, name = null } = $props();
  const st = $derived(ha.states[entity]);
  let tick = $state(0);
  let full = $state(false);
  $effect(() => { const t = setInterval(() => tick++, 5000); return () => clearInterval(t); });

  // entity_picture містить токен доступу; працює з того ж origin, що й HA (через Ingress)
  const token = $derived(new URL(st?.attributes?.entity_picture || '/x?token=', location.origin).searchParams.get('token'));
  const snap = $derived(st ? `/api/camera_proxy/${entity}?token=${token}&t=${tick}` : '');
  const live = $derived(st ? `/api/camera_proxy_stream/${entity}?token=${token}` : '');
</script>

{#if st}
  <button class="cam" onclick={() => (full = true)}>
    <img src={snap} alt={name || st.attributes.friendly_name} loading="lazy" />
    <span class="lbl"><Icon name="mdi:cctv" size={18} />{name || st.attributes.friendly_name}<i class="dot"></i></span>
  </button>
  {#if full}
    <div class="full" role="dialog" aria-modal="true">
      <img src={live} alt="наживо" />
      <button class="x" onclick={() => (full = false)} aria-label="Закрити"><Icon name="mdi:close" /></button>
    </div>
  {/if}
{/if}

<style>
  .cam { all: unset; cursor: pointer; display: block; position: relative; border-radius: var(--r-tile); overflow: hidden; background: #000; aspect-ratio: 16 / 9; width: 100%; }
  .cam img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .lbl { position: absolute; left: 10px; bottom: 10px; display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 12px;
    background: rgba(0,0,0,.55); backdrop-filter: blur(8px); color: #fff; font-size: 14px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #ff453a; animation: blink 1.6s infinite; }
  @keyframes blink { 50% { opacity: .3; } }
  .full { position: fixed; inset: 0; z-index: 60; background: #000; display: grid; place-items: center; }
  .full img { max-width: 100%; max-height: 100%; }
  .x { all: unset; cursor: pointer; position: absolute; top: calc(14px + env(safe-area-inset-top)); right: 14px; width: 44px; height: 44px; border-radius: 50%;
    background: rgba(255,255,255,.2); color: #fff; display: grid; place-items: center; }
</style>
