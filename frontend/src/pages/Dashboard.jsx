import React, { useState, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Circle,
  CircleMarker,
  Rectangle
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
  X
} from 'lucide-react';
import L from 'leaflet';
import { 
  getSystemStats, 
  getAllTerritories,
  getTerritoryOverlaps, 
  getActiveAlerts, 
  resolveAlert, 
  uploadCameraTrap,
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

const createStationIcon = (color = '#059669') => {
  return L.divIcon({
    className: 'custom-station-icon',
    html: `<div style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5]
  });
};

export default function Dashboard({ refreshTrigger }) {
  const [stats, setStats] = useState({
    active_cameras: 142,
    identified_tigers: 30,
    storage_saved_mb: 48.6,
    quarantined_images: 18,
    manual_hours_saved: 0.8
  });

  const [territories, setTerritories] = useState([]);
  const [cameraStations, setCameraStations] = useState([]);
  const [overlaps, setOverlaps] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedTigerId, setSelectedTigerId] = useState('ALL'); // 'ALL' or 'T-001', etc.
  const [showRadius, setShowRadius] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

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
      }

      // 5. Active Alerts
      const alertsRes = await getActiveAlerts();
      if (alertsRes.data) {
        setAlerts(alertsRes.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard intelligence:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await uploadCameraTrap(formData);
      setUploadResult(res.data);
      loadData(); // Refresh metrics and territory
    } catch (err) {
      console.error('Triage upload failed:', err);
      setUploadResult({
        status: 'error',
        message: 'Could not connect to AI Triage endpoint. Check backend status.'
      });
    } finally {
      setIsUploading(false);
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
            Pench Tiger Reserve Core & Buffer Sectors · Real-Time MegaDetector V6 Triage & Biometric Re-ID
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-white border border-surface-border text-xs font-semibold text-forest-900 shadow-sm flex items-center gap-2">
            <Sparkles size={14} className="text-amber-500" />
            <span>AI Pipeline: <strong>MDV6-e + ResNet50 Metric Learning</strong></span>
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
          <div className="stat-value">{stats.identified_tigers || territories.length || 30} <span className="text-sm font-normal text-slate-500">Tigers</span></div>
          <div className="stat-meta flex items-center gap-1.5">
            <span className="text-emerald-700 font-bold flex items-center gap-0.5">
              <ArrowUpRight size={13} /> 100%
            </span>
            <span className="text-slate-500">Biometric catalogued</span>
          </div>
        </div>

        {/* Metric 2: Active Optical Nodes */}
        <div className="stat-card accent-emerald">
          <div className="stat-label">
            <Camera size={14} className="text-emerald-600" />
            Optical Sensor Grid
          </div>
          <div className="stat-value">{cameraStations.length || 90} <span className="text-sm font-normal text-slate-500">Nodes</span></div>
          <div className="stat-meta">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>All stations transmitting</span>
          </div>
        </div>

        {/* Metric 3: Safe Triage Optimization */}
        <div className="stat-card accent-cyan">
          <div className="stat-label">
            <FileCheck size={14} className="text-sky-600" />
            Quarantine Storage Saved
          </div>
          <div className="stat-value">{stats.storage_saved_mb || 48.6} <span className="text-sm font-normal text-slate-500">MB</span></div>
          <div className="stat-meta">
            <span>{stats.quarantined_images || 18} blanks filtered ({stats.manual_hours_saved || 0.8}h saved)</span>
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
                <span>Geospatial Territories & Centroid Patrol Radii</span>
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
                  <option value="ALL">🌐 All 30 Territories</option>
                  {territories.map((t) => (
                    <option key={t.tiger_id} value={t.tiger_id}>
                      {t.tiger_id} — {t.tiger_alias}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3">
              <div style={{ height: '460px', width: '100%', borderRadius: '10px', overflow: 'hidden' }}>
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

                  {/* RENDER TERRITORIES */}
                  {filteredTerritories.map((t) => {
                    const color = getTigerColor(t.tiger_id);
                    const centroid = t.centroid;
                    const radiusM = t.radius_meters || 1200;

                    return (
                      <React.Fragment key={t.tiger_id}>
                        {/* 1. MCP POLYGON */}
                        {t.polygon && t.polygon.length >= 3 && (
                          <Polygon
                            positions={t.polygon}
                            pathOptions={{
                              color: color,
                              fillColor: color,
                              fillOpacity: selectedTigerId === t.tiger_id ? 0.32 : 0.16,
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
                              fillOpacity: selectedTigerId === t.tiger_id ? 0.14 : 0.06,
                              weight: selectedTigerId === t.tiger_id ? 2.5 : 1.5,
                              dashArray: '6, 6'
                            }}
                          >
                            <Popup>
                              <div className="p-1 space-y-1 text-xs">
                                <strong className="text-amber-800 block text-sm">
                                  🎯 {t.tiger_id} Centroid Patrol Buffer
                                </strong>
                                <div><strong>Radius:</strong> {(radiusM / 1000).toFixed(2)} km ({radiusM}m)</div>
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

        {/* RIGHT COLUMN (5 Cols): INGESTION & THREAT ALERTS */}
        <div className="lg:col-span-5 space-y-6">

          {/* DIRECT OPTICAL TRIAGE INGESTION */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <UploadCloud size={17} className="text-amber-600" />
                <span>Live AI Triage & Re-ID</span>
              </div>
              <span className="badge-tag badge-tiger">MegaDetector V6</span>
            </div>

            <div className="panel-body space-y-4 p-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Upload a raw frame to test automated blank filtering, flank isolation, and stripe matching against the FAISS catalogue.
              </p>

              <label className={`dropzone-container block cursor-pointer p-5 border-2 border-dashed border-slate-300 rounded-xl hover:border-forest-600 transition-all text-center bg-slate-50 ${isUploading ? 'opacity-75' : ''}`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-forest-100 flex items-center justify-center text-forest-800 mx-auto">
                    <Camera size={20} />
                  </div>
                  <div className="text-xs font-bold text-forest-900">
                    {isUploading ? 'Running MegaDetector V6 Inference...' : 'Select or Drop Camera Trap Image'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Supports JPG, PNG, TIFF · Extracts GPS & DateTime from EXIF
                  </div>
                </div>
              </label>

              {/* Triage / Matching Result Feedback */}
              {uploadResult && (
                <div className={`p-3.5 rounded-xl text-xs border ${
                  uploadResult.status === 'success'
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : uploadResult.status === 'quarantined'
                    ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                    : 'bg-rose-50/80 border-rose-300 text-rose-950'
                }`}>
                  {uploadResult.status === 'success' ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 font-bold text-emerald-900">
                        <CheckCircle2 size={16} className="text-emerald-700" />
                        <span>Biometric Match Verified: {uploadResult.tiger_id}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/80 p-2 rounded-lg border border-emerald-200">
                        <div>Station: <strong className="font-mono">{uploadResult.station}</strong></div>
                        <div>Distance: <strong className="font-mono">{uploadResult.distance_score}</strong></div>
                        <div>Status: <span className="font-semibold uppercase">{uploadResult.match_status}</span></div>
                        <div>Action: <span>Territory Updated</span></div>
                      </div>
                    </div>
                  ) : uploadResult.status === 'quarantined' ? (
                    <div className="space-y-1 text-amber-950">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle size={15} className="text-amber-700" />
                        <span>Safe Quarantine (Blank Frame Filtered)</span>
                      </div>
                      <div className="text-[11px]">{uploadResult.message}</div>
                    </div>
                  ) : (
                    <div className="space-y-1 text-rose-950">
                      <div className="font-bold">Error Processing Frame</div>
                      <div className="text-[11px]">{uploadResult.message}</div>
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

            <div className="p-4 space-y-3 max-h-[260px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
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