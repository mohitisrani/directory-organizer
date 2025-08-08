// renderer/Collections.jsx (no prompt/confirm)
import React, { useEffect, useState } from 'react';
import CollectionView from './CollectionView';
import Modal from './ui/Modal';

export default function Collections() {
  const [collections, setCollections] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);

  // modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#6366F1' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);

  async function refresh() {
    setLoading(true);
    const res = await window.electron.invoke('get-collections');
    setCollections(res || []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function openCreate() {
    setForm({ name: '', description: '', color: '#6366F1' });
    setCreateOpen(true);
  }
  async function doCreate() {
    if (!form.name.trim()) return;
    await window.electron.invoke('create-collection', { name: form.name, description: form.description, color: form.color });
    setCreateOpen(false);
    refresh();
  }

  function openEdit(c) {
    setEditTarget(c);
    setForm({ name: c.name || '', description: c.description || '', color: c.color || '#6366F1' });
    setEditOpen(true);
  }
  async function doEdit() {
    await window.electron.invoke('update-collection', { id: editTarget.id, ...form });
    setEditOpen(false);
    refresh();
  }

  function openConfirm(c) {
    setConfirmTarget(c);
    setConfirmOpen(true);
  }
  async function doDelete() {
    await window.electron.invoke('delete-collection', confirmTarget.id);
    setConfirmOpen(false);
    refresh();
  }

  if (active) {
    return <CollectionView collection={active} onBack={() => { setActive(null); refresh(); }} />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Collections</h2>
        <button onClick={openCreate} className="px-3 py-1 rounded-full bg-black text-white">
          + New
        </button>
      </div>

      <div className="divide-y rounded-xl border">
        {loading ? (
          <div className="p-4">Loading…</div>
        ) : collections.length === 0 ? (
          <div className="p-4 text-slate-500">No collections yet.</div>
        ) : (
          collections.map((c) => (
            <div key={c.id} className="p-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  <span className="inline-block w-3 h-3 rounded-full mr-2 align-middle" style={{ background: c.color || '#CBD5E1' }} />
                  {c.name}
                </div>
                {c.description && <div className="text-xs text-slate-500 truncate">{c.description}</div>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setActive(c)} className="px-2 py-1 rounded-full border text-sm">
                  Open
                </button>
                <button onClick={() => openEdit(c)} className="px-2 py-1 rounded-full border text-sm">
                  ✏️ Edit
                </button>
                <button onClick={() => openConfirm(c)} className="px-2 py-1 rounded-full bg-rose-600 text-white text-sm">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      <Modal open={createOpen} title="New Collection" onClose={() => setCreateOpen(false)}
        actions={<>
          <button onClick={() => setCreateOpen(false)} className="px-3 py-1 rounded-full border">Cancel</button>
          <button onClick={doCreate} className="px-3 py-1 rounded-full bg-black text-white">Create</button>
        </>}
      >
        <label className="block text-sm">Name</label>
        <input className="w-full border rounded-xl p-2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

        <label className="block text-sm">Description</label>
        <input className="w-full border rounded-xl p-2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

        <label className="block text-sm">Color</label>
        <input type="color" className="w-16 h-8 p-0 border rounded" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} title="Edit Collection" onClose={() => setEditOpen(false)}
        actions={<>
          <button onClick={() => setEditOpen(false)} className="px-3 py-1 rounded-full border">Cancel</button>
          <button onClick={doEdit} className="px-3 py-1 rounded-full bg-black text-white">Save</button>
        </>}
      >
        <label className="block text-sm">Name</label>
        <input className="w-full border rounded-xl p-2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

        <label className="block text-sm">Description</label>
        <input className="w-full border rounded-xl p-2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

        <label className="block text-sm">Color</label>
        <input type="color" className="w-16 h-8 p-0 border rounded" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal open={confirmOpen} title="Delete collection?" onClose={() => setConfirmOpen(false)}
        actions={<>
          <button onClick={() => setConfirmOpen(false)} className="px-3 py-1 rounded-full border">Cancel</button>
          <button onClick={doDelete} className="px-3 py-1 rounded-full bg-rose-600 text-white">Delete</button>
        </>}
      >
        <div className="text-sm text-slate-600">
          This action deletes the collection (not the files). Continue?
        </div>
      </Modal>
    </div>
  );
}
