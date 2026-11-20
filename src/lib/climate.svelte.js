// Клієнт API двигуна клімату (сервер itcity-home).
export const clim = $state({ config: null, status: null, error: '' });

export async function loadClimate() {
  try {
    const r = await fetch('api/climate');
    const d = await r.json();
    clim.config = d.config; clim.status = d.status; clim.error = '';
  } catch (e) { clim.error = String(e); }
}

export async function saveClimate() {
  await fetch('api/climate/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clim.config) });
  await loadClimate();
}

export async function zoneAction(id, action, body = {}) {
  await fetch(`api/climate/zone/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  await loadClimate();
}

let timer;
export function startClimatePolling() {
  loadClimate();
  clearInterval(timer);
  timer = setInterval(loadClimate, 10000);
  return () => clearInterval(timer);
}

export const PRESET_UK = { comfort: 'Комфорт', eco: 'Економ', night: 'Ніч', away: 'Нікого вдома' };
export const DAYS_UK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
