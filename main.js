const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path   = require('path');
const { exec, execFile } = require('child_process');
const express  = require('express');
const cors     = require('cors');
const Database = require('better-sqlite3');

// ── DB ────────────────────────────────────────────────────
const DB_PATH = path.join(app.getPath('userData'), 'devtrack.db');
let db;

function initDB() {
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id      TEXT PRIMARY KEY,
      data    TEXT NOT NULL,
      created TEXT NOT NULL
    )
  `);
}

// ── EXPRESS API ───────────────────────────────────────────
const api = express();
api.use(cors({ origin: '*' }));
api.use(express.json());

api.get('/api/health', (req, res) => {
  res.json({ status: 'ok', local: true, platform: process.platform });
});

api.get('/api/projects', (req, res) => {
  const rows = db.prepare('SELECT data FROM projects ORDER BY created DESC').all();
  res.json(rows.map(r => JSON.parse(r.data)));
});

api.post('/api/projects', (req, res) => {
  const p = req.body;
  p.id = 'p' + Date.now();
  p.created = p.created || new Date().toISOString().slice(0, 10);
  p.versions = p.versions || [];
  db.prepare('INSERT INTO projects (id, data, created) VALUES (?, ?, ?)')
    .run(p.id, JSON.stringify(p), p.created);
  res.status(201).json(p);
});

api.put('/api/projects/:id', (req, res) => {
  const p = req.body;
  db.prepare('UPDATE projects SET data = ? WHERE id = ?')
    .run(JSON.stringify(p), req.params.id);
  res.json(p);
});

api.delete('/api/projects/:id', (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

api.post('/api/projects/:id/versions', (req, res) => {
  const row = db.prepare('SELECT data FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const p = JSON.parse(row.data);
  p.versions = p.versions || [];
  p.versions.push({ date: new Date().toISOString().slice(0, 10), note: req.body.note });
  db.prepare('UPDATE projects SET data = ? WHERE id = ?').run(JSON.stringify(p), req.params.id);
  res.json(p);
});

// הרצת .bat / פקודה
api.post('/api/run', (req, res) => {
  const { bat_path, exe_cmd, work_dir } = req.body;
  if (bat_path) {
    exec(`start "" "${bat_path}"`, { shell: true }, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
  } else if (exe_cmd) {
    const opts = { shell: true, cwd: work_dir || undefined };
    exec(`start cmd /k "${exe_cmd}"`, opts, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
  } else {
    res.status(400).json({ error: 'bat_path או exe_cmd נדרשים' });
  }
});

// פתיחת תיקייה
api.post('/api/open-folder', (req, res) => {
  const { path: folderPath } = req.body;
  if (!folderPath) return res.status(400).json({ error: 'path נדרש' });
  shell.openPath(folderPath).then(err => {
    if (err) return res.status(500).json({ error: err });
    res.json({ ok: true });
  });
});

// בחירת קובץ/תיקייה דרך dialog
api.get('/api/pick-folder', async (req, res) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'בחר תיקיית פרויקט'
  });
  if (result.canceled) return res.json({ canceled: true });
  res.json({ path: result.filePaths[0] });
});

api.get('/api/pick-file', async (req, res) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Executable', extensions: ['bat', 'exe', 'cmd', 'sh', 'py', 'js'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    title: 'בחר קובץ הרצה'
  });
  if (result.canceled) return res.json({ canceled: true });
  res.json({ path: result.filePaths[0] });
});

api.get('/api/pick-json', async (req, res) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
    title: 'בחר קובץ גיבוי JSON'
  });
  if (result.canceled) return res.json({ canceled: true });
  const fs = require('fs');
  try {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    res.json({ content, filename: path.basename(result.filePaths[0]) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── WINDOW ────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'DevTrack',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL('http://localhost:7474');

  // פתיחת קישורים חיצוניים בדפדפן
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── STARTUP ───────────────────────────────────────────────
app.whenReady().then(() => {
  initDB();
  api.listen(7474, '127.0.0.1', () => {
    console.log('DevTrack API on http://localhost:7474');
    createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
