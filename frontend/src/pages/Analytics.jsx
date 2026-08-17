import React from 'react';
import { BarChart3, TrendingUp, Cpu, HardDrive, Zap, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function Analytics() {
  return (
    <div className="space-y-6">
      {/* PAGE HEADING */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 tracking-wider uppercase">
            Inference Performance & Pipeline ROI
          </div>
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            System & Triage Analytics
          </h1>
          
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card accent-emerald">
          <div className="stat-label">
            <Zap size={14} className="text-emerald-600" />
            MDV6 Inference Latency
          </div>
          <div className="stat-value text-emerald-800">38 ms</div>
          <div className="stat-meta">MegaDetector V6 (YOLOv10-e)</div>
        </div>

        <div className="stat-card accent-tiger">
          <div className="stat-label">
            <Cpu size={14} className="text-amber-600" />
            FAISS Re-ID Match Time
          </div>
          <div className="stat-value text-amber-800">1.4 ms</div>
          <div className="stat-meta">2048-dim ResNet-50 Index</div>
        </div>

        <div className="stat-card accent-cyan">
          <div className="stat-label">
            <HardDrive size={14} className="text-sky-600" />
            Blank Filtration Ratio
          </div>
          <div className="stat-value text-sky-900">78.2%</div>
          <div className="stat-meta">Vegetation & empty frames quarantined</div>
        </div>

        <div className="stat-card accent-emerald">
          <div className="stat-label">
            <CheckCircle2 size={14} className="text-emerald-600" />
            Detection Precision
          </div>
          <div className="stat-value text-emerald-800">99.1%</div>
          <div className="stat-meta">Verified across 142 optical nodes</div>
        </div>
      </div>

      {/* ROI & PERFORMANCE BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel p-5 space-y-4">
          <h3 className="text-forest-950 font-bold text-sm flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-700" />
            Automated Triage Efficiency vs. Manual Review
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>Manual Field Review Speed</span>
                <span className="text-slate-500">~4.0 seconds / frame</span>
              </div>
              <div className="w-full bg-surface-subtle h-2.5 rounded-full overflow-hidden">
                <div className="bg-slate-400 h-full rounded-full" style={{ width: '25%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between font-semibold text-forest-950 mb-1">
                <span>MegaDetector V6 AI Pipeline</span>
                <span className="text-emerald-800 font-bold">~0.038 seconds / frame (105x faster)</span>
              </div>
              <div className="w-full bg-surface-subtle h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: '98%' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel p-5 space-y-4">
          <h3 className="text-forest-950 font-bold text-sm flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-700" />
            Alert Distribution by Severity
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <div className="font-bold text-rose-900 text-lg">2</div>
              <div className="text-[10px] uppercase font-bold text-rose-700">Critical Shifts</div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="font-bold text-amber-900 text-lg">4</div>
              <div className="text-[10px] uppercase font-bold text-amber-700">Buffer Warnings</div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="font-bold text-emerald-900 text-lg">18</div>
              <div className="text-[10px] uppercase font-bold text-emerald-700">Station Pings</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}