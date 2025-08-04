// electron/migrate_chunks.js
import db from './db.js';
import fs from 'fs';
import path from 'path';
import { pipeline } from '@xenova/transformers';
import pdf from 'pdf-parse';
import Tesseract from 'tesseract.js';
import { execSync } from 'child_process';

// ------------------ DB MIGRATION ------------------
db.prepare(`
  CREATE TABLE IF NOT EXISTS document_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER,
    chunk_index INTEGER,
    content TEXT,
    embedding TEXT,
    FOREIGN KEY(document_id) REFERENCES documents(id)
  )
`).run();

db.prepare('CREATE INDEX IF NOT EXISTS idx_chunks_docid ON document_chunks(document_id)').run();

console.log('✅ document_chunks table ensured.');

// ------------------ EMBEDDING UTILITIES ------------------

async function getEmbedder() {
  if (!global.embedder) {
    global.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return global.embedder;
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

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (!fs.existsSync(filePath)) return '';

  // Simple text formats
  if (['.txt', '.md', '.csv', '.json', '.log'].includes(ext)) {
    return fs.readFileSync(filePath, 'utf-8').slice(0, 50000);
  }

  // PDF parsing
  if (ext === '.pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);
    let text = (pdfData.text || '').trim();

    // Fallback to OCR if minimal text
    if (text.length < 50) {
      console.log('⚡ OCR fallback for:', filePath);
      const tempDir = path.join(process.cwd(), 'ocr-temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

      execSync(`pdftoppm "${filePath}" "${tempDir}/page" -png`);
      const pngFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.png'));
      for (const pngFile of pngFiles) {
        const imgPath = path.join(tempDir, pngFile);
        const { data: { text: ocrText } } = await Tesseract.recognize(imgPath, 'eng');
        text += '\n' + ocrText;
        fs.unlinkSync(imgPath);
      }
    }

    return text.slice(0, 50000);
  }

  return '';
}

async function generateEmbedding(text) {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// ------------------ MIGRATION PROCESS ------------------

async function migrateAllDocuments() {
  const docs = db.prepare('SELECT * FROM documents').all();
  console.log(`📄 Found ${docs.length} documents to migrate...`);

  for (const doc of docs) {
    // Skip if already chunked
    const chunkExists = db.prepare(
      'SELECT 1 FROM document_chunks WHERE document_id=? LIMIT 1'
    ).get(doc.id);
    if (chunkExists) {
      console.log(`⏩ Skipping ${doc.name}, chunks already exist.`);
      continue;
    }

    const text = await extractText(doc.path);
    if (!text.trim()) {
      console.warn(`⚠️ Skipping ${doc.name}, no text extracted.`);
      continue;
    }

    const chunks = chunkText(text, 1000, 100);
    console.log(`📑 ${doc.name} → ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk);

      db.prepare(`
        INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
        VALUES (?, ?, ?, ?)
      `).run(doc.id, i, chunk, JSON.stringify(embedding));
    }

    console.log(`✅ Migrated ${doc.name}`);
  }

  console.log('🎉 Migration complete! All documents now have chunked embeddings.');
}

migrateAllDocuments().then(() => process.exit(0));
