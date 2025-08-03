import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';

const CATEGORY_OPTIONS = ['Work', 'Personal', 'Finance', 'Legal', 'Health', 'Other'];

export default function DocumentsTable() {
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    window.electron.invoke('get-documents').then(setDocuments);
    const listener = (updatedDocs) => setDocuments(updatedDocs || []);
    window.electron.on('documents-updated', listener);
    return () => {};
  }, []);

  const updateDocument = (id, data) => {
    window.electron.invoke('update-document', { id, ...data });
  };

  const handleTagAdd = (doc, e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
      const newTags = doc.tags ? doc.tags.split(',').map(t => t.trim()) : [];
      newTags.push(e.target.value.trim());
      const tagStr = newTags.join(', ');
      updateDocument(doc.id, { tags: tagStr });
      e.target.value = '';
    }
  };

  const handleTagRemove = (doc, tag) => {
    const newTags = doc.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t !== tag)
      .join(', ');
    updateDocument(doc.id, { tags: newTags });
  };

  const filteredDocs = documents.filter(doc => {
    const query = searchQuery.toLowerCase();
    return (
      (doc.name || '').toLowerCase().includes(query) ||
      (doc.path || '').toLowerCase().includes(query) ||
      (doc.category || '').toLowerCase().includes(query) ||
      (doc.tags || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-800 mb-2">Your Documents</h2>

      <input
        type="text"
        placeholder="Search by name, path, category, or tags..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full p-3 border rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-200">
        <table className="min-w-full border-collapse overflow-hidden rounded-2xl">
          <thead className="bg-gray-50 text-gray-700 text-sm">
            <tr>
              <th className="p-3 text-left">File Name</th>
              <th className="p-3 text-left">Path</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Tags</th>
              <th className="p-3 text-center">Missing?</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.map((doc, idx) => (
              <tr
                key={doc.id}
                className={`border-t border-gray-100 hover:bg-gray-50 transition ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                } ${doc.missing ? 'bg-red-50' : ''}`}
              >
                <td className="p-3 font-medium text-gray-800">{doc.name}</td>
                <td className="p-3 text-xs text-gray-500">{doc.path}</td>
                <td className="p-3">
                  <select
                    defaultValue={doc.category || 'Other'}
                    onChange={(e) => updateDocument(doc.id, { category: e.target.value })}
                    className="w-full border rounded-full p-1 px-2 text-sm shadow-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {CATEGORY_OPTIONS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {doc.tags && doc.tags.split(',').map(tag => (
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
                <td className="p-3 text-center font-semibold">
                  {doc.missing ? '⚠️' : 'No'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
