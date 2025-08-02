import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

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

// Utility: File metadata
function getFileMetadata(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return { size: stats.size, lastModified: stats.mtime.toISOString() };
  } catch {
    return { size: null, lastModified: null };
  }
}

// Utility: Recursive directory scan
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

app.whenReady().then(() => {
  createWindow();
});

//
// IPC HANDLERS
//

ipcMain.handle('get-documents', () => db.prepare('SELECT * FROM documents').all());

ipcMain.handle('delete-document', (event, docId) => {
  db.prepare('DELETE FROM documents WHERE id = ?').run(docId);
  const updatedDocs = db.prepare('SELECT * FROM documents').all();
  mainWindow.webContents.send('documents-updated', updatedDocs);
  return true;
});

ipcMain.handle('pick-and-add-document', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (canceled || filePaths.length === 0) return null;

  const filePath = filePaths[0];
  const fileName = path.basename(filePath);

  // Prevent duplicates
  const exists = db.prepare('SELECT 1 FROM documents WHERE path = ?').get(filePath);
  if (exists) return { duplicate: true, name: fileName, path: filePath };

  const meta = getFileMetadata(filePath);
  db.prepare('INSERT INTO documents (name, path, size, lastModified) VALUES (?, ?, ?, ?)')
    .run(fileName, filePath, meta.size, meta.lastModified);

  const updatedDocs = db.prepare('SELECT * FROM documents').all();
  mainWindow.webContents.send('documents-updated', updatedDocs);
  return updatedDocs[updatedDocs.length - 1];
});

ipcMain.handle('pick-directory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return;

  const dirPath = result.filePaths[0];
  const filePaths = getAllFiles(dirPath);

  const insert = db.prepare(
    'INSERT OR IGNORE INTO documents (name, path, size, lastModified) VALUES (?, ?, ?, ?)'
  );
  for (const filePath of filePaths) {
    const meta = getFileMetadata(filePath);
    insert.run(path.basename(filePath), filePath, meta.size, meta.lastModified);
  }

  const updatedDocs = db.prepare('SELECT * FROM documents').all();
  mainWindow.webContents.send('documents-updated', updatedDocs);
  return updatedDocs;
});

ipcMain.handle('show-in-finder', (_, filePath) => shell.showItemInFolder(filePath));
ipcMain.handle('open-file', async (_, filePath) => shell.openPath(filePath));

// ✅ Missing files check
ipcMain.handle('check-missing-files', () => {
  const docs = db.prepare('SELECT * FROM documents').all();
  const missing = [];

  for (const doc of docs) {
    if (!fs.existsSync(doc.path)) {
      missing.push(doc.id);
    }
  }

  if (missing.length > 0) {
    db.prepare(`DELETE FROM documents WHERE id IN (${missing.join(',')})`).run();
  }

  const updatedDocs = db.prepare('SELECT * FROM documents').all();
  mainWindow.webContents.send('documents-updated', updatedDocs);

  return missing.length;
});
