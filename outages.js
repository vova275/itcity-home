// Журнал відключень світла: фактичні відключення (binary_sensor.svitlo_merezha) + графік на кожен день.
// Зберігається назавжди в DATA_DIR/outages.json (історія HA тримається лише ~10 днів).
// При підключенні дотягує пропущене з історії HA.

import fs from 'node:fs';
import path from 'node:path';
import { WebSocket } from 'ws';

const GRID = 'binary_sensor.svitlo_merezha';
const PLAN = 'binary_sensor.svitlo_vidkliuchennia_zaraz';
const MIN_OFF = 60e3; // коротші за хвилину — не відключення

export function createOutages({ dataDir, haWsUrl, token, log = console.log }) {
  const file = path.join(dataDir, 'outages.json');
  let db = { since: null, events: [], plans: {} };   // since — з якого моменту є дані; events: [{ s, e|null }] ms; plans: { 'YYYY-MM-DD': ['07:00–10:00', …] }
  try { db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}
  let tz = 'Europe/Kyiv';
  let ws, nextId = 1; const pending = new Map();

  const save = () => { try { fs.writeFileSync(file + '.tmp', JSON.stringify(db)); fs.renameSync(file + '.tmp', file); } catch (e) { log('[outages] save', e.message); } };
  const dayKey = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));

  function send(msg) {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== 1) return reject(new Error('no HA'));
      const id = nextId++; pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ ...msg, id }));
    });
  }

  // додати/закрити відключення
  function gridState(state, t) {
    const open = db.events.at(-1);
    if (state === 'off') {
      if (open && open.e == null) return false;
      db.events.push({ s: t, e: null }); return true;
    }
    if (state === 'on' && open && open.e == null) {
      if (t - open.s < MIN_OFF) db.events.pop(); else open.e = t;
      return true;
    }
    return false;
  }
  function plan(attrs, t) {
    if (!attrs || !Array.isArray(attrs.today) && attrs.today !== null) return false;
    const k = dayKey(t), v = attrs.today || [];
    if (JSON.stringify(db.plans[k]) === JSON.stringify(v)) return false;
    db.plans[k] = v; return true;
  }

  // дотягнути з історії HA те, чого немає в журналі
  async function backfill() {
    const lastKnown = db.events.length ? Math.max(...db.events.map((x) => x.e ?? x.s)) : 0;
    const start = new Date(Math.max(lastKnown - 3600e3, Date.now() - 30 * 86400e3)).toISOString();
    const h = await send({ type: 'history/history_during_period', start_time: start, entity_ids: [GRID], minimal_response: true, no_attributes: true });
    const pts = (h[GRID] || []).map((x) => [Math.round((x.lu ?? x.lc) * 1000), x.s]);
    let ch = false;
    if (db.since == null && pts.length) { db.since = pts[0][0]; ch = true; }
    for (const [t, s] of pts) {
      if (t <= lastKnown) continue;
      if (s === 'off' || s === 'on') ch = gridState(s, t) || ch;
    }
    // графіки за минулі дні (атрибут today змінюється рідко)
    const hp = await send({ type: 'history/history_during_period', start_time: new Date(Date.now() - 30 * 86400e3).toISOString(), entity_ids: [PLAN], no_attributes: false, significant_changes_only: false });
    for (const x of hp[PLAN] || []) {
      const t = Math.round((x.lu ?? x.lc) * 1000), k = dayKey(t);
      if (k === dayKey(Date.now()) || !db.plans[k]) ch = plan(x.a, t) || ch;
    }
    if (ch) { db.events.sort((a, b) => a.s - b.s); save(); log(`[outages] backfill: ${db.events.length} відключень, ${Object.keys(db.plans).length} днів графіка`); }
  }

  function connect() {
    ws = new WebSocket(haWsUrl);
    ws.on('message', async (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'auth_required') return ws.send(JSON.stringify({ type: 'auth', access_token: token }));
      if (m.type === 'auth_ok') {
        try {
          tz = (await send({ type: 'get_config' })).time_zone || tz;
          await send({ type: 'subscribe_trigger', trigger: { platform: 'state', entity_id: [GRID, PLAN] } });
          await backfill();
          const all = await send({ type: 'get_states' });
          const g = all.find((s) => s.entity_id === GRID), p = all.find((s) => s.entity_id === PLAN);
          let ch = false;
          if (g) ch = gridState(g.state, Date.parse(g.last_changed)) || ch;
          if (p) ch = plan(p.attributes, Date.now()) || ch;
          if (ch) save();
        } catch (e) { log('[outages]', e.message); }
        return;
      }
      if (m.type === 'result') { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.success ? p.resolve(m.result) : p.reject(new Error(m.error?.message)); } return; }
      if (m.type === 'event' && m.event?.variables?.trigger) {
        const tr = m.event.variables.trigger, ns = tr.to_state; if (!ns) return;
        const ch = ns.entity_id === GRID ? gridState(ns.state, Date.parse(ns.last_changed)) : plan(ns.attributes, Date.now());
        if (ch) save();
      }
    });
    ws.on('close', () => { setTimeout(connect, 5000); });
    ws.on('error', () => {});
  }
  connect();

  return {
    api: () => ({ tz, since: db.since ?? null, events: db.events, plans: db.plans, now: Date.now() }),
  };
}
