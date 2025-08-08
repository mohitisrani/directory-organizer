import React, { useState, useEffect } from 'react';
import FilePreviewModal from './FilePreviewModal.jsx';
import { EyeIcon, FolderIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/solid';

const CATEGORY_OPTIONS = ['Work', 'Personal', 'Finance', 'Legal', 'Health', 'Other'];

export default function DocumentsTable({
  onAddFiles,
  onPickDirectory,
  onCheckMissing,
  onExportDB,
  onImportDB,
}) {
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);

  const runSemanticSearch = async () => {
    if (!semanticQuery.trim()) return;
    const results = await window.electron.invoke('semantic-search', semanticQuery, 5);
    setSemanticResults(results);
    setSelectedDocs([]); // clear selection on new search
  };

  const refreshDocuments = async () => {
    const docs = await window.electron.invoke('get-documents');
    const checked = await Promise.all(
      docs.map(async (doc) => {
        const exists = await window.electron.invoke('file-exists', doc.path);
        return { ...doc, missing: !exists };
      })
    );
    setDocuments(checked);

    // ✅ Generate embeddings for any docs that don't have them
    for (const doc of checked) {
      if (!doc.embedding) {
        await window.electron.invoke('generate-document-embedding', doc.id);
      }
    }
  };

  useEffect(() => {
    refreshDocuments();
    const listener = () => refreshDocuments();
    window.electron.on('documents-updated', listener);
    return () => {};
  }, []);

  const updateDocument = (id, data) => {
    window.electron.invoke('update-document', { id, ...data });
  };

  const deleteDocument = (id) => {
    if (confirm('Are you sure you want to delete this document from the database?')) {
      window.electron.invoke('delete-document', id);
    }
  };

  const deleteSelectedDocuments = async () => {
    if (selectedDocs.length === 0) return;
    if (!confirm(`Delete ${selectedDocs.length} selected documents?`)) return;
    for (const id of selectedDocs) {
      await window.electron.invoke('delete-document', id);
    }
    setSelectedDocs([]);
  };

  const viewFile = async (filePath, name) => {
    const fileData = await window.electron.invoke('read-file-content', filePath);
    setPreviewFile({ ...fileData, name });
  };

  const showInFinder = (filePath) => window.electron.invoke('show-in-finder', filePath);

  const handleTagAdd = (doc, e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
      const newTags = doc.tags ? doc.tags.split(',').map((t) => t.trim()) : [];
      newTags.push(e.target.value.trim());
      const tagStr = newTags.join(', ');
      updateDocument(doc.id, { tags: tagStr });
      e.target.value = '';
    }
  };

  const handleTagRemove = (doc, tag) => {
    const newTags = doc.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== tag)
      .join(', ');
    updateDocument(doc.id, { tags: newTags });
  };

  // ---------- Multi-Select ----------
  const toggleSelect = (docId) => {
    setSelectedDocs((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const selectAll = () => {
    const ids = displayedDocs.map((doc) => doc.id);
    setSelectedDocs(ids);
  };

  const clearSelection = () => setSelectedDocs([]);

  // ---------- Filtering ----------
  const filteredDocs = documents.filter((doc) => {
    const query = searchQuery.toLowerCase();
    return (
      (doc.name || '').toLowerCase().includes(query) ||
      (doc.path || '').toLowerCase().includes(query) ||
      (doc.category || '').toLowerCase().includes(query) ||
      (doc.tags || '').toLowerCase().includes(query)
    );
  });

  const displayedDocs = semanticResults.length > 0 ? semanticResults : filteredDocs;

  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);

  // Fetch collections
  const refreshCollections = async () => {
    const cols = await window.electron.invoke('get-collections');
    setCollections(cols);
  };

  return (
    <div className="space-y-4">
      {/* 🔹 Toolbar moved inside the Documents view */}
      <div className="bg-white rounded-2xl shadow p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button onClick={onAddFiles} className="px-3 py-1 rounded-full bg-black text-white">
            ➕ Add Files
          </button>
          <button onClick={onPickDirectory} className="px-3 py-1 rounded-full border">
            📁 Add Directory
          </button>
          <button onClick={onCheckMissing} className="px-3 py-1 rounded-full border">
            🧹 Clean Missing
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onExportDB} className="px-3 py-1 rounded-full border">
            ⬇️ Export DB
          </button>
          <button onClick={onImportDB} className="px-3 py-1 rounded-full border">
            ⬆️ Import DB
          </button>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-gray-800 mb-2">Your Documents</h2>

      {/* Text search */}
      <input
        type="text"
        placeholder="Search by name, path, category, or tags..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full p-3 border rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {/* Semantic search */}
      <div className="flex gap-2 my-4">
        <input
          type="text"
          placeholder="Ask in natural language..."
          value={semanticQuery}
          onChange={(e) => setSemanticQuery(e.target.value)}
          className="flex-1 p-3 border rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={runSemanticSearch}
          className="px-4 py-2 bg-indigo-500 text-white rounded-full shadow hover:bg-indigo-600 transition"
        >
          🔍 Semantic Search
        </button>
      </div>

      {semanticResults.length > 0 && (
        <div className="text-sm text-indigo-600 font-medium mb-2">
          Showing top {semanticResults.length} semantic matches for "{semanticQuery}"
          <button
            onClick={() => setSemanticResults([])}
            className="ml-2 text-red-500 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Bulk Action Toolbar */}
      {selectedDocs.length > 0 && (
        <div className="flex gap-2 mb-4 items-center">
          <span className="text-sm text-gray-600">{selectedDocs.length} selected</span>
          <button
            onClick={deleteSelectedDocuments}
            className="px-3 py-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
          >
            🗑 Delete Selected
          </button>
          <button
            onClick={() => {
              refreshCollections();
              setShowCollectionModal(true);
            }}
            className="px-3 py-1 bg-green-500 text-white rounded-full hover:bg-green-600 transition"
          >
            ➕ Add to Collection
          </button>
          <button
            onClick={clearSelection}
            className="px-3 py-1 bg-gray-400 text-white rounded-full hover:bg-gray-500 transition"
          >
            ✖ Clear Selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-200">
        <table className="min-w-full border-collapse overflow-hidden rounded-2xl">
          <thead className="bg-gray-50 text-gray-700 text-sm">
            <tr>
              <th className="p-3 text-center">
                <input
                  type="checkbox"
                  checked={selectedDocs.length === displayedDocs.length && displayedDocs.length > 0}
                  onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
                />
              </th>
              <th className="p-3 text-left">File Name</th>
              <th className="p-3 text-left">Path</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Tags</th>
              {semanticResults.length > 0 && <th className="p-3 text-left">Snippet</th>}
              <th className="p-3 text-center">Missing?</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedDocs.map((doc, idx) => (
              <tr
                key={doc.id}
                className={`border-t border-gray-100 hover:bg-gray-50 transition ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                } ${doc.missing ? 'bg-red-50' : ''}`}
              >
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(doc.id)}
                    onChange={() => toggleSelect(doc.id)}
                  />
                </td>
                <td className="p-3 font-medium text-gray-800">{doc.name}</td>
                <td className="p-3 text-xs text-gray-500">{doc.path}</td>
                <td className="p-3">
                  <select
                    defaultValue={doc.category || 'Other'}
                    onChange={(e) => updateDocument(doc.id, { category: e.target.value })}
                    className="w-full border rounded-full p-1 px-2 text-sm shadow-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {doc.tags &&
                      doc.tags.split(',').map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 px-2 py-1 rounded-full text-xs shadow-sm hover:shadow transition"
                        >
                          {tag}
                          <XMarkIcon
                            className="w-4 h-4 ml-1 cursor-pointer hover:text-red-500 transition-transform hover:scale-110"
                            onClick={() => handleTagRemove(doc, tag)}
                          />
                        </span>
                      ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Add tag..."
                    onKeyDown={(e) => handleTagAdd(doc, e)}
                    className="w-full border rounded-full p-1 px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </td>
                {semanticResults.length > 0 && (
                  <td
                    className="p-3 text-xs text-gray-600 max-w-xs truncate"
                    title={doc.snippet}
                  >
                    {doc.snippet && <span className="italic">“{doc.snippet}”</span>}
                  </td>
                )}
                <td className="p-3 text-center font-semibold">
                  {doc.missing ? '⚠️ Missing' : 'No'}
                </td>
                <td className="p-3 text-center space-x-2">
                  <button
                    onClick={() => viewFile(doc.path, doc.name)}
                    className="p-2 bg-blue-500 text-white rounded-full shadow hover:bg-blue-600 transition-transform hover:scale-110 hover:rotate-3 hover:shadow-lg"
                    title="Preview File"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => showInFinder(doc.path)}
                    className="p-2 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition"
                    title="Show in Finder"
                  >
                    <FolderIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                    title="Delete Document"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      {/* Add-to-Collection Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-lg">
            <h2 className="text-xl font-semibold">Add to Collection</h2>

            {collections.length === 0 ? (
              <p className="text-gray-500">No collections yet. Create one in the Collections tab.</p>
            ) : (
              <select
                value={selectedCollectionId || ''}
                onChange={(e) => setSelectedCollectionId(Number(e.target.value))}
                className="w-full border rounded-lg p-2"
              >
                <option value="" disabled>
                  Select a collection
                </option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCollectionModal(false)}
                className="px-4 py-2 bg-gray-300 rounded-full hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                disabled={!selectedCollectionId}
                onClick={async () => {
                  await window.electron.invoke('add-docs-to-collection', {
                    collectionId: selectedCollectionId,
                    docIds: selectedDocs,
                  });
                  setShowCollectionModal(false);
                  clearSelection();
                  alert('Documents added to collection!');
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-gray-400"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
