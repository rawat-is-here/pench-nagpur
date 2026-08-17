import React from 'react';
import { Download, FileText, CheckSquare, FileSpreadsheet, MapPin } from 'lucide-react';

export default function Reports() {
  const handleDownload = (type) => {
    alert(`Generating ${type} report for Pench Tiger Reserve Field Officers... Ready for export.`);
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADING */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 tracking-wider uppercase">
            Export & Forest Department Reporting
          </div>
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Reserve Intelligence Exports
          </h1>
          
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Report 1 */}
        <div className="panel p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <FileText size={20} />
            </div>
            <span className="badge-tag badge-info">PDF Report</span>
          </div>
          <div>
            <h3 className="text-forest-950 font-extrabold text-base">Weekly Sector Activity & Deviation Briefing</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Consolidates camera trap triage counts, individual tiger encounters, core range shifts, and village-adjacent corridor warnings for the Pench Field Director.
            </p>
          </div>
          <button 
            onClick={() => handleDownload("Weekly Corridor Activity")}
            className="btn btn-primary text-xs w-full py-2 flex items-center justify-center gap-2"
          >
            <Download size={14} />
            Export Executive PDF Summary
          </button>
        </div>

        {/* Report 2 */}
        <div className="panel p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
              <FileSpreadsheet size={20} />
            </div>
            <span className="badge-tag badge-tiger">GIS & CSV</span>
          </div>
          <div>
            <h3 className="text-forest-950 font-extrabold text-base">Tiger Home Range (MCP) Shapefile & CSV</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Full spatial dataset containing UTM Zone 44N polygon boundaries, activity centroids, territorial overlap intersections, and camera station capture logs.
            </p>
          </div>
          <button 
            onClick={() => handleDownload("GIS Spatial Dataset")}
            className="btn btn-secondary text-xs w-full py-2 flex items-center justify-center gap-2"
          >
            <Download size={14} />
            Export GIS GeoJSON & CSV
          </button>
        </div>
      </div>
    </div>
  );
}