// Модель «пристроїв» як у Homey: пристрій = набір сутностей HA, одна з них головна (для плитки).

const MAIN_PRIORITY = [
  'climate', 'alarm_control_panel', 'cover', 'light', 'fan', 'media_player', 'lock', 'switch',
  'water_heater', 'vacuum', 'humidifier', 'camera', 'sensor', 'binary_sensor', 'select', 'number',
];
const SENSOR_PRIORITY = ['temperature', 'power', 'humidity', 'carbon_dioxide', 'pressure', 'energy', 'voltage', 'battery'];

export const TOGGLE_DOMAINS = new Set(['light', 'switch', 'fan', 'input_boolean', 'automation', 'media_player', 'humidifier', 'climate', 'cover', 'lock', 'siren']);

export function domainOf(entityId) { return entityId.split('.')[0]; }

function entityScore(e, st) {
  const d = domainOf(e.entity_id);
  let s = MAIN_PRIORITY.indexOf(d);
  if (s < 0) s = 99;
  if (d === 'sensor') {
    const dc = st?.attributes?.device_class;
    const i = SENSOR_PRIORITY.indexOf(dc);
    s += (i < 0 ? 9 : i) / 10;
  }
  if (e.entity_category) s += 50;
  return s;
}

/** Будує список пристроїв з реєстрів і станів. */
export function buildDevices(ha) {
  const byDevice = new Map();
  for (const e of ha.entities) {
    if (e.disabled_by || e.hidden_by) continue;
    if (!ha.states[e.entity_id]) continue;
    const key = e.device_id || 'entity:' + e.entity_id;
    if (!byDevice.has(key)) byDevice.set(key, []);
    byDevice.get(key).push(e);
  }
  const devById = Object.fromEntries(ha.devices.map((d) => [d.id, d]));
  const out = [];
  for (const [key, ents] of byDevice) {
    const dev = devById[key];
    if (dev?.entry_type === 'service') continue;
    ents.sort((a, b) => entityScore(a, ha.states[a.entity_id]) - entityScore(b, ha.states[b.entity_id]));
    const main = ents[0];
    const st = ha.states[main.entity_id];
    const area_id = dev?.area_id || main.area_id || ents.find((x) => x.area_id)?.area_id || null;
    out.push({
      id: key,
      device: dev || null,
      name: dev?.name_by_user || dev?.name || main.name || st?.attributes?.friendly_name || main.entity_id,
      area_id,
      main: main.entity_id,
      entities: ents.map((x) => x.entity_id),
      registry: ents,
    });
  }
  return mergeOrphans(out, ha);
}

/** Сутності без пристрою (шаблони, хелпери) приєднуємо до пристрою з тим самим префіксом id:
 *  sensor.lichylnyk_potuzhnist → пристрій, де є sensor.lichylnyk_potuzhnist_l1 тощо. */
function mergeOrphans(list, ha) {
  const real = list.filter((d) => d.device);
  const token = (eid) => eid.split('.')[1].split('_')[0];
  const keep = [];
  for (const d of list) {
    if (d.device || d.entities.length !== 1) { keep.push(d); continue; }
    const t = token(d.main);
    const host = t.length >= 4 && real.find((r) => r.entities.filter((e) => token(e) === t).length >= 2);
    if (!host) { keep.push(d); continue; }
    host.entities.push(d.main);
    host.registry.push(...d.registry);
    const all = host.registry;
    all.sort((a, b) => entityScore(a, ha.states[a.entity_id]) - entityScore(b, ha.states[b.entity_id]));
    host.main = all[0].entity_id;
  }
  return keep;
}

/** Пристрій для довільної сутності (для «Вибраного» з окремих сутностей). */
export function deviceForEntity(devices, entityId) {
  return devices.find((d) => d.entities.includes(entityId)) || {
    id: 'entity:' + entityId, device: null, name: null, area_id: null, main: entityId, entities: [entityId], registry: [],
  };
}

export function isOn(st) {
  if (!st) return false;
  const s = st.state;
  if (domainOf(st.entity_id) === 'climate') return s !== 'off' && s !== 'unavailable';
  if (domainOf(st.entity_id) === 'alarm_control_panel') return s !== 'disarmed' && s !== 'unavailable';
  return ['on', 'open', 'opening', 'playing', 'unlocked', 'home', 'heat', 'cool', 'auto', 'dry', 'fan_only', 'heat_cool', 'cleaning'].includes(s);
}

export function friendly(ha, entityId) {
  const st = ha.states[entityId];
  const reg = ha.entities.find((e) => e.entity_id === entityId);
  return reg?.name || st?.attributes?.friendly_name || entityId;
}
