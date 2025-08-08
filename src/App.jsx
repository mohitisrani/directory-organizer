import { useState } from 'react';
import DocumentsTable from './components/DocumentsTable.jsx';
import Collections from './components/Collections.jsx';
import Chat from './components/Chat.jsx';
import DeepDocsLogo from './components/DeepDocsLogo.jsx';
import './index.css';


function App() {
  const [view, setView] = useState('docs');
  const [isDragOver, setIsDragOver] = useState(false);

  // ---------- Handlers moved from the global header ----------
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

  // Drag & drop — only active in Documents view
  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (view !== 'docs') return;
    const files = [...e.dataTransfer.files].map((f) => f.path);
    await window.electron.invoke('add-dropped-files', files);
  };

  return (
    <div
      className={`min-h-screen bg-gray-100 flex justify-center p-6 font-sans ${
        view === 'docs' ? 'docs-drop-area' : ''
      } ${isDragOver && view === 'docs' ? 'drag-over' : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => {
        if (view === 'docs') {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
    >
      <div className="w-full max-w-7xl space-y-6">
        {/* App header */}
        <div className="bg-white shadow-md rounded-2xl p-8 flex flex-col items-center">
          <h1 className="text-4xl font-semibold text-gray-800 mb-1 flex items-center gap-3">
            <DeepDocsLogo className="w-10 h-10" />
            <span>DeepDocs</span>
           </h1>
          <p className="text-gray-500 text-sm">
            Organize, tag, and manage your files — now with local chat ✨
          </p>

          {/* Top-level navigation */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setView('docs')}
              className={`px-4 py-2 rounded-full border ${view === 'docs' ? 'bg-black text-white' : 'bg-white'}`}
            >
              Documents
            </button>
            <button
              onClick={() => setView('collections')}
              className={`px-4 py-2 rounded-full border ${view === 'collections' ? 'bg-black text-white' : 'bg-white'}`}
            >
              Collections
            </button>
            <button
              onClick={() => setView('chat')}
              className={`px-4 py-2 rounded-full border ${view === 'chat' ? 'bg-black text-white' : 'bg-white'}`}
            >
              Chat
            </button>
          </div>
        </div>

        {/* Views */}
        {view === 'docs' && (
          <DocumentsTable
            onAddFiles={addDocumentsFromFiles}
            onPickDirectory={pickDirectory}
            onCheckMissing={checkMissingFiles}
            onExportDB={exportDB}
            onImportDB={importDB}
          />
        )}

        {view === 'collections' && <Collections />}

        {view === 'chat' && <Chat />}
      </div>
    </div>
  );
}

export default App;
