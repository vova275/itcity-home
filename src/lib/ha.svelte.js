// Підключення до Home Assistant через WebSocket-проксі сервера itcity-home.
// Тримає живий стан усіх сутностей і реєстри (кімнати, поверхи, пристрої, сутності).

export const ha = $state({
  connected: false,
  error: '',
  states: {},     // entity_id -> state object
  areas: [],
  floors: [],
  devices: [],
  entities: [],   // entity registry (display list)
  version: '',
});

let ws = null;
let nextId = 1;
const pending = new Map();
let reconnectTimer = null;

function wsUrl() {
  const u = new URL('api/websocket', location.href);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

export function send(msg) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== 1) return reject(new Error('Немає зв’язку з HA'));
    const id = nextId++;
    const timer = setTimeout(() => { if (pending.delete(id)) reject(new Error('Час очікування минув')); }, 20000);
    pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    ws.send(JSON.stringify({ ...msg, id }));
  });
}

const subscriptions = new Map();
export async function subscribe(msg, cb) {
  const id = nextId++;
  subscriptions.set(id, cb);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: () => resolve(() => unsubscribe(id)), reject });
    ws.send(JSON.stringify({ ...msg, id }));
  });
}
async function unsubscribe(id) {
  subscriptions.delete(id);
  try { await send({ type: 'unsubscribe_events', subscription: id }); } catch {}
}

export function callService(domain, service, data = {}, target) {
  return send({ type: 'call_service', domain, service, service_data: data, ...(target ? { target } : {}) });
}

async function loadRegistries() {
  const [areas, floors, devices, entities] = await Promise.all([
    send({ type: 'config/area_registry/list' }),
    send({ type: 'config/floor_registry/list' }).catch(() => []),
    send({ type: 'config/device_registry/list' }),
    send({ type: 'config/entity_registry/list' }),
  ]);
  ha.areas = areas; ha.floors = floors; ha.devices = devices; ha.entities = entities;
}

export function connect() {
  clearTimeout(reconnectTimer);
  ws = new WebSocket(wsUrl());
  ws.onmessage = async (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'auth_ok') {
      ha.connected = true; ha.error = ''; ha.version = msg.ha_version || '';
      const states = await send({ type: 'get_states' });
      const map = {};
      for (const s of states) map[s.entity_id] = s;
      ha.states = map;
      await subscribe({ type: 'subscribe_events', event_type: 'state_changed' }, (ev) => {
        const { entity_id, new_state } = ev.data;
        if (new_state) ha.states[entity_id] = new_state; else delete ha.states[entity_id];
      });
      await loadRegistries();
      for (const t of ['area_registry_updated', 'device_registry_updated', 'entity_registry_updated', 'floor_registry_updated']) {
        subscribe({ type: 'subscribe_events', event_type: t }, debounceRegistries).catch(() => {});
      }
      return;
    }
    if (msg.type === 'auth_invalid') { ha.error = 'Помилка авторизації в HA: ' + (msg.message || ''); return; }
    if (msg.type === 'result') {
      const p = pending.get(msg.id);
      if (p) { pending.delete(msg.id); msg.success ? p.resolve(msg.result) : p.reject(new Error(msg.error?.message || 'error')); }
      return;
    }
    if (msg.type === 'event') subscriptions.get(msg.id)?.(msg.event);
  };
  ws.onclose = () => {
    ha.connected = false;
    for (const p of pending.values()) p.reject(new Error('disconnected'));
    pending.clear(); subscriptions.clear();
    reconnectTimer = setTimeout(connect, 3000);
  };
}

let regTimer;
function debounceRegistries() {
  clearTimeout(regTimer);
  regTimer = setTimeout(() => loadRegistries().catch(() => {}), 800);
}

// ---- налаштування дашборда (зберігаються на сервері) ----
export const settings = $state({ favorites: [], hidden: [], loaded: false });

export async function loadSettings() {
  try {
    const r = await fetch('api/config');
    Object.assign(settings, await r.json(), { loaded: true });
  } catch { settings.loaded = true; }
}

export async function saveSettings() {
  const { loaded, ...data } = settings;
  await fetch('api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}
