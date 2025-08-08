// electron/db.js
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// One file DB stored at project root (adjust if you prefer elsewhere)
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

// Pragmas
db.pragma('journal_mode = WAL');      // better write concurrency / fewer locking issues
db.pragma('foreign_keys = ON');       // enforce FK constraints

// Schema (fresh DB)
// - ON DELETE CASCADE ensures removing a document cleans up collection links and chunks
// - Indices speed up lookups by path, lastModified, and chunk retrieval
db.exec(`
  -- ===================== documents =====================
  CREATE TABLE IF NOT EXISTS documents (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT,
    path          TEXT UNIQUE,
    size          INTEGER,
    lastModified  TEXT,
    category      TEXT DEFAULT '',
    tags          TEXT DEFAULT '',
    embedding     TEXT DEFAULT NULL   -- JSON array string of the doc-level embedding
  );
  CREATE INDEX IF NOT EXISTS idx_documents_path         ON documents(path);
  CREATE INDEX IF NOT EXISTS idx_documents_lastModified ON documents(lastModified);

  -- ===================== collections =====================
  CREATE TABLE IF NOT EXISTS collections (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    color       TEXT DEFAULT NULL,
    createdAt   TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- ============ many-to-many: collection_documents ============
  CREATE TABLE IF NOT EXISTS collection_documents (
    collection_id INTEGER NOT NULL,
    document_id   INTEGER NOT NULL,
    PRIMARY KEY (collection_id, document_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (document_id)   REFERENCES documents(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  );

  -- ===================== document_chunks =====================
  CREATE TABLE IF NOT EXISTS document_chunks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id  INTEGER NOT NULL,
    chunk_index  INTEGER,
    content      TEXT,
    embedding    TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_chunks_docid        ON document_chunks(document_id);
  CREATE INDEX IF NOT EXISTS idx_chunks_docid_index  ON document_chunks(document_id, chunk_index);
`);

export default db;
