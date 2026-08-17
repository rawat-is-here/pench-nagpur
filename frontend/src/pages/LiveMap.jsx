import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, Eye, Shield, AlertTriangle, Layers, MapPin } from 'lucide-react';
import { getTerritory } from '../services/api';

export default function LiveMap() {
  const [selectedTiger, setSelectedTiger] = useState('T-001');
  const [territory, setTerritory] = useState(null);
  const [showCoreZone, setShowCoreZone] = useState(true);
  const [showBufferZone, setShowBufferZone] = useState(true);

  useEffect(() => {
    async function loadTerritory() {
      try {
        const res = await getTerritory(selectedTiger);
        if (res.data && res.data.status === 'calculated') {
          setTerritory(res.data);
        } else {
          setTerritory(null);
        }
      } catch (err) {
        console.error('Failed to load territory on live map:', err);
      }
    }
    loadTerritory();
  }, [selectedTiger]);

  return (
    <div className="space-y-6">
      {/* PAGE HEADING */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 tracking-wider uppercase">
            Geospatial Intelligence & Spatial Ecology
          </div>
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Tactical Reserve GIS Map
          </h1>
          <p className="text-xs text-slate-600">
            Real-time projection of Minimum Convex Polygons (MCP), activity centroids, and sanctuary boundaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-forest-950">Tiger Focus:</label>
          <select
            value={selectedTiger}
            onChange={(e) => setSelectedTiger(e.target.value)}
            className="bg-surface-card border border-surface-border text-forest-950 rounded-lg px-3 py-1.5 text-xs font-bold outline-none shadow-sm"
          >
            <option value="T-001">Tiger T-001 (Machli)</option>
            <option value="T-002">Tiger T-002 (Ustad)</option>
            <option value="T-104">Tiger T-104 (Sharmilee)</option>
          </select>
        </div>
      </div>

      {/* MAP PANEL */}
      <div className="panel overflow-hidden">
        <div className="panel-header flex flex-wrap justify-between items-center gap-3">
          <div className="panel-title">
            <Compass size={17} className="text-emerald-700" />
            <span>High-Resolution Geospatial Feed · Pench Sector-7</span>
          </div>

          <div className="flex gap-4 text-xs font-medium">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showCoreZone}
                onChange={(e) => setShowCoreZone(e.target.checked)}
                className="accent-emerald-600"
              />
              <span className="text-emerald-800 font-bold">Pench Core Zone</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showBufferZone}
                onChange={(e) => setShowBufferZone(e.target.checked)}
                className="accent-amber-600"
              />
              <span className="text-amber-800 font-bold">Buffer Coexistence Boundary</span>
            </label>
          </div>
        </div>

        <div style={{ height: '520px', width: '100%' }}>
          <MapContainer center={[21.655, 79.215]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />

            {showCoreZone && (
              <Polygon
                positions={[[21.71, 79.19], [21.71, 79.29], [21.61, 79.29], [21.61, 79.19]]}
                pathOptions={{ color: '#059669', fillColor: '#059669', fillOpacity: 0.08, weight: 2 }}
              >
                <Popup>
                  <strong className="text-emerald-900 block font-bold">Pench Core Zone Boundary</strong>
                  <span className="text-xs text-slate-600">Strict wildlife sanctuary sanctuary.</span>
                </Popup>
              </Polygon>
            )}

            {showBufferZone && (
              <Polygon
                positions={[[21.75, 79.15], [21.75, 79.35], [21.55, 79.35], [21.55, 79.15]]}
                pathOptions={{ color: '#d97706', fillColor: '#d97706', fillOpacity: 0.04, weight: 1.5, dashArray: '5, 5' }}
              >
                <Popup>
                  <strong className="text-amber-900 block font-bold">Pench Buffer Zone Boundary</strong>
                  <span className="text-xs text-slate-600">Forest-village coexistence perimeter.</span>
                </Popup>
              </Polygon>
            )}

            {territory && territory.centroid && (
              <Marker position={[territory.centroid.lat, territory.centroid.lon]}>
                <Popup>
                  <div className="text-xs space-y-1">
                    <strong className="text-forest-950 font-bold block">Tiger {territory.tiger_id} Activity Centroid</strong>
                    <div>Calculated Area: <strong>{territory.core_area_sqkm} sq km</strong></div>
                    <div className="font-mono text-slate-500">{territory.centroid.lat.toFixed(3)}°N, {territory.centroid.lon.toFixed(3)}°E</div>
                  </div>
                </Popup>
              </Marker>
            )}

            {territory && territory.polygon && territory.polygon.length > 0 && (
              <Polygon
                positions={territory.polygon}
                pathOptions={{ color: '#059669', fillColor: '#10b981', fillOpacity: 0.25, weight: 2.5 }}
              />
            )}
          </MapContainer>
        </div>

        {/* METRICS STRIP */}
        <div className="p-4 bg-surface-subtle border-t border-surface-border flex flex-wrap justify-between items-center text-xs">
          {territory ? (
            <div className="flex flex-wrap gap-8">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Focused Individual</span>
                <span className="font-bold text-forest-950 text-sm">{territory.tiger_id}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Home Range Area (MCP)</span>
                <span className="font-bold text-forest-950 text-sm">{territory.core_area_sqkm} sq km</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Activity Centroid</span>
                <span className="font-bold font-mono text-emerald-800 text-sm">
                  {territory.centroid?.lat?.toFixed(3)}°N, {territory.centroid?.lon?.toFixed(3)}°E
                </span>
              </div>
            </div>
          ) : (
            <span className="text-slate-500">Generating Minimum Convex Polygon telemetry...</span>
          )}

          <div className="text-slate-500 text-[11px]">
            Projection: <strong>WGS84 / UTM 44N</strong>
          </div>
        </div>
      </div>
    </div>
  );
}