<script>
  // Дзвіночок: сповіщення «Дому» (ворота, відключення, протікання, техніка…) + системні повідомлення HA.
  import Icon from './Icon.svelte';
  import { ha, settings, saveSettings, subscribe, callService } from '../lib/ha.svelte.js';
  import { pushLayer, back } from '../lib/ui.svelte.js';
  import { timeAgo } from '../lib/format.js';

  let items = $state([]);
  let system = $state({});
  let open = $state(false);

  async function load() {
    try { items = await (await fetch('api/notifications')).json(); } catch {}
  }
  $effect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); });
  let subscribed = false;
  $effect(() => {
    if (!ha.connected || subscribed) return;
    subscribed = true;
    subscribe({ type: 'persistent_notification/subscribe' }, (ev) => {
      if (ev.type === 'current') system = ev.notifications || {};
      else if (ev.type === 'added' || ev.type === 'updated') system = { ...system, ...ev.notifications };
      else if (ev.type === 'removed') { const s = { ...system }; for (const k of Object.keys(ev.notifications || {})) delete s[k]; system = s; }
    }).catch(() => (subscribed = false));
  });

  const seen = $derived(settings.notif_seen || 0);
  const unread = $derived(items.filter((n) => n.t > seen).length + Object.keys(system).length);
  function show() {
    open = true; pushLayer(() => (open = false));
    settings.notif_seen = Date.now(); saveSettings();
  }
  const sys = $derived(Object.values(system).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')));
</script>

<button class="bell" onclick={show} aria-label="Сповіщення">
  <Icon name={unread ? 'mdi:bell-badge' : 'mdi:bell-outline'} size={24} />
  {#if unread}<span class="cnt">{unread > 99 ? '99+' : unread}</span>{/if}
</button>

{#if open}
  <div class="backdrop" onclick={back} role="presentation"></div>
  <div class="sheet" role="dialog" aria-modal="true">
    <header><b>Сповіщення</b><button onclick={back} aria-label="Закрити"><Icon name="mdi:close" /></button></header>
    <div class="body">
      {#if sys.length}
        <h3>Системні (Home Assistant)</h3>
        {#each sys as n (n.notification_id)}
          <div class="it sys">
            <Icon name="mdi:information-outline" size={22} />
            <span class="tx"><b>{n.title || 'Повідомлення'}</b><small>{n.message?.slice(0, 300)}</small></span>
            <button class="x" onclick={() => callService('persistent_notification', 'dismiss', { notification_id: n.notification_id })} aria-label="Прибрати"><Icon name="mdi:check" size={18} /></button>
          </div>
        {/each}
      {/if}
      <h3>Дім</h3>
      {#each items as n, i (n.t + '-' + i)}
        <div class="it" class:crit={n.critical} class:new={n.t > seen}>
          <Icon name={n.critical ? 'mdi:alert' : n.camera ? 'mdi:cctv' : 'mdi:bell-ring-outline'} size={22} />
          <span class="tx"><b>{n.title}</b>{#if n.message}<small>{n.message}</small>{/if}</span>
          <em>{timeAgo(new Date(n.t).toISOString())}</em>
        </div>
      {:else}<p class="muted">Поки що сповіщень немає. Тут з'являтимуться ворота, двері, відключення світла, протікання, техніка, батарейки.</p>{/each}
    </div>
  </div>
{/if}

<style>
  .bell { all: unset; cursor: pointer; position: relative; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--tile); }
  .cnt { position: absolute; top: 2px; right: 0; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--danger); color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; box-sizing: border-box; }
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 55; }
  .sheet { position: fixed; z-index: 56; left: 50%; bottom: 0; transform: translateX(-50%); width: min(620px, 100vw); height: min(88vh, 860px);
    background: var(--bg-sheet); border-radius: 28px 28px 0 0; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }
  header { display: flex; align-items: center; justify-content: space-between; padding: 18px 18px 8px; font-size: 20px; }
  header button { all: unset; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); }
  .body { overflow-y: auto; padding: 4px 16px 20px; }
  h3 { margin: 14px 2px 8px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .it { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; background: var(--tile); border-radius: 16px; margin-bottom: 6px; }
  .it.new { box-shadow: inset 3px 0 0 var(--accent); }
  .it.crit { background: color-mix(in srgb, var(--danger) 18%, var(--tile)); }
  .it.sys { background: color-mix(in srgb, #ffd60a 10%, var(--tile)); }
  .tx { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; } .tx small { color: var(--muted); white-space: pre-line; overflow-wrap: anywhere; }
  em { font-style: normal; color: var(--muted); font-size: 12px; white-space: nowrap; }
  .x { all: unset; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--pw); flex: none; }
  .muted { color: var(--muted); }
</style>
