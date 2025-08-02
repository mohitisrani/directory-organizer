// electron/main.js
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
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
      path TEXT UNIQUE,
      size INTEGER,
      lastModified TEXT
    )
  `).run();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
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

// --- Utility: Get file metadata ---
function getFileMetadata(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
    };
  } catch {
    return { size: null, lastModified: null };
  }
}

// --- Utility: Recursively get files from a directory ---
function getAllFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

// ✅ Get all documents
ipcMain.handle('get-documents', () => {
  return db.prepare('SELECT * FROM documents').all();
});

// ✅ Delete document
ipcMain.handle('delete-document', (event, docId) => {
  db.prepare('DELETE FROM documents WHERE id = ?').run(docId);
  const updatedDocs = db.prepare('SELECT * FROM documents').all();
  mainWindow.webContents.send('documents-updated', updatedDocs);
  return true;
});

// ✅ Pick and add single document
ipcMain.handle('pick-and-add-document', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (canceled || filePaths.length === 0) return null;

  const filePath = filePaths[0];
  const fileName = path.basename(filePath);

  const exists = db.prepare('SELECT 1 FROM documents WHERE path = ?').get(filePath);
  if (exists) return { duplicate: true, name: fileName, path: filePath };

  const meta = getFileMetadata(filePath);
  db.prepare('INSERT INTO documents (name, path, size, lastModified) VALUES (?, ?, ?, ?)')
    .run(fileName, filePath, meta.size, meta.lastModified);

  const newDoc = db.prepare('SELECT * FROM documents ORDER BY id DESC LIMIT 1').get();
  mainWindow.webContents.send('documents-updated', db.prepare('SELECT * FROM documents').all());
  return newDoc;
});

// ✅ Pick a directory and add all files (recursive)
ipcMain.handle('pick-directory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return;

  const dirPath = result.filePaths[0];
  const filePaths = getAllFiles(dirPath);

  const insert = db.prepare('INSERT OR IGNORE INTO documents (name, path, size, lastModified) VALUES (?, ?, ?, ?)');
  for (const filePath of filePaths) {
    const meta = getFileMetadata(filePath);
    insert.run(path.basename(filePath), filePath, meta.size, meta.lastModified);
  }

  const updatedDocs = db.prepare('SELECT * FROM documents').all();
  mainWindow.webContents.send('documents-updated', updatedDocs);
  return updatedDocs;
});

// ✅ Show file in Finder/Explorer
ipcMain.handle('show-in-finder', async (_, filePath) => {
  shell.showItemInFolder(filePath);
});

// ✅ Open file in default app
ipcMain.handle('open-file', async (_, filePath) => {
  const result = await shell.openPath(filePath);
  return result || true;
});
