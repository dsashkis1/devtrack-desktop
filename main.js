const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const { exec } = require('child_process');
const express = require('express');
const cors = require('cors');

// ── JSON STORAGE ──────────────────────────────────────────
const DATA_PATH = path.join(app.getPath('userData'), 'devtrack-projects.json');

function readProjects() {
  try {
    if (!fs.existsSync(DATA_PATH)) return [];
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  } catch { return []; }
}

function writeProjects(projects) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(projects, null, 2), 'utf-8');
}

// ── EXPRESS API ───────────────────────────────────────────
const api = express();
api.use(cors({ origin: '*' }));
api.use(express.json());

api.get('/api/health', (req, res) =>
  res.json({ status: 'ok', local: true, dataPath: DATA_PATH }));

// טעינה אוטומטית בהפעלה
api.get('/api/projects', (req, res) =>
  res.json(readProjects()));

// שמירה אוטומטית בכל שינוי
api.post('/api/projects', (req, res) => {
  const projects = readProjects();
  const p = { ...req.body,
    id: 'p' + Date.now(),
    created: req.body.created || new Date().toISOString().slice(0,10),
    versions: req.body.versions || [] };
  projects.unshift(p);
  writeProjects(projects);
  res.status(201).json(p);
});

api.put('/api/projects/:id', (req, res) => {
  const projects = readProjects();
  const i = projects.findIndex(p => p.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'not found' });
  projects[i] = req.body;
  writeProjects(projects);
  res.json(req.body);
});

api.delete('/api/projects/:id', (req, res) => {
  writeProjects(readProjects().filter(p => p.id !== req.params.id));
  res.json({ ok: true });
});

api.post('/api/projects/:id/versions', (req, res) => {
  const projects = readProjects();
  const p = projects.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  (p.versions = p.versions || []).push({
    date: new Date().toISOString().slice(0,10),
    note: req.body.note });
  writeProjects(projects);
  res.json(p);
});

// ── ייבוא JSON — החלפה מלאה ───────────────────────────────
api.post('/api/import', (req, res) => {
  const { projects } = req.body;
  if (!Array.isArray(projects)) return res.status(400).json({ error: 'invalid' });
  writeProjects(projects);
  res.json({ ok: true, count: projects.length });
});

// ── פעולות מקומיות ────────────────────────────────────────
api.post('/api/run', (req, res) => {
  const { bat_path, exe_cmd, work_dir } = req.body;
  const cmd = bat_path
    ? `start "" "${bat_path}"`
    : `start cmd /k "${exe_cmd}"`;
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
    filters: [
      { name: 'קובץ הרצה', extensions: ['bat','exe','cmd','sh','py','js'] },
      { name: 'All Files', extensions: ['*'] }
    ],
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
    res.json({
      content: fs.readFileSync(r.filePaths[0], 'utf-8'),
      filename: path.basename(r.filePaths[0])
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  server = api.listen(7474, '127.0.0.1', () => {
    console.log('DevTrack ready — data:', DATA_PATH);
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
