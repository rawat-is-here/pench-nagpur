import React, { useState, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
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
  FileCheck
} from 'lucide-react';
import L from 'leaflet';
import { 
  getSystemStats, 
  getTerritory, 
  getTerritoryOverlaps, 
  getActiveAlerts, 
  resolveAlert, 
  uploadCameraTrap 
} from '../services/api';

// Leaflet default icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Camera Node Icon
const createStationIcon = (color = '#059669') => {
  return L.divIcon({
    className: 'custom-station-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

const STATIONS = [
  { id: 'STATION_A01', name: 'Totladoh Core Bank', lat: 21.650, lon: 79.201, status: 'Active' },
  { id: 'STATION_A02', name: 'Ghatpendari Corridor', lat: 21.661, lon: 79.215, status: 'Active' },
  { id: 'STATION_A03', name: 'Karmajhiri Deep Forest', lat: 21.642, lon: 79.220, status: 'Active' },
  { id: 'STATION_A04', name: 'Sillari Fringe Station', lat: 21.655, lon: 79.190, status: 'Active' },
  { id: 'STATION_A05', name: 'Chhindwara Border Pass', lat: 21.648, lon: 79.230, status: 'Active' },
  { id: 'STATION_A06', name: 'East River Buffer Node', lat: 21.675, lon: 79.240, status: 'Active' },
  { id: 'STATION_A07', name: 'Kolitmara Crossing', lat: 21.668, lon: 79.225, status: 'Active' },
  { id: 'STATION_A08', name: 'Mahadeo Trail Head', lat: 21.658, lon: 79.250, status: 'Active' }
];

export default function Dashboard({ refreshTrigger }) {
  const [stats, setStats] = useState({
    active_cameras: 142,
    identified_tigers: 2,
    storage_saved_mb: 48.6,
    quarantined_images: 18,
    manual_hours_saved: 0.8
  });

  const [t1Territory, setT1Territory] = useState(null);
  const [t2Territory, setT2Territory] = useState(null);
  const [overlaps, setOverlaps] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

  const loadData = async () => {
    try {
      // 1. Stats
      const statsRes = await getSystemStats();
      if (statsRes.data) setStats(statsRes.data);

      // 2. T1 Territory (Machli)
      const t1Res = await getTerritory('T-001');
      if (t1Res.data && t1Res.data.status === 'calculated') {
        setT1Territory(t1Res.data);
      }

      // 3. T2 Territory (Ustad)
      const t2Res = await getTerritory('T-002');
      if (t2Res.data && t2Res.data.status === 'calculated') {
        setT2Territory(t2Res.data);
      }

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

  // Pench Core Zone Bounds for GIS visualization
  const coreZoneBounds = [
    [21.61, 79.19],
    [21.71, 79.29]
  ];

  return (
    <div className="space-y-6">
      {/* HEADER WITH OPERATIONS SUMMARY */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 tracking-wider uppercase">
            <Radio size={12} className="text-emerald-600 animate-pulse" />
            Live Reserve Telemetry Feed
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
            <span>AI Models: <strong>MDV6 + ResNet50</strong></span>
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
          <div className="stat-value">{stats.identified_tigers || 2} <span className="text-sm font-normal text-slate-500">Tigers</span></div>
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
          <div className="stat-value">{stats.active_cameras || 142} <span className="text-sm font-normal text-slate-500">Nodes</span></div>
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
          <div className="stat-value">{stats.storage_saved_mb || 0} <span className="text-sm font-normal text-slate-500">MB</span></div>
          <div className="stat-meta">
            <span>{stats.quarantined_images || 0} blanks filtered ({stats.manual_hours_saved || 0.8}h saved)</span>
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
            <span className="text-amber-700 font-medium">Core shift & buffer warnings</span>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN (7 Cols): TACTICAL GIS MAP */}
        <div className="lg:col-span-7 space-y-6">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <Compass size={17} className="text-emerald-700" />
                <span>Pench Reserve Spatial Grid & Home Ranges</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  T-001 Range
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800 font-medium">
                  <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                  T-002 Range
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Territory Overlap
                </span>
              </div>
            </div>

            <div className="p-3">
              <div style={{ height: '420px', width: '100%', borderRadius: '10px', overflow: 'hidden' }}>
                <MapContainer
                  center={[21.655, 79.215]}
                  zoom={12}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Pench Core Zone Outer Box */}
                  <Rectangle
                    bounds={coreZoneBounds}
                    pathOptions={{
                      color: '#059669',
                      weight: 1.5,
                      dashArray: '4, 4',
                      fillOpacity: 0.04
                    }}
                  >
                    <Popup><strong>Pench Core Zone Boundary</strong><br />Lat [21.61, 21.71], Lon [79.19, 79.29]</Popup>
                  </Rectangle>

                  {/* Tiger 1 Territory (T-001 Machli) */}
                  {t1Territory && t1Territory.polygon && t1Territory.polygon.length > 0 && (
                    <Polygon
                      positions={t1Territory.polygon}
                      pathOptions={{
                        color: '#059669',
                        fillColor: '#10b981',
                        fillOpacity: 0.22,
                        weight: 2
                      }}
                    >
                      <Popup>
                        <div className="text-xs space-y-1">
                          <strong className="text-emerald-900 block text-sm">Tiger T-001 (Machli)</strong>
                          <div>Core Territory: <strong>{t1Territory.core_area_sqkm} sq km</strong></div>
                          <div>Centroid: {t1Territory.centroid?.lat?.toFixed(3)}°N, {t1Territory.centroid?.lon?.toFixed(3)}°E</div>
                        </div>
                      </Popup>
                    </Polygon>
                  )}

                  {/* Tiger 2 Territory (T-002 Ustad) */}
                  {t2Territory && t2Territory.polygon && t2Territory.polygon.length > 0 && (
                    <Polygon
                      positions={t2Territory.polygon}
                      pathOptions={{
                        color: '#0284c7',
                        fillColor: '#38bdf8',
                        fillOpacity: 0.22,
                        weight: 2
                      }}
                    >
                      <Popup>
                        <div className="text-xs space-y-1">
                          <strong className="text-sky-900 block text-sm">Tiger T-002 (Ustad)</strong>
                          <div>Core Territory: <strong>{t2Territory.core_area_sqkm} sq km</strong></div>
                        </div>
                      </Popup>
                    </Polygon>
                  )}

                  {/* Overlap Polygons */}
                  {overlaps.map((ov, idx) => (
                    ov.polygon && ov.polygon.length > 0 && (
                      <Polygon
                        key={idx}
                        positions={ov.polygon}
                        pathOptions={{
                          color: '#d97706',
                          fillColor: '#f59e0b',
                          fillOpacity: 0.45,
                          weight: 2,
                          dashArray: '3, 3'
                        }}
                      >
                        <Popup>
                          <div className="text-xs space-y-1">
                            <strong className="text-amber-900 block font-bold">Territorial Overlap Zone</strong>
                            <div>Intersection: {ov.tiger_1} & {ov.tiger_2}</div>
                            <div>Shared Area: <strong>{ov.overlap_area_sqkm} sq km</strong></div>
                          </div>
                        </Popup>
                      </Polygon>
                    )
                  ))}

                  {/* Camera Trap Stations */}
                  {STATIONS.map((st) => (
                    <Marker
                      key={st.id}
                      position={[st.lat, st.lon]}
                      icon={createStationIcon('#112c20')}
                    >
                      <Popup>
                        <div className="text-xs space-y-1">
                          <div className="font-bold text-forest-900">{st.id}</div>
                          <div className="text-slate-600">{st.name}</div>
                          <div className="text-slate-500 font-mono">{st.lat.toFixed(3)}°N, {st.lon.toFixed(3)}°E</div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div className="mt-3 flex justify-between items-center text-xs text-slate-500 px-1">
                <span>Projection: <strong>UTM Zone 44N (EPSG:32644)</strong></span>
                <span>Active Polygon Model: <strong>Minimum Convex Polygon (MCP)</strong></span>
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

            <div className="panel-body space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed px-[22px] pt-3">
                Upload a raw frame to test automated blank filtering, flank isolation, and stripe matching against the FAISS catalogue.
              </p>

              <label className={`dropzone-container block cursor-pointer ${isUploading ? 'radar-scan-line opacity-75' : ''}`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-forest-100 flex items-center justify-center text-forest-800">
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
                        <div>Time: <span>{new Date(uploadResult.timestamp).toLocaleTimeString()}</span></div>
                      </div>
                    </div>
                  ) : uploadResult.status === 'quarantined' ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-amber-900">
                        <AlertTriangle size={16} className="text-amber-700" />
                        <span>Blank Image Quarantined</span>
                      </div>
                      <div className="text-[11px] text-slate-700">
                        {uploadResult.message || 'No animal detected above confidence threshold. Frame safely moved to quarantine directory.'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-rose-800 font-medium">
                      {uploadResult.message || 'Inference error during processing.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ACTIVE SPATIAL & MOVEMENT ALERTS */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <ShieldAlert size={17} className="text-rose-600" />
                <span>Active Threat & Deviation Alerts</span>
              </div>
              <span className="text-xs font-bold text-slate-500">{alerts.length} Total</span>
            </div>

            <div className="panel-body max-h-[300px] overflow-y-auto space-y-2.5">
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-600 mb-1" />
                  No unresolved territory deviations or buffer breaches.
                </div>
              ) : (
                alerts.map((alert) => {
                  const isCritical = alert.severity === 'CRITICAL';
                  const isWarning = alert.severity === 'WARNING';
                  return (
                    <div
                      key={alert.id}
                      className={`alert-item ${
                        isCritical ? 'severity-critical' : isWarning ? 'severity-warning' : 'severity-info'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`badge-tag ${
                            isCritical ? 'badge-critical' : isWarning ? 'badge-warning' : 'badge-info'
                          }`}>
                            {alert.alert_type}
                          </span>
                          <span className="badge-tag badge-tiger">
                            {alert.tiger_id}
                          </span>
                        </div>
                        <button
                          onClick={() => handleResolveAlert(alert.id)}
                          disabled={resolvingId === alert.id}
                          className="btn btn-secondary py-0.5 px-2 text-[11px] h-6 flex items-center gap-1"
                        >
                          <Check size={11} />
                          <span>Resolve</span>
                        </button>
                      </div>

                      <div className="text-xs font-semibold text-slate-900 mt-1.5 leading-snug">
                        {alert.message}
                      </div>

                      {alert.evidence && (
                        <div className="mt-1 text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                          {alert.evidence.distance_km && (
                            <span>Shift: <strong>{alert.evidence.distance_km} km</strong></span>
                          )}
                          {alert.evidence.station && (
                            <span>Station: <strong className="font-mono">{alert.evidence.station}</strong></span>
                          )}
                          {alert.evidence.from_station && (
                            <span>Route: <strong className="font-mono">{alert.evidence.from_station} → {alert.evidence.to_station}</strong></span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}