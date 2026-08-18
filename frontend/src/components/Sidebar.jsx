import React from 'react';
import { NavLink, Link } from 'react-router-dom';
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
      <Link to="/" className="brand block hover:opacity-80 transition-opacity cursor-pointer" style={{ textDecoration: 'none' }}>
        <div className="flex items-center gap-3">
          <div className="brand-mark">
            <img src="/favicon.svg" alt="TerraStripe Logo" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <div className="brand-title">TERRASTRIPE</div>
          </div>
        </div>
      </Link>

      {/* NAVIGATION SECTIONS */}
      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="sidebar-section-title">Operations Core</div>
          <NavLink to="/dashboard" className={getNavClass}>
            <LayoutDashboard size={16} />
            <span>Alert Mapping</span>
          </NavLink>
          <NavLink to="/live-map" className={getNavClass}>
            <Compass size={16} />
            <span>Territory Map</span>
          </NavLink>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Fauna Intelligence</div>
          <NavLink to="/tigers" className={getNavClass}>
            <Eye size={16} />
            <span>Profile and Archives</span>
          </NavLink>
          <NavLink to="/territories" className={getNavClass}>
            <Layers size={16} />
            <span>Area and Coverage</span>
          </NavLink>

        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Optical Grid & Triage</div>

          <NavLink to="/add-dataset" className={getNavClass}>
            <FolderSync size={16} />
            <span>Import data and Cam Health</span>
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
            <span>PDF and Reports</span>
          </NavLink>
        </div>
      </div>

      {/* QUICK SYSTEM STATUS & REFRESH */}
      <div className="sidebar-bottom">


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