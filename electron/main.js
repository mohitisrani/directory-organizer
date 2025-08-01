// electron/main.js
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;
let mainWindow;

function initDB() {
  db = new Database(path.join(__dirname, '../database.sqlite'));
  db.prepare(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      path TEXT
    )
  `).run();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL('http://localhost:5173');
}

app.whenReady().then(() => {
  initDB();
  createWindow();
});

ipcMain.handle('get-documents', () => {
  return db.prepare('SELECT * FROM documents').all();
});

ipcMain.handle('add-document', (_, doc) => {
  db.prepare('INSERT INTO documents (name, path) VALUES (?, ?)').run(doc.name, doc.path);
  const updatedDocs = db.prepare('SELECT * FROM documents').all();
  mainWindow.webContents.send('documents-updated', updatedDocs);
  return true;
});

// ✅ Pick a real file
ipcMain.handle('pick-and-add-document', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;

  const filePath = filePaths[0];
  const fileName = path.basename(filePath);

  db.prepare('INSERT INTO documents (name, path) VALUES (?, ?)').run(fileName, filePath);
  const newDoc = db.prepare('SELECT * FROM documents ORDER BY id DESC LIMIT 1').get();
  mainWindow.webContents.send('documents-updated', db.prepare('SELECT * FROM documents').all());
  return newDoc;
});
