import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, Search, FileImage, Trash2, FilePlus, CheckSquare, Square } from 'lucide-react';
import { 
  getQuarantinedImages, 
  deleteQuarantinedImage, 
  bulkDeleteQuarantinedImages, 
  manuallyEnterQuarantine 
} from '../services/api';

export default function QuarantinedData() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actioningFile, setActioningFile] = useState(null);
  const [message, setMessage] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const fetchQuarantine = async () => {
    setLoading(true);
    try {
      const res = await getQuarantinedImages();
      if (res.data) {
        setImages(res.data);
      }
      setSelectedFiles([]); // Reset selection on reload
    } catch (err) {
      console.error('Error fetching quarantined images:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuarantine();
  }, []);

  const handleDelete = async (filename) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${filename}?`)) return;
    setActioningFile(filename);
    setMessage(null);
    try {
      const res = await deleteQuarantinedImage(filename);
      if (res.data && res.data.status === 'success') {
        setMessage({ type: 'success', text: `Successfully deleted ${filename} permanently.` });
        fetchQuarantine();
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Failed to delete image.' });
      }
    } catch (err) {
      console.error('Error deleting image:', err);
      setMessage({ type: 'error', text: 'Error communicating with delete endpoint.' });
    } finally {
      setActioningFile(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete the ${selectedFiles.length} selected images?`)) return;
    
    setLoading(true);
    setMessage(null);
    try {
      const res = await bulkDeleteQuarantinedImages(selectedFiles);
      if (res.data && res.data.status === 'success') {
        setMessage({ type: 'success', text: `Successfully deleted ${selectedFiles.length} images permanently.` });
        fetchQuarantine();
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Failed to delete selected images.' });
      }
    } catch (err) {
      console.error('Error in bulk delete:', err);
      setMessage({ type: 'error', text: 'Error communicating with bulk delete endpoint.' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualEnter = async (filename) => {
    setActioningFile(filename);
    setMessage(null);
    try {
      const res = await manuallyEnterQuarantine(filename);
      if (res.data && res.data.status === 'success') {
        setMessage({ type: 'success', text: `Successfully moved ${filename} to manual review. View it under "Needs Manual Review".` });
        fetchQuarantine();
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Failed to move image.' });
      }
    } catch (err) {
      console.error('Error moving image to manual review:', err);
      setMessage({ type: 'error', text: 'Error communicating with manual entry endpoint.' });
    } finally {
      setActioningFile(null);
    }
  };

  const toggleSelectFile = (filename) => {
    setSelectedFiles(prev => 
      prev.includes(filename) 
        ? prev.filter(f => f !== filename) 
        : [...prev, filename]
    );
  };

  const toggleSelectAll = () => {
    const filteredNames = filtered.map(img => img.filename);
    if (selectedFiles.length === filteredNames.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(filteredNames);
    }
  };

  const filtered = images.filter(img => 
    img.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* PAGE HEADING */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Quarantine Stage
          </h1>
          
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-surface-card border border-surface-border text-xs outline-none focus:border-forest-700 font-medium"
            />
          </div>
          <button 
            onClick={fetchQuarantine}
            className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-xs border ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'
        }`}>
          {message.text}
        </div>
      )}

      {/* ACTION BAR AND GRID */}
      <div className="panel p-5 space-y-4">
        {images.length > 0 && !loading && (
          <div className="flex justify-between items-center bg-surface-subtle p-3 rounded-lg border border-surface-border text-xs">
            <button 
              onClick={toggleSelectAll}
              className="flex items-center gap-2 font-bold text-forest-950 cursor-pointer"
            >
              {selectedFiles.length === filtered.length && filtered.length > 0 ? (
                <CheckSquare size={16} className="text-forest-800" />
              ) : (
                <Square size={16} className="text-slate-400" />
              )}
              <span>Select All ({filtered.length} visible)</span>
            </button>

            {selectedFiles.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="btn btn-tiger bg-rose-700 hover:bg-rose-800 text-white font-bold py-1.5 px-4 flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Delete Selected ({selectedFiles.length})</span>
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 className="animate-spin text-forest-900" size={24} />
            <span className="text-xs font-medium">Scanning quarantine directory...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <ShieldCheck size={48} className="text-emerald-700" />
            <div className="text-center">
              <div className="text-sm font-bold text-forest-950">No Quarantined Files Found</div>
              <p className="text-xs text-slate-500 mt-1">Quarantine directory is clean or search criteria returned empty.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map((item) => (
              <div key={item.filename} className="bg-surface-subtle border border-surface-border rounded-xl overflow-hidden hover:shadow-hover transition-all flex flex-col justify-between relative">
                
                {/* SELECT CHECKBOX BOX */}
                <button 
                  onClick={() => toggleSelectFile(item.filename)}
                  className="absolute top-2 left-2 z-10 bg-white/95 rounded-md p-1 border border-surface-border cursor-pointer shadow-sm"
                >
                  {selectedFiles.includes(item.filename) ? (
                    <CheckSquare size={15} className="text-forest-800" />
                  ) : (
                    <Square size={15} className="text-slate-400" />
                  )}
                </button>

                <div>
                  {/* PREVIEW IMAGE */}
                  <div className="aspect-video relative bg-slate-900 overflow-hidden flex items-center justify-center group border-b border-surface-border">
                    <img 
                      src={`http://127.0.0.1:8000${item.image_url}`}
                      alt={item.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="hidden absolute inset-0 bg-slate-950 text-slate-500 flex-col items-center justify-center gap-1.5 p-3 text-center">
                      <FileImage size={24} />
                      <span className="text-[10px] break-all">{item.filename}</span>
                    </div>
                    <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-sm text-[10px] font-mono px-2 py-0.5 rounded text-slate-300">
                      {item.size_kb} KB
                    </div>
                  </div>

                  <div className="p-4 space-y-1">
                    <div className="text-xs font-bold text-forest-950 break-all line-clamp-1" title={item.filename}>
                      {item.filename}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Staged: {new Date(item.modified_time).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 border-t border-surface-border/50 mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleDelete(item.filename)}
                    disabled={actioningFile === item.filename}
                    className="btn btn-secondary text-rose-700 hover:text-rose-800 border-rose-200 text-[11px] font-bold py-1.5 px-2 flex items-center gap-1.5 justify-center"
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                  <button
                    onClick={() => handleManualEnter(item.filename)}
                    disabled={actioningFile === item.filename}
                    className="btn btn-tiger text-[11px] font-bold py-1.5 px-2 flex items-center gap-1.5 justify-center"
                  >
                    <FilePlus size={12} />
                    <span>Manual Review</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
