// Відображення станів українською.

const STATE_UK = {
  on: 'Увімкнено', off: 'Вимкнено', open: 'Відкрито', closed: 'Закрито', opening: 'Відкривається', closing: 'Закривається',
  unavailable: 'Недоступно', unknown: '—', home: 'Вдома', not_home: 'Не вдома', locked: 'Зачинено', unlocked: 'Відчинено',
  playing: 'Грає', paused: 'Пауза', idle: 'Очікує', standby: 'Очікування',
  disarmed: 'Знято з охорони', armed_away: 'Під охороною', armed_home: 'Частково', armed_night: 'Нічний режим',
  arming: 'Ставиться…', pending: 'Очікування', triggered: 'ТРИВОГА',
  heat: 'Обігрів', cool: 'Охолодження', auto: 'Авто', dry: 'Осушення', fan_only: 'Вентиляція', heat_cool: 'Обігрів/охол.',
  heating: 'гріє', cooling: 'охолоджує', drying: 'осушує', fan: 'вентилює', preheating: 'прогрів',
};
// побутова техніка (SmartThings, Home Connect): стан, етап, програми
const APPLIANCE_UK = {
  run: 'Працює', stop: 'Зупинено', pause: 'Пауза', ready: 'Готова', inactive: 'Вимкнена', delayedstart: 'Відкладений старт',
  actionrequired: 'Потрібна дія', finished: 'Завершено', finish: 'Завершено', error: 'Помилка', aborting: 'Скасування',
  none: '—', wash: 'Прання', ai_wash: 'Прання (AI)', pre_wash: 'Попереднє прання', air_wash: 'Освіження повітрям', rinse: 'Полоскання',
  ai_rinse: 'Полоскання (AI)', spin: 'Віджим', ai_spin: 'Віджим (AI)', drying: 'Сушіння', ai_drying: 'Сушіння (AI)', cooling: 'Охолодження',
  delay_wash: 'Відкладений старт', refreshing: 'Освіження', weight_sensing: 'Зважування', wrinkle_prevent: 'Захист від зминання',
  dehumidifying: 'Осушення', sanitizing: 'Дезінфекція', internal_care: 'Самоочищення',
  rinse_hold: 'Без зливу', no_spin: 'Без віджиму', cold: 'Холодна',
  dishcare_dishwasher_program_eco_50: 'Eco 50°', dishcare_dishwasher_program_auto_2: 'Авто 45–65°', dishcare_dishwasher_program_intensiv_70: 'Інтенсив 70°',
  dishcare_dishwasher_program_quick_65: 'Швидка 65°', dishcare_dishwasher_program_night_wash: 'Нічна (тиха)', dishcare_dishwasher_program_machine_care: 'Догляд за машиною',
  dishcare_dishwasher_program_pre_rinse: 'Попереднє ополіскування',
};
const APPLIANCE_RE = /(machine_state|job_state|operation_state|posudomiika|pralna|susharka|washer|dryer|dishwasher)/;
export function applianceText(entityId, state) {
  return APPLIANCE_RE.test(entityId) ? APPLIANCE_UK[state] : undefined;
}
export const HVAC_UK = { off: 'Вимк.', heat: 'Обігрів', cool: 'Охолодж.', auto: 'Авто', dry: 'Осуш.', fan_only: 'Вентил.', heat_cool: 'Обігр./охол.' };
export const FAN_UK = {
  auto: 'Авто', low: 'Низька', medium_low: 'Нижче сер.', medium: 'Середня', medium_high: 'Вище сер.', high: 'Висока',
  turbo: 'Турбо', quiet: 'Тиха',
};

const BIN_DC = {
  door: ['Відчинено', 'Зачинено'], window: ['Відчинено', 'Зачинено'], opening: ['Відчинено', 'Зачинено'], garage_door: ['Відчинено', 'Зачинено'],
  motion: ['Рух', 'Немає руху'], occupancy: ['Присутність', 'Нікого'], moisture: ['ПРОТІКАННЯ', 'Сухо'], smoke: ['ДИМ', 'Норма'],
  gas: ['ГАЗ', 'Норма'], battery: ['Розряджена', 'Норма'], connectivity: ['На зв’язку', 'Офлайн'], problem: ['Проблема', 'Норма'],
  tamper: ['Втручання', 'Норма'], heat: ['Гаряче', 'Норма'], power: ['Є', 'Немає'], running: ['Працює', 'Стоїть'],
};

export function num(v, digits) {
  const n = Number(v);
  if (!isFinite(n)) return v;
  const d = digits ?? (Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2);
  const r = Math.round(n * 10 ** d) / 10 ** d || 0;   // без «-0»
  return r.toLocaleString('uk-UA', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

export function stateText(st) {
  if (!st) return '—';
  const d = st.entity_id.split('.')[0];
  const a = st.attributes || {};
  if (st.state === 'unavailable') return 'Недоступно';
  if (d === 'binary_sensor' && BIN_DC[a.device_class]) return BIN_DC[a.device_class][st.state === 'on' ? 0 : 1];
  if (d === 'climate') {
    const cur = a.current_temperature != null ? `${num(a.current_temperature, 1)}°` : '';
    if (st.state === 'off') return `Вимк.${cur ? ' • ' + cur : ''}`;
    return `${HVAC_UK[st.state] || st.state} ${a.temperature != null ? num(a.temperature, 1) + '°' : ''}${cur ? ' • ' + cur : ''}`.trim();
  }
  if (d === 'light' && st.state === 'on' && a.brightness != null) return `Увімк. • ${Math.round(a.brightness / 2.55)}%`;
  if (d === 'fan' && st.state === 'on' && a.percentage != null) return `Увімк. • ${fanLevelText(st)}`;
  if (d === 'sensor' || d === 'number' || d === 'input_number') {
    if (a.device_class === 'timestamp') return relTime(st.state);
    const unit = a.unit_of_measurement ? ` ${a.unit_of_measurement}` : '';
    return isFinite(Number(st.state)) ? `${num(st.state)}${unit}` : (applianceText(st.entity_id, st.state) || STATE_UK[st.state] || st.state) + unit;
  }
  return applianceText(st.entity_id, st.state) || STATE_UK[st.state] || st.state;
}

export function relTime(iso) {
  const t = new Date(iso);
  if (isNaN(t)) return iso;
  const m = Math.round((t - Date.now()) / 60000);
  const abs = Math.abs(m);
  const hm = abs >= 60 ? `${Math.floor(abs / 60)} год ${abs % 60} хв` : `${abs} хв`;
  const clock = t.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  return m >= 0 ? `о ${clock} (через ${hm})` : `о ${clock} (${hm} тому)`;
}

export function timeAgo(iso) {
  const s = Math.round((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'щойно';
  if (s < 3600) return `${Math.floor(s / 60)} хв тому`;
  if (s < 86400) return `${Math.floor(s / 3600)} год тому`;
  return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Доброї ночі' : h < 12 ? 'Доброго ранку' : h < 18 ? 'Доброго дня' : 'Доброго вечора';
}

export const WEATHER_UK = {
  'clear-night': 'Ясно', cloudy: 'Хмарно', exceptional: 'Аномально', fog: 'Туман', hail: 'Град', lightning: 'Гроза',
  'lightning-rainy': 'Гроза з дощем', partlycloudy: 'Мінлива хмарність', pouring: 'Злива', rainy: 'Дощ', snowy: 'Сніг',
  'snowy-rainy': 'Мокрий сніг', sunny: 'Сонячно', windy: 'Вітряно', 'windy-variant': 'Вітряно',
};

// Вентилятори зі ступенями (Prana: крок 16,67 % → швидкості 1–5, 6-та = турбо): показуємо цифру, як на пульті.
export function fanLevels(st) {
  const step = st?.attributes?.percentage_step;
  if (!step || step < 5) return null;
  let n = Math.round(100 / step);
  if (n === 6 && st.attributes.preset_modes?.includes('boost')) n = 5;
  return { n, step };
}
export function fanLevel(st) {
  const step = st?.attributes?.percentage_step;
  const p = st?.attributes?.percentage;
  return step && p != null ? Math.round(p / step) : null;
}
export function fanLevelText(st) {
  if (st?.attributes?.preset_mode === 'boost') return 'Турбо';
  const lv = fanLevel(st);
  return lv != null ? `швидкість ${lv}` : `${st?.attributes?.percentage ?? ''}%`;
}
