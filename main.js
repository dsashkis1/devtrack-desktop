const { app, BrowserWindow, shell, dialog } = require('electron');
const path   = require('path');
const fs     = require('fs');
const { exec } = require('child_process');
const express  = require('express');
const cors     = require('cors');
const initSqlJs = require('sql.js');

let db;
const DB_PATH = path.join(app.getPath('userData'), 'devtrack.db');

function getWasmPath() {
  if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'sql-wasm.wasm'))) {
    return path.join(process.resourcesPath, 'sql-wasm.wasm');
  }
  return path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
}

async function initDB() {
  const SQL = await initSqlJs({ locateFile: () => getWasmPath() });
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  db.run(`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, data TEXT NOT NULL, created TEXT NOT NULL)`);
  saveDB();
}

function saveDB() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function dbAll(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbRun(sql, params) {
  db.run(sql, params || []);
  saveDB();
}

const api = express();
api.use(cors({ origin: '*' }));
api.use(express.json());

api.get('/api/health', (req, res) => res.json({ status: 'ok', local: true }));

api.get('/api/projects', (req, res) => {
  res.json(dbAll('SELECT data FROM projects ORDER BY created DESC').map(r => JSON.parse(r.data)));
});

api.post('/api/projects', (req, res) => {
  const p = { ...req.body, id: 'p' + Date.now(), created: req.body.created || new Date().toISOString().slice(0,10), versions: req.body.versions || [] };
  dbRun('INSERT INTO projects (id, data, created) VALUES (?, ?, ?)', [p.id, JSON.stringify(p), p.created]);
  res.status(201).json(p);
});

api.put('/api/projects/:id', (req, res) => {
  dbRun('UPDATE projects SET data = ? WHERE id = ?', [JSON.stringify(req.body), req.params.id]);
  res.json(req.body);
});

api.delete('/api/projects/:id', (req, res) => {
  dbRun('DELETE FROM projects WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

api.post('/api/projects/:id/versions', (req, res) => {
  const rows = dbAll('SELECT data FROM projects WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  const p = JSON.parse(rows[0].data);
  (p.versions = p.versions || []).push({ date: new Date().toISOString().slice(0,10), note: req.body.note });
  dbRun('UPDATE projects SET data = ? WHERE id = ?', [JSON.stringify(p), req.params.id]);
  res.json(p);
});

api.post('/api/run', (req, res) => {
  const { bat_path, exe_cmd, work_dir } = req.body;
  const cmd = bat_path ? `start "" "${bat_path}"` : `start cmd /k "${exe_cmd}"`;
  exec(cmd, { shell: true, cwd: work_dir || undefined }, err =>
    err ? res.status(500).json({ error: err.message }) : res.json({ ok: true }));
});

api.post('/api/open-folder', (req, res) => {
  shell.openPath(req.body.path || '').then(err =>
    err ? res.status(500).json({ error: err }) : res.json({ ok: true }));
});

api.get('/api/pick-folder', async (req, res) => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'בחר תיקיית פרויקט' });
  res.json(r.canceled ? { canceled: true } : { path: r.filePaths[0] });
});

api.get('/api/pick-file', async (req, res) => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Executable', extensions: ['bat','exe','cmd','sh','py','js'] }, { name: 'All Files', extensions: ['*'] }], title: 'בחר קובץ הרצה' });
  res.json(r.canceled ? { canceled: true } : { path: r.filePaths[0] });
});

api.get('/api/pick-json', async (req, res) => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }], title: 'בחר קובץ גיבוי JSON' });
  if (r.canceled) return res.json({ canceled: true });
  try { res.json({ content: fs.readFileSync(r.filePaths[0], 'utf-8'), filename: path.basename(r.filePaths[0]) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

let mainWindow, server;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 600,
    title: 'DevTrack', backgroundColor: '#0f0f0f',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true }
  });
  mainWindow.loadURL('http://localhost:7474');
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(async () => {
  try {
    await initDB();
    server = api.listen(7474, '127.0.0.1', () => { createWindow(); });
  } catch (err) {
    dialog.showErrorBox('שגיאת הפעלה', err.message);
    app.quit();
  }
});

app.on('window-all-closed', () => { if (server) server.close(); if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
