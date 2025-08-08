import { useState } from 'react';
import DocumentsTable from './components/DocumentsTable.jsx';
import Collections from './components/Collections.jsx';
import CollectionView from './components/CollectionView.jsx';
import Chat from './components/Chat.jsx';

function App() {
  const [view, setView] = useState('docs');
  const [selectedCollection, setSelectedCollection] = useState(null);

  const addDocumentsFromFiles = async () => {
    const newDocs = await window.electron.invoke('pick-and-add-documents');
    if (!newDocs || newDocs.length === 0) return;
    for (const doc of newDocs) {
      await window.electron.invoke('generate-document-embedding', doc.id);
    }
  };

  const pickDirectory = async () => {
    const addedDocs = await window.electron.invoke('pick-directory');
    if (!addedDocs) return;
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
    const files = [...e.dataTransfer.files].map((f) => f.path);
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
            📂 DeepDocs
          </h1>
          <p className="text-gray-500 text-sm">
            Organize, tag, and manage your files — now with local chat ✨
          </p>
        </div>

        {/* Action Buttons */}
        <div className="bg-white shadow rounded-xl p-4 flex flex-wrap justify-center gap-3">
          <button
            onClick={addDocumentsFromFiles}
            className="px-4 py-2 bg-blue-500 text-white rounded-full shadow hover:bg-blue-600 transition"
          >
            📄 Add Files
          </button>
          <button
            onClick={pickDirectory}
            className="px-4 py-2 bg-green-500 text-white rounded-full shadow hover:bg-green-600 transition"
          >
            📁 Add Directory
          </button>
          <button
            onClick={checkMissingFiles}
            className="px-4 py-2 bg-yellow-400 text-white rounded-full shadow hover:bg-yellow-500 transition"
          >
            🧹 Remove Missing Files
          </button>
          <button
            onClick={exportDB}
            className="px-4 py-2 bg-indigo-500 text-white rounded-full shadow hover:bg-indigo-600 transition"
          >
            💾 Export DB
          </button>
          <button
            onClick={importDB}
            className="px-4 py-2 bg-purple-500 text-white rounded-full shadow hover:bg-purple-600 transition"
          >
            📥 Import DB
          </button>
        </div>

        {/* Navigation */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => {
              setView('docs');
              setSelectedCollection(null);
            }}
            className={`px-4 py-2 rounded-full ${
              view === 'docs' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            📄 Documents
          </button>

          <button
            onClick={() => setView('collections')}
            className={`px-4 py-2 rounded-full ${
              view === 'collections' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            📚 Collections
          </button>

          <button
            onClick={() => setView('chat')}
            className={`px-4 py-2 rounded-full ${
              view === 'chat' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            💬 Chat with Documents
          </button>
        </div>

        {/* Views */}
        <div className="w-full max-w-7xl space-y-6">
          {view === 'docs' && <DocumentsTable />}
          {view === 'collections' && !selectedCollection && (
            <Collections onOpenCollection={(col) => setSelectedCollection(col)} />
          )}
          {selectedCollection && (
            <CollectionView
              collection={selectedCollection}
              onBack={() => setSelectedCollection(null)}
            />
          )}
          {view === 'chat' && <Chat />}
        </div>
      </div>
    </div>
  );
}

export default App;
