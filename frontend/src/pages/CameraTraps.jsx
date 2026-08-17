import React, { useState } from 'react';
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
  RotateCcw
} from 'lucide-react';
import { uploadCameraTrap, runBulkTriage } from '../services/api';

const initialCameras = [
  { id: 'CAM-PENCH-01', zone: 'Core Zone A · Totladoh Bank', status: 'Online', battery: 92, lastCapture: '12 mins ago', captures: 1420, signal: 'Strong', lat: 21.650, lon: 79.201 },
  { id: 'CAM-PENCH-08', zone: 'East River Buffer · Kolitmara', status: 'Online', battery: 78, lastCapture: '35 mins ago', captures: 980, signal: 'Moderate', lat: 21.668, lon: 79.225 },
  { id: 'CAM-PENCH-14', zone: 'South Border · Sillari Fringe', status: 'Warning', battery: 24, lastCapture: '2 hours ago', captures: 2310, signal: 'Moderate', lat: 21.655, lon: 79.190 },
  { id: 'CAM-PENCH-22', zone: 'West Corridor · Chhindwara Pass', status: 'Offline', battery: 8, lastCapture: '3 days ago', captures: 430, signal: 'No Signal', lat: 21.648, lon: 79.230 },
  { id: 'CAM-PENCH-31', zone: 'Core Zone B · Mahadeo Ghat', status: 'Online', battery: 88, lastCapture: '5 mins ago', captures: 1870, signal: 'Strong', lat: 21.658, lon: 79.250 },
  { id: 'CAM-PENCH-45', zone: 'Buffer North · Khawasa Route', status: 'Online', battery: 65, lastCapture: '1 hour ago', captures: 1120, signal: 'Strong', lat: 21.675, lon: 79.240 },
];

export default function CameraTraps() {
  const [activeTab, setActiveTab] = useState('grid'); // 'grid' or 'batch'
  const [cameras, setCameras] = useState(initialCameras);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedStation, setSelectedStation] = useState('CAM-PENCH-01');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Batch Triage State
  const [directoryPath, setDirectoryPath] = useState('data/raw');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.40);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

  const filtered = filterStatus === 'ALL'
    ? cameras
    : cameras.filter(c => c.status.toUpperCase() === filterStatus.toUpperCase());

  const handleStationUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await uploadCameraTrap(formData);
      setUploadResult(res.data);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadResult({ status: 'error', message: 'Failed to communicate with AI Triage pipeline.' });
    } finally {
      setIsUploading(false);
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
          <div className="text-xs font-bold text-emerald-800 tracking-wider uppercase">
            Optical Sensor Grid & Batch Ingestion
          </div>
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Camera Trap Stations & Triage Terminal
          </h1>
          <p className="text-xs text-slate-600">
            Real-time battery diagnostics, telemetry, and automated SD-card blank filtering (MegaDetector V6).
          </p>
        </div>

        {/* TAB TOGGLE */}
        <div className="flex items-center p-1 bg-surface-subtle border border-surface-border rounded-xl">
          <button
            onClick={() => setActiveTab('grid')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'grid'
                ? 'bg-white text-forest-950 shadow-sm'
                : 'text-slate-600 hover:text-forest-900'
            }`}
          >
            Sensor Nodes (142)
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'batch'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-forest-900'
            }`}
          >
            <FolderSync size={13} className={activeTab === 'batch' ? 'text-amber-400' : ''} />
            <span>SD-Card Batch Ingest</span>
          </button>
        </div>
      </div>

      {/* =========================================================
         TAB 1: BATCH INGESTION RUNNER (Deliverable i)
         ========================================================= */}
      {activeTab === 'batch' && (
        <div className="space-y-6">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <FolderSync size={18} className="text-amber-600" />
                <span>Automated SD-Card Batch Directory Ingestion & Safe Triage</span>
              </div>
              <span className="badge-tag badge-tiger">MegaDetector V6 Accelerated</span>
            </div>

            <div className="panel-body space-y-6">
              <p className="text-xs text-slate-600">
                Point the system to a raw camera trap SD-card dump directory. The system will automatically classify each frame, safely quarantine blank images to a staged folder (with zero data loss), and catalog all animal frames.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Directory Input */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-forest-950 block">
                    Source Image Directory Path
                  </label>
                  <input
                    type="text"
                    value={directoryPath}
                    onChange={(e) => setDirectoryPath(e.target.value)}
                    placeholder="e.g. data/raw or D:/CameraTraps/Survey_August"
                    className="w-full px-3.5 py-2 rounded-lg bg-surface-subtle border border-surface-border text-xs font-mono text-forest-950 focus:outline-none focus:border-forest-700"
                  />
                  <div className="text-[11px] text-slate-500">
                    Will scan all nested station subfolders for JPG, PNG, and TIFF frames.
                  </div>
                </div>

                {/* Confidence Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-forest-950">Confidence Threshold</span>
                    <span className="font-mono font-bold text-amber-700">{(confidenceThreshold * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.20"
                    max="0.80"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                  <div className="text-[11px] text-slate-500">
                    Recommended: 40% (high animal recall, zero false negatives)
                  </div>
                </div>
              </div>

              {/* Action Trigger */}
              <div className="flex justify-between items-center pt-2 border-t border-surface-border">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <ShieldCheck size={16} className="text-emerald-700" />
                  <span>Staged safe-delete active (recoverable from <code className="font-mono text-forest-900">data/quarantine</code>)</span>
                </div>

                <button
                  onClick={handleRunBatchTriage}
                  disabled={isBatchRunning}
                  className="btn btn-tiger text-xs font-bold px-6 py-2 flex items-center gap-2"
                >
                  {isBatchRunning ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Ingesting & Triaging Frames...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Run Automated Triage Ingestion</span>
                    </>
                  )}
                </button>
              </div>

              {/* Batch Processing Report */}
              {batchResult && (
                <div className={`p-4 rounded-xl border ${
                  batchResult.status === 'success'
                    ? 'bg-emerald-50/90 border-emerald-300'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}>
                  {batchResult.status === 'success' ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                        <CheckCircle2 size={18} className="text-emerald-700" />
                        <span>Triage Ingestion Complete: {batchResult.message}</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-white rounded-lg border border-emerald-200 shadow-sm">
                          <div className="text-[10px] uppercase font-bold text-slate-500">Frames Ingested</div>
                          <div className="text-lg font-extrabold text-forest-950">{batchResult.total_frames_ingested}</div>
                        </div>

                        <div className="p-3 bg-white rounded-lg border border-emerald-200 shadow-sm">
                          <div className="text-[10px] uppercase font-bold text-amber-700">Quarantined (Blanks)</div>
                          <div className="text-lg font-extrabold text-amber-700">{batchResult.frames_quarantined}</div>
                        </div>

                        <div className="p-3 bg-white rounded-lg border border-emerald-200 shadow-sm">
                          <div className="text-[10px] uppercase font-bold text-emerald-700">Retained (Animals)</div>
                          <div className="text-lg font-extrabold text-emerald-800">{batchResult.frames_retained}</div>
                        </div>

                        <div className="p-3 bg-white rounded-lg border border-emerald-200 shadow-sm">
                          <div className="text-[10px] uppercase font-bold text-sky-700">Space Saved</div>
                          <div className="text-lg font-extrabold text-sky-900">{batchResult.space_saved_mb} MB</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-emerald-950 pt-2 border-t border-emerald-200">
                        <span>Processing Time: <strong>{batchResult.processing_time_seconds}s</strong></span>
                        <span>Estimated Manual Review Hours Saved: <strong>{batchResult.manual_hours_saved} hours</strong></span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs">{batchResult.message}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
         TAB 2: SENSOR GRID & LIVE NODE UPLOAD
         ========================================================= */}
      {activeTab === 'grid' && (
        <div className="space-y-6">
          {/* FILTER & DIRECT INGESTION TOOLBAR */}
          <div className="panel p-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <h3 className="text-forest-950 font-bold text-sm flex items-center gap-2">
                  <UploadCloud size={17} className="text-emerald-700" />
                  Direct Node Image Ingestion
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Simulate instant telemetry transmission from a field camera trap station.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="bg-surface-subtle border border-surface-border text-forest-950 rounded-lg px-3 py-1.5 text-xs outline-none"
                >
                  {cameras.map(c => (
                    <option key={c.id} value={c.id}>{c.id} ({c.zone.split('·')[0]})</option>
                  ))}
                </select>

                <label className={`btn btn-primary text-xs py-1.5 px-4 flex items-center gap-2 cursor-pointer ${
                  isUploading ? 'opacity-50 pointer-events-none' : ''
                }`}>
                  {isUploading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Triaging Capture...
                    </>
                  ) : (
                    <>
                      <Camera size={13} />
                      Upload Station Capture
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isUploading}
                    onChange={handleStationUpload}
                  />
                </label>

                <div className="h-6 w-px bg-surface-border hidden md:block"></div>

                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-slate-500" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-surface-subtle border border-surface-border text-forest-950 rounded-lg px-3 py-1.5 text-xs outline-none"
                  >
                    <option value="ALL">All Stations (142)</option>
                    <option value="ONLINE">Online Only</option>
                    <option value="WARNING">Low Battery Warning</option>
                    <option value="OFFLINE">Offline / Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {uploadResult && (
              <div className={`mt-4 p-3 rounded-lg text-xs border ${
                uploadResult.status === 'success' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : uploadResult.status === 'quarantined'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}>
                {uploadResult.status === 'success' ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-700" />
                    <span><strong>Target Identified:</strong> Individual {uploadResult.tiger_id} matched via Station {selectedStation} (L2 score: {uploadResult.distance_score}).</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-700" />
                    <span>{uploadResult.message || 'Capture quarantined: No target detected.'}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CAMERA GRID CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((cam) => (
              <div key={cam.id} className="panel p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-forest-950 font-bold text-base block">{cam.id}</span>
                    <span className="text-xs text-slate-500">{cam.zone}</span>
                  </div>
                  <span className={`badge-tag ${
                    cam.status === 'Online' 
                      ? 'badge-info' 
                      : cam.status === 'Warning'
                      ? 'badge-warning'
                      : 'badge-critical'
                  }`}>
                    {cam.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-surface-subtle p-3 rounded-lg border border-surface-border">
                  <div className="flex items-center gap-2">
                    {cam.battery < 30 ? (
                      <BatteryWarning size={16} className="text-amber-600" />
                    ) : (
                      <Battery size={16} className="text-emerald-700" />
                    )}
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Battery</span>
                      <span className="text-forest-950 font-mono font-bold">{cam.battery}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Signal size={16} className={cam.signal === 'No Signal' ? 'text-rose-600' : 'text-emerald-700'} />
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Telemetry</span>
                      <span className="text-forest-950 font-semibold">{cam.signal}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-surface-border pt-3 flex justify-between items-center text-xs text-slate-600">
                  <span>Last Sync: <strong className="text-forest-950">{cam.lastCapture}</strong></span>
                  <span>Captures: <strong className="text-forest-950 font-mono">{cam.captures}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}