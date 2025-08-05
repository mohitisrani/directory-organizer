
// ======================= IMPORTS =======================
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';

// Third-party libraries
import db from './db.js';
import { pipeline } from '@xenova/transformers';
import pdf from 'pdf-parse';
import { PDFDocument } from 'pdf-lib';
import Tesseract from 'tesseract.js';

// ======================= GLOBALS =======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let embedder = null;

// ======================= WINDOW CREATION =======================
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
  createWindow();
});

// ======================= UTILITY FUNCTIONS =======================
function getFileMetadata(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return { size: stats.size, lastModified: stats.mtime.toISOString() };
  } catch {
    return { size: null, lastModified: null };
  }
}

function getAllFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(getAllFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

function chunkText(text, chunkSize = 1000, overlap = 100) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function extractText(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '';
    const ext = path.extname(filePath).toLowerCase();

    // Text files
    if (['.txt', '.md', '.csv', '.json', '.log'].includes(ext)) {
      return fs.readFileSync(filePath, 'utf-8').slice(0, 20000);
    }

    // PDF files
    if (ext === '.pdf') {
      const absPath = path.resolve(filePath);
      const dataBuffer = fs.readFileSync(absPath);
      const pdfData = await pdf(dataBuffer);
      let extractedText = (pdfData.text || '').trim();

      // Fallback to OCR if minimal text
      if (extractedText.length < 50) {
        const tempDir = path.join(__dirname, 'ocr-temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        execSync(`pdftoppm "${absPath}" "${tempDir}/page" -png`);
        const pngFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.png'));
        for (const pngFile of pngFiles) {
          const imgPath = path.join(tempDir, pngFile);
          const { data: { text } } = await Tesseract.recognize(imgPath, 'eng');
          extractedText += '\n' + text;
          fs.unlinkSync(imgPath);
        }
      }

      return extractedText.slice(0, 20000);
    }
    return '';
  } catch {
    return '';
  }
}

async function generateEmbedding(text) {
  if (!text || !text.trim()) return null;
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// ======================= IPC HANDLERS =======================

// -- Document CRUD --
ipcMain.handle('get-documents', async () => db.prepare('SELECT * FROM documents').all());

ipcMain.handle('update-document', async (_, { id, category, tags }) => {
  if (category !== undefined) db.prepare('UPDATE documents SET category=? WHERE id=?').run(category, id);
  if (tags !== undefined) db.prepare('UPDATE documents SET tags=? WHERE id=?').run(tags, id);
  mainWindow.webContents.send('documents-updated', db.prepare('SELECT * FROM documents').all());
});

ipcMain.handle('delete-document', (event, docIds) => {
  const ids = Array.isArray(docIds) ? docIds : [docIds];
  const deleteChunks = db.prepare('DELETE FROM document_chunks WHERE document_id = ?');
  const deleteDoc = db.prepare('DELETE FROM documents WHERE id = ?');
  const transaction = db.transaction((idsToDelete) => {
    for (const id of idsToDelete) {
      deleteChunks.run(id);
      deleteDoc.run(id);
    }
  });
  transaction(ids);
  mainWindow.webContents.send('documents-updated', db.prepare('SELECT * FROM documents').all());
  return true;
});

// -- File Adding / Drag & Drop --
ipcMain.handle('pick-and-add-documents', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
  if (canceled || filePaths.length === 0) return null;
  const insert = db.prepare('INSERT OR IGNORE INTO documents (name, path, size, lastModified) VALUES (?, ?, ?, ?)');
  const newDocs = [];
  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    const exists = db.prepare('SELECT 1 FROM documents WHERE path = ?').get(filePath);
    if (exists) continue;
    const meta = getFileMetadata(filePath);
    insert.run(fileName, filePath, meta.size, meta.lastModified);
    const doc = db.prepare('SELECT * FROM documents WHERE path = ?').get(filePath);
    newDocs.push(doc);
  }
  mainWindow.webContents.send('documents-updated', db.prepare('SELECT * FROM documents').all());
  return newDocs;
});

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
  mainWindow.webContents.send('documents-updated', db.prepare('SELECT * FROM documents').all());
  return db.prepare('SELECT * FROM documents').all();
});

ipcMain.handle('add-dropped-files', (event, filePaths) => {
  const insert = db.prepare('INSERT OR IGNORE INTO documents (name, path, size, lastModified) VALUES (?, ?, ?, ?)');
  function processPath(p) {
    const stats = fs.statSync(p);
    if (stats.isDirectory()) fs.readdirSync(p).forEach(entry => processPath(path.join(p, entry)));
    else {
      const meta = getFileMetadata(p);
      insert.run(path.basename(p), p, meta.size, meta.lastModified);
    }
  }
  filePaths.forEach(processPath);
  mainWindow.webContents.send('documents-updated', db.prepare('SELECT * FROM documents').all());
  return db.prepare('SELECT * FROM documents').all();
});

// -- File Operations --
ipcMain.handle('file-exists', (_, filePath) => fs.existsSync(filePath));
ipcMain.handle('show-in-finder', (_, filePath) => shell.showItemInFolder(filePath));
ipcMain.handle('open-file', async (_, filePath) => shell.openPath(filePath));

ipcMain.handle('read-file-content', async (_, filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (['.txt', '.md', '.json', '.log', '.csv'].includes(ext))
      return { type: 'text', content: fs.readFileSync(filePath, 'utf-8').slice(0, 5000) };
    if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext))
      return { type: 'image', content: `data:image/${ext.replace('.', '')};base64,${fs.readFileSync(filePath).toString('base64')}` };
    if (ext === '.pdf')
      return { type: 'pdf', content: `data:application/pdf;base64,${fs.readFileSync(filePath).toString('base64')}` };
    return { type: 'unsupported', content: null };
  } catch {
    return { type: 'error', content: null };
  }
});

ipcMain.handle('check-missing-files', () => {
  const docs = db.prepare('SELECT * FROM documents').all();
  const missing = [];
  for (const doc of docs) if (!fs.existsSync(doc.path)) missing.push(doc.id);
  if (missing.length > 0) db.prepare(`DELETE FROM documents WHERE id IN (${missing.join(',')})`).run();
  mainWindow.webContents.send('documents-updated', db.prepare('SELECT * FROM documents').all());
  return missing.length;
});

// -- Embeddings & Semantic Search --
ipcMain.handle('generate-document-embedding', async (_, docId) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
  if (!doc) return null;
  const chunkExists = db.prepare('SELECT 1 FROM document_chunks WHERE document_id=? LIMIT 1').get(docId);
  if (chunkExists) return 0;
  const text = await extractText(doc.path);
  if (!text.trim()) return null;
  const chunks = chunkText(text, 1000, 100);
  const model = await getEmbedder();
  let totalEmbeddings = 0;
  let docVectorSum = null;
  for (let i = 0; i < chunks.length; i++) {
    const output = await model(chunks[i], { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data);
    if (!docVectorSum) docVectorSum = embedding.slice();
    else for (let j = 0; j < embedding.length; j++) docVectorSum[j] += embedding[j];
    db.prepare('INSERT INTO document_chunks (document_id, chunk_index, content, embedding) VALUES (?, ?, ?, ?)')
      .run(docId, i, chunks[i], JSON.stringify(embedding));
    totalEmbeddings++;
  }
  if (docVectorSum) {
    const avgEmbedding = docVectorSum.map(v => v / totalEmbeddings);
    db.prepare('UPDATE documents SET embedding=? WHERE id=?').run(JSON.stringify(avgEmbedding), docId);
  }
  return totalEmbeddings;
});

ipcMain.handle('semantic-search', async (_, query, topK = 5) => {
  const qEmbed = await generateEmbedding(query);
  if (!qEmbed) return [];
  const chunks = db.prepare('SELECT * FROM document_chunks').all();
  if (chunks.length === 0) return [];
  const scoredChunks = chunks.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(qEmbed, JSON.parse(chunk.embedding))
  }));
  const bestChunksByDoc = {};
  for (const chunk of scoredChunks) {
    const docId = chunk.document_id;
    if (!bestChunksByDoc[docId] || bestChunksByDoc[docId].score < chunk.score) bestChunksByDoc[docId] = chunk;
  }
  return Object.values(bestChunksByDoc)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(chunk => {
      const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(chunk.document_id);
      return { ...doc, score: chunk.score, snippet: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? '...' : '') };
    });
});

// -- Collections CRUD --
ipcMain.handle('get-collections', () => db.prepare('SELECT * FROM collections ORDER BY createdAt DESC').all());
ipcMain.handle('create-collection', (_, { name, description = '', color = null }) => {
  const info = db.prepare('INSERT INTO collections (name, description, color) VALUES (?, ?, ?)')
    .run(name, description, color);
  return { id: info.lastInsertRowid, name, description, color };
});
ipcMain.handle('delete-collection', (_, collectionId) => {
  db.prepare('DELETE FROM collection_documents WHERE collection_id=?').run(collectionId);
  db.prepare('DELETE FROM collections WHERE id=?').run(collectionId);
  return true;
});
ipcMain.handle('get-collection-docs', (_, collectionId) => db.prepare(
  'SELECT d.* FROM documents d JOIN collection_documents cd ON d.id = cd.document_id WHERE cd.collection_id=?'
).all(collectionId));
ipcMain.handle('add-docs-to-collection', (_, { collectionId, docIds }) => {
  const insert = db.prepare('INSERT OR IGNORE INTO collection_documents (collection_id, document_id) VALUES (?, ?)');
  db.transaction(ids => { for (const docId of ids) insert.run(collectionId, docId); })(docIds);
  return true;
});
ipcMain.handle('remove-doc-from-collection', (_, { collectionId, docId }) => {
  db.prepare('DELETE FROM collection_documents WHERE collection_id=? AND document_id=?')
    .run(collectionId, docId);
  return true;
});

// -- DB Import/Export --
ipcMain.handle('export-db', async () => {
  const { filePath } = await dialog.showSaveDialog({ title: 'Export Database', defaultPath: 'documents-backup.sqlite', filters: [{ name: 'SQLite DB', extensions: ['sqlite'] }] });
  if (!filePath) return false;
  fs.copyFileSync(path.join(__dirname, '..', 'database.sqlite'), filePath);
  return true;
});

ipcMain.handle('import-db', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'SQLite DB', extensions: ['sqlite'] }] });
  if (canceled || filePaths.length === 0) return false;
  fs.copyFileSync(filePaths[0], path.join(__dirname, '..', 'database.sqlite'));
  mainWindow.webContents.send('documents-updated', db.prepare('SELECT * FROM documents').all());
  return true;
});