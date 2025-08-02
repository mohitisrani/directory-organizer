// electron/db.js
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

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
    tags TEXT DEFAULT ''
  )
`).run();

// Migration in case old DB exists
try {
  db.prepare('ALTER TABLE documents ADD COLUMN category TEXT DEFAULT ""').run();
} catch {}
try {
  db.prepare('ALTER TABLE documents ADD COLUMN tags TEXT DEFAULT ""').run();
} catch {}

db.prepare('CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_documents_lastModified ON documents(lastModified)').run();

export default db;
