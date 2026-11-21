# ITCITY Home

**English** · [Українська](#українською) · [☕ Support](#support)

A clean, touch-friendly dashboard for **Home Assistant** in the style of modern smart-home apps: rooms, square tiles, and a device sheet with tabs that opens when you tap a tile. It runs as a Home Assistant add-on (app) and appears in the sidebar. Works on phones, tablets and desktops.

## Features

- 🏠 **Home**: greeting, weather with forecast, a clickable summary (lights on, open doors, batteries, offline devices), power-outage schedule (`ukraine_outages` integration), quick scenes, live camera, and favourites you reorder by dragging
- 🔔 **Notifications bell**: a feed of household events (gate, doors, leaks, outages, appliances) plus Home Assistant system notifications
- 🧱 **Rooms**: devices from the HA registry, grouped by floor and area. Duplicate devices from different integrations are merged
- 🎛 **Device sheet**: Controls · Parameters · Charts (multi-series; hour/day/week/month/year) · Automations · History
- 🌡 **Climate**: a built-in heating engine with zones (several sensors averaged, offset, valve switch, comfort/eco/night/away presets, weekly schedule, window-open detection, boost, frost guard). It also includes weather-compensated control for a Vaillant boiler over eBUS
- 🔥 **Boiler card**: manual/auto mode, flow and hot-water setpoints, pressure, return temperature
- 📺 **Media**: player controls, volume, sources, a TV remote D-pad, and YouTube launch (Chromecast / Android TV)
- ⚡ **Energy**: 3-phase meter, day/night tariff consumption in kWh and money
- 📹 **Cameras**: live HLS video on the home screen, fullscreen on tap
- 📱 Bottom navigation on phones, side menu on tablet/desktop, dark/light theme, back gesture closes sheets. Ukrainian UI

## Installation (Home Assistant OS)

1. **Settings → Apps (Add-ons) → Store → ⋮ → Repositories**, then add `https://github.com/vova275/itcity-home`
2. Install **ITCITY Home**, start it and enable **Show in sidebar**.
3. Optional: make it the default panel (**Profile → Dashboard**).

No token is needed. The app talks to Home Assistant through the Supervisor, so the token never reaches the browser.

## Development

```bash
npm install
HA_URL=http://<ha-ip> HA_TOKEN=<long-lived-token> PORT=8099 node server.js   # backend
npm run dev                                                                   # frontend with HMR
```

Stack: Svelte 5 + Vite SPA, a small Node server (static files, WebSocket proxy to HA, climate engine, notifications log).

## Support

If ITCITY Home is useful to you, you can say thanks here 💛

[![Support via Monobank](https://img.shields.io/badge/☕_Buy_me_a_coffee-Monobank-000000?style=for-the-badge)](https://send.monobank.ua/jar/7Zv7oTCnWc)

Any Visa / Mastercard, Apple Pay or Google Pay works, from any country.

Licence: MIT.

---

## Українською

Зручний дашборд для **Home Assistant** у стилі застосунків розумного дому: кімнати, квадратні плитки, а тап по плитці відкриває картку пристрою з вкладками.

- 🏠 **Дім**: привітання, погода, зведення, графік відключень світла, сценарії, камера наживо, вибрані пристрої (порядок змінюється перетягуванням)
- 🔔 **Дзвіночок**: стрічка сповіщень дому та системні повідомлення HA
- 🧱 **Кімнати**: пристрої з реєстру HA, згруповані за поверхами й кімнатами
- 🎛 **Картка пристрою**: Керування · Параметри · Графіки · Автоматизації · Історія
- 🌡 **Клімат**: зони, розклад, пресети, відкрите вікно, буст, керування котлом Vaillant через eBUS
- ⚡ **Енергія**: лічильник по фазах, облік день/ніч у кВт·год і гривнях
- 📱 Телефон (нижня панель), 📟 планшет і ПК (бокове меню), темна/світла тема

### Встановлення

1. **Налаштування → Застосунки → Магазин → ⋮ → Репозиторії**, додати `https://github.com/vova275/itcity-home`
2. Встановити **ITCITY Home**, запустити, увімкнути «Показувати в боковому меню».

### Подякувати

Якщо застосунок вам корисний, можна підтримати автора 💛

[![Подякувати через Монобанку](https://img.shields.io/badge/☕_Подякувати-Банка_Monobank-000000?style=for-the-badge)](https://send.monobank.ua/jar/7Zv7oTCnWc)
