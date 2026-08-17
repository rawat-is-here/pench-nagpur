import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Polygon, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  HardDrive, Camera, AlertTriangle, Activity, Users, 
  ShieldAlert, FolderOpen, Loader2, CheckCircle2, Compass, 
  Layers, Check, MapPin, Download, RefreshCw, AlertCircle,
  Eye, UserCheck, UserPlus, X, Undo2, ArrowRight
} from 'lucide-react';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({ 
  iconUrl: icon, 
  shadowUrl: iconShadow, 
  iconSize: [25, 41], 
  iconAnchor: [12, 41] 
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function App() {
  const [territory, setTerritory] = useState(null);
  const [overlaps, setOverlaps] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    active_cameras: 142,
    identified_tigers: 0,
    storage_saved_mb: 0.0,
    quarantined_images: 0
  });
  const [tigers, setTigers] = useState([]);
  const [selectedTiger, setSelectedTiger] = useState("");
  
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Bulk Triage states
  const [bulkDir, setBulkDir] = useState("data/raw");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Human-in-the-Loop Review states
  const [pendingReviews, setPendingReviews] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reassignTargetId, setReassignTargetId] = useState("");
  const [isResolvingReview, setIsResolvingReview] = useState(false);

  // Quarantine Bin states
  const [quarantinedList, setQuarantinedList] = useState([]);
  const [showQuarantineModal, setShowQuarantineModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const API_BASE = "http://127.0.0.1:8000";

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      // 1. Fetch system stats
      const statsRes = await axios.get(`${API_BASE}/system_stats`);
      setStats(statsRes.data);

      // 2. Fetch tigers list
      const tigersRes = await axios.get(`${API_BASE}/tigers`);
      setTigers(tigersRes.data);

      // 3. Fetch active alerts
      const alertsRes = await axios.get(`${API_BASE}/alerts`);
      setAlerts(alertsRes.data);

      // 4. Fetch overlaps
      const overlapRes = await axios.get(`${API_BASE}/territory_overlaps`);
      setOverlaps(overlapRes.data.overlaps || []);

      // 5. Fetch pending reviews for Human-in-the-Loop
      const reviewsRes = await axios.get(`${API_BASE}/pending_reviews`);
      setPendingReviews(reviewsRes.data || []);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  };

  // Fetch territory for selected tiger
  const fetchTigerTerritory = async (tigerId) => {
    if (!tigerId) return;
    try {
      const res = await axios.get(`${API_BASE}/territory/${tigerId}`);
      if (res.data.status === "calculated") {
        setTerritory(res.data);
      } else {
        setTerritory({
          tiger_id: tigerId,
          core_area_sqkm: 0,
          centroid: res.data.centroid || null,
          polygon: []
        });
      }
    } catch (error) {
      console.error("Error fetching territory:", error);
    }
  };

  const fetchQuarantinedImages = async () => {
    try {
      const res = await axios.get(`${API_BASE}/quarantined_images`);
      setQuarantinedList(res.data || []);
    } catch (error) {
      console.error("Error fetching quarantined images:", error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Fetch territory when selected tiger changes
  useEffect(() => {
    if (selectedTiger) {
      fetchTigerTerritory(selectedTiger);
    } else if (tigers.length > 0) {
      setSelectedTiger(tigers[0].id);
    }
  }, [selectedTiger, tigers]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_BASE}/upload_camera_trap`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadStatus(response.data);
      fetchDashboardData();
      if (response.data.tiger_id) {
        setSelectedTiger(response.data.tiger_id);
      }
    } catch (error) {
      console.error("Upload failed", error);
      setUploadStatus({ status: "error", message: "Failed to process image or connect to API." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkTriage = async () => {
    if (!bulkDir) return;
    setIsBulkProcessing(true);
    setBulkResult(null);

    try {
      const response = await axios.post(`${API_BASE}/bulk_triage`, {
        directory_path: bulkDir
      });
      setBulkResult(response.data);
      fetchDashboardData();
    } catch (error) {
      console.error("Bulk triage failed", error);
      setBulkResult({ status: "error", message: "Bulk triage failed to complete." });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      await axios.post(`${API_BASE}/resolve_alert/${alertId}`);
      const alertsRes = await axios.get(`${API_BASE}/alerts`);
      setAlerts(alertsRes.data);
      const statsRes = await axios.get(`${API_BASE}/system_stats`);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Failed to resolve alert:", error);
    }
  };

  // Human-in-the-loop review decision submission
  const handleResolveReview = async (action, targetId = null) => {
    if (pendingReviews.length === 0) return;
    const currentReview = pendingReviews[reviewIdx];
    setIsResolvingReview(true);

    try {
      await axios.post(`${API_BASE}/resolve_review`, {
        capture_id: currentReview.id,
        action: action,
        target_tiger_id: targetId || reassignTargetId
      });

      // Refresh data
      await fetchDashboardData();
      
      // Update index or close if queue empty
      if (reviewIdx >= pendingReviews.length - 1) {
        setReviewIdx(0);
        if (pendingReviews.length <= 1) {
          setShowReviewModal(false);
        }
      }
    } catch (error) {
      console.error("Failed to resolve review:", error);
    } finally {
      setIsResolvingReview(false);
    }
  };

  // Restore quarantined blank frame
  const handleRestoreQuarantine = async (filename) => {
    setIsRestoring(true);
    try {
      await axios.post(`${API_BASE}/restore_quarantine/${filename}`);
      await fetchQuarantinedImages();
      await fetchDashboardData();
    } catch (error) {
      console.error("Failed to restore quarantine frame:", error);
    } finally {
      setIsRestoring(false);
    }
  };

  const downloadGeoJSON = () => {
    if (!territory || !territory.polygon || territory.polygon.length === 0) return;
    
    const coords = territory.polygon.map(coord => [coord[1], coord[0]]);
    if (coords.length > 0) {
      coords.push(coords[0]); // Close polygon loop
    }
    
    const geojsonData = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            tiger_id: territory.tiger_id,
            area_sqkm: territory.core_area_sqkm,
            centroid: territory.centroid
          },
          geometry: {
            type: "Polygon",
            coordinates: [coords]
          }
        }
      ]
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojsonData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `tiger_${territory.tiger_id}_range.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const criticalAlertCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const currentReviewItem = pendingReviews[reviewIdx];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased pb-12">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-emerald-500 w-8 h-8" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Pench Tiger Intelligence Center</h1>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">Automated Camera Trap Triage & Stripe-Matched Movement Intelligence</p>
        </div>

        <div className="flex items-center gap-3">
          {/* HITL Review Badge Button */}
          {pendingReviews.length > 0 && (
            <button 
              onClick={() => { setShowReviewModal(true); setReviewIdx(0); }}
              className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 px-3.5 py-1.5 rounded-lg text-xs font-semibold animate-pulse transition"
            >
              <Eye size={14} /> Review Queue ({pendingReviews.length})
            </button>
          )}

          {/* Quarantine Bin Button */}
          <button 
            onClick={() => { fetchQuarantinedImages(); setShowQuarantineModal(true); }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3.5 py-1.5 rounded-lg text-xs font-medium transition"
          >
            <HardDrive size={14} /> Quarantine Bin ({stats.quarantined_images})
          </button>

          <button 
            onClick={fetchDashboardData}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            title="Refresh System Data"
          >
            <RefreshCw size={16} />
          </button>
          
          <div className="bg-slate-850 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-400">
            Grid Zone: <span className="text-emerald-400">UTM 44N</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8 space-y-6">
        
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-850 flex items-center">
            <Camera className="text-sky-400 w-10 h-10 mr-4 p-2 bg-sky-500/10 rounded-lg" />
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Active Stations</p>
              <p className="text-3xl font-extrabold tracking-tight text-white mt-1">{stats.active_cameras}</p>
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-xl border border-slate-850 flex items-center">
            <Activity className="text-emerald-400 w-10 h-10 mr-4 p-2 bg-emerald-500/10 rounded-lg" />
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Identified Tigers</p>
              <p className="text-3xl font-extrabold tracking-tight text-white mt-1">{stats.identified_tigers}</p>
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-xl border border-slate-850 flex items-center">
            <HardDrive className="text-indigo-400 w-10 h-10 mr-4 p-2 bg-indigo-500/10 rounded-lg" />
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Storage Saved (MB)</p>
              <p className="text-3xl font-extrabold tracking-tight text-white mt-1">{stats.storage_saved_mb}</p>
            </div>
          </div>

          <div className={`bg-slate-900 p-5 rounded-xl border flex items-center transition-all ${
            criticalAlertCount > 0 ? 'border-red-500/30 bg-red-950/10' : 'border-slate-850'
          }`}>
            <AlertTriangle className={`w-10 h-10 mr-4 p-2 rounded-lg ${
              criticalAlertCount > 0 ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-slate-500 bg-slate-800'
            }`} />
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Critical Alerts</p>
              <p className={`text-3xl font-extrabold tracking-tight mt-1 ${
                criticalAlertCount > 0 ? 'text-red-500' : 'text-white'
              }`}>{criticalAlertCount}</p>
            </div>
          </div>
        </div>

        {/* Primary Dashboard Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Map Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Live Territory Map Card */}
            <div className="bg-slate-900 rounded-xl border border-slate-850 overflow-hidden flex flex-col h-[580px]">
              <div className="p-4 bg-slate-900/90 border-b border-slate-850 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <Compass className="text-emerald-500" size={18} />
                  <h2 className="font-bold text-white text-md">Spatial Analysis & Home Ranges (MCP)</h2>
                </div>
                
                {/* Tiger Selector Dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Tiger Focus:</label>
                  <select 
                    value={selectedTiger}
                    onChange={(e) => setSelectedTiger(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-xs text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  >
                    {tigers.map((t) => (
                      <option key={t.id} value={t.id}>{t.id} ({t.name || "Unnamed"})</option>
                    ))}
                    {tigers.length === 0 && <option value="">No tigers enrolled</option>}
                  </select>
                </div>
              </div>
              
              {/* Map Canvas */}
              <div className="flex-grow bg-slate-950 relative z-0">
                <MapContainer center={[21.655, 79.215]} zoom={11.5} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com/">Carto</a>'
                  />

                  {/* Pench Reserve Zones */}
                  <Polygon 
                    positions={[[21.71, 79.19], [21.71, 79.29], [21.61, 79.29], [21.61, 79.19]]} 
                    pathOptions={{ color: '#059669', fillColor: '#059669', fillOpacity: 0.08, weight: 2 }}
                  >
                    <Popup>
                      <strong className="text-emerald-400">Pench Core Forest Zone</strong><br/>
                      Strict wildlife protection core zone.
                    </Popup>
                  </Polygon>

                  <Polygon 
                    positions={[[21.75, 79.15], [21.75, 79.35], [21.55, 79.35], [21.55, 79.15]]} 
                    pathOptions={{ color: '#d97706', fillColor: '#d97706', fillOpacity: 0.03, weight: 1.5, dashArray: '5, 5' }}
                  >
                    <Popup>
                      <strong className="text-amber-500">Pench Buffer Zone</strong><br/>
                      Co-existence forest area bordering human settlements.
                    </Popup>
                  </Polygon>
                  
                  {/* Home range boundary polygon */}
                  {territory && territory.polygon && territory.polygon.length > 0 && (
                    <Polygon 
                      positions={territory.polygon} 
                      pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.15, weight: 3 }} 
                    >
                      <Popup>
                        <strong className="text-emerald-500">Tiger {territory.tiger_id} Range</strong><br/>
                        Estimated Area: {territory.core_area_sqkm} sq km
                      </Popup>
                    </Polygon>
                  )}

                  {/* Centroid marker */}
                  {territory && territory.centroid && (
                    <Marker position={[territory.centroid.lat, territory.centroid.lon]}>
                      <Popup>
                        <strong>Tiger {territory.tiger_id} Centroid</strong><br/>
                        Lat: {territory.centroid.lat.toFixed(4)}<br/>
                        Lon: {territory.centroid.lon.toFixed(4)}
                      </Popup>
                    </Marker>
                  )}

                  {/* Overlaps polygons */}
                  {overlaps.map((ov, idx) => (
                    <Polygon 
                      key={`overlap-${idx}`}
                      positions={ov.polygon}
                      pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.25, weight: 2, dashArray: '5, 5' }}
                    >
                      <Popup>
                        <strong className="text-red-500">⚠️ Territory Overlap Zone</strong><br/>
                        Tigers: {ov.tiger_1} & {ov.tiger_2}<br/>
                        Overlap Area: {ov.overlap_area_sqkm} sq km
                      </Popup>
                    </Polygon>
                  ))}
                </MapContainer>
              </div>

              {/* Map Footer Info */}
              <div className="bg-slate-900 border-t border-slate-850 p-4 flex flex-wrap justify-between items-center gap-4 text-xs">
                {territory ? (
                  <div className="flex gap-6">
                    <div>
                      <span className="text-slate-500 block uppercase font-mono tracking-wider">Territory Area</span>
                      <span className="text-sm font-bold text-white mt-1 block">
                        {territory.core_area_sqkm > 0 ? `${territory.core_area_sqkm} sq km` : "Insufficient points (Needs 3)"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase font-mono tracking-wider">Activity Center</span>
                      <span className="text-sm font-bold text-white mt-1 block">
                        {territory.centroid ? `${territory.centroid.lat.toFixed(4)}, ${territory.centroid.lon.toFixed(4)}` : "N/A"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500">No active tiger telemetry loaded.</span>
                )}
                
                {territory && territory.polygon && territory.polygon.length > 0 && (
                  <button 
                    onClick={downloadGeoJSON}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg text-xs transition"
                  >
                    <Download size={14} /> Export GIS GeoJSON
                  </button>
                )}
              </div>
            </div>

            {/* Operations Center Card */}
            <div className="bg-slate-900 rounded-xl border border-slate-850 p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
                <Layers className="text-emerald-500" size={20} />
                <h2 className="font-bold text-white text-md">Triage & Analysis Pipeline Operations</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Single Image upload */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                      <Camera size={16} className="text-emerald-400" /> Single Camera Capture Test
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Upload an image to execute MegaDetector triage and fine-tuned ResNet-50 stripe matching on GPU.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <label className={`w-full flex justify-center items-center cursor-pointer px-4 py-3 rounded-lg border text-sm font-medium transition ${
                      isUploading ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-emerald-600 border-emerald-500 hover:bg-emerald-500 text-white'
                    }`}>
                      {isUploading ? (
                        <>
                          <Loader2 size={16} className="animate-spin mr-2" /> Processing Pipeline...
                        </>
                      ) : (
                        "Upload Camera Capture"
                      )}
                      <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" disabled={isUploading} />
                    </label>

                    {uploadStatus && (
                      <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                        uploadStatus.status === 'success' ? 'bg-emerald-950/20 border-emerald-800 text-emerald-300' 
                        : uploadStatus.status === 'quarantined' ? 'bg-yellow-950/20 border-yellow-800 text-yellow-300'
                        : 'bg-red-950/20 border-red-800 text-red-300'
                      }`}>
                        {uploadStatus.status === 'success' ? (
                          <div>
                            <span className="font-bold text-white block mb-1">🐯 PIPELINE PROCESSED: {uploadStatus.match_status.toUpperCase()}</span>
                            <strong>Individual:</strong> {uploadStatus.tiger_id} <br/>
                            <strong>Distance Score:</strong> {uploadStatus.distance_score} <br/>
                            <strong>Station:</strong> {uploadStatus.station} <br/>
                            <strong>Coordinates:</strong> {uploadStatus.lat.toFixed(4)}, {uploadStatus.lon.toFixed(4)}
                          </div>
                        ) : uploadStatus.status === 'quarantined' ? (
                          <div>
                            <span className="font-bold text-white block mb-1">🛡️ TRIAGE: IMAGE QUARANTINED</span>
                            {uploadStatus.message}
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-white block mb-1">❌ PROCESS ERROR</span>
                            {uploadStatus.message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bulk Directory Triage */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                      <FolderOpen size={16} className="text-emerald-400" /> Directory Bulk Ingestion (Task i)
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Ingest folders of raw camera trap data. Safe stage-deletes blank frames into quarantine.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block mb-1">Working Directory Path</label>
                      <input 
                        type="text" 
                        value={bulkDir} 
                        onChange={(e) => setBulkDir(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono" 
                      />
                    </div>
                    
                    <button 
                      onClick={handleBulkTriage}
                      disabled={isBulkProcessing}
                      className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-750 text-white font-medium py-3 rounded-lg text-sm transition flex justify-center items-center disabled:opacity-50"
                    >
                      {isBulkProcessing ? (
                        <>
                          <Loader2 size={16} className="animate-spin mr-2 text-emerald-400" /> Triaging Folder...
                        </>
                      ) : (
                        "Process Folder Triage"
                      )}
                    </button>

                    {bulkResult && (
                      <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                        bulkResult.status === 'success' ? 'bg-emerald-950/20 border-emerald-800 text-emerald-300' : 'bg-red-950/20 border-red-800 text-red-300'
                      }`}>
                        {bulkResult.status === 'success' ? (
                          <div className="space-y-1">
                            <span className="font-bold text-white block mb-1">📂 TRIAGE REPORT SUCCESS</span>
                            <div><strong>Ingested Frames:</strong> {bulkResult.total_frames_ingested}</div>
                            <div><strong>Quarantined Blanks:</strong> {bulkResult.frames_quarantined}</div>
                            <div><strong>Retained Subjects:</strong> {bulkResult.frames_retained}</div>
                            <div className="text-emerald-400"><strong>Disk Space Saved:</strong> {bulkResult.space_saved_mb} MB</div>
                            <div className="text-emerald-400"><strong>Manual Review Saved:</strong> {bulkResult.manual_time_saved_seconds}s</div>
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-white block mb-1">❌ TRIAGE ERROR</span>
                            {bulkResult.message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Alerts & Intelligence Sidebar (1/3 width) */}
          <div className="bg-slate-900 rounded-xl border border-slate-850 flex flex-col h-[850px]">
            <div className="p-4 border-b border-slate-850 bg-slate-900/90 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertCircle className="text-emerald-500" size={18} />
                <h2 className="font-bold text-white text-md">Intelligence Feed & Alerts</h2>
              </div>
              <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] font-mono text-slate-400">
                {alerts.length} active
              </span>
            </div>
            
            <div className="p-4 overflow-y-auto flex-grow space-y-3 bg-slate-950/40">
              {alerts.map((alert) => (
                <div key={alert.id} className={`p-4 rounded-xl border leading-relaxed transition-all ${
                  alert.severity === 'CRITICAL' ? 'bg-red-950/10 border-red-900/50 hover:bg-red-950/15' 
                  : alert.severity === 'WARNING' ? 'bg-amber-950/10 border-amber-900/40 hover:bg-amber-950/15'
                  : 'bg-slate-900/50 border-slate-800 hover:bg-slate-900'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                      alert.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' 
                      : alert.severity === 'WARNING' ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-sky-500/20 text-sky-400'
                    }`}>
                      {alert.severity}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  
                  <h4 className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
                    {alert.alert_type} (Tiger: {alert.tiger_id})
                  </h4>
                  <p className="text-xs text-slate-300 font-medium">{alert.message}</p>
                  
                  {alert.evidence && Object.keys(alert.evidence).length > 0 && (
                    <div className="mt-2.5 p-2 bg-slate-900/60 rounded border border-slate-850 text-[10px] font-mono text-slate-500 space-y-0.5">
                      {alert.evidence.distance_km && <div>Distance: {alert.evidence.distance_km.toFixed(2)} km</div>}
                      {alert.evidence.station && <div>Station: {alert.evidence.station}</div>}
                    </div>
                  )}
                  
                  <div className="mt-3 flex justify-end">
                    <button 
                      onClick={() => handleResolveAlert(alert.id)}
                      className="flex items-center gap-1 bg-slate-850 hover:bg-emerald-600/20 hover:text-emerald-400 text-slate-400 px-3 py-1.5 border border-slate-800 hover:border-emerald-900/30 rounded-lg text-xs transition"
                    >
                      <Check size={12} /> Acknowledge
                    </button>
                  </div>
                </div>
              ))}
              
              {alerts.length === 0 && (
                <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-3">
                  <CheckCircle2 className="text-slate-700 w-12 h-12" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-400">All systems nominal</h4>
                    <p className="text-xs text-slate-600 mt-1">No deviations or alerts detected in Pench Reserve.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div> 
        
      </main>

      {/* ========================================================================= */}
      {/* HUMAN-IN-THE-LOOP (HITL) AMBIGUOUS MATCH REVIEW MODAL                     */}
      {/* ========================================================================= */}
      {showReviewModal && currentReviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90">
              <div className="flex items-center gap-2">
                <Eye className="text-amber-400" size={20} />
                <h3 className="font-bold text-white text-base">Human-in-the-Loop Stripe Verification</h3>
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full">
                  Review {reviewIdx + 1} of {pendingReviews.length}
                </span>
              </div>
              <button 
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Split Screen Comparison */}
            <div className="p-6 overflow-y-auto flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/50">
              
              {/* Left Pane: Candidate Sighting */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Unresolved Sighting</span>
                  <span className="text-[10px] font-mono text-slate-500">Capture #{currentReviewItem.id}</span>
                </div>

                <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-850 flex items-center justify-center relative">
                  <img 
                    src={`${API_BASE}${currentReviewItem.flank_url || currentReviewItem.raw_url}`} 
                    alt="Candidate Flank" 
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=500&q=80"; }}
                  />
                  <span className="absolute bottom-2 left-2 bg-black/70 backdrop-blur px-2 py-0.5 rounded text-[10px] text-amber-300 font-mono">
                    Isolated Flank Crop
                  </span>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-850 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Predicted Individual:</span>
                    <strong className="text-white font-mono">{currentReviewItem.candidate_tiger_id || "Unmatched"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Distance Score:</span>
                    <span className="text-amber-400 font-mono">{currentReviewItem.distance_score} (Uncertainty Margin)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Station / Time:</span>
                    <span className="text-slate-300">{currentReviewItem.station} · {new Date(currentReviewItem.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              </div>

              {/* Right Pane: Catalogue Reference */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Known Catalogue ({currentReviewItem.candidate_tiger_id})
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Baseline Stripe Archive</span>
                </div>

                <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-850 flex items-center justify-center relative">
                  <img 
                    src={`${API_BASE}/data/raw/t1_historical_0.jpg`} 
                    alt="Catalogue Reference" 
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1549480017-d76466a4b7e8?w=500&q=80"; }}
                  />
                  <span className="absolute bottom-2 left-2 bg-black/70 backdrop-blur px-2 py-0.5 rounded text-[10px] text-emerald-300 font-mono">
                    Registered Flank Reference
                  </span>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-850 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Registered Territory:</span>
                    <span className="text-white font-mono">Core Zone (Pench Central)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Historical Captures:</span>
                    <span className="text-emerald-400 font-mono">5 confirmed sightings</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Stripe Topology Match:</span>
                    <span className="text-slate-300">Compare vertical torso bifurcation</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2">
                {/* Reassign dropdown */}
                <select 
                  value={reassignTargetId}
                  onChange={(e) => setReassignTargetId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs text-white rounded px-2.5 py-2 focus:outline-none focus:border-sky-500"
                >
                  <option value="">Reassign to another...</option>
                  {tigers.map((t) => (
                    <option key={t.id} value={t.id}>{t.id} ({t.name || "Unnamed"})</option>
                  ))}
                </select>
                
                {reassignTargetId && (
                  <button 
                    onClick={() => handleResolveReview("reassign", reassignTargetId)}
                    disabled={isResolvingReview}
                    className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                  >
                    <UserCheck size={14} /> Assign {reassignTargetId}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleResolveReview("reject")}
                  disabled={isResolvingReview}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium px-3.5 py-2 rounded-lg transition"
                >
                  Reject Frame
                </button>

                <button 
                  onClick={() => handleResolveReview("new_tiger")}
                  disabled={isResolvingReview}
                  className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition"
                >
                  <UserPlus size={14} /> Enroll New Tiger
                </button>

                <button 
                  onClick={() => handleResolveReview("confirm")}
                  disabled={isResolvingReview}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg shadow-emerald-950 transition"
                >
                  {isResolvingReview ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Confirm Match ({currentReviewItem.candidate_tiger_id})
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SAFE QUARANTINE BIN INSPECTOR & RECOVERY MODAL (Pillar i)                 */}
      {/* ========================================================================= */}
      {showQuarantineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90">
              <div className="flex items-center gap-2">
                <HardDrive className="text-indigo-400" size={20} />
                <h3 className="font-bold text-white text-base">Quarantined Blank Frames Inspector (Safe Staging)</h3>
                <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full">
                  {quarantinedList.length} staged frames
                </span>
              </div>
              <button 
                onClick={() => setShowQuarantineModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow bg-slate-950/50">
              <p className="text-xs text-slate-400 mb-4">
                Images automatically classified as blank by MegaDetector. Review before permanent purge, or one-click restore false-negatives into the tiger tracking pipeline.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {quarantinedList.map((item, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-850 rounded-xl overflow-hidden p-3 space-y-2">
                    <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center">
                      <img 
                        src={`${API_BASE}${item.image_url}`} 
                        alt={item.filename}
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=500&q=80"; }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                      <span className="truncate max-w-[120px]">{item.filename}</span>
                      <span>{item.size_kb} KB</span>
                    </div>
                    <button 
                      onClick={() => handleRestoreQuarantine(item.filename)}
                      disabled={isRestoring}
                      className="w-full flex justify-center items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-semibold py-1.5 rounded-lg transition"
                    >
                      <Undo2 size={12} /> Restore & Re-evaluate
                    </button>
                  </div>
                ))}

                {quarantinedList.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-500 text-xs">
                    No images currently in quarantine stage.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}