import React, { useState, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Circle,
  CircleMarker
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ShieldAlert,
  Camera,
  Activity,
  Compass,
  Layers,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  TrendingUp,
  FolderSync,
  MapPin,
  ArrowUpRight,
  Check,
  Radio,
  FileCheck,
  Eye,
  Undo2,
  X,
  Layers as LayersIcon,
  FolderUp,
  Loader2
} from 'lucide-react';
import L from 'leaflet';
import { 
  getSystemStats, 
  getAllTerritories,
  getTerritoryOverlaps, 
  getActiveAlerts, 
  resolveAlert, 
  uploadCameraTrap,
  uploadCameraTrapsBulk,
  getCameraStations
} from '../services/api';

// Distinct color palette for tigers
const TIGER_COLORS = [
  '#c98222', '#2563eb', '#059669', '#d97706', '#7c3aed',
  '#dc2626', '#0891b2', '#db2777', '#4f46e5', '#16a34a',
  '#ea580c', '#9333ea', '#e11d48', '#0284c7', '#65a30d',
  '#b45309', '#6366f1', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#ec4899', '#3b82f6', '#22c55e',
  '#f97316', '#a855f7', '#f43f5e', '#38bdf8', '#84cc16'
];

const getTigerColor = (tigerId) => {
  if (!tigerId) return '#c98222';
  const num = parseInt(tigerId.replace(/\D/g, ''), 10) || 1;
  return TIGER_COLORS[(num - 1) % TIGER_COLORS.length];
};

const createTigerCentroidIcon = (tigerId, color = '#c98222') => {
  return L.divIcon({
    className: 'custom-tiger-centroid-icon',
    html: `
      <div style="
        background: ${color};
        color: white;
        padding: 3px 8px;
        border-radius: 999px;
        font-weight: 800;
        font-size: 11px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
        border: 2px solid white;
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      ">
        <span style="width:6px; height:6px; border-radius:50%; background:white;"></span>
        ${tigerId}
      </div>
    `,
    iconSize: [64, 24],
    iconAnchor: [32, 12]
  });
};

export default function Dashboard({ refreshTrigger }) {
  const [stats, setStats] = useState({
    active_cameras: 0,
    identified_tigers: 0,
    storage_saved_mb: 0.0,
    quarantined_images: 0,
    manual_hours_saved: 0.0
  });

  const [territories, setTerritories] = useState([]);
  const [cameraStations, setCameraStations] = useState([]);
  const [overlaps, setOverlaps] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedTigerId, setSelectedTigerId] = useState('ALL');
  const [showRadius, setShowRadius] = useState(true);
  
  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [bulkResult, setBulkResult] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [uploadMode, setUploadMode] = useState('bulk'); // 'bulk' or 'single'

  const loadData = async () => {
    try {
      // 1. Stats
      const statsRes = await getSystemStats();
      if (statsRes.data) setStats(statsRes.data);

      // 2. All Territories
      const terrRes = await getAllTerritories();
      if (terrRes.data) setTerritories(terrRes.data);

      // 3. Camera Stations
      const stationsRes = await getCameraStations();
      if (stationsRes.data) setCameraStations(stationsRes.data);

      // 4. Overlaps
      const ovRes = await getTerritoryOverlaps();
      if (ovRes.data && ovRes.data.overlaps) {
        setOverlaps(ovRes.data.overlaps);
      } else {
        setOverlaps([]);
      }

      // 5. Active Alerts
      const alertsRes = await getActiveAlerts();
      if (alertsRes.data) {
        setAlerts(alertsRes.data);
      } else {
        setAlerts([]);
      }
    } catch (err) {
      console.error('Error fetching dashboard intelligence:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    setBulkResult(null);
    setUploadProgress({ current: 0, total: files.length });

    const formData = new FormData();
    if (files.length === 1 && uploadMode === 'single') {
      formData.append('file', files[0]);
      try {
        const res = await uploadCameraTrap(formData);
        setBulkResult({
          status: 'success',
          total_uploaded: 1,
          retained_count: res.data.has_animal ? 1 : 0,
          quarantined_count: res.data.has_animal ? 0 : 1,
          space_saved_mb: res.data.has_animal ? 0 : 1.44,
          results: [res.data],
          message: res.data.message
        });
        await loadData();
      } catch (err) {
        console.error('Single upload failed:', err);
        setBulkResult({ status: 'error', message: 'Upload failed. Check backend connection.' });
      } finally {
        setIsUploading(false);
      }
    } else {
      // Bulk upload
      files.forEach((file) => {
        formData.append('files', file);
      });

      try {
        const res = await uploadCameraTrapsBulk(formData);
        setBulkResult(res.data);
        await loadData(); // Refresh map and territory stats automatically!
      } catch (err) {
        console.error('Bulk upload failed:', err);
        setBulkResult({
          status: 'error',
          message: 'Bulk upload failed. Verify that server is running.'
        });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleResolveAlert = async (id) => {
    setResolvingId(id);
    try {
      await resolveAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Error resolving alert:', err);
    } finally {
      setResolvingId(null);
    }
  };

  const filteredTerritories = selectedTigerId === 'ALL'
    ? territories
    : territories.filter(t => t.tiger_id === selectedTigerId);

  const selectedTerritoryData = territories.find(t => t.tiger_id === selectedTigerId);

  return (
    <div className="space-y-6">
      {/* HEADER WITH OPERATIONS SUMMARY */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 tracking-wider uppercase">
            <Radio size={12} className="text-emerald-600 animate-pulse" />
            Live Pench Telemetry Feed
          </div>
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Reserve Operations Command Center
          </h1>
          <p className="text-xs text-slate-600">
            Real-time EXIF location extraction, MegaDetector V6 triage, and GPU biometric stripe re-identification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-lg bg-white border border-surface-border text-xs font-semibold text-forest-900 shadow-sm flex items-center gap-2">
            <Sparkles size={14} className="text-amber-500" />
            <span>AI Pipeline: <strong>MDV6 + ResNet-50 Metric Learning</strong></span>
          </div>
        </div>
      </div>

      {/* 4 CORE KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Identified Tigers */}
        <div className="stat-card accent-tiger">
          <div className="stat-label">
            <Activity size={14} className="text-amber-600" />
            Enrolled Individuals
          </div>
          <div className="stat-value">{stats.identified_tigers} <span className="text-sm font-normal text-slate-500">Tigers</span></div>
          <div className="stat-meta flex items-center gap-1.5">
            <span className="text-emerald-700 font-bold flex items-center gap-0.5">
              <ArrowUpRight size={13} /> {stats.identified_tigers > 0 ? '100%' : '0%'}
            </span>
            <span className="text-slate-500">Dynamic EXIF Geo-tagged</span>
          </div>
        </div>

        {/* Metric 2: Active Optical Nodes */}
        <div className="stat-card accent-emerald">
          <div className="stat-label">
            <Camera size={14} className="text-emerald-600" />
            Optical Sensor Grid
          </div>
          <div className="stat-value">{cameraStations.length} <span className="text-sm font-normal text-slate-500">Nodes</span></div>
          <div className="stat-meta">
            <span className={`w-2 h-2 rounded-full ${cameraStations.length > 0 ? 'bg-emerald-500' : 'bg-slate-300'} inline-block`}></span>
            <span>{cameraStations.length > 0 ? 'All stations transmitting' : 'No active stations'}</span>
          </div>
        </div>

        {/* Metric 3: Safe Triage Optimization */}
        <div className="stat-card accent-cyan">
          <div className="stat-label">
            <FileCheck size={14} className="text-sky-600" />
            Quarantine Storage Saved
          </div>
          <div className="stat-value">{stats.storage_saved_mb || 0} <span className="text-sm font-normal text-slate-500">MB</span></div>
          <div className="stat-meta">
            <span>{stats.quarantined_images || 0} blanks filtered ({stats.manual_hours_saved || 0}h saved)</span>
          </div>
        </div>

        {/* Metric 4: Active Alerts */}
        <div className="stat-card accent-crimson">
          <div className="stat-label">
            <ShieldAlert size={14} className="text-rose-600" />
            Active Spatial Alerts
          </div>
          <div className="stat-value text-rose-700">{alerts.length} <span className="text-sm font-normal text-slate-500">Pending</span></div>
          <div className="stat-meta">
            <span className="text-amber-700 font-medium">Buffer proximity & range shifts</span>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN (7 Cols): TACTICAL GIS MAP */}
        <div className="lg:col-span-7 space-y-6">
          <div className="panel">
            <div className="panel-header flex flex-wrap justify-between items-center gap-3">
              <div className="panel-title">
                <Compass size={17} className="text-emerald-700" />
                <span>Territory Minimum Convex Polygons & Centroid Radii</span>
              </div>

              {/* TIGER SELECTOR DROPDOWN & RADIUS TOGGLE */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs font-bold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRadius}
                    onChange={(e) => setShowRadius(e.target.checked)}
                    className="accent-amber-600"
                  />
                  <span>🎯 Patrol Radii</span>
                </label>

                <select
                  value={selectedTigerId}
                  onChange={(e) => setSelectedTigerId(e.target.value)}
                  className="bg-slate-50 border border-surface-border text-forest-950 rounded-lg px-2.5 py-1 text-xs font-bold outline-none cursor-pointer"
                >
                  {territories.length === 0 ? (
                    <option value="ALL">🌐 No Territories Enrolled Yet</option>
                  ) : (
                    <>
                      <option value="ALL">🌐 All Enrolled ({territories.length} Territories)</option>
                      {territories.map((t) => (
                        <option key={t.tiger_id} value={t.tiger_id}>
                          {t.tiger_id} — {t.tiger_alias} ({t.core_area_sqkm} km²)
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="p-3">
              <div style={{ height: '480px', width: '100%', borderRadius: '10px', overflow: 'hidden' }}>
                <MapContainer
                  center={
                    selectedTerritoryData && selectedTerritoryData.centroid
                      ? [selectedTerritoryData.centroid.lat, selectedTerritoryData.centroid.lon]
                      : [21.655, 79.215]
                  }
                  zoom={selectedTigerId === 'ALL' ? 11 : 13}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors | Pench Forest Dept'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Pench Core Zone Outer Box */}
                  <Polygon
                    positions={[
                      [21.745, 79.180],
                      [21.745, 79.310],
                      [21.560, 79.310],
                      [21.560, 79.130],
                      [21.630, 79.130]
                    ]}
                    pathOptions={{
                      color: '#059669',
                      weight: 1.5,
                      dashArray: '4, 4',
                      fillOpacity: 0.04
                    }}
                  >
                    <Popup><strong>Pench Core Sanctuary</strong></Popup>
                  </Polygon>

                  {/* RENDER TERRITORIES DYNAMICALLY ONLY WHEN EXIST */}
                  {filteredTerritories.map((t) => {
                    const color = getTigerColor(t.tiger_id);
                    const centroid = t.centroid;
                    const radiusM = t.radius_meters || 1200;

                    if (!centroid || !t.capture_points || t.capture_points.length === 0) {
                      return null;
                    }

                    return (
                      <React.Fragment key={t.tiger_id}>
                        {/* 1. MCP POLYGON */}
                        {t.polygon && t.polygon.length >= 3 && (
                          <Polygon
                            positions={t.polygon}
                            pathOptions={{
                              color: color,
                              fillColor: color,
                              fillOpacity: selectedTigerId === t.tiger_id ? 0.35 : 0.16,
                              weight: selectedTigerId === t.tiger_id ? 3 : 2
                            }}
                          >
                            <Popup>
                              <div className="p-1 space-y-1 text-xs">
                                <strong className="text-sm block" style={{ color: color }}>
                                  {t.tiger_id} — {t.tiger_alias}
                                </strong>
                                <div>Core Territory: <strong>{t.core_area_sqkm} sq km</strong></div>
                                <div>Sector: {t.sector}</div>
                              </div>
                            </Popup>
                          </Polygon>
                        )}

                        {/* 2. CENTROID PATROL RADIUS CIRCLE */}
                        {showRadius && centroid && (
                          <Circle
                            center={[centroid.lat, centroid.lon]}
                            radius={radiusM}
                            pathOptions={{
                              color: color,
                              fillColor: color,
                              fillOpacity: selectedTigerId === t.tiger_id ? 0.15 : 0.06,
                              weight: selectedTigerId === t.tiger_id ? 2.5 : 1.5,
                              dashArray: '6, 6'
                            }}
                          >
                            <Popup>
                              <div className="p-1 space-y-1 text-xs">
                                <strong className="text-amber-800 block text-sm">
                                  🎯 {t.tiger_id} Centroid Patrol Buffer
                                </strong>
                                <div><strong>Patrol Radius:</strong> {(radiusM / 1000).toFixed(2)} km ({radiusM}m)</div>
                                <div><strong>Centroid:</strong> {centroid.lat.toFixed(4)}°N, {centroid.lon.toFixed(4)}°E</div>
                                <div><strong>Tiger:</strong> {t.tiger_alias}</div>
                              </div>
                            </Popup>
                          </Circle>
                        )}

                        {/* 3. CENTROID MARKER WITH TIGER ID BADGE */}
                        {centroid && (
                          <Marker
                            position={[centroid.lat, centroid.lon]}
                            icon={createTigerCentroidIcon(t.tiger_id, color)}
                          >
                            <Popup>
                              <div className="p-1.5 space-y-1 text-xs min-w-[180px]">
                                <div className="font-extrabold text-sm">{t.tiger_id} Centroid</div>
                                <div className="text-slate-700 font-bold">{t.tiger_alias}</div>
                                <div className="text-slate-600"><strong>GPS:</strong> {centroid.lat.toFixed(5)}°N, {centroid.lon.toFixed(5)}°E</div>
                                <div className="text-slate-600"><strong>Patrol Radius:</strong> {(radiusM / 1000).toFixed(2)} km</div>
                                <div className="text-slate-600"><strong>Core MCP:</strong> {t.core_area_sqkm} km²</div>
                                <div className="text-slate-600"><strong>Sector:</strong> {t.sector}</div>
                              </div>
                            </Popup>
                          </Marker>
                        )}

                        {/* 4. SIGHTING NODES */}
                        {t.capture_points && t.capture_points.map((pt, pIdx) => (
                          <CircleMarker
                            key={`${t.tiger_id}-pt-${pIdx}`}
                            center={[pt.lat, pt.lon]}
                            radius={4}
                            pathOptions={{
                              color: 'white',
                              fillColor: color,
                              fillOpacity: 0.9,
                              weight: 1.5
                            }}
                          >
                            <Popup>
                              <div className="p-1 text-xs">
                                <strong>{t.tiger_id} Sighting #{pIdx + 1}</strong><br />
                                Station: {pt.station}<br />
                                GPS: {pt.lat.toFixed(4)}°N, {pt.lon.toFixed(4)}°E
                              </div>
                            </Popup>
                          </CircleMarker>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </MapContainer>
              </div>

              <div className="mt-3 flex flex-wrap justify-between items-center text-xs text-slate-500 px-1">
                <span>Projection: <strong>UTM Zone 44N (EPSG:32644)</strong></span>
                <span>Active Model: <strong>Minimum Convex Polygon (MCP) + Centroid Radius</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 Cols): DIRECT BULK / SINGLE INGESTION & THREAT ALERTS */}
        <div className="lg:col-span-5 space-y-6">

          {/* BULK & SINGLE IMAGE UPLOAD PANEL */}
          <div className="panel">
            <div className="panel-header flex justify-between items-center">
              <div className="panel-title">
                <UploadCloud size={17} className="text-amber-600" />
                <span>Live AI Classification & Ingestion</span>
              </div>
              <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setUploadMode('bulk')}
                  className={`px-2.5 py-0.5 rounded cursor-pointer transition-all ${
                    uploadMode === 'bulk' ? 'bg-forest-900 text-white shadow-sm' : 'text-slate-600 hover:text-forest-900'
                  }`}
                >
                  Bulk (100+)
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('single')}
                  className={`px-2.5 py-0.5 rounded cursor-pointer transition-all ${
                    uploadMode === 'single' ? 'bg-forest-900 text-white shadow-sm' : 'text-slate-600 hover:text-forest-900'
                  }`}
                >
                  Single
                </button>
              </div>
            </div>

            <div className="panel-body space-y-4 p-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                {uploadMode === 'bulk' 
                  ? 'Select or drag a batch of camera trap photos (up to 100+). Location coordinates are parsed directly from image EXIF headers.' 
                  : 'Upload an individual camera trap photo to extract EXIF location and match stripe biometrics.'}
              </p>

              <label className={`dropzone-container block cursor-pointer p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-forest-600 transition-all text-center bg-slate-50 ${isUploading ? 'opacity-75' : ''}`}>
                <input
                  type="file"
                  accept="image/*"
                  multiple={uploadMode === 'bulk'}
                  onChange={handleFilesSelected}
                  disabled={isUploading}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-forest-100 flex items-center justify-center text-forest-800 mx-auto">
                    {isUploading ? (
                      <Loader2 size={24} className="animate-spin text-forest-700" />
                    ) : uploadMode === 'bulk' ? (
                      <FolderUp size={24} />
                    ) : (
                      <Camera size={24} />
                    )}
                  </div>
                  <div className="text-xs font-bold text-forest-900">
                    {isUploading 
                      ? 'Running MegaDetector V6 + ResNet-50 Pipeline...' 
                      : uploadMode === 'bulk'
                      ? 'Select Multiple Images (e.g. 100 Captures)'
                      : 'Select Single Camera Trap Photo'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Extracts embedded GPS & DateTime directly from EXIF · No CSV needed
                  </div>
                </div>
              </label>

              {/* BATCH CLASSIFICATION SUMMARY MODAL / CARD */}
              {bulkResult && (
                <div className="p-3.5 rounded-xl text-xs border bg-white shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="font-extrabold text-forest-950 flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-700" />
                      <span>Ingestion Complete ({bulkResult.total_uploaded} Frames)</span>
                    </div>
                    <span className="text-[11px] text-emerald-800 font-bold font-mono">
                      +{bulkResult.space_saved_mb || 0} MB Saved
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                      <div className="text-slate-500 text-[10px] uppercase font-bold">Retained</div>
                      <div className="text-sm font-extrabold text-emerald-900 font-mono">{bulkResult.retained_count || 0}</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg">
                      <div className="text-slate-500 text-[10px] uppercase font-bold">Quarantined</div>
                      <div className="text-sm font-extrabold text-amber-900 font-mono">{bulkResult.quarantined_count || 0}</div>
                    </div>
                    <div className="bg-sky-50 border border-sky-200 p-2 rounded-lg">
                      <div className="text-slate-500 text-[10px] uppercase font-bold">New Tigers</div>
                      <div className="text-sm font-extrabold text-sky-900 font-mono">
                        {bulkResult.new_tigers_enrolled ? bulkResult.new_tigers_enrolled.length : 0}
                      </div>
                    </div>
                  </div>

                  {/* RESULTS LIST PREVIEW */}
                  {bulkResult.results && bulkResult.results.length > 0 && (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 border-t pt-2">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Classified Stream Preview</div>
                      {bulkResult.results.slice(0, 15).map((r, idx) => (
                        <div key={idx} className="flex justify-between items-center p-1.5 rounded bg-slate-50 text-[11px]">
                          <span className="font-mono text-slate-700 truncate max-w-[140px]">{r.filename}</span>
                          <div className="flex items-center gap-2">
                            {r.has_animal ? (
                              <span className="font-extrabold text-emerald-800 font-mono">
                                {r.tiger_id} ({r.match_status})
                              </span>
                            ) : (
                              <span className="text-amber-700 font-semibold">Blank (Quarantined)</span>
                            )}
                            <span className="text-slate-400 text-[10px] font-mono">
                              {r.latitude ? `${r.latitude.toFixed(2)},${r.longitude.toFixed(2)}` : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ACTIVE ALERTS LIST */}
          <div className="panel">
            <div className="panel-header flex justify-between items-center">
              <div className="panel-title">
                <ShieldAlert size={17} className="text-rose-600" />
                <span>Active Threat & Deviation Alerts</span>
              </div>
              <span className="text-xs font-bold text-rose-700 font-mono">{alerts.length} Active</span>
            </div>

            <div className="p-4 space-y-3 max-h-[220px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center py-5 text-slate-400 text-xs">
                  <CheckCircle2 size={22} className="mx-auto text-emerald-500 mb-1" />
                  No active spatial alerts. All resident home ranges stable.
                </div>
              ) : (
                alerts.map((al) => (
                  <div
                    key={al.id}
                    className={`p-3 rounded-xl border text-xs space-y-2 ${
                      al.severity === 'CRITICAL'
                        ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                        : 'bg-amber-50/70 border-amber-200 text-amber-950'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-white border text-[10px]">
                          {al.tiger_id}
                        </span>
                        <span className="font-bold">{al.alert_type}</span>
                      </div>
                      <button
                        onClick={() => handleResolveAlert(al.id)}
                        disabled={resolvingId === al.id}
                        className="text-[11px] bg-white border px-2 py-0.5 rounded-md font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        {resolvingId === al.id ? 'Resolving...' : 'Acknowledge'}
                      </button>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-700">{al.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}