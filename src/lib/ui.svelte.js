// Стан інтерфейсу + інтеграція з історією браузера: жест/кнопка «назад» спершу закриває
// відкрите вікно (камера, картка, список), потім повертає на попередню вкладку.

export const ui = $state({
  view: 'home',          // home | rooms | energy | more
  room: null,
  sheet: null,           // відкритий пристрій
  sheetTab: 'control',
  list: null,            // { title, entities: () => [...], empty, show }
  outages: false,        // вікно «Історія відключень»
});

const layers = [];       // функції закриття, верхня — остання

// «Дім» відкривається в iframe панелі HA. Застосунок HA на телефоні дивиться лише на історію
// верхнього вікна (інакше жест «назад» закриває застосунок), тому пишемо історію туди —
// iframe Ingress має той самий origin, що й HA. Якщо недоступно — власна історія.
function topWin() {
  try { if (window.top !== window && window.top.location.origin === location.origin) return window.top; } catch {}
  return window;
}
const W = typeof window !== 'undefined' ? topWin() : null;

export function pushLayer(close) {
  layers.push(close);
  W.history.pushState({ ...(W.history.state || {}), itcity: layers.length }, '');
}

/** Закрити верхній шар так само, як це зробив би жест «назад». */
let going = 0;  // скільки «назад» уже в дорозі — щоб два обробники не зробили зайвий крок
export function back() {
  if (layers.length > going) { going++; W.history.back(); }
}

if (W) {
  W.addEventListener('popstate', (e) => {
    going = 0;
    if (!layers.length) return;
    const lvl = e.state?.itcity || 0;
    // закрити всі шари вище рівня, на який повернулись
    while (layers.length > lvl) { const close = layers.pop(); close?.(); }
  });
}

export function setView(v) {
  if (v === ui.view) return;
  const prev = ui.view;
  ui.view = v;
  pushLayer(() => { ui.view = prev; });
}

export function openDevice(device) {
  ui.sheet = device;
  ui.sheetTab = 'control';
  pushLayer(() => { ui.sheet = null; });
}
export function closeSheet() { back(); }

export function openList(list) {
  ui.list = list;
  pushLayer(() => { ui.list = null; });
}

export function openOutages() {
  ui.outages = true;
  pushLayer(() => { ui.outages = false; });
}
