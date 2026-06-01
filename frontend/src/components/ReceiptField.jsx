/**
 * ReceiptField
 * Lets the user either paste a URL or upload a PDF/image file.
 * Props:
 *   value      – current receiptUrl string
 *   onChange   – (url, name) => void  called whenever the value changes
 *   uploading  – bool  (parent controls spinner state)
 *   onUpload   – async (file) => { url, name }  called when a file is picked
 */
import React, { useState } from 'react';

export default function ReceiptField({ value, onChange, onUpload, uploading }) {
  const [mode, setMode] = useState(value && !value.startsWith('/uploads/') ? 'link' : value ? 'link' : 'link');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('File must be under 10 MB'); return; }
    try {
      const result = await onUpload(file);
      onChange(result.url, result.name);
      setMode('link'); // show the resulting URL
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setMode('link')}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            mode === 'link' ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'
          }`}
        >
          🔗 URL / Link
        </button>
        <button
          type="button"
          onClick={() => setMode('file')}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            mode === 'file' ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'
          }`}
        >
          📎 Upload File
        </button>
      </div>

      {mode === 'link' ? (
        <input
          className="input"
          type="url"
          value={value || ''}
          onChange={(e) => onChange(e.target.value, '')}
          placeholder="https://drive.google.com/… or any link"
        />
      ) : (
        <label className={`flex items-center gap-2 btn-secondary cursor-pointer w-full justify-center py-2.5 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? (
            <><span className="animate-spin">⏳</span> Uploading…</>
          ) : (
            <><span>📎</span> Choose PDF or Image (max 10 MB)</>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            className="hidden"
            onChange={handleFile}
            disabled={uploading}
          />
        </label>
      )}

      {/* Preview of current value */}
      {value && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 truncate flex-1">
            {value.startsWith('/uploads/') ? '✓ File uploaded' : value}
          </span>
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline flex-shrink-0">
            Open ↗
          </a>
          <button type="button" onClick={() => onChange('', '')} className="text-gray-600 hover:text-red-400">✕</button>
        </div>
      )}
    </div>
  );
}
