import * as mdi from '@mdi/js';

export function path(name) {
  if (!name) return mdi.mdiHelpCircleOutline;
  const key = 'mdi' + name.replace(/^mdi:/, '').split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  return mdi[key] || mdi.mdiHelpCircleOutline;
}

const DOMAIN_ICON = {
  light: ['mdi:lightbulb', 'mdi:lightbulb-outline'], switch: ['mdi:toggle-switch', 'mdi:toggle-switch-off-outline'],
  fan: ['mdi:fan', 'mdi:fan-off'], climate: ['mdi:thermostat', 'mdi:thermostat'], cover: ['mdi:garage-open', 'mdi:garage'],
  alarm_control_panel: ['mdi:shield-lock', 'mdi:shield-off-outline'], lock: ['mdi:lock-open-variant', 'mdi:lock'],
  media_player: ['mdi:cast-connected', 'mdi:cast'], camera: ['mdi:cctv', 'mdi:cctv'], automation: ['mdi:robot', 'mdi:robot-off'],
  input_boolean: ['mdi:toggle-switch', 'mdi:toggle-switch-off-outline'], input_number: ['mdi:ray-vertex', 'mdi:ray-vertex'],
  input_select: ['mdi:format-list-bulleted', 'mdi:format-list-bulleted'], select: ['mdi:format-list-bulleted', 'mdi:format-list-bulleted'],
  number: ['mdi:ray-vertex', 'mdi:ray-vertex'], weather: ['mdi:weather-partly-cloudy', 'mdi:weather-partly-cloudy'],
  water_heater: ['mdi:water-boiler', 'mdi:water-boiler-off'], calendar: ['mdi:calendar', 'mdi:calendar'],
};
const SENSOR_DC = {
  temperature: 'mdi:thermometer', humidity: 'mdi:water-percent', power: 'mdi:flash', energy: 'mdi:lightning-bolt',
  voltage: 'mdi:sine-wave', current: 'mdi:current-ac', pressure: 'mdi:gauge', carbon_dioxide: 'mdi:molecule-co2',
  battery: 'mdi:battery', illuminance: 'mdi:brightness-5', monetary: 'mdi:cash', duration: 'mdi:timer-outline',
  timestamp: 'mdi:clock-outline', volatile_organic_compounds_parts: 'mdi:air-filter', signal_strength: 'mdi:wifi',
};
const BIN_DC = {
  door: ['mdi:door-open', 'mdi:door-closed'], window: ['mdi:window-open-variant', 'mdi:window-closed-variant'],
  motion: ['mdi:motion-sensor', 'mdi:motion-sensor-off'], moisture: ['mdi:water-alert', 'mdi:water-off'],
  smoke: ['mdi:smoke-detector-variant-alert', 'mdi:smoke-detector-variant'], occupancy: ['mdi:home-account', 'mdi:home-outline'],
  connectivity: ['mdi:lan-connect', 'mdi:lan-disconnect'], battery: ['mdi:battery-alert', 'mdi:battery'],
};

export function iconFor(st, reg) {
  if (reg?.icon) return reg.icon;
  if (st?.attributes?.icon) return st.attributes.icon;
  if (!st) return 'mdi:help-circle-outline';
  const d = st.entity_id.split('.')[0];
  const on = !['off', 'closed', 'disarmed', 'locked', 'idle', 'unavailable'].includes(st.state);
  const dc = st.attributes?.device_class;
  if (d === 'sensor') return SENSOR_DC[dc] || 'mdi:eye';
  if (d === 'binary_sensor') return (BIN_DC[dc] || ['mdi:checkbox-marked-circle', 'mdi:checkbox-blank-circle-outline'])[on ? 0 : 1];
  const pair = DOMAIN_ICON[d];
  return pair ? pair[on ? 0 : 1] : 'mdi:checkbox-blank-circle-outline';
}
