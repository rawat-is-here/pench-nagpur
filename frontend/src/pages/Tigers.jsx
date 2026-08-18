import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  MapPin, 
  Shield, 
  Calendar, 
  X, 
  Plus, 
  Eye, 
  Sparkles, 
  Layers, 
  Fingerprint,
  CheckCircle2,
  AlertTriangle,
  Camera
} from 'lucide-react';
import { getAllTerritories, getAllTigers } from '../services/api';

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

export default function Tigers() {
  const [territories, setTerritories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTiger, setSelectedTiger] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await getAllTerritories();
        if (res.data) setTerritories(res.data);
      } catch (err) {
        console.error('Error fetching tiger territories:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const filtered = territories.filter(
    (t) =>
      t.tiger_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.tiger_alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.sector.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Tiger Profiles and details
          </h1>
          
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, alias, or sector..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-surface-border rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:border-forest-600 w-64 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* 30 TIGERS CARD GRID */}
      {filtered.length === 0 ? (
        <div className="panel p-12 text-center space-y-3">
          <Fingerprint size={36} className="mx-auto text-slate-300" />
          <h3 className="text-forest-950 font-extrabold text-base">No Tigers Enrolled in Database Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Upload raw camera trap frames via the Command Center. The AI pipeline will extract EXIF location data, isolate stripes, and dynamically enroll resident tigers.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((t) => {
            const color = getTigerColor(t.tiger_id);
            const firstImage = t.capture_points && t.capture_points.length > 0 ? t.capture_points[0].image_name : `${t.tiger_id}_1.jpg`;

          return (
            <div
              key={t.tiger_id}
              onClick={() => setSelectedTiger(t)}
              className="panel overflow-hidden hover:shadow-hover transition-all cursor-pointer group flex flex-col justify-between border-t-4"
              style={{ borderTopColor: color }}
            >
              <div>
                {/* THUMBNAIL IMAGE */}
                <div className="relative aspect-video bg-slate-200 overflow-hidden border-b border-surface-border">
                  <img
                    src={`http://127.0.0.1:8000/data/raw/${firstImage}`}
                    alt={t.tiger_alias}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=500&auto=format&fit=crop&q=60';
                    }}
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-forest-950/80 backdrop-blur-sm text-white font-mono text-[10px] font-extrabold">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></span>
                    {t.tiger_id}
                  </div>
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold">
                    {t.zone}
                  </div>
                </div>

                {/* CONTENT */}
                <div className="p-4 space-y-2.5">
                  <div>
                    <h3 className="font-extrabold text-forest-950 text-sm leading-tight group-hover:text-forest-700 transition-colors">
                      {t.tiger_alias}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin size={11} className="text-slate-400" />
                      {t.sector}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-surface-border text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">MCP Core Area</span>
                      <strong className="text-forest-950 font-mono">{t.core_area_sqkm} km²</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Patrol Radius</span>
                      <strong className="text-amber-700 font-mono">{(t.radius_meters / 1000).toFixed(2)} km</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="px-4 py-2.5 bg-slate-50 border-t border-surface-border flex justify-between items-center text-[11px] text-slate-500">
                <span className="flex items-center gap-1 font-mono">
                  <Camera size={11} /> {t.capture_points ? t.capture_points.length : 3} Captures
                </span>
                <span className="text-forest-800 font-bold group-hover:translate-x-0.5 transition-transform">
                  View Profile →
                </span>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedTiger && (
        <div className="modal-backdrop" onClick={() => setSelectedTiger(null)}>
          <div className="modal-card max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <span className="font-mono text-base px-2 py-0.5 rounded bg-forest-100 text-forest-900 font-extrabold">
                  {selectedTiger.tiger_id}
                </span>
                <span className="text-base font-extrabold text-forest-950">{selectedTiger.tiger_alias}</span>
              </div>
              <button
                onClick={() => setSelectedTiger(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body space-y-4">
              {/* PHOTO GALLERY */}
              <div>
                <div className="text-xs font-bold text-forest-950 mb-2 flex items-center gap-1">
                  <Camera size={14} />
                  Verified Flank & Sighting Captures ({selectedTiger.capture_points ? selectedTiger.capture_points.length : 3})
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(selectedTiger.capture_points || []).map((cp, idx) => (
                    <div key={idx} className="aspect-video bg-slate-100 rounded-lg overflow-hidden border border-surface-border relative group">
                      <img
                        src={`http://127.0.0.1:8000/data/raw/${cp.image_name || `${selectedTiger.tiger_id}_${idx+1}.jpg`}`}
                        alt="Capture"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=500&auto=format&fit=crop&q=60';
                        }}
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-forest-950/80 p-1 text-[10px] text-white font-mono truncate">
                        {cp.station}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TELEMETRY & TERRITORY DETAILS */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="panel p-3 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Activity Centroid</span>
                  <div className="font-mono font-bold text-slate-900">
                    {selectedTiger.centroid?.lat?.toFixed(5)}°N, {selectedTiger.centroid?.lon?.toFixed(5)}°E
                  </div>
                </div>
                <div className="panel p-3 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Centroid Patrol Radius</span>
                  <div className="font-mono font-bold text-amber-700">
                    {(selectedTiger.radius_meters / 1000).toFixed(2)} km ({selectedTiger.radius_meters}m)
                  </div>
                </div>
                <div className="panel p-3 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Minimum Convex Polygon (MCP)</span>
                  <div className="font-mono font-bold text-emerald-800">
                    {selectedTiger.core_area_sqkm} km²
                  </div>
                </div>
                <div className="panel p-3 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Sanctuary Sector & Zone</span>
                  <div className="font-bold text-forest-950">
                    {selectedTiger.sector} ({selectedTiger.zone})
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div className="text-xs text-slate-500 font-mono">
                Biometric Vector: 2048D ResNet-50 FAISS Embedded
              </div>
              <button
                onClick={() => setSelectedTiger(null)}
                className="px-4 py-1.5 bg-forest-900 text-white rounded-lg text-xs font-bold hover:bg-forest-800 cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}