// renderer/ui/Modal.jsx
import React from 'react';

export default function Modal({ open, title, children, onClose, actions }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-4">
        <div className="text-lg font-semibold mb-2">{title}</div>
        <div className="space-y-3">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          {actions}
        </div>
      </div>
    </div>
  );
}
