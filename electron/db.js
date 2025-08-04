// electron/db.js
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse';
import { pipeline } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

// Create table with new columns for phase 3
db.prepare(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    path TEXT UNIQUE,
    size INTEGER,
    lastModified TEXT,
    category TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    embedding TEXT DEFAULT NULL  -- store JSON array of embedding
  )
`).run();

try { db.prepare('ALTER TABLE documents ADD COLUMN embedding TEXT DEFAULT NULL').run(); } catch {}


// Migration in case old DB exists
try {
  db.prepare('ALTER TABLE documents ADD COLUMN category TEXT DEFAULT ""').run();
} catch {}
try {
  db.prepare('ALTER TABLE documents ADD COLUMN tags TEXT DEFAULT ""').run();
} catch {}

db.prepare('CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_documents_lastModified ON documents(lastModified)').run();

db.prepare(`
  -- 1. Collections Table
  CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT DEFAULT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`).run();

db.prepare(`-- 2. Relationship Table (Many-to-Many)
  CREATE TABLE IF NOT EXISTS collection_documents (
      collection_id INTEGER,
      document_id INTEGER,
      PRIMARY KEY (collection_id, document_id),
      FOREIGN KEY (collection_id) REFERENCES collections(id),
      FOREIGN KEY (document_id) REFERENCES documents(id)
  );
`).run();

export default db;
