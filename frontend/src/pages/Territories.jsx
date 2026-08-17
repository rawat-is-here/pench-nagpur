import React, { useState, useEffect } from 'react';
import { Layers, AlertTriangle, ShieldCheck, Compass, MapPin, Activity } from 'lucide-react';
import { getTerritoryOverlaps } from '../services/api';

const territoryData = [
  {
    tiger_id: 'T-001',
    name: 'Machli (Core Resident)',
    core_area: '18.4 sq km',
    overlap_risk: 'Low (6.2%)',
    primary_zone: 'Pench Core · Totladoh Bank',
    status: 'Stable Territory'
  },
  {
    tiger_id: 'T-002',
    name: 'Ustad (Border Roamer)',
    core_area: '22.8 sq km',
    overlap_risk: 'Moderate (16.8%)',
    primary_zone: 'East River Buffer · Kolitmara',
    status: 'Border Overlap Active'
  },
  {
    tiger_id: 'T-104',
    name: 'Sharmilee (Sub-adult Disperser)',
    core_area: '14.1 sq km',
    overlap_risk: 'High (28.4%)',
    primary_zone: 'West Corridor · Sillari Fringe',
    status: 'Active Range Shift'
  }
];

export default function Territories() {
  const [overlaps, setOverlaps] = useState([]);

  useEffect(() => {
    async function loadOverlaps() {
      try {
        const res = await getTerritoryOverlaps();
        if (res.data && res.data.overlaps) {
          setOverlaps(res.data.overlaps);
        }
      } catch (err) {
        console.error('Error fetching overlaps:', err);
      }
    }
    loadOverlaps();
  }, []);

  return (
    <div className="space-y-6">
      {/* PAGE HEADING */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 tracking-wider uppercase">
            Spatial Ecology & Territorial Dynamics
          </div>
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Home Range & Overlap Analysis
          </h1>
          <p className="text-xs text-slate-600">
            Minimum Convex Polygon (MCP) calculations, boundary overlaps, and territorial dispute risk scoring.
          </p>
        </div>
      </div>

      {/* OVERVIEW STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {territoryData.map((item) => (
          <div key={item.tiger_id} className="panel p-5 space-y-4 hover:shadow-hover transition-all">
            <div className="flex justify-between items-center">
              <span className="badge-tag badge-tiger font-mono text-xs font-bold">
                {item.tiger_id}
              </span>
              <span className={`badge-tag ${
                item.status === 'Active Range Shift' 
                  ? 'badge-critical' 
                  : item.status === 'Border Overlap Active'
                  ? 'badge-warning'
                  : 'badge-info'
              }`}>
                {item.status}
              </span>
            </div>

            <div>
              <h3 className="text-forest-950 font-extrabold text-base">{item.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <MapPin size={12} className="text-slate-400" />
                {item.primary_zone}
              </p>
            </div>

            <div className="border-t border-surface-border pt-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Occupied Area (MCP):</span>
                <strong className="text-forest-950 font-mono text-sm">{item.core_area}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Territorial Overlap:</span>
                <strong className={`font-mono ${item.overlap_risk.includes('High') ? 'text-rose-700 font-bold' : 'text-amber-700'}`}>
                  {item.overlap_risk}
                </strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* OVERLAP BREAKDOWN PANEL */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Layers size={17} className="text-amber-600" />
            <span>Territorial Overlap Matrix (Deliverable iii)</span>
          </div>
        </div>

        <div className="panel-body">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border text-slate-500 uppercase text-[10px] tracking-wider">
                  <th className="pb-3 font-bold">Primary Individual</th>
                  <th className="pb-3 font-bold">Overlapping Individual</th>
                  <th className="pb-3 font-bold">Intersection Area (km²)</th>
                  <th className="pb-3 font-bold">Corridor Zone</th>
                  <th className="pb-3 font-bold">Dispute Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                <tr>
                  <td className="py-3 font-bold text-forest-950">T-001 (Machli)</td>
                  <td className="py-3 font-bold text-forest-950">T-002 (Ustad)</td>
                  <td className="py-3 font-mono font-bold text-amber-700">3.84 sq km</td>
                  <td className="py-3 text-slate-600">Ghatpendari / Riverbank Crossing</td>
                  <td className="py-3">
                    <span className="badge-tag badge-warning">Moderate (16.8%)</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-bold text-forest-950">T-002 (Ustad)</td>
                  <td className="py-3 font-bold text-forest-950">T-104 (Sharmilee)</td>
                  <td className="py-3 font-mono font-bold text-slate-700">1.12 sq km</td>
                  <td className="py-3 text-slate-600">Western Fringe Passage</td>
                  <td className="py-3">
                    <span className="badge-tag badge-info">Low (5.2%)</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}