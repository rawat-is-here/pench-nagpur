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
  Layers,
  AlertTriangle,
  ShieldCheck,
  Compass,
  MapPin,
  Activity,
  Eye,
  CheckCircle2,
  Sparkles,
  Maximize2
} from 'lucide-react';
import L from 'leaflet';
import { getAllTerritories, getTerritoryOverlaps } from '../services/api';

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

export default function Territories() {
  const [territories, setTerritories] = useState([]);
  const [overlaps, setOverlaps] = useState([]);
  const [selectedTigerId, setSelectedTigerId] = useState('T-001');
  const [searchTerm, setSearchTerm] = useState('');
  const [showRadius, setShowRadius] = useState(true);
  const [showAllOnMap, setShowAllOnMap] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTerritories() {
      setIsLoading(true);
      try {
        const [terrRes, ovRes] = await Promise.all([
          getAllTerritories(),
          getTerritoryOverlaps()
        ]);
        if (terrRes.data) setTerritories(terrRes.data);
        if (ovRes.data && ovRes.data.overlaps) setOverlaps(ovRes.data.overlaps);
      } catch (err) {
        console.error('Error fetching territory telemetry:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadTerritories();
  }, []);

  const filteredTerritories = territories.filter(t => 
    t.tiger_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.tiger_alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.sector.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeTerritory = territories.find(t => t.tiger_id === selectedTigerId) || territories[0];

  const totalArea = territories.reduce((acc, t) => acc + (t.core_area_sqkm || 0), 0);

  return (
    <div className="space-y-6">
      {/* PAGE HEADING */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 tracking-wider uppercase flex items-center gap-1.5">
            <Layers size={14} />
            Spatial Ecology & Territorial Dynamics
          </div>
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Home Range & Centroid Patrol Radii
          </h1>
          <p className="text-xs text-slate-600">
            Minimum Convex Polygon (MCP) calculations, activity centroid mapping, and territorial buffer radii for 30 resident tigers.
          </p>
        </div>

        {/* STAT BADGES */}
        <div className="flex items-center gap-3">
          <div className="bg-white border border-surface-border px-3.5 py-2 rounded-xl text-center shadow-sm">
            <div className="text-[10px] uppercase font-bold text-slate-500">Tracked Individuals</div>
            <div className="text-lg font-extrabold text-forest-950 font-mono">{territories.length}</div>
          </div>
          <div className="bg-white border border-surface-border px-3.5 py-2 rounded-xl text-center shadow-sm">
            <div className="text-[10px] uppercase font-bold text-slate-500">Total Core Range</div>
            <div className="text-lg font-extrabold text-emerald-800 font-mono">{totalArea.toFixed(1)} km²</div>
          </div>
        </div>
      </div>

      {/* DUAL COLUMN: MAP & TERRITORY LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: INTERACTIVE GEOSPATIAL MAP */}
        <div className="lg:col-span-7 panel overflow-hidden flex flex-col">
          <div className="panel-header bg-slate-50 flex flex-wrap justify-between items-center gap-3 p-3">
            <div className="panel-title text-xs font-bold flex items-center gap-2">
              <Compass size={16} className="text-emerald-700" />
              <span>
                {showAllOnMap ? 'All 30 Resident Territories' : `${activeTerritory?.tiger_id} Territory & Patrol Radius`}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRadius}
                  onChange={(e) => setShowRadius(e.target.checked)}
                  className="accent-amber-600"
                />
                <span className="text-amber-900 font-bold">🎯 Patrol Radius</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllOnMap}
                  onChange={(e) => setShowAllOnMap(e.target.checked)}
                  className="accent-forest-700"
                />
                <span className="text-forest-900 font-bold">Show All 30</span>
              </label>
            </div>
          </div>

          <div style={{ height: '520px', width: '100%' }} className="relative bg-slate-100 flex-1">
            <MapContainer
              center={
                activeTerritory && activeTerritory.centroid
                  ? [activeTerritory.centroid.lat, activeTerritory.centroid.lon]
                  : [21.655, 79.215]
              }
              zoom={showAllOnMap ? 11 : 13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />

              {/* RENDER TARGET OR ALL TERRITORIES */}
              {(showAllOnMap ? territories : (activeTerritory ? [activeTerritory] : [])).map((t) => {
                const color = getTigerColor(t.tiger_id);
                const centroid = t.centroid;
                const radiusM = t.radius_meters || 1200;

                return (
                  <React.Fragment key={t.tiger_id}>
                    {/* POLYGON */}
                    {t.polygon && t.polygon.length >= 3 && (
                      <Polygon
                        positions={t.polygon}
                        pathOptions={{
                          color: color,
                          fillColor: color,
                          fillOpacity: 0.28,
                          weight: 2.5
                        }}
                      >
                        <Popup>
                          <div className="p-1 space-y-1 text-xs">
                            <div className="font-extrabold text-sm" style={{ color: color }}>
                              {t.tiger_id} — {t.tiger_alias}
                            </div>
                            <div><strong>MCP Area:</strong> {t.core_area_sqkm} km²</div>
                            <div><strong>Sector:</strong> {t.sector}</div>
                          </div>
                        </Popup>
                      </Polygon>
                    )}

                    {/* CENTROID RADIUS */}
                    {showRadius && centroid && (
                      <Circle
                        center={[centroid.lat, centroid.lon]}
                        radius={radiusM}
                        pathOptions={{
                          color: color,
                          fillColor: color,
                          fillOpacity: 0.12,
                          weight: 2,
                          dashArray: '6, 6'
                        }}
                      >
                        <Popup>
                          <div className="p-1 space-y-1 text-xs">
                            <div className="font-bold text-amber-800">
                              🎯 Centroid Patrol Buffer: {(radiusM / 1000).toFixed(2)} km
                            </div>
                            <div><strong>Centroid:</strong> {centroid.lat.toFixed(4)}°N, {centroid.lon.toFixed(4)}°E</div>
                            <div><strong>Tiger:</strong> {t.tiger_id} ({t.tiger_alias})</div>
                          </div>
                        </Popup>
                      </Circle>
                    )}

                    {/* CENTROID BADGE MARKER */}
                    {centroid && (
                      <Marker
                        position={[centroid.lat, centroid.lon]}
                        icon={createTigerCentroidIcon(t.tiger_id, color)}
                      >
                        <Popup>
                          <div className="p-1.5 space-y-1 text-xs">
                            <div className="font-extrabold text-sm">{t.tiger_id} Centroid</div>
                            <div className="text-slate-600"><strong>Alias:</strong> {t.tiger_alias}</div>
                            <div className="text-slate-600"><strong>GPS:</strong> {centroid.lat.toFixed(5)}°N, {centroid.lon.toFixed(5)}°E</div>
                            <div className="text-slate-600"><strong>Patrol Radius:</strong> {(radiusM / 1000).toFixed(2)} km</div>
                            <div className="text-slate-600"><strong>Core MCP:</strong> {t.core_area_sqkm} km²</div>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {/* SIGHTING NODES */}
                    {t.capture_points && t.capture_points.map((pt, pIdx) => (
                      <CircleMarker
                        key={`${t.tiger_id}-pt-${pIdx}`}
                        center={[pt.lat, pt.lon]}
                        radius={4}
                        pathOptions={{ color: 'white', fillColor: color, fillOpacity: 0.9, weight: 1.5 }}
                      >
                        <Popup>
                          <div className="p-1 text-xs">
                            <strong>{t.tiger_id} Sighting #{pIdx+1}</strong><br/>
                            Station: {pt.station}<br/>
                            GPS: {pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </React.Fragment>
                );
              })}
            </MapContainer>
          </div>

          {/* ACTIVE TERRITORY SUMMARY FOOTER */}
          {activeTerritory && (
            <div className="bg-white p-4 border-t border-surface-border text-xs flex flex-wrap justify-between items-center gap-3">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Selected Individual</span>
                <span className="font-extrabold text-forest-950 text-sm">
                  {activeTerritory.tiger_id} — {activeTerritory.tiger_alias}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Centroid Location</span>
                <span className="font-mono text-slate-800">
                  {activeTerritory.centroid?.lat.toFixed(4)}°N, {activeTerritory.centroid?.lon.toFixed(4)}°E
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Centroid Patrol Radius</span>
                <span className="font-mono text-amber-700 font-extrabold">
                  {(activeTerritory.radius_meters / 1000).toFixed(2)} km ({activeTerritory.radius_meters}m)
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">MCP Core Area</span>
                <span className="font-mono text-emerald-800 font-extrabold">
                  {activeTerritory.core_area_sqkm} km²
                </span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: SEARCHABLE 30-TIGER ROSTER */}
        <div className="lg:col-span-5 space-y-4">
          <div className="panel p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-forest-950 flex items-center gap-2">
                <Eye size={16} className="text-forest-700" />
                Territorial Roster ({filteredTerritories.length})
              </h3>
            </div>

            <input
              type="text"
              placeholder="Search by ID (e.g. T-005), Alias, or Sector..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-surface-border rounded-lg px-3 py-2 text-xs outline-none focus:border-forest-600"
            />
          </div>

          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            {filteredTerritories.map((t) => {
              const isSelected = t.tiger_id === selectedTigerId;
              const color = getTigerColor(t.tiger_id);

              return (
                <div
                  key={t.tiger_id}
                  onClick={() => setSelectedTigerId(t.tiger_id)}
                  className={`panel p-3.5 cursor-pointer transition-all border-l-4 hover:shadow-sm ${
                    isSelected ? 'ring-2 ring-forest-700 bg-emerald-50/40' : 'hover:bg-slate-50'
                  }`}
                  style={{ borderLeftColor: color }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold font-mono text-xs text-forest-950 px-2 py-0.5 rounded bg-slate-100">
                          {t.tiger_id}
                        </span>
                        <span className="text-xs font-bold text-forest-950 truncate max-w-[200px]">
                          {t.tiger_alias}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin size={11} className="text-slate-400" />
                        {t.sector} ({t.zone})
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-extrabold text-emerald-800 font-mono">
                        {t.core_area_sqkm} km²
                      </div>
                      <div className="text-[10px] text-amber-700 font-bold font-mono mt-0.5">
                        R = {(t.radius_meters / 1000).toFixed(2)} km
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}