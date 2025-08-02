// electron/db.js
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

// Create table + indexes
db.prepare(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    path TEXT UNIQUE,
    size INTEGER,
    lastModified TEXT
  )
`).run();

db.prepare('CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_documents_lastModified ON documents(lastModified)').run();

export default db;
