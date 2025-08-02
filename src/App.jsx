import { useState, useEffect } from 'react';

function App() {
  const [documents, setDocuments] = useState([]);

  const fetchDocuments = async () => {
    const docs = await window.electron.invoke('get-documents');
    setDocuments(docs || []);
  };

  const addDocumentFromFile = async () => {
    const newDoc = await window.electron.invoke('pick-and-add-document');
    if (!newDoc) return;

    if (newDoc.duplicate) {
      alert(`⚠ ${newDoc.name} is already in the database.`);
    } else {
      fetchDocuments();
    }
  };

  const pickDirectory = async () => {
    await window.electron.invoke('pick-directory');
    // Auto-update handled by 'documents-updated' event
  };

  const showInFinder = async (filePath) => {
    await window.electron.invoke('show-in-finder', filePath);
  };

  const deleteDocument = async (id) => {
    await window.electron.invoke('delete-document', id);
  };

  useEffect(() => {
    fetchDocuments();
    window.electron.on('documents-updated', (updatedDocs) => {
      setDocuments(updatedDocs || []);
    });
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>📂 Document Organizer</h1>

      <button onClick={addDocumentFromFile} style={{ marginRight: 10 }}>
        📄 Add Document From File
      </button>

      <button onClick={pickDirectory}>
        📁 Add All Files from Directory
      </button>

      <h2>Stored Documents:</h2>
      {documents.length === 0 ? (
        <p>No documents yet.</p>
      ) : (
        <ul>
          {documents.map((doc) => (
            <li key={doc.id}>
              <strong>{doc.name}</strong> — <span>{doc.path}</span>
              <button 
                onClick={() => showInFinder(doc.path)} 
                style={{ marginLeft: 10 }}
              >
                🔍 Show in Finder
              </button>
              <button 
                onClick={() => deleteDocument(doc.id)} 
                style={{ marginLeft: 10 }}
              >
                🗑 Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
