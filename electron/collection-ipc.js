// electron/collection-ipc.js (TAILORED FOR `documents.path`)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import archiver from 'archiver';
import { ipcMain, dialog, shell } from 'electron';

// --- helpers ---
function safeFilename(name) {
  return String(name || '').replace(/[\/\\?%*:|"<>]/g, '_').trim() || 'file';
}

export function registerCollectionIpc({ db, generateEmbedding, cosineSimilarity }) {
  // Your schema: documents(id, name, path, size, lastModified, category, tags, embedding)
  const selectDocsSQL = `
    SELECT d.id, d.name, d.path
    FROM documents d
    JOIN collection_documents cd ON d.id = cd.document_id
    WHERE cd.collection_id = ?
  `;

  // ---- Export to Folder ----
  ipcMain.handle('export-collection-to-folder', async (_, collectionId) => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || filePaths.length === 0) return { ok: false };

    const destDir = filePaths[0];
    const docs = db.prepare(selectDocsSQL).all(collectionId);

    let copied = 0;
    for (const doc of docs) {
      const p = doc?.path;
      if (!p || !fs.existsSync(p)) continue;

      const base = safeFilename(doc.name || path.basename(p));
      let target = path.join(destDir, base);

      if (fs.existsSync(target)) {
        const ext = path.extname(base);
        const stem = path.basename(base, ext);
        const hash = crypto.createHash('md5').update(p).digest('hex').slice(0, 6);
        target = path.join(destDir, `${stem}-${hash}${ext}`);
      }
      fs.copyFileSync(p, target);
      copied++;
    }
    return { ok: true, count: copied, destDir };
  });

  // ---- Export ZIP ----
  ipcMain.handle('export-collection-zip', async (_, collectionId) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Collection as ZIP',
      defaultPath: 'collection.zip',
      filters: [{ name: 'Zip', extensions: ['zip'] }]
    });
    if (canceled || !filePath) return { ok: false };

    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);

    const docs = db.prepare(selectDocsSQL).all(collectionId);
    let added = 0;

    for (const doc of docs) {
      const p = doc?.path;
      if (!p || !fs.existsSync(p)) continue;
      const entryName = safeFilename(doc.name || path.basename(p));
      archive.file(p, { name: entryName });
      added++;
    }

    await archive.finalize();
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    return { ok: true, filePath, count: added };
  });

  // ---- Export CSV ----
  ipcMain.handle('export-collection-csv', async (_, collectionId) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Collection CSV',
      defaultPath: 'collection.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
    if (canceled || !filePath) return { ok: false };

    const rows = db.prepare(`
      SELECT d.id, d.name, d.path
      FROM documents d
      JOIN collection_documents cd ON d.id = cd.document_id
      WHERE cd.collection_id = ?
    `).all(collectionId);

    const header = 'id,name,path';
    const csv = [header, ...rows.map(r =>
      [r.id, r.name, r.path]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    )].join('\n');

    fs.writeFileSync(filePath, csv, 'utf-8');
    return { ok: true, filePath, count: rows.length };
  });

  // ---- Reveal All in Finder/Explorer ----
  ipcMain.handle('reveal-collection-in-finder', async (_, collectionId) => {
    const docs = db.prepare(selectDocsSQL).all(collectionId);
    for (const doc of docs) {
      const p = doc?.path;
      if (p && fs.existsSync(p)) shell.showItemInFolder(p);
    }
    return true;
  });

  // ---- Update Collection Metadata (optional UI) ----
  ipcMain.handle('update-collection', (_, { id, name, description, color }) => {
    const stmt = db.prepare('UPDATE collections SET name=COALESCE(?, name), description=COALESCE(?, description), color=COALESCE(?, color) WHERE id=?');
    stmt.run(name ?? null, description ?? null, color ?? null, id);
    return true;
  });

  // ---- Semantic Search within a Collection (unchanged) ----
  ipcMain.handle('semantic-search-in-collection', async (_, { collectionId, query, topK = 5 }) => {
    if (!generateEmbedding || !cosineSimilarity) return [];
    const qEmbed = await generateEmbedding(query);
    if (!qEmbed) return [];

    const ids = db.prepare(
      'SELECT document_id AS id FROM collection_documents WHERE collection_id=?'
    ).all(collectionId).map(r => r.id);
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const chunks = db.prepare(
      `SELECT * FROM document_chunks WHERE document_id IN (${placeholders})`
    ).all(...ids);

    const scored = chunks.map(c => ({
      ...c,
      score: cosineSimilarity(qEmbed, JSON.parse(c.embedding))
    }));

    const bestByDoc = {};
    for (const ch of scored) {
      if (!bestByDoc[ch.document_id] || bestByDoc[ch.document_id].score < ch.score) {
        bestByDoc[ch.document_id] = ch;
      }
    }

    const results = Object.values(bestByDoc)
      .sort((a,b) => b.score - a.score)
      .slice(0, topK)
      .map(ch => {
        const d = db.prepare('SELECT * FROM documents WHERE id=?').get(ch.document_id);
        return {
          ...d,
          score: ch.score,
          snippet: (ch.content || '').slice(0, 200) + ((ch.content || '').length > 200 ? '...' : '')
        };
      });

    return results;
  });
}
