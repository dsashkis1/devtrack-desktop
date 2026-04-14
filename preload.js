// preload.js — context bridge (אין צורך ב-IPC כי משתמשים ב-Express API)
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('electronApp', {
  version: process.versions.electron,
});
