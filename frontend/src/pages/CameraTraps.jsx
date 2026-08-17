import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Battery, 
  BatteryWarning, 
  Signal, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Filter,
  FolderSync,
  Sliders,
  HardDrive,
  Clock,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  FolderUp,
  MapPin,
  Eye
} from 'lucide-react';
import { uploadCameraTrap, uploadCameraTrapsBulk, runBulkTriage, getCameraStations } from '../services/api';

const defaultCameras = [
  { id: 'CAM-PENCH-01', zone: 'Core Zone A · Totladoh Bank', status: 'Online', battery: 92, lastCapture: '12 mins ago', captures: 1420, signal: 'Strong', lat: 21.650, lon: 79.201 },
  { id: 'CAM-PENCH-08', zone: 'East River Buffer · Kolitmara', status: 'Online', battery: 78, lastCapture: '35 mins ago', captures: 980, signal: 'Moderate', lat: 21.668, lon: 79.225 },
  { id: 'CAM-PENCH-14', zone: 'South Border · Sillari Fringe', status: 'Warning', battery: 24, lastCapture: '2 hours ago', captures: 2310, signal: 'Moderate', lat: 21.655, lon: 79.190 },
  { id: 'CAM-PENCH-22', zone: 'West Corridor · Chhindwara Pass', status: 'Offline', battery: 8, lastCapture: '3 days ago', captures: 430, signal: 'No Signal', lat: 21.648, lon: 79.230 },
  { id: 'CAM-PENCH-31', zone: 'Core Zone B · Mahadeo Ghat', status: 'Online', battery: 88, lastCapture: '5 mins ago', captures: 1870, signal: 'Strong', lat: 21.658, lon: 79.250 },
  { id: 'CAM-PENCH-45', zone: 'Buffer North · Khawasa Route', status: 'Online', battery: 65, lastCapture: '1 hour ago', captures: 1120, signal: 'Strong', lat: 21.675, lon: 79.240 },
];

export default function CameraTraps({ defaultTab = 'batch' }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
  const [cameras, setCameras] = useState(defaultCameras);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedStation, setSelectedStation] = useState('CAM-PENCH-01');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Bulk Upload State
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Local Directory Triage State
  const [directoryPath, setDirectoryPath] = useState('data/raw');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.40);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

  useEffect(() => {
    async function loadStations() {
      try {
        const res = await getCameraStations();
        if (res.data && res.data.length > 0) {
          const mapped = res.data.map((st, idx) => ({
            id: st.id,
            zone: `${st.zone || 'Core Zone'} · ${st.name || st.id}`,
            status: st.status === 'active' ? 'Online' : 'Warning',
            battery: parseInt(st.battery) || (80 - (idx % 30)),
            lastCapture: 'Just now',
            captures: 45 + (idx * 12),
            signal: 'Strong',
            lat: st.lat,
            lon: st.lon
          }));
          setCameras(mapped);
        }
      } catch (err) {
        console.error('Error fetching stations:', err);
      }
    }
    loadStations();
  }, []);

  const filtered = filterStatus === 'ALL'
    ? cameras
    : cameras.filter(c => c.status.toUpperCase() === filterStatus.toUpperCase());

  const handleBulkFilesUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsBulkUploading(true);
    setBulkResult(null);

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
      const res = await uploadCameraTrapsBulk(formData);
      setBulkResult(res.data);
    } catch (err) {
      console.error('Bulk upload error:', err);
      setBulkResult({
        status: 'error',
        message: 'Could not upload batch images to backend.'
      });
    } finally {
      setIsBulkUploading(false);
    }
  };

  const handleRunBatchTriage = async () => {
    setIsBatchRunning(true);
    setBatchResult(null);

    try {
      const res = await runBulkTriage(directoryPath, confidenceThreshold);
      setBatchResult(res.data);
    } catch (err) {
      console.error('Batch triage failed:', err);
      setBatchResult({
        status: 'error',
        message: 'Could not connect to bulk triage backend endpoint.'
      });
    } finally {
      setIsBatchRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 tracking-wider uppercase flex items-center gap-1.5">
            <Camera size={14} />
            Optical Sensor Grid & Batch Ingestion
          </div>
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Camera Trap Stations & Triage Terminal
          </h1>
          <p className="text-xs text-slate-600">
            Automated EXIF GPS location extraction, MegaDetector V6 blank filtering, and batch ingestion.
          </p>
        </div>

        {/* TAB TOGGLE */}
        <div className="flex items-center p-1 bg-surface-subtle border border-surface-border rounded-xl">
          <button
            onClick={() => setActiveTab('batch')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'batch'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-forest-900'
            }`}
          >
            <FolderSync size={13} className={activeTab === 'batch' ? 'text-amber-400' : ''} />
            <span>Batch Upload & Triage</span>
          </button>
          <button
            onClick={() => setActiveTab('grid')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'grid'
                ? 'bg-white text-forest-950 shadow-sm'
                : 'text-slate-600 hover:text-forest-900'
            }`}
          >
            Sensor Nodes ({cameras.length})
          </button>
        </div>
      </div>

      {/* =========================================================
         TAB 1: BATCH INGESTION RUNNER (Deliverable i)
         ========================================================= */}
      {activeTab === 'batch' && (
        <div className="space-y-6">
          {/* 1. DIRECT MULTI-FILE / BULK BROWSER UPLOAD */}
          <div className="panel">
            <div className="panel-header flex justify-between items-center">
              <div className="panel-title">
                <FolderUp size={18} className="text-amber-600" />
                <span>Upload Batch Captures (Multi-Select Up to 100+ Images)</span>
              </div>
              <span className="badge-tag badge-tiger">Direct Browser Ingestion</span>
            </div>

            <div className="panel-body space-y-4 p-5">
              <p className="text-xs text-slate-600">
                Select or drag a batch of raw JPEG camera trap photos. Location coordinates and timestamps are extracted directly from embedded EXIF headers with zero reliance on CSV files.
              </p>

              <label className={`dropzone-container block cursor-pointer p-8 border-2 border-dashed border-slate-300 rounded-xl hover:border-forest-600 transition-all text-center bg-slate-50 ${isBulkUploading ? 'opacity-75' : ''}`}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBulkFilesUpload}
                  disabled={isBulkUploading}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-forest-100 flex items-center justify-center text-forest-800 mx-auto">
                    {isBulkUploading ? (
                      <Loader2 size={26} className="animate-spin text-forest-700" />
                    ) : (
                      <FolderUp size={26} />
                    )}
                  </div>
                  <div className="text-sm font-bold text-forest-900">
                    {isBulkUploading 
                      ? 'Processing Batch Through MegaDetector & Stripe Re-ID...' 
                      : 'Click to Browse or Drag Multiple Camera Trap Images Here'}
                  </div>
                  <div className="text-xs text-slate-500">
                    Supports 100+ images · Automatic blank isolation · EXIF GPS extraction
                  </div>
                </div>
              </label>

              {/* BULK UPLOAD SUMMARY */}
              {bulkResult && (
                <div className={`p-4 rounded-xl border ${
                  bulkResult.status === 'success'
                    ? 'bg-emerald-50/90 border-emerald-300'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}>
                  {bulkResult.status === 'success' ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                        <CheckCircle2 size={18} className="text-emerald-700" />
                        <span>Batch Ingestion Successful: {bulkResult.message}</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-white rounded-lg border border-emerald-200 shadow-sm text-center">
                          <div className="text-[10px] uppercase font-bold text-slate-500">Total Uploaded</div>
                          <div className="text-lg font-extrabold text-forest-950 font-mono">{bulkResult.total_uploaded}</div>
                        </div>

                        <div className="p-3 bg-white rounded-lg border border-emerald-200 shadow-sm text-center">
                          <div className="text-[10px] uppercase font-bold text-emerald-700">Retained (Animals)</div>
                          <div className="text-lg font-extrabold text-emerald-800 font-mono">{bulkResult.retained_count}</div>
                        </div>

                        <div className="p-3 bg-white rounded-lg border border-emerald-200 shadow-sm text-center">
                          <div className="text-[10px] uppercase font-bold text-amber-700">Quarantined (Blanks)</div>
                          <div className="text-lg font-extrabold text-amber-700 font-mono">{bulkResult.quarantined_count}</div>
                        </div>

                        <div className="p-3 bg-white rounded-lg border border-emerald-200 shadow-sm text-center">
                          <div className="text-[10px] uppercase font-bold text-sky-700">Storage Saved</div>
                          <div className="text-lg font-extrabold text-sky-900 font-mono">{bulkResult.space_saved_mb} MB</div>
                        </div>
                      </div>

                      {/* DETAILED STREAM TABLE */}
                      {bulkResult.results && (
                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 border-t border-emerald-200 pt-3">
                          <div className="text-[11px] font-bold text-slate-700">Classification Stream</div>
                          {bulkResult.results.map((r, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 rounded bg-white border border-emerald-100 text-xs">
                              <span className="font-mono text-slate-800 truncate max-w-[180px]">{r.filename}</span>
                              <div className="flex items-center gap-3">
                                {r.has_animal ? (
                                  <span className="font-extrabold text-emerald-900 font-mono">
                                    🐯 {r.tiger_id} ({r.match_status})
                                  </span>
                                ) : (
                                  <span className="text-amber-800 font-semibold">⚠️ Blank Quarantined</span>
                                )}
                                <span className="text-slate-500 font-mono text-[11px]">
                                  {r.latitude ? `${r.latitude.toFixed(4)}°N, ${r.longitude.toFixed(4)}°E` : ''}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs">{bulkResult.message}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. LOCAL DIRECTORY SCANNER */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <FolderSync size={18} className="text-slate-700" />
                <span>Local Directory Scanner (SD-Card Dump)</span>
              </div>
            </div>

            <div className="panel-body space-y-4 p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-forest-950 block">Directory Path</label>
                  <input
                    type="text"
                    value={directoryPath}
                    onChange={(e) => setDirectoryPath(e.target.value)}
                    placeholder="e.g. data/raw or D:/CameraTraps"
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-surface-border text-xs font-mono text-forest-950 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-forest-950 block">Confidence: {(confidenceThreshold * 100).toFixed(0)}%</label>
                  <input
                    type="range"
                    min="0.20"
                    max="0.80"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    className="w-full accent-amber-600"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleRunBatchTriage}
                  disabled={isBatchRunning}
                  className="btn btn-tiger text-xs font-bold px-5 py-2 flex items-center gap-2"
                >
                  {isBatchRunning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>Scan & Ingest Directory</span>
                </button>
              </div>

              {batchResult && (
                <div className="p-3 bg-slate-50 rounded-lg border text-xs text-slate-800">
                  {batchResult.message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
         TAB 2: GRID OF SENSOR STATIONS
         ========================================================= */}
      {activeTab === 'grid' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((cam) => (
              <div key={cam.id} className="panel p-4 space-y-3 hover:shadow-sm transition-all">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-extrabold text-xs text-forest-950">{cam.id}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    cam.status === 'Online' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {cam.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 flex items-center gap-1">
                  <MapPin size={12} className="text-slate-400" />
                  {cam.zone}
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded border border-surface-border">
                  <div>Battery: <strong>{cam.battery}%</strong></div>
                  <div>GPS: <strong>{cam.lat.toFixed(3)}, {cam.lon.toFixed(3)}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}