import { useEffect, useState } from 'react';

export default function CollectionView({ collection, onBack }) {
  const [docs, setDocs] = useState([]);

  const refreshDocs = async () => {
    const data = await window.electron.invoke('get-collection-docs', collection.id);
    setDocs(data);
  };

  const removeDoc = async (docId) => {
    await window.electron.invoke('remove-doc-from-collection', { collectionId: collection.id, docId });
    refreshDocs();
  };

  useEffect(() => { refreshDocs(); }, [collection]);

  return (
    <div className="p-4 space-y-4">
      <button onClick={onBack} className="text-blue-500 hover:underline">⬅ Back to Collections</button>
      <h2 className="text-2xl font-semibold">{collection.name}</h2>

      <ul className="divide-y divide-gray-200">
        {docs.map(doc => (
          <li key={doc.id} className="flex justify-between items-center py-2">
            <span>{doc.name}</span>
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
