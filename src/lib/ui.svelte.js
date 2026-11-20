export const ui = $state({
  view: 'home',          // home | rooms | energy | more
  room: null,            // area_id для перегляду кімнати
  sheet: null,           // відкритий пристрій { device }
  sheetTab: 'control',
});

export function openDevice(device) {
  ui.sheet = device;
  ui.sheetTab = 'control';
}
export function closeSheet() { ui.sheet = null; }
