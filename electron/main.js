import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from './db.js';
import { pipeline } from '@xenova/transformers';
import pdf from 'pdf-parse'; // ✅ Needed for extractText()

import { PDFDocument } from 'pdf-lib';
import Tesseract from 'tesseract.js';

import { execSync } from 'child_process';

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

// Fetch all documents
ipcMain.handle('get-documents', async () => {
  return db.prepare('SELECT * FROM documents').all();
});

// Update category/tags
ipcMain.handle('update-document', async (_, { id, category, tags }) => {
  if (category !== undefined) {
    db.prepare('UPDATE documents SET category = ? WHERE id = ?').run(category, id);
  }
  if (tags !== undefined) {
    db.prepare('UPDATE documents SET tags = ? WHERE id = ?').run(tags, id);
  }
  const updatedDocs = db.prepare('SELECT * FROM documents').all();
  mainWindow.webContents.send('documents-updated', updatedDocs);
});

// Safe delete-document handler with chunk cleanup
ipcMain.handle('delete-document', (event, docIds) => {
  // Support both single ID and array of IDs
  const ids = Array.isArray(docIds) ? docIds : [docIds];

  const deleteChunks = db.prepare('DELETE FROM document_chunks WHERE document_id = ?');
  const deleteDoc = db.prepare('DELETE FROM documents WHERE id = ?');

  const transaction = db.transaction((idsToDelete) => {
    for (const id of idsToDelete) {
      // Delete chunks first to avoid FK errors
      deleteChunks.run(id);
      deleteDoc.run(id);
    }
  });

  transaction(ids);

  const updatedDocs = db.prepare('SELECT * FROM documents').all();
  mainWindow.webContents.send('documents-updated', updatedDocs);

  return true;
});


ipcMain.handle('pick-and-add-documents', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections']
  });

  if (canceled || filePaths.length === 0) return null;

  const insert = db.prepare(
    'INSERT OR IGNORE INTO documents (name, path, size, lastModified) VALUES (?, ?, ?, ?)'
  );

  const newDocs = [];

  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);

    // Skip duplicates
    const exists = db.prepare('SELECT 1 FROM documents WHERE path = ?').get(filePath);
    if (exists) continue;

    const meta = getFileMetadata(filePath);
    insert.run(fileName, filePath, meta.size, meta.lastModified);

    const doc = db.prepare('SELECT * FROM documents WHERE path = ?').get(filePath);
    newDocs.push(doc);
  }

  const updatedDocs = db.prepare('SELECT * FROM documents').all();
  mainWindow.webContents.send('documents-updated', updatedDocs);
  return newDocs;
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

// Drag & drop handler
ipcMain.handle('add-dropped-files', (event, filePaths) => {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO documents (name, path, size, lastModified) VALUES (?, ?, ?, ?)'
  );

  function processPath(p) {
    const stats = fs.statSync(p);
    if (stats.isDirectory()) {
      const entries = fs.readdirSync(p);
      for (const entry of entries) {
        processPath(path.join(p, entry));
      }
    } else {
      const meta = getFileMetadata(p);
      insert.run(path.basename(p), p, meta.size, meta.lastModified);
    }
  }

  filePaths.forEach(processPath);

  const updatedDocs = db.prepare('SELECT * FROM documents').all();
  mainWindow.webContents.send('documents-updated', updatedDocs);
  return updatedDocs;
});


ipcMain.handle('show-in-finder', (_, filePath) => shell.showItemInFolder(filePath));
ipcMain.handle('open-file', async (_, filePath) => shell.openPath(filePath));

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

// Update tags/category
ipcMain.handle('update-doc-metadata', (event, { id, category, tags }) => {
  db.prepare('UPDATE documents SET category=?, tags=? WHERE id=?').run(category, tags, id);
  const updatedDocs = db.prepare('SELECT * FROM documents').all();
  mainWindow.webContents.send('documents-updated', updatedDocs);
  return true;
});

// Export DB
ipcMain.handle('export-db', async () => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export Database',
    defaultPath: 'documents-backup.sqlite',
    filters: [{ name: 'SQLite DB', extensions: ['sqlite'] }]
  });

  if (!filePath) return false;
  fs.copyFileSync(path.join(__dirname, '..', 'database.sqlite'), filePath);
  return true;
});

// Import DB
ipcMain.handle('import-db', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'SQLite DB', extensions: ['sqlite'] }]
  });

  if (canceled || filePaths.length === 0) return false;

  const importPath = filePaths[0];
  fs.copyFileSync(importPath, path.join(__dirname, '..', 'database.sqlite'));

  const updatedDocs = db.prepare('SELECT * FROM documents').all();
  mainWindow.webContents.send('documents-updated', updatedDocs);
  return true;
});


ipcMain.handle('file-exists', (_, filePath) => {
  return fs.existsSync(filePath);
});

ipcMain.handle('read-file-content', async (_, filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();

    // --- TEXT ---
    if (['.txt', '.md', '.json', '.log', '.csv'].includes(ext)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return { type: 'text', content: data.slice(0, 5000) };
    }

    // --- IMAGE as Base64 ---
    if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
      const data = fs.readFileSync(filePath);
      const base64 = `data:image/${ext.replace('.', '')};base64,${data.toString('base64')}`;
      return { type: 'image', content: base64 };
    }

    // --- PDF as Base64 ---
    if (ext === '.pdf') {
      const data = fs.readFileSync(filePath);
      const base64 = `data:application/pdf;base64,${data.toString('base64')}`;
      return { type: 'pdf', content: base64 };
    }

    return { type: 'unsupported', content: null };
  } catch (err) {
    console.error('Error reading file for preview:', err);
    return { type: 'error', content: null };
  }
});

let embedder = null;
async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}


// -------------------- TEXT EXTRACTION & EMBEDDINGS --------------------

async function extractText(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn('⚠️ File not found, skipping embedding:', filePath);
      return '';
    }

    const ext = path.extname(filePath).toLowerCase();

    // 1. Text-based files
    if (['.txt', '.md', '.csv', '.json', '.log'].includes(ext)) {
      return fs.readFileSync(filePath, 'utf-8').slice(0, 20000);
    }

    // 2. PDF: Try pdf-parse first
    if (ext === '.pdf') {
      const absPath = path.resolve(filePath);
      const dataBuffer = fs.readFileSync(absPath);
      const pdfData = await pdf(dataBuffer);

      let extractedText = (pdfData.text || '').trim();

      // 3. Fallback to OCR if very little text
      if (extractedText.length < 50) {
        console.log('⚡ Running OCR on PDF images:', filePath);
        const tempDir = path.join(__dirname, 'ocr-temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        // Convert PDF to PNG images using poppler
        execSync(`pdftoppm "${absPath}" "${tempDir}/page" -png`);

        // Process each page
        const pngFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.png'));
        for (const pngFile of pngFiles) {
          console.log('🖼 OCR processing:', pngFile);
          const imgPath = path.join(tempDir, pngFile);
          const { data: { text } } = await Tesseract.recognize(imgPath, 'eng');
          extractedText += '\n' + text;
          fs.unlinkSync(imgPath); // cleanup page image
        }
      }

      return extractedText.slice(0, 20000);
    }

    return '';
  } catch (err) {
    console.error('❌ OCR/Text extraction failed for', filePath, err);
    return '';
  }
}

// Generate embedding
async function generateEmbedding(text) {
  if (!text || !text.trim()) return null;
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data); // Float32Array → JS Array
}

// Generate embedding for one document
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

ipcMain.handle('generate-document-embedding', async (_, docId) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
  if (!doc) return null;

  const text = await extractText(doc.path);
  if (!text.trim()) {
    console.warn('⚠️ No text extracted for embedding:', doc.path);
    return null;
  }

  const chunks = chunkText(text, 1000, 100); // ~1k chars with 100 overlap
  const model = await getEmbedder();
  let totalEmbeddings = 0;

  // Remove old chunks if regenerating
  db.prepare('DELETE FROM document_chunks WHERE document_id=?').run(docId);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const output = await model(chunk, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data);

    db.prepare(`
      INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
      VALUES (?, ?, ?, ?)
    `).run(docId, i, chunk, JSON.stringify(embedding));

    totalEmbeddings++;
  }

  console.log(`✅ Generated ${totalEmbeddings} chunk embeddings for ${doc.name}`);

  // Keep doc.embedding as NULL for now to not break existing logic
  return totalEmbeddings;
});



// Cosine similarity
function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Semantic search IPC
ipcMain.handle('semantic-search', async (_, query, topK = 5) => {
  console.log(`🔍 Semantic search started for query: "${query}"`);

  const qEmbed = await generateEmbedding(query);
  if (!qEmbed) return [];

  const chunks = db.prepare('SELECT * FROM document_chunks').all();
  if (chunks.length === 0) {
    console.warn('⚠️ No chunk embeddings found.');
    return [];
  }

  // Score all chunks
  const scoredChunks = chunks.map(chunk => {
    const embedding = JSON.parse(chunk.embedding);
    const score = cosineSimilarity(qEmbed, embedding);
    return { ...chunk, score };
  });

  // Group by document and keep only top chunk per doc
  const bestChunksByDoc = {};
  for (const chunk of scoredChunks) {
    const docId = chunk.document_id;
    if (!bestChunksByDoc[docId] || bestChunksByDoc[docId].score < chunk.score) {
      bestChunksByDoc[docId] = chunk;
    }
  }

  // Convert to array and sort by score
  const topDocs = Object.values(bestChunksByDoc)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(chunk => {
      const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(chunk.document_id);
      return {
        ...doc,
        score: chunk.score,
        snippet: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? '...' : '')
      };
    });

  console.log(`✅ Top ${topK} semantic results for "${query}":`);
  topDocs.forEach((res, i) => console.log(` ${i + 1}. ${res.name} → ${res.score.toFixed(4)}`));

  return topDocs;
});




