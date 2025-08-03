import React from 'react';

export default function FilePreviewModal({ file, onClose }) {
  if (!file) return null;

  const { type, content, name } = file;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">{name} Preview</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-800 transition text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50">
          {type === 'text' && (
            <pre className="whitespace-pre-wrap text-sm font-mono">{content}</pre>
          )}

          {type === 'image' && (
            <img src={content} alt="Preview" className="max-h-[70vh] mx-auto" />
          )}

          {type === 'pdf' && (
            <iframe src={content} className="w-full h-[70vh]" title="PDF Preview" />
          )}

          {type === 'unsupported' && (
            <p className="text-gray-500 text-center mt-10">
              ⚠️ This file type is not supported for preview.
            </p>
          )}

          {type === 'error' && (
            <p className="text-red-500 text-center mt-10">
              ❌ Could not load file content.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
