import { useEffect } from 'react';
import DocumentsTable from './components/DocumentsTable.jsx';

function App() {

  const addDocumentsFromFiles = async () => {
    const newDocs = await window.electron.invoke('pick-and-add-documents');
    if (!newDocs || newDocs.length === 0) return;
  
    for (const doc of newDocs) {
      // Generate embeddings for each new doc
      await window.electron.invoke('generate-document-embedding', doc.id);
    }
  };

  const pickDirectory = async () => {
    const addedDocs = await window.electron.invoke('pick-directory');
    if (!addedDocs) return;
  
    // ✅ Generate embeddings for each new doc
    for (const doc of addedDocs) {
      await window.electron.invoke('generate-document-embedding', doc.id);
    }
  };

  const checkMissingFiles = async () => {
    const removedCount = await window.electron.invoke('check-missing-files');
    alert(`Removed ${removedCount} missing files from database.`);
  };

  const exportDB = () => window.electron.invoke('export-db');
  const importDB = () => window.electron.invoke('import-db');

  const handleDrop = async (e) => {
    e.preventDefault();
    const files = [...e.dataTransfer.files].map(f => f.path);
    await window.electron.invoke('add-dropped-files', files);
  };

  return (
    <div
      className="min-h-screen bg-gray-100 flex justify-center p-6 font-sans"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="w-full max-w-7xl space-y-6">

        {/* Header */}
        <div className="bg-white shadow-md rounded-2xl p-8 flex flex-col items-center">
          <h1 className="text-4xl font-semibold text-gray-800 mb-1 flex items-center gap-2">
            📂 Document Organizer
          </h1>
          <p className="text-gray-500 text-sm">Organize, tag, and manage your files effortlessly</p>
        </div>

        {/* Action Buttons */}
        <div className="bg-white shadow rounded-xl p-4 flex flex-wrap justify-center gap-3">
          <button onClick={addDocumentsFromFiles} className="px-4 py-2 bg-blue-500 text-white rounded-full shadow hover:bg-blue-600 transition">
            📄 Add Files
          </button>
          <button onClick={pickDirectory} className="px-4 py-2 bg-green-500 text-white rounded-full shadow hover:bg-green-600 transition">
            📁 Add Directory
          </button>
          <button onClick={checkMissingFiles} className="px-4 py-2 bg-yellow-400 text-white rounded-full shadow hover:bg-yellow-500 transition">
            🧹 Remove Missing Files
          </button>
          <button onClick={exportDB} className="px-4 py-2 bg-indigo-500 text-white rounded-full shadow hover:bg-indigo-600 transition">
            💾 Export DB
          </button>
          <button onClick={importDB} className="px-4 py-2 bg-purple-500 text-white rounded-full shadow hover:bg-purple-600 transition">
            📥 Import DB
          </button>
        </div>

        {/* Table */}
        <div className="bg-white shadow-lg rounded-2xl p-6">
          <DocumentsTable />
        </div>
      </div>
    </div>
  );
}

export default App;
