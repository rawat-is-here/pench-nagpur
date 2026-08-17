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
      {/* TACTICAL GIS MAP (Full Width) */}
      <div className="panel">
        <div className="panel-header flex flex-wrap justify-between items-center gap-3">
          <div className="panel-title">
            <Compass size={17} className="text-emerald-700" />
            <span>Geospatial Territories & Centroid Patrol Radii</span>
          </div>

          {/* TIGER SELECTOR DROPDOWN & RADIUS TOGGLE */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Show Patrol Buffer</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showRadius}
                  onChange={(e) => setShowRadius(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            <div className="h-4 w-px bg-surface-border"></div>

            <div className="flex items-center gap-2">
              <Compass size={13} className="text-slate-500" />
              <select
                value={selectedTigerId}
                onChange={(e) => setSelectedTigerId(e.target.value)}
                className="bg-surface-subtle border border-surface-border text-forest-950 rounded-lg px-2.5 py-1 text-xs font-bold outline-none"
              >
                <option value="ALL">All Territories ({territories.length})</option>
                {territories.map((t) => (
                  <option key={t.tiger_id} value={t.tiger_id}>
                    {t.tiger_id} ({t.tiger_alias || 'Resident'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="panel-body p-4 space-y-4">
          {selectedTerritoryData && (
            <div className="p-3 bg-surface-subtle border border-surface-border rounded-xl text-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: getTigerColor(selectedTigerId) }}></span>
                <div>
                  <strong className="text-forest-950 text-sm font-extrabold">{selectedTigerId} — {selectedTerritoryData.tiger_alias}</strong>
                  <span className="text-slate-500 block text-[10px] mt-0.5">Primary Sector: <strong>{selectedTerritoryData.sector}</strong> · Zone: <strong>{selectedTerritoryData.zone}</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-5 text-right font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block">Home Range Area</span>
                  <strong className="text-forest-900 text-xs font-bold">{selectedTerritoryData.core_area_sqkm} sq km</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Patrol Centroid Radius</span>
                  <strong className="text-forest-900 text-xs font-bold">{(selectedTerritoryData.radius_meters / 1000).toFixed(2)} km</strong>
                </div>
              </div>
            </div>
          )}

          {/* Map container */}
          <div className="aspect-video relative rounded-xl overflow-hidden border border-surface-border" style={{ height: '480px' }}>
            <MapContainer
              center={[21.655, 79.215]}
              zoom={13}
              scrollWheelZoom={true}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Draw Buffer Area Polygons (Total 2) */}
              <Polygon
                positions={[
                  [21.61, 79.19],
                  [21.71, 79.19],
                  [21.71, 79.29],
                  [21.61, 79.29]
                ]}
                pathOptions={{
                  color: '#10b981',
                  fillColor: '#10b981',
                  weight: 2,
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

      {/* ACTIVE THREAT & DEVIATION ALERTS (Full Width below the map) */}
      <div className="panel">
        <div className="panel-header flex justify-between items-center">
          <div className="panel-title">
            <ShieldAlert size={17} className="text-rose-600" />
            <span>Active Threat & Deviation Alerts</span>
          </div>
          <span className="text-xs font-bold text-rose-700 font-mono">{alerts.length} Active</span>
        </div>

        <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-2" />
              No active spatial alerts. All resident home ranges stable.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alerts.map((al) => (
                <div
                  key={al.id}
                  className={`p-3 rounded-xl border text-xs space-y-2 flex flex-col justify-between ${
                    al.severity === 'CRITICAL'
                      ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                      : 'bg-amber-50/70 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="space-y-2">
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}