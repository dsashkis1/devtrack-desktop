const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const { exec } = require('child_process');
const express = require('express');
const cors = require('cors');

const RENDER_API = 'https://devtrack-y6ef.onrender.com';

// ── EXPRESS — מגשר בין הדפדפן לRender + פעולות מקומיות ──
const api = express();
api.use(cors({ origin: '*' }));
api.use(express.json());

// proxy לכל /api/* → Render
const http = require('http');
const https = require('https');

function proxyToRender(req, res) {
  const url = new URL(RENDER_API + req.url);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: req.method,
    headers: { 'Content-Type': 'application/json' }
  };
  const proxyReq = https.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
    proxyRes.pipe(res);
  });
  proxyReq.on('error', e => res.status(502).json({ error: e.message }));
  if (req.body && Object.keys(req.body).length) {
    proxyReq.write(JSON.stringify(req.body));
  }
  proxyReq.end();
}

// פעולות מקומיות — הרצה, סייר, dialog
api.post('/api/run', (req, res) => {
  const { bat_path, exe_cmd, work_dir } = req.body;
  const cmd = bat_path ? `start "" "${bat_path}"` : `start cmd /k "${exe_cmd}"`;
  exec(cmd, { shell: true, cwd: work_dir || undefined },
    err => err ? res.status(500).json({ error: err.message }) : res.json({ ok: true }));
});

api.post('/api/open-folder', (req, res) => {
  shell.openPath(req.body.path || '')
    .then(err => err ? res.status(500).json({ error: err }) : res.json({ ok: true }));
});

api.get('/api/pick-folder', async (req, res) => {
  const r = await dialog.showOpenDialog(mainWindow,
    { properties: ['openDirectory'], title: 'בחר תיקיית פרויקט' });
  res.json(r.canceled ? { canceled: true } : { path: r.filePaths[0] });
});

api.get('/api/pick-file', async (req, res) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Executable', extensions: ['bat','exe','cmd','sh','py','js'] },
              { name: 'All Files', extensions: ['*'] }],
    title: 'בחר קובץ הרצה'
  });
  res.json(r.canceled ? { canceled: true } : { path: r.filePaths[0] });
});

api.get('/api/pick-json', async (req, res) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
    title: 'בחר קובץ גיבוי JSON'
  });
  if (r.canceled) return res.json({ canceled: true });
  try {
    res.json({ content: fs.readFileSync(r.filePaths[0], 'utf-8'),
               filename: path.basename(r.filePaths[0]) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// כל שאר הבקשות → Render
api.use('/api', proxyToRender);

// ── WINDOW ────────────────────────────────────────────────
let mainWindow, server;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 600,
    title: 'DevTrack', backgroundColor: '#0f0f0f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, contextIsolation: true
    }
  });
  mainWindow.loadURL('http://localhost:7474');
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); return { action: 'deny' };
  });
}

// serve index.html
api.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'index.html'));
});

// ── STARTUP ───────────────────────────────────────────────
app.whenReady().then(() => {
  server = api.listen(7474, '127.0.0.1', () => {
    console.log('DevTrack ready, proxying to', RENDER_API);
    createWindow();
  });
  server.on('error', err => {
    dialog.showErrorBox('שגיאה', 'פורט 7474 תפוס:\n' + err.message);
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});
