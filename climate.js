// Двигун клімату itcity-home: зони (кімнати) з датчиками, клапанами, розкладом, вікнами, бустом
// + котел за потребою з погодною кривою. Працює на сервері, налаштування — у DATA_DIR/climate.json.
//
// Безпека: режим dry_run (лише показує рішення), захист від замерзання, «мовчазний» датчик → клапан
// у безпечний стан, мінімальний час роботи клапана, котел без команд сам повертається на панель за ~15 хв.

import fs from 'node:fs';
import path from 'node:path';
import { WebSocket } from 'ws';

const PRESETS = ['comfort', 'eco', 'night', 'away'];
export const PRESET_UK = { comfort: 'Комфорт', eco: 'Економ', night: 'Ніч', away: 'Нікого вдома' };

const DEFAULT_ZONE = (id, name) => ({
  id, name, enabled: true, dry_run: true,
  sensors: [], combine: 'avg', offset: 0,
  valve: null, valve_inverted: false, always_open: false,
  cooler: null,
  presets: { comfort: 22, eco: 20, night: 19.5, away: 17 },
  schedule: [
    { days: [1, 2, 3, 4, 5], from: '06:30', preset: 'comfort' },
    { days: [1, 2, 3, 4, 5], from: '22:30', preset: 'night' },
    { days: [6, 7], from: '08:00', preset: 'comfort' },
    { days: [6, 7], from: '23:00', preset: 'night' },
  ],
  hysteresis: 0.3, min_cycle_min: 5, stale_min: 45, frost: 7,
  window_sensors: [], window_drop: 1.0,
  boost: null,         // { until: ms, delta: 2 }
  manual: null,        // { target, until: ms|null } — ручна уставка до наступного кроку розкладу
});

const DEFAULT_CONFIG = {
  enabled: true,
  presence: [],        // person./device_tracker. — якщо всі не вдома → пресет away
  outdoor: 'weather.golovna',
  boiler: {
    enabled: false, dry_run: true, service: 'shell_command.ebus_setmode',
    curve_slope: 1.2, curve_shift: 0, flow_min: 30, flow_max: 65, room_gain: 3, hwc: 46,
    summer_outdoor: 18,
  },
  zones: [],
};

export function createClimate({ dataDir, haWsUrl, token, log = console.log }) {
  const file = path.join(dataDir, 'climate.json');
  let cfg = load();
  const states = {};
  const status = { zones: {}, boiler: {}, updated: 0, connected: false };
  const runtime = {};   // id -> { heating, since, lastTemps: [[t, v]] }
  let ws, nextId = 1; const pending = new Map();

  function load() {
    try { return merge(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { return merge({}); }
  }
  function merge(c) {
    const out = { ...DEFAULT_CONFIG, ...c, boiler: { ...DEFAULT_CONFIG.boiler, ...(c.boiler || {}) } };
    out.zones = (c.zones || []).map((z) => ({ ...DEFAULT_ZONE(z.id, z.name), ...z, presets: { ...DEFAULT_ZONE().presets, ...(z.presets || {}) } }));
    return out;
  }
  function save() {
    fs.writeFileSync(file + '.tmp', JSON.stringify(cfg, null, 2));
    fs.renameSync(file + '.tmp', file);
  }

  // ---------- з'єднання з HA ----------
  function send(msg) {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== 1) return reject(new Error('no HA'));
      const id = nextId++; pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ ...msg, id }));
    });
  }
  const call = (domain, service, data, entity_id) =>
    send({ type: 'call_service', domain, service, service_data: data || {}, ...(entity_id ? { target: { entity_id } } : {}) });

  function connect() {
    ws = new WebSocket(haWsUrl);
    ws.on('message', async (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'auth_required') return ws.send(JSON.stringify({ type: 'auth', access_token: token }));
      if (m.type === 'auth_ok') {
        status.connected = true;
        const all = await send({ type: 'get_states' });
        for (const s of all) states[s.entity_id] = s;
        await send({ type: 'subscribe_events', event_type: 'state_changed' });
        await send({ type: 'subscribe_events', event_type: 'state_reported' }).catch(() => {});
        return;
      }
      if (m.type === 'result') { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.success ? p.resolve(m.result) : p.reject(new Error(m.error?.message)); } return; }
      if (m.type === 'event' && m.event?.event_type === 'state_reported') {
        const st = states[m.event.data.entity_id];
        if (st) st.last_reported = m.event.data.last_reported;
        return;
      }
      if (m.type === 'event' && m.event?.event_type === 'state_changed') {
        const { entity_id, new_state } = m.event.data;
        if (new_state) states[entity_id] = new_state; else delete states[entity_id];
      }
    });
    ws.on('close', () => { status.connected = false; setTimeout(connect, 5000); });
    ws.on('error', () => {});
  }

  // ---------- логіка ----------
  const num = (e) => { const v = Number(states[e]?.state); return isFinite(v) ? v : null; };
  const fresh = (e, min) => {
    const s = states[e]; if (!s) return false;
    if (s.state === 'unavailable' || s.state === 'unknown') return false;
    // last_reported оновлюється при кожному звіті датчика, навіть без зміни значення
    const t = Date.parse(s.last_reported || s.last_updated || s.last_changed);
    return !isFinite(t) || Date.now() - t < min * 60e3;
  };

  function zoneTemp(z) {
    const vals = z.sensors.filter((e) => fresh(e, z.stale_min)).map(num).filter((v) => v != null);
    if (!vals.length) return null;
    const v = z.combine === 'min' ? Math.min(...vals) : z.combine === 'max' ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round((v + Number(z.offset || 0)) * 10) / 10;
  }

  function schedulePreset(z, now = new Date()) {
    const dow = ((now.getDay() + 6) % 7) + 1;           // 1 = пн … 7 = нд
    const mins = now.getHours() * 60 + now.getMinutes();
    const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    // шукаємо останній крок розкладу до «зараз», проглядаючи до 7 днів назад
    for (let back = 0; back < 8; back++) {
      const d = ((dow - 1 - back + 70) % 7) + 1;
      const steps = z.schedule.filter((s) => s.days.includes(d)).map((s) => ({ ...s, m: toMin(s.from) }))
        .filter((s) => back > 0 || s.m <= mins).sort((a, b) => b.m - a.m);
      if (steps.length) return steps[0].preset;
    }
    return 'comfort';
  }

  function everyoneAway() {
    if (!cfg.presence?.length) return false;
    return cfg.presence.every((e) => states[e] && !['home', 'on'].includes(states[e].state));
  }

  function windowOpen(z, temp) {
    if (z.window_sensors.some((e) => states[e]?.state === 'on')) return 'датчик вікна';
    const rt = runtime[z.id];
    if (temp != null && rt?.lastTemps?.length) {
      const old = rt.lastTemps.find(([t]) => Date.now() - t <= 10 * 60e3);
      if (old && old[1] - temp >= z.window_drop) return `різке падіння на ${(old[1] - temp).toFixed(1)}°`;
    }
    return null;
  }

  function evaluateZone(z) {
    const rt = (runtime[z.id] ||= { heating: false, since: 0, lastTemps: [], windowUntil: 0 });
    const temp = zoneTemp(z);
    if (temp != null) {
      rt.lastTemps.push([Date.now(), temp]);
      rt.lastTemps = rt.lastTemps.filter(([t]) => Date.now() - t < 15 * 60e3);
    }
    let preset = schedulePreset(z);
    if (everyoneAway()) preset = 'away';
    let target = z.presets[preset];
    let reason = `${PRESET_UK[preset]} за розкладом`;
    if (z.manual && (!z.manual.until || z.manual.until > Date.now())) { target = z.manual.target; reason = 'вручну'; }
    if (z.boost && z.boost.until > Date.now()) { target = Number(target) + Number(z.boost.delta || 2); reason = 'буст'; }

    let want = rt.heating;
    let note = '';
    const win = windowOpen(z, temp);
    if (win) rt.windowUntil = Date.now() + 15 * 60e3;
    if (!z.enabled) { want = false; note = 'зону вимкнено'; }
    else if (temp == null) { want = false; note = 'немає даних датчика — клапан закрито'; }
    else if (temp < z.frost) { want = true; note = 'захист від замерзання'; }
    else if (rt.windowUntil > Date.now()) { want = false; note = `відкрите вікно (${win || 'пауза 15 хв'})`; }
    else if (temp <= target - z.hysteresis) want = true;
    else if (temp >= target + z.hysteresis / 2) want = false;

    // мінімальний час роботи — не клацати клапаном
    if (want !== rt.heating && Date.now() - rt.since < z.min_cycle_min * 60e3 && !note.startsWith('відкрите') && rt.since) {
      want = rt.heating; note = note || 'чекаю мінімальний час циклу';
    }
    if (want !== rt.heating) { rt.heating = want; rt.since = Date.now(); }

    // виконання
    const heatOut = z.always_open ? true : want;
    if (z.valve && !z.dry_run && cfg.enabled) {
      const desiredOn = z.valve_inverted ? !heatOut : heatOut;
      const cur = states[z.valve]?.state;
      if (cur && (cur === 'on') !== desiredOn) call('switch', desiredOn ? 'turn_on' : 'turn_off', {}, z.valve).catch((e) => log('[climate] valve', e.message));
    }
    status.zones[z.id] = {
      temp, target: target != null ? Math.round(target * 10) / 10 : null, preset, reason, heating: want, note,
      valve: z.valve ? states[z.valve]?.state : null, dry_run: z.dry_run,
      deficit: temp != null && target != null ? Math.round((target - temp) * 10) / 10 : null,
    };
    return status.zones[z.id];
  }

  function evaluateBoiler(zs) {
    const b = cfg.boiler;
    const outdoor = num(cfg.outdoor) ?? states[cfg.outdoor]?.attributes?.temperature ?? null;
    const demandZones = cfg.zones.filter((z) => z.enabled && (zs[z.id]?.heating));
    const maxDeficit = Math.max(0, ...cfg.zones.filter((z) => z.enabled).map((z) => zs[z.id]?.deficit ?? 0));
    let flow = 20 + b.curve_slope * (20 - (outdoor ?? 5)) + b.curve_shift + Math.min(maxDeficit, 3) * b.room_gain;
    flow = Math.round(Math.min(b.flow_max, Math.max(b.flow_min, flow)));
    const summer = outdoor != null && outdoor >= b.summer_outdoor;
    const heating = demandZones.length > 0 && !summer;
    status.boiler = { outdoor, flow, heating, hwc: b.hwc, zones: demandZones.map((z) => z.name), summer, dry_run: b.dry_run, enabled: b.enabled };
    return status.boiler;
  }

  let lastBoilerSend = 0;
  async function tick() {
    if (!status.connected) return;
    const zs = {};
    for (const z of cfg.zones) zs[z.id] = evaluateZone(z);
    const b = evaluateBoiler(zs);
    if (cfg.enabled && cfg.boiler.enabled && !cfg.boiler.dry_run && Date.now() - lastBoilerSend > 110e3) {
      lastBoilerSend = Date.now();
      const [d, s] = cfg.boiler.service.split('.');
      call(d, s, { flow: b.flow, hwc: b.hwc, heating_off: !b.heating }).catch((e) => log('[climate] boiler', e.message));
    }
    status.updated = Date.now();
  }

  // ---------- API ----------
  function api(method, sub, body) {
    if (method === 'GET' && sub === '') return { config: cfg, status };
    if (method === 'POST' && sub === 'config') { cfg = merge(body); save(); tick(); return { ok: true }; }
    const m = sub.match(/^zone\/([\w-]+)\/(target|boost|clear|preset)$/);
    if (method === 'POST' && m) {
      const z = cfg.zones.find((x) => x.id === m[1]); if (!z) return { error: 'zone' };
      if (m[2] === 'target') z.manual = { target: Number(body.target), until: body.hours ? Date.now() + body.hours * 3600e3 : nextScheduleChange(z) };
      if (m[2] === 'boost') z.boost = { until: Date.now() + (body.minutes || 60) * 60e3, delta: body.delta || 2 };
      if (m[2] === 'clear') { z.manual = null; z.boost = null; }
      save(); tick(); return { ok: true };
    }
    return { error: 'not found' };
  }

  function nextScheduleChange(z) {
    const now = Date.now();
    for (let mins = 1; mins < 8 * 1440; mins += 5) {
      const t = new Date(now + mins * 60e3);
      if (schedulePreset(z, t) !== schedulePreset(z, new Date(now))) return t.getTime();
    }
    return now + 12 * 3600e3;
  }

  connect();
  setInterval(() => tick().catch((e) => log('[climate]', e.message)), 30e3);
  setTimeout(() => tick().catch(() => {}), 5000);
  return { api, PRESETS };
}
