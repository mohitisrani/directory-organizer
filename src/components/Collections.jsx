import { useEffect, useState } from 'react';

export default function Collections({ onOpenCollection }) {
  const [collections, setCollections] = useState([]);
  const [name, setName] = useState('');

  const refresh = async () => {
    const data = await window.electron.invoke('get-collections');
    setCollections(data);
  };

  const createCollection = async () => {
    if (!name.trim()) return;
    await window.electron.invoke('create-collection', { name });
    setName('');
    refresh();
  };

  const deleteCollection = async (id) => {
    if (confirm('Delete this collection?')) {
      await window.electron.invoke('delete-collection', id);
      refresh();
    }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-2xl font-semibold">Collections</h2>

      {/* Create Collection */}
      <div className="flex gap-2">
        <input 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection name"
          className="border rounded-full p-2 flex-1"
        />
        <button onClick={createCollection} className="bg-green-500 text-white px-4 rounded-full">
          ➕ Add
        </button>
      </div>

      {/* List of collections */}
      <ul className="space-y-2">
        {collections.map(col => (
          <li 
            key={col.id} 
            className="flex justify-between items-center bg-gray-100 p-2 rounded-lg cursor-pointer hover:bg-gray-200"
            onClick={() => onOpenCollection(col)}
          >
            <span>{col.name}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); deleteCollection(col.id); }} 
              className="text-red-500 hover:text-red-700"
            >
              ✖
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
