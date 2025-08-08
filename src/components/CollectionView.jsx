import { useEffect, useState } from 'react';

export default function CollectionView({ collection, onBack }) {
  const [docs, setDocs] = useState([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshDocs = async () => {
    const data = await window.electron.invoke('get-collection-docs', collection.id);
    setDocs(data);
  };

  const removeDoc = async (docId) => {
    await window.electron.invoke('remove-doc-from-collection', { collectionId: collection.id, docId });
    refreshDocs();
  };

  const exportToFolder = async () => {
    const res = await window.electron.invoke('export-collection-to-folder', collection.id);
    if (res?.ok) alert(`Exported ${res.count} files to ${res.destDir}`);
  };

  const exportZip = async () => {
    const res = await window.electron.invoke('export-collection-zip', collection.id);
    if (res?.ok) alert(`ZIP saved: ${res.filePath}`);
  };

  const exportCSV = async () => {
    const res = await window.electron.invoke('export-collection-csv', collection.id);
    if (res?.ok) alert(`CSV saved: ${res.filePath}`);
  };

  const revealAll = async () => {
    await window.electron.invoke('reveal-collection-in-finder', collection.id);
  };

  const runSearch = async () => {
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    const res = await window.electron.invoke('semantic-search-in-collection', {
      collectionId: collection.id,
      query,
      topK: 8,
    });
    setResults(res || []);
    setLoading(false);
  };

  useEffect(() => { refreshDocs(); }, [collection]);

  const items = results.length > 0 ? results : docs;

  // simple stats
  const totalSize = (items || []).reduce((a, d) => a + (d.size || 0), 0);
  const prettyMB = (totalSize / (1024 * 1024)).toFixed(1);

  return (
    <div className="p-4 space-y-4">
      <button onClick={onBack} className="text-blue-500 hover:underline">⬅ Back to Collections</button>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">{collection.name}</h2>

        <div className="flex flex-wrap gap-2">
          <button onClick={exportToFolder} className="px-3 py-1 bg-green-600 text-white rounded-full">📁 Export to Folder</button>
          <button onClick={exportZip} className="px-3 py-1 bg-indigo-600 text-white rounded-full">🗜️ Export ZIP</button>
          <button onClick={exportCSV} className="px-3 py-1 bg-slate-700 text-white rounded-full">📄 Export CSV</button>
          <button onClick={revealAll} className="px-3 py-1 bg-gray-600 text-white rounded-full">🔎 Reveal Files</button>
        </div>
      </div>

      <div className="text-sm text-gray-500">
        {items.length} docs • ~{prettyMB} MB {results.length > 0 && <span className="text-indigo-600">• results for “{q}”</span>}
      </div>

      {/* Search in this collection */}
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Semantic search in this collection…"
          className="border rounded-full p-2 flex-1"
        />
        <button onClick={runSearch} disabled={loading} className="px-3 py-1 bg-indigo-500 text-white rounded-full">
          {loading ? 'Searching…' : '🔍 Search'}
        </button>
        {results.length > 0 && (
          <button onClick={() => { setResults([]); setQ(''); }} className="px-3 py-1 bg-gray-200 rounded-full">
            Clear
          </button>
        )}
      </div>

      <ul className="divide-y divide-gray-200">
        {items.map(doc => (
          <li key={doc.id} className="flex justify-between items-center py-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{doc.name}</div>
              <div className="text-xs text-gray-500 truncate">{doc.path}</div>
              {doc.snippet && (
                <div className="text-xs text-indigo-700 italic truncate">“{doc.snippet}”</div>
              )}
            </div>
            <button
              onClick={() => removeDoc(doc.id)}
              className="text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
