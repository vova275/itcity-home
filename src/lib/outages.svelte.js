// Журнал відключень з сервера (api/outages): фактичні відключення + графік по днях.

export const out = $state({ since: null, events: [], plans: {}, loaded: false });

export async function loadOutages() {
  try {
    const r = await (await fetch('api/outages')).json();
    out.since = r.since; out.events = r.events || []; out.plans = r.plans || {}; out.loaded = true;
  } catch {}
}

export const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
export const keyOf = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Фактичні відключення в межах [a, b): [[s, e], …] обрізані до меж. */
export function clip(events, a, b, now = Date.now()) {
  return events.map((x) => [Math.max(x.s, a), Math.min(x.e ?? now, b)]).filter(([s, e]) => e > s);
}
export const sum = (segs) => segs.reduce((t, [s, e]) => t + (e - s), 0);

/** 48 клітинок по пів години: 'off' — хоч хвилина без світла, 'on' — світло було, null — майбутнє/немає даних. */
export function halfHours(events, day, now = Date.now()) {
  const segs = clip(events, day, addDays(day, 1), now);
  return Array.from({ length: 48 }, (_, i) => {
    const a = day + i * 1800e3, b = a + 1800e3;
    if (segs.some(([s, e]) => s < b && e > a)) return 'off';
    return a < now ? 'on' : null;
  });
}

const mins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
/** Графік дня: ['07:00–10:00'] → хвилини без світла. */
export function planMinutes(list) {
  return (list || []).reduce((t, iv) => { const [x, y] = iv.replace('–', '-').split('-'); const b = mins(y) || 1440; return t + b - mins(x); }, 0);
}
/** Скільки хвилин графіка відключень припадає на проміжок дня [m0, m1) хвилин. */
export function planMinutesIn(list, m0, m1) {
  return (list || []).reduce((t, iv) => { const [x, y] = iv.replace('–', '-').split('-'); const a = Math.max(mins(x), m0), b = Math.min(mins(y) || 1440, m1); return t + Math.max(0, b - a); }, 0);
}
export function planCells(list) {
  const p = (list || []).map((iv) => { const [x, y] = iv.replace('–', '-').split('-'); return [mins(x), mins(y) || 1440]; });
  return Array.from({ length: 48 }, (_, i) => p.some(([x, y]) => x < i * 30 + 30 && y > i * 30));
}

export const dur = (ms) => {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} хв`;
  return `${Math.floor(m / 60)} год` + (m % 60 ? ` ${m % 60} хв` : '');
};
export const hm = (t) => new Date(t).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
