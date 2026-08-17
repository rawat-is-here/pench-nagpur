import React, { useState } from 'react';
import { MapPin, Calendar, Clock, Filter, CheckCircle2, AlertCircle } from 'lucide-react';

const mockSightings = [
  {
    id: 'SGT-8841',
    tiger_id: 'T-001',
    station: 'Station A01 · Totladoh Bank',
    timestamp: '2026-08-14 21:00:00',
    coordinates: '21.648° N, 79.230° E',
    confidence: '98.4%',
    type: 'MegaDetector + ResNet50 Re-ID',
    verified: true
  },
  {
    id: 'SGT-8839',
    tiger_id: 'T-002',
    station: 'Station A06 · East River Buffer',
    timestamp: '2026-08-14 04:50:00',
    coordinates: '21.658° N, 79.250° E',
    confidence: '94.2%',
    type: 'Camera Trap AI Match',
    verified: true
  },
  {
    id: 'SGT-8820',
    tiger_id: 'T-104',
    station: 'Station A04 · Sillari Fringe',
    timestamp: '2026-08-13 03:15:00',
    coordinates: '21.655° N, 79.190° E',
    confidence: '91.0%',
    type: 'Automated Detection',
    verified: false
  },
  {
    id: 'SGT-8815',
    tiger_id: 'T-001',
    station: 'Station A02 · Ghatpendari Corridor',
    timestamp: '2026-08-11 12:30:00',
    coordinates: '21.661° N, 79.215° E',
    confidence: '97.1%',
    type: 'Camera Trap AI Match',
    verified: true
  }
];

export default function Sightings() {
  const [filterTiger, setFilterTiger] = useState('ALL');

  const filtered = filterTiger === 'ALL' 
    ? mockSightings 
    : mockSightings.filter(s => s.tiger_id === filterTiger);

  return (
    <div className="space-y-6">
      {/* PAGE HEADING */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 tracking-wider uppercase">
            Telemetry & Field Captures Audit Trail
          </div>
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Sightings & Detection Log
          </h1>
          <p className="text-xs text-slate-600">
            Chronological log of camera trap detections, biometric stripe matches, and field station pings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Filter size={14} className="text-slate-500" />
          <select
            value={filterTiger}
            onChange={(e) => setFilterTiger(e.target.value)}
            className="bg-surface-card border border-surface-border text-forest-950 rounded-lg px-3 py-1.5 text-xs font-bold outline-none shadow-sm"
          >
            <option value="ALL">All Enrolled Tigers</option>
            <option value="T-001">Tiger T-001 (Machli)</option>
            <option value="T-002">Tiger T-002 (Ustad)</option>
            <option value="T-104">Tiger T-104 (Sharmilee)</option>
          </select>
        </div>
      </div>

      {/* SIGHTINGS TABLE */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-surface-subtle text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Tiger</th>
                <th className="py-3 px-4">Camera Station</th>
                <th className="py-3 px-4">Timestamp (IST)</th>
                <th className="py-3 px-4">GPS Coordinates</th>
                <th className="py-3 px-4">Similarity Score</th>
                <th className="py-3 px-4">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border text-slate-700">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-surface-subtle/60 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{s.id}</td>
                  <td className="py-3.5 px-4 font-bold">
                    <span className="badge-tag badge-tiger font-mono">
                      {s.tiger_id}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="flex items-center gap-1.5 text-forest-950 font-semibold">
                      <MapPin size={13} className="text-emerald-700" />
                      {s.station}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{s.timestamp}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{s.coordinates}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">{s.confidence}</td>
                  <td className="py-3.5 px-4">
                    {s.verified ? (
                      <span className="badge-tag badge-info">
                        <CheckCircle2 size={11} /> Auto-Verified
                      </span>
                    ) : (
                      <span className="badge-tag badge-warning">
                        <AlertCircle size={11} /> Review Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}