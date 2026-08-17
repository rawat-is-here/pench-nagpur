import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Compass,
  Camera,
  MapPin,
  Layers,
  BarChart3,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  Radio,
  FolderSync,
  ShieldAlert,
  UserCheck
} from 'lucide-react';

export default function Sidebar({ onRefresh, isRefreshing }) {
  const getNavClass = ({ isActive }) =>
    `nav-item ${isActive ? 'active' : ''}`;

  return (
    <aside className="sidebar">
      {/* BRAND HEADER */}
      <div className="brand">
        <div className="brand-badge">
          <Radio size={10} className="animate-pulse text-amber-400" />
          Pench Intelligence
        </div>
        <div className="flex items-center gap-3">
          <div className="brand-mark">
            <img src="/favicon.svg" alt="TerraStripe Logo" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <div className="brand-title">TERRASTRIPE</div>
            <div className="brand-subtitle">Reserve Spatial Intelligence</div>
          </div>
        </div>
      </div>

      {/* NAVIGATION SECTIONS */}
      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="sidebar-section-title">Operations Core</div>
          <NavLink to="/" end className={getNavClass}>
            <LayoutDashboard size={16} />
            <span>Command Center</span>
          </NavLink>
          <NavLink to="/live-map" className={getNavClass}>
            <Compass size={16} />
            <span>Tactical GIS Map</span>
          </NavLink>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Fauna Intelligence</div>
          <NavLink to="/tigers" className={getNavClass}>
            <Eye size={16} />
            <span>Tiger Biometrics</span>
          </NavLink>
          <NavLink to="/territories" className={getNavClass}>
            <Layers size={16} />
            <span>Home Ranges & MCP</span>
          </NavLink>

        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Optical Grid & Triage</div>

          <NavLink to="/add-dataset" className={getNavClass}>
            <FolderSync size={16} />
            <span>Add new dataset</span>
          </NavLink>
          <NavLink to="/quarantine" className={getNavClass}>
            <ShieldAlert size={16} />
            <span>Quarantined data</span>
          </NavLink>
          <NavLink to="/manual-review" className={getNavClass}>
            <UserCheck size={16} />
            <span>Needs Manual Review</span>
          </NavLink>
          <NavLink to="/analytics" className={getNavClass}>
            <BarChart3 size={16} />
            <span>Triage Analytics</span>
          </NavLink>
          <NavLink to="/reports" className={getNavClass}>
            <FileSpreadsheet size={16} />
            <span>Field Exports</span>
          </NavLink>
        </div>
      </div>

      {/* QUICK SYSTEM STATUS & REFRESH */}
      <div className="sidebar-bottom">
        <div className="quick-telemetry-box">
          <div className="flex justify-between items-center text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              MegaDetector V6
            </span>
            <span className="text-white font-mono">MDV6-e</span>
          </div>
          <div className="text-[11px] text-slate-300">
            ResNet50 FAISS cosine index active
          </div>
        </div>

        <button
          className="nav-item justify-center text-xs font-semibold"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-amber-400' : ''} />
          <span>{isRefreshing ? 'Syncing...' : 'Sync Sensor Grid'}</span>
        </button>
      </div>
    </aside>
  );
}