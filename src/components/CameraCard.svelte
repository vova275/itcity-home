<script>
  // Камера: на картці — кадр, оновлюється раз на 30 с (швидко і без навантаження);
  // тап — живе відео HLS (camera/stream + hls.js, на iOS нативно) на весь екран.
  import Icon from './Icon.svelte';
  import Hls from 'hls.js';
  import { ha, send, whenConnected } from '../lib/ha.svelte.js';
  import { pushLayer, back } from '../lib/ui.svelte.js';

  let { entity, name = null } = $props();
  const st = $derived(ha.states[entity]);
  let full = $state(false);
  let error = $state('');
  let bigVideo = $state();

  // повертає функцію очищення
  function play(el) {
    let h = null, dead = false, timer;
    const start = async () => {
      try {
        await whenConnected();
        const r = await send({ type: 'camera/stream', entity_id: entity, format: 'hls' });
        if (dead) return;
        if (!Hls.isSupported() && el.canPlayType('application/vnd.apple.mpegurl')) { el.src = r.url; error = ''; return; }
        if (!Hls.isSupported()) { error = 'Браузер не підтримує відео'; return; }
        h = new Hls({ liveSyncDurationCount: 2 });
        h.loadSource(r.url); h.attachMedia(el);
        h.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) { h.destroy(); h = null; timer = setTimeout(start, 4000); } });
        error = '';
      } catch { if (dead) return; error = 'Камера недоступна, пробую ще…'; timer = setTimeout(start, 3000); }
    };
    // повернулись у застосунок з відкритою камерою — відео після сну стоїть, запускаємо заново
    let hiddenAt = 0;
    const vis = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > 5000) { clearTimeout(timer); h?.destroy(); h = null; el.removeAttribute('src'); start(); }
    };
    document.addEventListener('visibilitychange', vis);
    start();
    return () => { dead = true; document.removeEventListener('visibilitychange', vis); clearTimeout(timer); h?.destroy(); el.removeAttribute('src'); };
  }
  let tick = $state(0);
  let loaded = $state(false);
  $effect(() => {
    const t = setInterval(() => { if (!document.hidden) tick++; }, 30000);
    const v = () => { if (!document.hidden) tick++; };   // свіжий кадр одразу після повернення в застосунок
    document.addEventListener('visibilitychange', v);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); };
  });
  let frame = $state('');
  $effect(() => {
    tick;
    fetch(`api/camera/refresh/${entity}`).then((r) => r.json()).then((d) => { if (d.url) frame = d.url; }).catch(() => {});
  });
  $effect(() => { if (full && bigVideo) return play(bigVideo); });

  // закрити: як жест «назад»; якщо історія з якоїсь причини не спрацювала — закриваємо примусово
  function close() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    back();
    setTimeout(() => { full = false; }, 400);
  }
  $effect(() => {
    if (!full) return;
    const k = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) close(); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });
  let box = $state();

  // ---- збільшення: щипок двома пальцями, перетягування одним, подвійний тап; на ПК — колесо миші ----
  let z = $state({ s: 1, x: 0, y: 0 });
  const pts = new Map();
  let g = null, lastTap = 0;
  $effect(() => { if (!full) z = { s: 1, x: 0, y: 0 }; });
  const rel = (e) => { const r = box.getBoundingClientRect(); return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2, w: r.width, h: r.height }; };
  function clampZ(s, x, y, w, h) {
    s = Math.min(6, Math.max(1, s));
    // межі рахуємо за реальним кадром (на телефоні вертикально відео 16:9 займає лише смугу посередині)
    const ar = bigVideo?.videoWidth ? bigVideo.videoWidth / bigVideo.videoHeight : 16 / 9;
    const cw = Math.min(w, h * ar), ch = cw / ar;
    const mx = Math.max(0, (cw * s - w) / 2), my = Math.max(0, (ch * s - h) / 2);
    return { s, x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  }
  function zStart() {
    const a = [...pts.values()];
    if (a.length >= 2) {
      const c = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
      g = { pinch: true, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, c, z: { ...z } };
    } else if (a.length === 1) g = { pinch: false, p: a[0], z: { ...z } };
    else g = null;
  }
  function zDown(e) {
    if (e.target.closest('.bar')) return;
    const p = rel(e); pts.set(e.pointerId, p);
    try { box.setPointerCapture?.(e.pointerId); } catch {}
    if (pts.size === 1 && e.pointerType !== 'mouse') {
      const t = Date.now();
      if (t - lastTap < 300) {   // подвійний тап: 2,5× у точці дотику / назад
        z = z.s > 1 ? { s: 1, x: 0, y: 0 } : clampZ(2.5, -p.x * 1.5, -p.y * 1.5, p.w, p.h);
        lastTap = 0; pts.clear(); g = null; return;
      }
      lastTap = t;
    }
    zStart();
  }
  function zMove(e) {
    if (!pts.has(e.pointerId) || !g) return;
    const p = rel(e); pts.set(e.pointerId, p);
    const a = [...pts.values()];
    if (g.pinch && a.length >= 2) {
      const c = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
      const s = Math.min(6, Math.max(1, g.z.s * Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) / g.d));
      const k = s / g.z.s;
      z = clampZ(s, c.x - (g.c.x - g.z.x) * k, c.y - (g.c.y - g.z.y) * k, p.w, p.h);
    } else if (!g.pinch && z.s > 1) {
      z = clampZ(z.s, g.z.x + p.x - g.p.x, g.z.y + p.y - g.p.y, p.w, p.h);
    }
  }
  function zUp(e) { pts.delete(e.pointerId); zStart(); }
  function zWheel(e) {
    e.preventDefault();
    const p = rel(e), s = z.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), k = Math.min(6, Math.max(1, s)) / z.s;
    z = clampZ(s, p.x - (p.x - z.x) * k, p.y - (p.y - z.y) * k, p.w, p.h);
  }

  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : box?.requestFullscreen?.())?.catch?.(() => {});
</script>

{#if st}
  <button class="cam" onclick={() => { full = true; pushLayer(() => (full = false)); }}>
    {#if frame}<img src={frame} alt="" onload={() => (loaded = true)} />{/if}
    {#if !loaded}<span class="err">Завантаження кадру…</span>{/if}
    <span class="play"><Icon name="mdi:play" size={34} /></span>
    <span class="lbl"><Icon name="mdi:cctv" size={18} />{name || st.attributes.friendly_name?.replace(/^IP CAMERA\s*/, '') || 'Камера'}</span>
  </button>
  {#if full}
    <div class="full" role="dialog" aria-modal="true" onclick={(e) => { if (e.target === e.currentTarget) close(); }} onkeydown={() => {}} tabindex="-1">
      <div class="box" bind:this={box} onpointerdown={zDown} onpointermove={zMove} onpointerup={zUp} onpointercancel={zUp} onwheel={zWheel}>
        <div class="zoom" style:transform={`translate(${z.x}px, ${z.y}px) scale(${z.s})`}>
          {#if frame}<img class="poster" src={frame} alt="" draggable="false" />{/if}
          <video bind:this={bigVideo} muted autoplay playsinline disablepictureinpicture></video>
        </div>
        {#if z.s > 1}<button class="zreset" onclick={() => (z = { s: 1, x: 0, y: 0 })}>{z.s.toFixed(1)}× · скинути</button>{/if}
        {#if error}<span class="err">{error}</span>{/if}
        <div class="bar">
          <span class="ttl"><Icon name="mdi:cctv" size={18} />{name || st.attributes.friendly_name?.replace(/^IP CAMERA\s*/, '') || 'Камера'}</span>
          <button class="fs" onclick={toggleFs} aria-label="На весь екран" title="На весь екран / зменшити"><Icon name="mdi:fullscreen" /></button>
          <button class="x" onclick={close} aria-label="Закрити" title="Закрити (Esc)"><Icon name="mdi:close" /></button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .cam { all: unset; cursor: pointer; display: block; position: relative; border-radius: var(--r-tile); overflow: hidden; background: #000; aspect-ratio: 16 / 9; width: 100%; }
  .cam img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
  .play { position: absolute; right: 10px; bottom: 10px; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center;
    background: rgba(0,0,0,.5); backdrop-filter: blur(8px); color: #fff; }
  .poster { position: absolute; max-width: 100%; max-height: 100%; width: 100%; object-fit: contain; }
  .err { position: absolute; inset: 0; display: grid; place-items: center; color: #aaa; font-size: 14px; }
  .lbl { position: absolute; left: 10px; bottom: 10px; display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 12px;
    background: rgba(0,0,0,.55); backdrop-filter: blur(8px); color: #fff; font-size: 14px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #ff453a; animation: blink 1.6s infinite; }
  @keyframes blink { 50% { opacity: .3; } }
  .full { position: fixed; inset: 0; z-index: 60; background: #000; display: grid; place-items: center; }
  .box { position: relative; width: 100%; height: 100%; display: grid; place-items: center; background: #000; }
  .box { touch-action: none; overflow: hidden; user-select: none; -webkit-user-select: none; }
  .zoom { position: absolute; inset: 0; display: grid; place-items: center; transform-origin: center; will-change: transform; }
  .zoom video { position: relative; max-width: 100%; max-height: 100%; width: 100%; pointer-events: none; }
  .zoom .poster { pointer-events: none; }
  .zreset { all: unset; cursor: pointer; position: absolute; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom)); transform: translateX(-50%);
    padding: 8px 14px; border-radius: 999px; background: rgba(40,40,40,.8); color: #fff; font-size: 13px; }
  .bar { position: absolute; top: calc(10px + env(safe-area-inset-top)); left: 10px; right: 10px; display: flex; align-items: center; gap: 8px; }
  .ttl { margin-right: auto; display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 12px; background: rgba(0,0,0,.55); color: #fff; font-size: 14px; }
  .bar button { all: unset; cursor: pointer; width: 44px; height: 44px; border-radius: 50%; background: rgba(40,40,40,.75); color: #fff; display: grid; place-items: center; }
  .bar button:hover { background: rgba(80,80,80,.9); }
  .fs { display: none !important; }
  /* ПК: вікно по центру, навколо — затемнення (клік повз вікно закриває) */
  @media (min-width: 900px) and (hover: hover) {
    .full { background: rgba(0,0,0,.7); backdrop-filter: blur(4px); cursor: zoom-out; }
    .box { width: min(1200px, 88vw); height: auto; aspect-ratio: 16 / 9; max-height: 85vh; border-radius: 20px; overflow: hidden; cursor: default; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
    .box:fullscreen { width: 100vw; max-height: none; border-radius: 0; }
    .fs { display: grid !important; }
  }
</style>
