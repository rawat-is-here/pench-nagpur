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
  AlertTriangle
} from 'lucide-react';
import { getAllTigers } from '../services/api';

const defaultTigers = [
  {
    id: 'T-001',
    name: 'Machli (Core Resident)',
    gender: 'Female',
    age: '6 Yrs',
    status: 'Monitored',
    territory: '18.4 sq km',
    lastSeen: 'Station A01 · Totladoh Bank',
    confidence: '98.4%',
    sightingsCount: 42,
    stripePattern: 'Asymmetric Chevron · Left Flank High Density',
    notes: 'Dominant breeding matriarch in Pench Core Sector. High fidelity to reservoir bank routes.'
  },
  {
    id: 'T-002',
    name: 'Ustad (Border Roamer)',
    gender: 'Male',
    age: '4.5 Yrs',
    status: 'Active',
    territory: '22.8 sq km',
    lastSeen: 'Station A06 · East River Buffer',
    confidence: '94.2%',
    stripePattern: 'Parallel Double Bar · Right Flank Torso Band',
    notes: 'Dominant core male. Frequently patrols river border and overlaps with T-001 at Ghatpendari.'
  },
  {
    id: 'T-104',
    name: 'Sharmilee (Sub-adult Disperser)',
    gender: 'Female',
    age: '2.5 Yrs',
    status: 'Deviating',
    territory: '14.1 sq km',
    lastSeen: 'Station A04 · Sillari Fringe',
    confidence: '91.0%',
    stripePattern: 'Branching Y-forks · Mid Flank Region',
    notes: 'Under active deviation monitoring. Dispersing towards agricultural buffer boundary.'
  }
];

export default function Tigers() {
  const [tigers, setTigers] = useState(defaultTigers);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTiger, setSelectedTiger] = useState(null);

  useEffect(() => {
    const fetchTigers = async () => {
      try {
        const res = await getAllTigers();
        if (res.data && res.data.length > 0) {
          // Merge API data with rich details
          const merged = res.data.map((t, idx) => {
            const match = defaultTigers.find(dt => dt.id === t.id);
            return match || {
              id: t.id,
              name: t.name || `Tiger ${t.id}`,
              gender: 'Unknown',
              age: 'Adult',
              status: 'Monitored',
              territory: '16.5 sq km',
              lastSeen: 'Station A02 · Pench Grid',
              confidence: '95.0%',
              sightingsCount: 12,
              stripePattern: 'ResNet-50 2048D Normalized Embedding',
              notes: 'Enrolled via automated camera trap stripe triage.'
            };
          });
          setTigers(merged);
        }
      } catch (err) {
        console.error('Error fetching tigers:', err);
      }
    };
    fetchTigers();
  }, []);

  const filtered = tigers.filter(
    (t) =>
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* PAGE HEADING */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 tracking-wider uppercase">
            Biometric Stripe Re-Identification Database
          </div>
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Enrolled Tiger Catalogue
          </h1>
          <p className="text-xs text-slate-600">
            Automated ResNet-50 flank stripe embeddings & historical spatial records across Pench Reserve.
          </p>
        </div>

        {/* SEARCH BAR */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Tiger ID, name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 rounded-lg bg-surface-card border border-surface-border text-xs text-forest-950 focus:outline-none focus:border-forest-700 shadow-sm w-64"
            />
          </div>
        </div>
      </div>

      {/* TIGER CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((tiger) => (
          <div 
            key={tiger.id} 
            className="panel p-5 space-y-4 hover:shadow-hover transition-all cursor-pointer"
            onClick={() => setSelectedTiger(tiger)}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="badge-tag badge-tiger mb-1.5 font-bold">
                  {tiger.id}
                </span>
                <h3 className="text-forest-950 font-extrabold text-base">{tiger.name}</h3>
                <span className="text-xs text-slate-500">{tiger.gender} · {tiger.age}</span>
              </div>

              <span className={`badge-tag ${
                tiger.status === 'Monitored'
                  ? 'badge-info'
                  : tiger.status === 'Deviating'
                  ? 'badge-critical'
                  : 'badge-warning'
              }`}>
                {tiger.status}
              </span>
            </div>

            {/* Biometric Stripe Pattern Summary Box */}
            <div className="p-3 bg-surface-subtle rounded-lg border border-surface-border space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-forest-900">
                <Fingerprint size={15} className="text-amber-600" />
                <span>Stripe Signature:</span>
              </div>
              <p className="text-[11px] text-slate-600 line-clamp-2">
                {tiger.stripePattern}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-surface-border">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Estimated Range</span>
                <span className="font-bold text-forest-950">{tiger.territory}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Re-ID Match Confidence</span>
                <span className="font-bold text-emerald-700">{tiger.confidence}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-500 pt-2">
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-slate-400" />
                {tiger.lastSeen.split('·')[0]}
              </span>
              <span className="text-forest-800 font-semibold flex items-center gap-1">
                <Eye size={12} /> View Dossier
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* TIGER DOSSIER MODAL */}
      {selectedTiger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/40 backdrop-blur-sm">
          <div className="panel max-w-lg w-full p-6 space-y-5 bg-white shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button 
              onClick={() => setSelectedTiger(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-forest-950"
            >
              <X size={18} />
            </button>

            <div>
              <span className="badge-tag badge-tiger mb-1.5 font-mono text-xs">{selectedTiger.id}</span>
              <h2 className="text-xl font-extrabold text-forest-950">{selectedTiger.name}</h2>
              <p className="text-xs text-slate-500">{selectedTiger.gender} · {selectedTiger.age} · Monitored in Sector 7</p>
            </div>

            <div className="p-4 rounded-xl bg-forest-50 border border-forest-100 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-forest-900">
                <Fingerprint size={16} className="text-amber-600" />
                <span>Biometric Flank Profile</span>
              </div>
              <p className="text-xs text-forest-800">
                {selectedTiger.stripePattern}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-surface-subtle rounded-lg border border-surface-border">
                <div className="text-[10px] uppercase font-bold text-slate-500">Core Range</div>
                <div className="text-sm font-extrabold text-forest-950">{selectedTiger.territory}</div>
              </div>
              <div className="p-3 bg-surface-subtle rounded-lg border border-surface-border">
                <div className="text-[10px] uppercase font-bold text-slate-500">Sightings</div>
                <div className="text-sm font-extrabold text-forest-950">{selectedTiger.sightingsCount} Captures</div>
              </div>
              <div className="p-3 bg-surface-subtle rounded-lg border border-surface-border">
                <div className="text-[10px] uppercase font-bold text-slate-500">Confidence</div>
                <div className="text-sm font-extrabold text-emerald-800">{selectedTiger.confidence}</div>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <span className="font-bold text-forest-950">Field Notes & Behavioral Log:</span>
              <p className="text-slate-600 leading-relaxed bg-surface-subtle p-3 rounded-lg border border-surface-border">
                {selectedTiger.notes}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setSelectedTiger(null)}
                className="btn btn-primary text-xs px-5 py-2"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}