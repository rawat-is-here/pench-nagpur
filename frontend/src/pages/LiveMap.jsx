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
  Compass,
  Eye,
  Shield,
  Layers,
  MapPin,
  Sparkles,
  Maximize2,
  Info,
  Camera,
  Activity,
  CheckCircle2
} from 'lucide-react';
import L from 'leaflet';
import { 
  getAllTerritories, 
  getAllTigers, 
  getCameraStations,
  getCaptures 
} from '../services/api';

// Distinct curated color palette for all 30 tigers
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

// Custom Centroid Marker with Tiger ID pill
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
        letter-spacing: 0.5px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
        border: 2px solid white;
        display: flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
        cursor: pointer;
      ">
        <span style="width:6px; height:6px; border-radius:50%; background:white; display:inline-block;"></span>
        ${tigerId}
      </div>
    `,
    iconSize: [64, 24],
    iconAnchor: [32, 12]
  });
};

// Camera station pin icon
const createStationIcon = (zone = 'Core Zone') => {
  const isCore = zone.includes('Core');
  const color = isCore ? '#059669' : '#d97706';
  return L.divIcon({
    className: 'custom-station-icon',
    html: `<div style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.35);"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5]
  });
};

export default function LiveMap() {
  const [territories, setTerritories] = useState([]);
  const [tigers, setTigers] = useState([]);
  const [cameraStations, setCameraStations] = useState([]);
  const [selectedTiger, setSelectedTiger] = useState('ALL'); // 'ALL' or specific tiger ID
  const [showRadius, setShowRadius] = useState(true);
  const [showPolygons, setShowPolygons] = useState(true);
  const [showSightings, setShowSightings] = useState(true);
  const [showStations, setShowStations] = useState(false);
  const [showCoreBoundary, setShowCoreBoundary] = useState(true);
  const [showBufferBoundary, setShowBufferBoundary] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [terrRes, tigersRes, stationsRes] = await Promise.all([
          getAllTerritories(),
          getAllTigers(),
          getCameraStations()
        ]);
        if (terrRes.data) setTerritories(terrRes.data);
        if (tigersRes.data) setTigers(tigersRes.data);
        if (stationsRes.data) setCameraStations(stationsRes.data);
      } catch (err) {
        console.error('Failed to load spatial data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredTerritories = selectedTiger === 'ALL'
    ? territories
    : territories.filter(t => t.tiger_id === selectedTiger);

  const selectedTerritoryData = territories.find(t => t.tiger_id === selectedTiger);

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Territory mapping for each Tiger
          </h1>
          
        </div>

        {/* TIGER SELECTOR DROPDOWN */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-surface-border shadow-sm">
            <Eye size={14} className="text-forest-700" />
            <label className="text-xs font-bold text-forest-950">Tiger Focus:</label>
            <select
              value={selectedTiger}
              onChange={(e) => setSelectedTiger(e.target.value)}
              className="bg-transparent border-0 text-forest-950 text-xs font-bold outline-none cursor-pointer"
            >
              <option value="ALL">🌐 All Resident Tigers (30 Territories)</option>
              {territories.map((t) => (
                <option key={t.tiger_id} value={t.tiger_id}>
                  {t.tiger_id} — {t.tiger_alias} ({t.core_area_sqkm} km²)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* MAP PANEL */}
      <div className="panel overflow-hidden">
        {/* MAP TOOLBAR / LAYER TOGGLES */}
        <div className="panel-header flex flex-wrap justify-between items-center gap-3 bg-slate-50 border-b border-surface-border py-2.5 px-4">
          <div className="panel-title text-xs font-bold flex items-center gap-2">
            <Layers size={16} className="text-emerald-700" />
            <span>Active Layers ({filteredTerritories.length} Territories Rendered)</span>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showRadius}
                onChange={(e) => setShowRadius(e.target.checked)}
                className="accent-amber-600"
              />
              <span className="text-amber-900 font-bold">🎯 Centroid Patrol Radius</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showPolygons}
                onChange={(e) => setShowPolygons(e.target.checked)}
                className="accent-emerald-600"
              />
              <span className="text-emerald-900 font-bold">⬡ MCP Territory Polygons</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSightings}
                onChange={(e) => setShowSightings(e.target.checked)}
                className="accent-blue-600"
              />
              <span className="text-blue-900 font-bold">📍 Sighting Points</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showStations}
                onChange={(e) => setShowStations(e.target.checked)}
                className="accent-slate-600"
              />
              <span className="text-slate-800 font-bold">📷 Camera Nodes ({cameraStations.length})</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showCoreBoundary}
                onChange={(e) => setShowCoreBoundary(e.target.checked)}
                className="accent-emerald-700"
              />
              <span className="text-emerald-800">Core Sanctuary</span>
            </label>
          </div>
        </div>

        {/* LEAFLET MAP CONTAINER */}
        <div style={{ height: '620px', width: '100%' }} className="relative bg-slate-100">
          <MapContainer
            center={
              selectedTerritoryData && selectedTerritoryData.centroid
                ? [selectedTerritoryData.centroid.lat, selectedTerritoryData.centroid.lon]
                : [21.655, 79.215]
            }
            zoom={selectedTiger === 'ALL' ? 11 : 13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors | Pench Forest Dept'
            />

            {/* 1. PENCH CORE ZONE BOUNDARY */}
            {showCoreBoundary && (
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
                  fillColor: '#059669',
                  fillOpacity: 0.04,
                  weight: 2,
                  dashArray: '4, 4'
                }}
              >
                <Popup>
                  <div className="font-bold text-xs text-emerald-900">
                    Pench National Park (Core Zone) · MP & MH
                  </div>
                </Popup>
              </Polygon>
            )}

            {/* 2. CAMERA TRAP STATIONS */}
            {showStations && cameraStations.map((st) => (
              <Marker
                key={st.id}
                position={[st.lat, st.lon]}
                icon={createStationIcon(st.zone)}
              >
                <Popup>
                  <div className="p-1 space-y-1 text-xs">
                    <div className="font-bold text-forest-950 flex items-center gap-1">
                      <Camera size={12} className="text-emerald-700" />
                      {st.id} — {st.name}
                    </div>
                    <div className="text-slate-600">
                      <strong>Sector:</strong> {st.sector} ({st.zone})
                    </div>
                    <div className="text-slate-600">
                      <strong>GPS:</strong> {st.lat.toFixed(4)}°N, {st.lon.toFixed(4)}°E
                    </div>
                    <div className="text-slate-600">
                      <strong>Elevation:</strong> {st.elevation_m}m · <strong>Battery:</strong> {st.battery}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* 3. TIGER TERRITORIES: POLYGONS, CENTROIDS, AND RADII */}
            {filteredTerritories.map((t) => {
              const color = getTigerColor(t.tiger_id);
              const centroid = t.centroid;
              const radiusMeters = t.radius_meters || 1200;

              if (!centroid || !t.capture_points || t.capture_points.length === 0) {
                return null;
              }

              return (
                <React.Fragment key={t.tiger_id}>
                  {/* A. HOME RANGE MINIMUM CONVEX POLYGON */}
                  {showPolygons && t.polygon && t.polygon.length >= 3 && (
                    <Polygon
                      positions={t.polygon}
                      pathOptions={{
                        color: color,
                        fillColor: color,
                        fillOpacity: selectedTiger === t.tiger_id ? 0.35 : 0.18,
                        weight: selectedTiger === t.tiger_id ? 3 : 2
                      }}
                    >
                      <Popup>
                        <div className="p-2 space-y-1.5 text-xs">
                          <div className="font-extrabold text-sm flex items-center gap-1.5" style={{ color: color }}>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                            {t.tiger_id} — {t.tiger_alias}
                          </div>
                          <div><strong>MCP Area:</strong> {t.core_area_sqkm} km²</div>
                          <div><strong>Sector:</strong> {t.sector}</div>
                          <div><strong>Zone:</strong> {t.zone}</div>
                          <div><strong>Sightings Count:</strong> {t.capture_points ? t.capture_points.length : 3}</div>
                        </div>
                      </Popup>
                    </Polygon>
                  )}

                  {/* B. CENTROID TERRITORY PATROL RADIUS CIRCLE */}
                  {showRadius && centroid && (
                    <Circle
                      center={[centroid.lat, centroid.lon]}
                      radius={radiusMeters}
                      pathOptions={{
                        color: color,
                        fillColor: color,
                        fillOpacity: selectedTiger === t.tiger_id ? 0.15 : 0.08,
                        weight: selectedTiger === t.tiger_id ? 2.5 : 1.5,
                        dashArray: '6, 6'
                      }}
                    >
                      <Popup>
                        <div className="p-2 space-y-1.5 text-xs">
                          <div className="font-extrabold text-sm" style={{ color: color }}>
                            🎯 {t.tiger_id} Centroid Territory Radius
                          </div>
                          <div><strong>Tiger:</strong> {t.tiger_alias}</div>
                          <div><strong>Centroid GPS:</strong> {centroid.lat.toFixed(4)}°N, {centroid.lon.toFixed(4)}°E</div>
                          <div><strong>Patrol Radius:</strong> {(radiusMeters / 1000).toFixed(2)} km ({radiusMeters}m)</div>
                          <div><strong>Core MCP Area:</strong> {t.core_area_sqkm} km²</div>
                          <div><strong>Sector:</strong> {t.sector} ({t.zone})</div>
                        </div>
                      </Popup>
                    </Circle>
                  )}

                  {/* C. CENTROID MARKER WITH TIGER ID BADGE */}
                  {centroid && (
                    <Marker
                      position={[centroid.lat, centroid.lon]}
                      icon={createTigerCentroidIcon(t.tiger_id, color)}
                    >
                      <Popup>
                        <div className="p-2 space-y-1.5 text-xs min-w-[200px]">
                          <div className="font-extrabold text-sm text-forest-950 border-b pb-1 flex items-center justify-between">
                            <span>{t.tiger_id}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                              Resident Centroid
                            </span>
                          </div>
                          <div className="font-bold text-slate-800">{t.tiger_alias}</div>
                          <div className="text-slate-600">
                            <strong>Centroid Coordinates:</strong> {centroid.lat.toFixed(5)}°N, {centroid.lon.toFixed(5)}°E
                          </div>
                          <div className="text-slate-600">
                            <strong>Territorial Buffer Radius:</strong> {(radiusMeters / 1000).toFixed(2)} km
                          </div>
                          <div className="text-slate-600">
                            <strong>Core Home Range:</strong> {t.core_area_sqkm} km²
                          </div>
                          <div className="text-slate-600">
                            <strong>Sector:</strong> {t.sector}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {/* D. INDIVIDUAL SIGHTINGS / CAMERA CAPTURES */}
                  {showSightings && t.capture_points && t.capture_points.map((pt, pIdx) => (
                    <CircleMarker
                      key={`${t.tiger_id}-pt-${pIdx}`}
                      center={[pt.lat, pt.lon]}
                      radius={selectedTiger === t.tiger_id ? 6 : 4}
                      pathOptions={{
                        color: 'white',
                        fillColor: color,
                        fillOpacity: 0.95,
                        weight: 1.5
                      }}
                    >
                      <Popup>
                        <div className="p-1 space-y-1 text-xs min-w-[160px]">
                          <div className="font-bold text-forest-950 flex items-center gap-1">
                            <MapPin size={12} style={{ color: color }} />
                            {t.tiger_id} Sighting #{pIdx + 1}
                          </div>
                          <div className="text-slate-600"><strong>Station:</strong> {pt.station}</div>
                          <div className="text-slate-600"><strong>Timestamp:</strong> {new Date(pt.timestamp).toLocaleString()}</div>
                          <div className="text-slate-600"><strong>GPS:</strong> {pt.lat.toFixed(4)}°N, {pt.lon.toFixed(4)}°E</div>
                          {pt.image_name && (
                            <div className="mt-1">
                              <img
                                src={`http://127.0.0.1:8000/data/raw/${pt.image_name}`}
                                alt="Capture"
                                className="w-full h-24 object-cover rounded border"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            </div>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </React.Fragment>
              );
            })}
          </MapContainer>
        </div>

        {/* MAP FOOTER TELEMETRY STATS */}
        <div className="map-footer bg-white p-4 border-t border-surface-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="map-metric-label">Active Enrolled Population</span>
              <span className="map-metric-value text-emerald-800 font-extrabold">
                {territories.length} Resident Tigers
              </span>
            </div>
            <div>
              <span className="map-metric-label">Territorial Radius Model</span>
              <span className="map-metric-value text-amber-700 font-bold">
                Centroid Buffer (0.80 – 2.20 km)
              </span>
            </div>
            <div>
              <span className="map-metric-label">Spatial Projection</span>
              <span className="map-metric-value text-slate-800">
                WGS84 / UTM Zone 44N (Metric Area)
              </span>
            </div>
          </div>

          {selectedTerritoryData && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-xs flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getTigerColor(selectedTerritoryData.tiger_id) }}></div>
              <div>
                <span className="font-extrabold text-forest-950">
                  {selectedTerritoryData.tiger_id} ({selectedTerritoryData.tiger_alias})
                </span>
                <span className="text-slate-600 ml-2">
                  Centroid: {selectedTerritoryData.centroid.lat.toFixed(4)}°N, {selectedTerritoryData.centroid.lon.toFixed(4)}°E | Radius: {(selectedTerritoryData.radius_meters / 1000).toFixed(2)} km | Area: {selectedTerritoryData.core_area_sqkm} km²
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}