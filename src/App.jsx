import { useState, useEffect } from 'react';

function App() {
  const [documents, setDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDocuments = async () => {
    const docs = await window.electron.invoke('get-documents');
    setDocuments(docs || []);
  };

  const addDocumentFromFile = async () => {
    const newDoc = await window.electron.invoke('pick-and-add-document');
    if (!newDoc) return;
    if (newDoc.duplicate) alert(`⚠ ${newDoc.name} is already in the database.`);
  };

  const pickDirectory = async () => {
    await window.electron.invoke('pick-directory');
  };

  const showInFinder = (filePath) => window.electron.invoke('show-in-finder', filePath);
  const openFile = (filePath) => window.electron.invoke('open-file', filePath);
  const deleteDocument = (id) => window.electron.invoke('delete-document', id);

  const checkMissingFiles = async () => {
    const removedCount = await window.electron.invoke('check-missing-files');
    alert(`Removed ${removedCount} missing files from database.`);
  };

  const exportDB = () => window.electron.invoke('export-db');
  const importDB = () => window.electron.invoke('import-db');

  const updateMetadata = (id, category, tags) => {
    window.electron.invoke('update-doc-metadata', { id, category, tags });
  };

  useEffect(() => {
    fetchDocuments();
    window.electron.on('documents-updated', (updatedDocs) => {
      setDocuments(updatedDocs || []);
    });
  }, []);

  const filteredDocs = documents.filter(
    (doc) =>
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.tags || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatSize = (size) => {
    if (!size) return '-';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Drag & drop
  const handleDrop = async (e) => {
    e.preventDefault();
    const files = [...e.dataTransfer.files].map(f => f.path);
    await window.electron.invoke('add-dropped-files', files);
  };

  return (
    <div
      style={{ padding: 20 }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <h1>📂 Document Organizer</h1>

      <div style={{ marginBottom: 10 }}>
        <button onClick={addDocumentFromFile} style={{ marginRight: 10 }}>
          📄 Add File
        </button>
        <button onClick={pickDirectory} style={{ marginRight: 10 }}>
          📁 Add Directory (Recursive)
        </button>
        <button onClick={checkMissingFiles} style={{ marginRight: 10 }}>
          🧹 Remove Missing Files
        </button>
        <button onClick={exportDB} style={{ marginRight: 10 }}>
          💾 Export DB
        </button>
        <button onClick={importDB}>
          📥 Import DB
        </button>
      </div>

      <input
        type="text"
        placeholder="🔍 Search by name, path, tags, category..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: 20, padding: 5, width: 400 }}
      />

      <h2>Stored Documents ({filteredDocs.length}):</h2>
      {filteredDocs.length === 0 ? (
        <p>No matching documents.</p>
      ) : (
        <table border="1" cellPadding="5" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Path</th>
              <th>Size</th>
              <th>Last Modified</th>
              <th>Category</th>
              <th>Tags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.name}</td>
                <td>{doc.path}</td>
                <td>{formatSize(doc.size)}</td>
                <td>{doc.lastModified || '-'}</td>
                <td>
                  <input
                    value={doc.category || ''}
                    onChange={(e) =>
                      updateMetadata(doc.id, e.target.value, doc.tags || '')
                    }
                    style={{ width: 80 }}
                  />
                </td>
                <td>
                  <input
                    value={doc.tags || ''}
                    onChange={(e) =>
                      updateMetadata(doc.id, doc.category || '', e.target.value)
                    }
                    style={{ width: 120 }}
                  />
                </td>
                <td>
                  <button onClick={() => showInFinder(doc.path)}>🔍</button>
                  <button onClick={() => openFile(doc.path)} style={{ marginLeft: 5 }}>▶</button>
                  <button onClick={() => deleteDocument(doc.id)} style={{ marginLeft: 5 }}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;
