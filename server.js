// itcity-home server: віддає зібраний інтерфейс і проксує WebSocket до Home Assistant.
// Токен ніколи не потрапляє в браузер: сервер сам проходить авторизацію HA.
//
// Змінні середовища:
//   PORT      — порт (8099)
//   HA_URL    — адреса HA. В аддоні: http://supervisor/core (за замовчуванням)
//   HA_TOKEN  — токен. В аддоні береться SUPERVISOR_TOKEN
//   DATA_DIR  — де зберігати налаштування (/data в аддоні)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { createClimate } from './climate.js';
import { createOutages } from './outages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8099);
const HA_URL = (process.env.HA_URL || 'http://supervisor/core').replace(/\/$/, '');
const HA_TOKEN = process.env.HA_TOKEN || process.env.SUPERVISOR_TOKEN || '';
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data'));
const DIST = path.join(__dirname, 'dist');
const CONFIG_FILE = path.join(DATA_DIR, 'itcity-home.json');

const upstreamWs = HA_URL.endsWith('/core')
  ? HA_URL.replace(/^http/, 'ws') + '/websocket'
  : HA_URL.replace(/^http/, 'ws') + '/api/websocket';

if (!HA_TOKEN) console.warn('[itcity-home] HA_TOKEN/SUPERVISOR_TOKEN не задано — підключення до HA не вдасться');
fs.mkdirSync(DATA_DIR, { recursive: true });
const climate = createClimate({ dataDir: DATA_DIR, haWsUrl: upstreamWs, token: HA_TOKEN });
const outages = createOutages({ dataDir: DATA_DIR, haWsUrl: upstreamWs, token: HA_TOKEN });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}

const frames = {}; // entity -> { t, busy: Promise }
function haPost(pathname, body) {
  return new Promise((resolve) => {
    const u = new URL(HA_URL + '/api/' + pathname);
    const r = http.request(u, { method: 'POST', headers: { Authorization: `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' }, timeout: 30000 }, (x) => { x.resume(); x.on('end', () => resolve(x.statusCode)); });
    r.on('error', () => resolve(0)); r.on('timeout', () => { r.destroy(); resolve(0); });
    r.end(JSON.stringify(body));
  });
}
async function snapIfOld(entity) {
  const name = entity.split('.')[1];
  const f = frames[entity] || (frames[entity] = { t: 0, busy: null });
  if (Date.now() - f.t > 25000) {
    if (!f.busy) f.busy = haPost('services/shell_command/cam_snap', { file: `/config/www/cam/${name}.jpg` }).finally(() => { f.t = Date.now(); f.busy = null; });
    await f.busy;
  }
  return { url: `/local/cam/${name}.jpg?t=${f.t}`, t: f.t };
}
async function cameraRefresh(entity, res) {
  sendJson(res, 200, await snapIfOld(entity));
}
async function cameraFrame(entity, res) {
  const name = entity.split('.')[1];
  const f = frames[entity] || (frames[entity] = { t: 0, busy: null });
  if (Date.now() - f.t > 25000) {
    if (!f.busy) f.busy = haPost('services/shell_command/cam_snap', { file: `/config/www/cam/${name}.jpg` }).finally(() => { f.t = Date.now(); f.busy = null; });
    await f.busy;
  }
  const up = http.get(new URL(HA_URL + `/local/cam/${name}.jpg?t=${f.t}`), (r) => {
    res.writeHead(r.statusCode || 502, { 'Content-Type': r.headers['content-type'] || 'image/jpeg', 'Cache-Control': 'no-store' });
    r.pipe(res);
  });
  up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);

  // Камери: знімок і живе MJPEG-відео через сервер (токен HA лишається на сервері)
  const cs = p.match(/\/api\/camera\/frame\/(camera\.[\w-]+)$/);
  if (cs) return cameraFrame(cs[1], res);
  const cr = p.match(/\/api\/camera\/refresh\/(camera\.[\w-]+)$/);
  if (cr) return cameraRefresh(cr[1], res);
  const cm = p.match(/\/api\/camera\/(snap|live)\/(camera\.[\w-]+)$/);
  if (cm) {
    const base = HA_URL.endsWith('/core') ? HA_URL + '/api' : HA_URL + '/api';
    const target = `${base}/${cm[1] === 'live' ? 'camera_proxy_stream' : 'camera_proxy'}/${cm[2]}`;
    const up = http.get(target, { headers: { Authorization: `Bearer ${HA_TOKEN}` } }, (r) => {
      res.writeHead(r.statusCode || 502, { 'Content-Type': r.headers['content-type'] || 'image/jpeg', 'Cache-Control': 'no-store' });
      r.pipe(res);
    });
    up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.on('close', () => up.destroy());
    return;
  }

  if (p.endsWith('/api/outages')) return sendJson(res, 200, outages.api());
  if (p.endsWith('/api/notifications')) return sendJson(res, 200, climate.notifications());

  const ci = p.indexOf('/api/climate');
  if (ci >= 0) {
    const sub = p.slice(ci + '/api/climate'.length).replace(/^\//, '');
    if (req.method === 'GET') return sendJson(res, 200, climate.api('GET', sub));
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { sendJson(res, 200, climate.api(req.method, sub, body ? JSON.parse(body) : {})); }
      catch (e) { sendJson(res, 400, { error: String(e) }); }
    });
    return;
  }

  if (p.endsWith('/api/config')) {
    if (req.method === 'GET') return sendJson(res, 200, readConfig());
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', () => {
        try {
          const cfg = JSON.parse(body);
          fs.writeFileSync(CONFIG_FILE + '.tmp', JSON.stringify(cfg, null, 2));
          fs.renameSync(CONFIG_FILE + '.tmp', CONFIG_FILE);
          sendJson(res, 200, { ok: true });
        } catch (e) { sendJson(res, 400, { error: String(e) }); }
      });
      return;
    }
  }

  // статика (SPA)
  let file = path.normalize(path.join(DIST, p));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  fs.createReadStream(file).pipe(res);
});

// --- WebSocket-проксі: клієнт говорить звичайним протоколом HA, авторизацію робить сервер ---
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (!req.url.split('?')[0].endsWith('/api/websocket')) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (client) => bridge(client));
});

function bridge(client) {
  const upstream = new WebSocket(upstreamWs, { headers: { Authorization: `Bearer ${HA_TOKEN}` } });
  const queue = [];
  let ready = false;

  upstream.on('message', (data) => {
    const text = data.toString();
    if (!ready) {
      let msg; try { msg = JSON.parse(text); } catch { return; }
      if (msg.type === 'auth_required') return upstream.send(JSON.stringify({ type: 'auth', access_token: HA_TOKEN }));
      if (msg.type === 'auth_ok') {
        ready = true;
        client.send(JSON.stringify({ type: 'auth_ok', ha_version: msg.ha_version }));
        queue.splice(0).forEach((m) => upstream.send(m));
        return;
      }
      if (msg.type === 'auth_invalid') { client.send(JSON.stringify({ type: 'auth_invalid', message: msg.message })); client.close(); return; }
    }
    if (client.readyState === WebSocket.OPEN) client.send(text);
  });
  client.on('message', (data) => {
    const text = data.toString();
    if (ready && upstream.readyState === WebSocket.OPEN) upstream.send(text); else queue.push(text);
  });
  const closeBoth = () => { try { client.close(); } catch {} try { upstream.close(); } catch {} };
  upstream.on('close', closeBoth); upstream.on('error', closeBoth);
  client.on('close', closeBoth); client.on('error', closeBoth);
}

server.listen(PORT, () => console.log(`[itcity-home] http://0.0.0.0:${PORT} → ${upstreamWs}`));
