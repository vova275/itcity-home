// Стан інтерфейсу + інтеграція з історією браузера: жест/кнопка «назад» спершу закриває
// відкрите вікно (камера, картка, список), потім повертає на попередню вкладку.

export const ui = $state({
  view: 'home',          // home | rooms | energy | more
  room: null,
  sheet: null,           // відкритий пристрій
  sheetTab: 'control',
  list: null,            // { title, entities: () => [...], empty, show }
});

const layers = [];       // функції закриття, верхня — остання

export function pushLayer(close) {
  layers.push(close);
  history.pushState({ itcity: layers.length }, '');
}

/** Закрити верхній шар так само, як це зробив би жест «назад». */
export function back() {
  if (layers.length) history.back();
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const close = layers.pop();
    if (close) close();
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
