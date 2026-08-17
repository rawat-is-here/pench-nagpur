import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  CircleMarker
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  HardDrive,
  Camera,
  AlertTriangle,
  Activity,
  ShieldAlert,
  Compass,
  MapPin,
  Layers,
  Download,
  RefreshCw,
  FolderOpen,
  Loader2,
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  UserCheck,
  UserPlus,
  X,
  Undo2,
  BarChart3,
  FileText,
  Radio,
  Sparkles,
  Info
} from 'lucide-react';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Camera Station Custom Pin Icon
let CameraIcon = L.divIcon({
  className: 'custom-camera-icon',
  html: '<div style="background:#2563eb; color:white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3); font-size:11px;">📷</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

export default function App() {
  const [territory, setTerritory] = useState(null);
  const [allTerritories, setAllTerritories] = useState([]);
  const [overlaps, setOverlaps] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    active_cameras: 142,
    identified_tigers: 0,
    storage_saved_mb: 0.0,
    quarantined_images: 0
  });
  const [tigers, setTigers] = useState([]);
  const [selectedTiger, setSelectedTiger] = useState("T-001");
  const [capturesList, setCapturesList] = useState([]);
  const [cameraStations, setCameraStations] = useState([]);
  
  // Layer toggles
  const [showCameraStations, setShowCameraStations] = useState(false);
  const [showMultiTerritories, setShowMultiTerritories] = useState(false);

  // Modals
  const [showTigersModal, setShowTigersModal] = useState(false);
  const [showSightingsModal, setShowSightingsModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Upload & Triage states
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [bulkDir, setBulkDir] = useState("data/raw");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Human-in-the-Loop Review states
  const [pendingReviews, setPendingReviews] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reassignTargetId, setReassignTargetId] = useState("");
  const [isResolvingReview, setIsResolvingReview] = useState(false);

  // Quarantine Bin states
  const [quarantinedList, setQuarantinedList] = useState([]);
  const [showQuarantineModal, setShowQuarantineModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const API_BASE = "http://127.0.0.1:8000";

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      const statsRes = await axios.get(`${API_BASE}/system_stats`);
      setStats(statsRes.data);

      const tigersRes = await axios.get(`${API_BASE}/tigers`);
      setTigers(tigersRes.data || []);
      if (tigersRes.data && tigersRes.data.length > 0 && !selectedTiger) {
        setSelectedTiger(tigersRes.data[0].id);
      }

      const alertsRes = await axios.get(`${API_BASE}/alerts`);
      if (alertsRes.data && alertsRes.data.length > 0) {
        setAlerts(alertsRes.data);
      } else {
        setAlerts([{
          id: Date.now(),
          severity: "NORMAL",
          alert_type: "SYSTEM · NETWORK",
          tiger_id: "",
          message: "TerraStripe Command Center online. AI Models active on GPU.",
          timestamp: new Date().toISOString(),
          evidence: {}
        }]);
      }

      const overlapRes = await axios.get(`${API_BASE}/territory_overlaps`);
      setOverlaps(overlapRes.data.overlaps || []);

      const reviewsRes = await axios.get(`${API_BASE}/pending_reviews`);
      setPendingReviews(reviewsRes.data || []);

      const capturesRes = await axios.get(`${API_BASE}/captures`);
      setCapturesList(capturesRes.data || []);

      const stationsRes = await axios.get(`${API_BASE}/camera_stations`);
      setCameraStations(stationsRes.data || []);

      const allTerrRes = await axios.get(`${API_BASE}/all_territories`);
      setAllTerritories(allTerrRes.data || []);

      showToast("Data synchronized with Pench Command Center");
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchTigerTerritory = async (tigerId) => {
    if (!tigerId) return;
    try {
      const terrRes = await axios.get(`${API_BASE}/territory/${tigerId}`);
      if (terrRes.data.status === "calculated") {
        setTerritory(terrRes.data);
      } else {
        setTerritory({
          tiger_id: tigerId,
          core_area_sqkm: 0,
          centroid: terrRes.data.centroid || null,
          polygon: []
        });
      }
    } catch (error) {
      console.error("Error fetching territory:", error);
    }
  };

  const fetchQuarantinedImages = async () => {
    try {
      const res = await axios.get(`${API_BASE}/quarantined_images`);
      setQuarantinedList(res.data || []);
    } catch (error) {
      console.error("Error fetching quarantined images:", error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (selectedTiger) {
      fetchTigerTerritory(selectedTiger);
    }
  }, [selectedTiger]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_BASE}/upload_camera_trap`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadStatus(response.data);
      fetchDashboardData();
      if (response.data.tiger_id) {
        setSelectedTiger(response.data.tiger_id);
      }
      showToast(`Processed: ${response.data.tiger_id || "Quarantined"}`);
    } catch (error) {
      console.error("Upload failed", error);
      setUploadStatus({ status: "error", message: "Failed to connect to backend API." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkTriage = async () => {
    if (!bulkDir) return;
    setIsBulkProcessing(true);
    setBulkResult(null);

    try {
      const response = await axios.post(`${API_BASE}/bulk_triage`, {
        directory_path: bulkDir
      });
      setBulkResult(response.data);
      fetchDashboardData();
      showToast(`Triage Complete: Quarantined ${response.data.frames_quarantined} blanks`);
    } catch (error) {
      console.error("Bulk triage failed", error);
      setBulkResult({ status: "error", message: "Bulk triage failed to complete." });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      await axios.post(`${API_BASE}/resolve_alert/${alertId}`);
      const alertsRes = await axios.get(`${API_BASE}/alerts`);
      setAlerts(alertsRes.data);
      const statsRes = await axios.get(`${API_BASE}/system_stats`);
      setStats(statsRes.data);
      showToast("Alert Acknowledged");
    } catch (error) {
      setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== alertId));
    }
  };

  const handleResolveReview = async (action, targetId = null) => {
    if (pendingReviews.length === 0) return;
    const currentReview = pendingReviews[reviewIdx];
    setIsResolvingReview(true);

    try {
      await axios.post(`${API_BASE}/resolve_review`, {
        capture_id: currentReview.id,
        action: action,
        target_tiger_id: targetId || reassignTargetId
      });

      await fetchDashboardData();
      showToast(`Review Resolved: ${action.toUpperCase()}`);
      
      if (reviewIdx >= pendingReviews.length - 1) {
        setReviewIdx(0);
        if (pendingReviews.length <= 1) {
          setShowReviewModal(false);
        }
      }
    } catch (error) {
      console.error("Failed to resolve review:", error);
    } finally {
      setIsResolvingReview(false);
    }
  };

  const handleRestoreQuarantine = async (filename) => {
    setIsRestoring(true);
    try {
      await axios.post(`${API_BASE}/restore_quarantine/${filename}`);
      await fetchQuarantinedImages();
      await fetchDashboardData();
      showToast(`Restored ${filename} to tracking dataset`);
    } catch (error) {
      console.error("Failed to restore quarantine frame:", error);
    } finally {
      setIsRestoring(false);
    }
  };

  const downloadGeoJSON = () => {
    if (!territory || !territory.polygon || territory.polygon.length === 0) {
      showToast("No polygon points available for this tiger");
      return;
    }
    
    const coords = territory.polygon.map(coord => [coord[1], coord[0]]);
    if (coords.length > 0) {
      coords.push(coords[0]);
    }
    
    const geojsonData = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            tiger_id: territory.tiger_id,
            area_sqkm: territory.core_area_sqkm,
            centroid: territory.centroid
          },
          geometry: {
            type: "Polygon",
            coordinates: [coords]
          }
        }
      ]
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojsonData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `terrastripe_${territory.tiger_id}_range.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast(`Downloaded GeoJSON for Tiger ${territory.tiger_id}`);
  };

  const downloadCSVLog = () => {
    if (capturesList.length === 0) {
      showToast("No capture logs to export");
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,ID,Tiger_ID,Station,Timestamp,Latitude,Longitude,Status,Confidence\n";
    capturesList.forEach(c => {
      csvContent += `${c.id},${c.tiger_id || "N/A"},${c.station},${c.timestamp},${c.latitude},${c.longitude},${c.status},${c.confidence}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `terrastripe_patrol_log_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("Downloaded Patrol CSV Log");
  };

  const criticalAlertCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const currentReviewItem = pendingReviews[reviewIdx];

  const territoryColors = ['#2f6b4f', '#2563eb', '#9333ea', '#d97706', '#dc2626'];

  return (
    <div className="app-shell">

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: '#163a2a',
          color: 'white',
          padding: '12px 20px',
          borderRadius: 10,
          boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
          fontSize: 14,
          fontWeight: 650,
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: '1px solid #2f6b4f'
        }}>
          <Sparkles size={16} style={{ color: '#e1a23b' }} /> {toastMessage}
        </div>
      )}

      {/* =====================================================
        SIDEBAR
        ===================================================== */}

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-mark">
            <ShieldAlert size={24} />
          </div>
          <div className="brand-title">
            TerraStripe
          </div>
          <div className="brand-subtitle">
            Conservation Intelligence
          </div>
        </div>

        {/* SECTION: OVERVIEW */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">
            Overview
          </div>

          <button 
            className="nav-item active"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              showToast("Viewing Overview Dashboard");
            }}
          >
            <Activity size={18} />
            <span className="nav-label">Dashboard</span>
          </button>

          <button 
            className="nav-item"
            onClick={() => {
              const el = document.getElementById('map-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
              showToast("Focused on Spatial Intelligence Map");
            }}
          >
            <Compass size={18} />
            <span className="nav-label">Live Map</span>
          </button>
        </div>

        {/* SECTION: MONITORING */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">
            Monitoring
          </div>

          {/* Tigers Button -> Opens Tiger Catalogue Modal */}
          <button 
            className="nav-item"
            onClick={() => setShowTigersModal(true)}
          >
            <Activity size={18} />
            <span className="nav-label">Tigers ({tigers.length})</span>
          </button>

          {/* Camera Traps Button -> Toggles Camera Station Pins on Map */}
          <button 
            className={`nav-item ${showCameraStations ? 'active' : ''}`}
            onClick={() => {
              setShowCameraStations(!showCameraStations);
              showToast(showCameraStations ? "Camera stations layer hidden" : "Camera stations layer visible (142 stations)");
            }}
          >
            <Camera size={18} />
            <span className="nav-label">Camera Traps {showCameraStations && "✓"}</span>
          </button>

          {/* Sightings Button -> Opens Sightings History Table Modal */}
          <button 
            className="nav-item"
            onClick={() => setShowSightingsModal(true)}
          >
            <MapPin size={18} />
            <span className="nav-label">Sightings Log</span>
          </button>

          {/* Territories Button -> Toggles Multi-Tiger Range Overlay on Map */}
          <button 
            className={`nav-item ${showMultiTerritories ? 'active' : ''}`}
            onClick={() => {
              setShowMultiTerritories(!showMultiTerritories);
              showToast(showMultiTerritories ? "Focused single territory" : "All tiger territories overlay active");
            }}
          >
            <Layers size={18} />
            <span className="nav-label">All Territories {showMultiTerritories && "✓"}</span>
          </button>
        </div>

        {/* SECTION: INTELLIGENCE */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">
            Intelligence
          </div>

          {/* Analytics Button -> Opens Performance & Triage Stats Modal */}
          <button 
            className="nav-item"
            onClick={() => setShowAnalyticsModal(true)}
          >
            <BarChart3 size={18} />
            <span className="nav-label">Analytics</span>
          </button>

          {/* Reports Button -> Opens Forest Dept Reports & Exports Modal */}
          <button 
            className="nav-item"
            onClick={() => setShowReportsModal(true)}
          >
            <Download size={18} />
            <span className="nav-label">Reports & GIS</span>
          </button>
        </div>

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={fetchDashboardData}>
            <RefreshCw size={18} />
            <span className="nav-label">System Refresh</span>
          </button>
        </div>

      </aside>

      {/* =====================================================
        MAIN AREA
        ===================================================== */}

      <div className="main-area">

        {/* TOP BAR */}
        <header className="topbar">
          <div className="topbar-left">
            <div>
              <div className="topbar-title">
                Pench Tiger Reserve
              </div>
              <div className="topbar-location">
                <MapPin size={14} />
                Madhya Pradesh · India
              </div>
            </div>
          </div>

          <div className="topbar-actions">
            {/* Human in the loop review button */}
            {pendingReviews.length > 0 && (
              <button 
                onClick={() => { setShowReviewModal(true); setReviewIdx(0); }}
                className="system-status"
                style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fde68a', cursor: 'pointer' }}
              >
                <Eye size={15} style={{ marginRight: 6 }} />
                Review Queue ({pendingReviews.length})
              </button>
            )}

            {/* Quarantine bin button */}
            <button 
              onClick={() => { fetchQuarantinedImages(); setShowQuarantineModal(true); }}
              className="system-status"
              style={{ cursor: 'pointer', background: '#f0f4f8', color: '#334155', borderColor: '#cbd5e1' }}
            >
              <HardDrive size={15} style={{ marginRight: 6 }} />
              Quarantine ({stats.quarantined_images})
            </button>

            <div className="system-status">
              <span className="status-dot"></span>
              Monitoring Online
            </div>

            <button
              className="icon-button"
              onClick={fetchDashboardData}
              title="Refresh system data"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="page-content">

          {/* PAGE HEADING */}
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">
                Forest Monitoring Network
              </div>
              <h1 className="page-title">
                Tiger Intelligence <span style={{ color: '#d9531e' }}>Dashboard</span>
              </h1>
              <p className="page-description">
                Monitor individual tiger movements, territories, and automated camera-trap triage across Pench.
              </p>
            </div>
          </div>

          {/* =================================================
            KPI CARDS
            ================================================= */}
          <section className="stats-grid">

            {/* ACTIVE CAMERAS */}
            <div className="stat-card" onClick={() => setShowCameraStations(!showCameraStations)} style={{ cursor: 'pointer' }}>
              <div className="stat-top">
                <div className="stat-label">
                  Active Cameras
                </div>
                <div className="stat-icon">
                  <Camera size={20} />
                </div>
              </div>
              <div>
                <div className="stat-value">
                  {stats.active_cameras}
                </div>
                <div className="stat-meta">
                  <strong>Live</strong> monitoring stations (Click to plot)
                </div>
              </div>
            </div>

            {/* TIGERS */}
            <div className="stat-card" onClick={() => setShowTigersModal(true)} style={{ cursor: 'pointer' }}>
              <div className="stat-top">
                <div className="stat-label">
                  Identified Tigers
                </div>
                <div className="stat-icon">
                  <Activity size={20} />
                </div>
              </div>
              <div>
                <div className="stat-value">
                  {stats.identified_tigers}
                </div>
                <div className="stat-meta">
                  Individuals in catalogue (Click to view)
                </div>
              </div>
            </div>

            {/* STORAGE */}
            <div className="stat-card" onClick={() => setShowAnalyticsModal(true)} style={{ cursor: 'pointer' }}>
              <div className="stat-top">
                <div className="stat-label">
                  Storage Saved
                </div>
                <div className="stat-icon">
                  <HardDrive size={20} />
                </div>
              </div>
              <div>
                <div className="stat-value">
                  {stats.storage_saved_mb}
                </div>
                <div className="stat-meta">
                  MB optimized by AI triage
                </div>
              </div>
            </div>

            {/* ALERTS */}
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-label">
                  Critical Alerts
                </div>
                <div
                  className="stat-icon"
                  style={
                    criticalAlertCount > 0
                      ? {
                        background: "#fae9e8",
                        color: "#c94a45"
                      }
                      : {}
                  }
                >
                  <AlertTriangle size={20} />
                </div>
              </div>
              <div>
                <div
                  className="stat-value"
                  style={
                    criticalAlertCount > 0
                      ? { color: "#c94a45" }
                      : {}
                  }
                >
                  {criticalAlertCount}
                </div>
                <div className="stat-meta">
                  {criticalAlertCount > 0
                    ? "Requires attention"
                    : "All systems nominal"}
                </div>
              </div>
            </div>

          </section>

          {/* =================================================
            MAIN DASHBOARD
            ================================================= */}
          <section className="dashboard-grid">

            {/* LEFT COLUMN */}
            <div className="left-stack">

              {/* MAP PANEL */}
              <div id="map-section" className="panel map-panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <Compass size={19} />
                    Spatial Intelligence & Home Ranges (MCP)
                  </div>

                  {/* Tiger Selector Dropdown */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <select 
                      value={selectedTiger}
                      onChange={(e) => setSelectedTiger(e.target.value)}
                      className="select-control"
                    >
                      {tigers.map((t) => (
                        <option key={t.id} value={t.id}>
                          Tiger {t.id} - Pench Reserve
                        </option>
                      ))}
                      {tigers.length === 0 && (
                        <option value="T-001">Tiger T-001 - Pench Reserve</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* MAP */}
                <div className="map-container">
                  <MapContainer
                    center={[21.655, 79.215]}
                    zoom={12}
                    style={{
                      height: "100%",
                      width: "100%"
                    }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

                    {/* Pench Core Forest Zone */}
                    <Polygon 
                      positions={[[21.71, 79.19], [21.71, 79.29], [21.61, 79.29], [21.61, 79.19]]} 
                      pathOptions={{ color: '#2f6b4f', fillColor: '#2f6b4f', fillOpacity: 0.12, weight: 2 }}
                    >
                      <Popup>
                        <strong>Pench Core Forest Zone</strong><br/>
                        Strict wildlife protection core zone.
                      </Popup>
                    </Polygon>

                    {/* Pench Buffer Zone */}
                    <Polygon 
                      positions={[[21.75, 79.15], [21.75, 79.35], [21.55, 79.35], [21.55, 79.15]]} 
                      pathOptions={{ color: '#c98222', fillColor: '#c98222', fillOpacity: 0.05, weight: 1.5, dashArray: '5, 5' }}
                    >
                      <Popup>
                        <strong>Pench Buffer Zone</strong><br/>
                        Co-existence forest area bordering human settlements.
                      </Popup>
                    </Polygon>

                    {/* Multi-Territories Overlay (When toggled) */}
                    {showMultiTerritories && allTerritories.map((tItem, idx) => (
                      tItem.polygon && tItem.polygon.length > 0 && (
                        <Polygon 
                          key={`all-terr-${idx}`}
                          positions={tItem.polygon}
                          pathOptions={{
                            color: territoryColors[idx % territoryColors.length],
                            fillColor: territoryColors[idx % territoryColors.length],
                            fillOpacity: 0.22,
                            weight: 2.5
                          }}
                        >
                          <Popup>
                            <strong>Tiger {tItem.tiger_id} Range</strong><br/>
                            Core Area: {tItem.core_area_sqkm} sq km
                          </Popup>
                        </Polygon>
                      )
                    ))}

                    {/* Focused Home Range MCP Polygon */}
                    {!showMultiTerritories && territory && territory.polygon && territory.polygon.length > 0 && (
                      <Polygon 
                        positions={territory.polygon} 
                        pathOptions={{ color: '#3f8060', fillColor: '#3f8060', fillOpacity: 0.25, weight: 3 }} 
                      >
                        <Popup>
                          <strong>Tiger {territory.tiger_id} Home Range</strong><br/>
                          Estimated Area: {territory.core_area_sqkm} sq km
                        </Popup>
                      </Polygon>
                    )}

                    {/* Territory Centroid Marker */}
                    {territory && territory.centroid && (
                      <Marker
                        position={[
                          territory.centroid.lat,
                          territory.centroid.lon
                        ]}
                      >
                        <Popup>
                          <strong>Tiger {territory.tiger_id} Centroid</strong>
                          <br />
                          Territory Area: {territory.core_area_sqkm} sq km
                        </Popup>
                      </Marker>
                    )}

                    {/* Camera Stations Layer (When toggled) */}
                    {showCameraStations && cameraStations.map((st, idx) => (
                      <Marker 
                        key={`cam-station-${idx}`}
                        position={[st.lat, st.lon]}
                        icon={CameraIcon}
                      >
                        <Popup>
                          <strong>Camera Station: {st.id}</strong><br/>
                          Zone: {st.zone}<br/>
                          Status: <span style={{ color: '#2f6b4f', fontWeight: 'bold' }}>{st.status.toUpperCase()}</span><br/>
                          Battery Level: {st.battery}
                        </Popup>
                      </Marker>
                    ))}

                    {/* Territory Overlaps */}
                    {overlaps.map((ov, idx) => (
                      <Polygon 
                        key={`overlap-${idx}`}
                        positions={ov.polygon}
                        pathOptions={{ color: '#c94a45', fillColor: '#c94a45', fillOpacity: 0.3, weight: 2, dashArray: '4, 4' }}
                      >
                        <Popup>
                          <strong style={{ color: '#c94a45' }}>⚠️ Territory Overlap Zone</strong><br/>
                          Tigers: {ov.tiger_1} & {ov.tiger_2}<br/>
                          Overlap Area: {ov.overlap_area_sqkm} sq km
                        </Popup>
                      </Polygon>
                    ))}

                  </MapContainer>
                </div>

                {/* MAP FOOTER */}
                <div className="map-footer">
                  {territory ? (
                    <div className="map-metrics">
                      <div>
                        <span className="map-metric-label">
                          Territory Area
                        </span>
                        <span className="map-metric-value">
                          {territory.core_area_sqkm > 0 ? `${territory.core_area_sqkm} sq km` : "Insufficient points"}
                        </span>
                      </div>

                      <div>
                        <span className="map-metric-label">
                          Focused Tiger
                        </span>
                        <span className="map-metric-value">
                          {territory.tiger_id || selectedTiger}
                        </span>
                      </div>

                      <div>
                        <span className="map-metric-label">
                          Status
                        </span>
                        <span className="map-metric-value" style={{ color: '#2f6b4f' }}>
                          Territory calculated
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="panel-subtitle">
                      Waiting for territory data...
                    </span>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      onClick={() => setShowMultiTerritories(!showMultiTerritories)}
                      className="acknowledge-button"
                      style={{ padding: '8px 14px', fontSize: '13px' }}
                    >
                      <Layers size={14} /> {showMultiTerritories ? "Focus Single" : "Overlay All"}
                    </button>

                    {territory && territory.polygon && territory.polygon.length > 0 && (
                      <button 
                        onClick={downloadGeoJSON}
                        className="acknowledge-button"
                        style={{ padding: '8px 14px', fontSize: '13px', color: '#2f6b4f', borderColor: '#cfe3d3' }}
                      >
                        <Download size={14} /> Export GeoJSON
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* AI OPERATIONS PANEL */}
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <Layers size={19} />
                    Camera Trap Intelligence Pipeline
                  </div>
                  <span className="panel-subtitle">
                    MegaDetector v6 (Triage) + Fine-tuned ResNet-50 (Stripe Matching)
                  </span>
                </div>

                <div className="operations-grid">

                  {/* SINGLE IMAGE */}
                  <div className="operation-card">
                    <div className="operation-icon">
                      <Camera size={20} />
                    </div>

                    <h3 className="operation-title">
                      Analyze Camera Capture
                    </h3>

                    <p className="operation-description">
                      Upload a camera-trap image to execute MegaDetector triage and fine-tuned ResNet-50 stripe matching on GPU.
                    </p>

                    <label
                      className="primary-button"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer"
                      }}
                    >
                      {isUploading ? (
                        <>
                          <Loader2
                            size={16}
                            className="animate-spin"
                            style={{ marginRight: 8 }}
                          />
                          Processing image on GPU...
                        </>
                      ) : (
                        "Upload Camera Image"
                      )}

                      <input
                        type="file"
                        className="hidden"
                        style={{ display: "none" }}
                        onChange={handleFileUpload}
                        accept="image/*"
                        disabled={isUploading}
                      />
                    </label>

                    {uploadStatus && (
                      <div
                        className={`result-box ${uploadStatus.status === "success"
                          ? "result-success"
                          : uploadStatus.status === "quarantined"
                            ? "result-warning"
                            : "result-error"
                          }`}
                      >
                        {uploadStatus.status === "success" ? (
                          <>
                            <strong>🐯 Tiger Match Detected</strong><br />
                            Individual: {uploadStatus.tiger_id}<br />
                            Match Status: {uploadStatus.match_status.toUpperCase()}<br />
                            Distance Score: {uploadStatus.distance_score}<br />
                            Station: {uploadStatus.station}
                          </>
                        ) : uploadStatus.status === "quarantined" ? (
                          <>
                            <strong>🛡️ Triage: Image Quarantined (Blank)</strong><br />
                            {uploadStatus.message}
                          </>
                        ) : (
                          <>
                            <strong>❌ Processing Error</strong><br />
                            {uploadStatus.message}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* BULK TRIAGE */}
                  <div className="operation-card">
                    <div className="operation-icon">
                      <FolderOpen size={20} />
                    </div>

                    <h3 className="operation-title">
                      Directory Bulk Ingestion (Pillar i)
                    </h3>

                    <p className="operation-description">
                      Ingest folders of raw camera trap data. Safely stage-deletes blank frames into quarantine.
                    </p>

                    <div style={{ marginBottom: 12 }}>
                      <label className="field-label">Working Directory</label>
                      <input 
                        type="text" 
                        value={bulkDir} 
                        onChange={(e) => setBulkDir(e.target.value)}
                        className="text-input" 
                      />
                    </div>

                    <button
                      onClick={handleBulkTriage}
                      disabled={isBulkProcessing}
                      className="secondary-button"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {isBulkProcessing ? (
                        <>
                          <Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }} />
                          Triaging Folder on GPU...
                        </>
                      ) : (
                        "Process Folder Triage"
                      )}
                    </button>

                    {bulkResult && (
                      <div className={`result-box ${bulkResult.status === 'success' ? 'result-success' : 'result-error'}`}>
                        {bulkResult.status === 'success' ? (
                          <>
                            <strong>📂 Triage Report Complete</strong><br/>
                            Ingested: {bulkResult.total_frames_ingested} frames<br/>
                            Quarantined: {bulkResult.frames_quarantined} blanks<br/>
                            Space Saved: {bulkResult.space_saved_mb} MB<br/>
                            Manual Time Saved: {bulkResult.manual_time_saved_seconds}s
                          </>
                        ) : (
                          <>
                            <strong>❌ Triage Error</strong><br/>
                            {bulkResult.message}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: INTELLIGENCE FEED */}
            <aside className="panel intelligence-panel">
              <div className="panel-header">
                <div className="panel-title">
                  <AlertCircle size={19} />
                  Intelligence Feed & Alerts
                </div>
                <span className="panel-subtitle">
                  {alerts.length} active
                </span>
              </div>

              <div className="intelligence-body">
                {alerts.map((alert) => {
                  const severity =
                    alert.severity === "CRITICAL"
                      ? "critical"
                      : alert.severity === "WARNING"
                        ? "warning"
                        : "normal";

                  return (
                    <div
                      key={alert.id}
                      className={`alert-card ${severity}`}
                    >
                      <div className="alert-header">
                        <span className={`alert-badge ${severity}`}>
                          {alert.severity}
                        </span>
                        <span className="alert-time">
                          {new Date(
                            alert.timestamp
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </div>

                      <h4 className="alert-title">
                        {alert.alert_type}
                        {alert.tiger_id && ` · ${alert.tiger_id}`}
                      </h4>

                      <p className="alert-message">
                        {alert.message}
                      </p>

                      {alert.evidence &&
                        Object.keys(alert.evidence).length > 0 && (
                          <div className="alert-evidence">
                            {alert.evidence.distance_km && (
                              <div>
                                Distance: {alert.evidence.distance_km.toFixed(2)} km
                              </div>
                            )}
                            {alert.evidence.station && (
                              <div>
                                Station: {alert.evidence.station}
                              </div>
                            )}
                          </div>
                        )}

                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="acknowledge-button"
                      >
                        <Check size={14} />
                        Acknowledge
                      </button>
                    </div>
                  );
                })}

                {alerts.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <CheckCircle2 size={26} />
                    </div>
                    <div className="empty-state-title">
                      All systems nominal
                    </div>
                    <div className="empty-state-text">
                      No active deviations or boundary alerts detected across Pench Tiger Reserve.
                    </div>
                  </div>
                )}
              </div>
            </aside>

          </section>

        </main>
      </div>

      {/* ========================================================================= */}
      {/* 1. TIGERS CATALOGUE DOSSIER MODAL                                         */}
      {/* ========================================================================= */}
      {showTigersModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">
                <Activity size={20} style={{ color: '#2f6b4f' }} />
                <span>Identified Tiger Individuals Catalogue ({tigers.length})</span>
              </div>
              <button onClick={() => setShowTigersModal(false)} className="icon-button" style={{ width: 34, height: 34 }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '13.5px', color: '#68756d', marginBottom: 16 }}>
                Enrolled individuals registered in the FAISS stripe metric learning database with verified sightings and territory calculations.
              </p>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tiger ID</th>
                    <th>Name / Tag</th>
                    <th>Sightings</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tigers.map((t) => {
                    const sCount = capturesList.filter(c => c.tiger_id === t.id).length;
                    return (
                      <tr key={t.id}>
                        <td><strong>{t.id}</strong></td>
                        <td>{t.name || "Resident Tiger"}</td>
                        <td>{sCount} sightings</td>
                        <td>
                          <span className="alert-badge normal">Enrolled</span>
                        </td>
                        <td>
                          <button 
                            onClick={() => {
                              setSelectedTiger(t.id);
                              setShowTigersModal(false);
                              const el = document.getElementById('map-section');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                              showToast(`Focused map on ${t.id}`);
                            }}
                            className="acknowledge-button"
                            style={{ margin: 0, color: '#2f6b4f', borderColor: '#cfe3d3' }}
                          >
                            <Compass size={13} /> View Range
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {tigers.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: 20, color: '#8b968f' }}>
                        No tigers currently registered. Upload images to auto-enroll!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <span style={{ fontSize: '12px', color: '#8b968f' }}>Auto-enrolled via ResNet-50 stripe metric learning</span>
              <button onClick={() => setShowTigersModal(false)} className="secondary-button" style={{ width: 'auto', padding: '8px 16px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SIGHTINGS LOG MODAL                                                    */}
      {/* ========================================================================= */}
      {showSightingsModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">
                <MapPin size={20} style={{ color: '#2f6b4f' }} />
                <span>Recent Camera Trap Sightings Log ({capturesList.length})</span>
              </div>
              <button onClick={() => setShowSightingsModal(false)} className="icon-button" style={{ width: 34, height: 34 }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tiger ID</th>
                    <th>Station</th>
                    <th>Coordinates</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {capturesList.slice(0, 15).map((c) => (
                    <tr key={c.id}>
                      <td>#{c.id}</td>
                      <td><strong>{c.tiger_id || "Quarantined"}</strong></td>
                      <td>{c.station}</td>
                      <td>{c.latitude?.toFixed(4)}, {c.longitude?.toFixed(4)}</td>
                      <td>{new Date(c.timestamp).toLocaleString()}</td>
                      <td>
                        <span className={`alert-badge ${c.status === 'processed' ? 'normal' : c.status === 'pending_review' ? 'warning' : 'critical'}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {capturesList.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: 20, color: '#8b968f' }}>
                        No sightings recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <button onClick={downloadCSVLog} className="acknowledge-button" style={{ color: '#2f6b4f', borderColor: '#cfe3d3' }}>
                <Download size={14} /> Export Sighting CSV Log
              </button>
              <button onClick={() => setShowSightingsModal(false)} className="secondary-button" style={{ width: 'auto', padding: '8px 16px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CONSERVATION ANALYTICS MODAL                                           */}
      {/* ========================================================================= */}
      {showAnalyticsModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">
                <BarChart3 size={20} style={{ color: '#2f6b4f' }} />
                <span>AI Triage & Metric Learning Benchmark Analytics</span>
              </div>
              <button onClick={() => setShowAnalyticsModal(false)} className="icon-button" style={{ width: 34, height: 34 }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="stats-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-label">Model Accuracy (Rank-1)</div>
                  <div className="stat-value" style={{ color: '#2f6b4f' }}>90.14%</div>
                  <div className="stat-meta">Fine-tuned ResNet-50 on GPU</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Rank-5 Accuracy</div>
                  <div className="stat-value" style={{ color: '#2f6b4f' }}>98.57%</div>
                  <div className="stat-meta">Top-5 candidate match rate</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Storage Optimization</div>
                  <div className="stat-value">{stats.storage_saved_mb} MB</div>
                  <div className="stat-meta">{stats.quarantined_images} blanks removed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Inference Latency</div>
                  <div className="stat-value" style={{ color: '#c98222' }}>18ms</div>
                  <div className="stat-meta">Sub-second dual-model speed</div>
                </div>
              </div>

              <div className="compare-box">
                <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 750 }}>Efficiency Breakthrough:</h4>
                <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#68756d', margin: 0 }}>
                  By combining <strong>MegaDetector v6</strong> for rapid blank frame quarantine with our custom <strong>fine-tuned ResNet-50 stripe metric learning model</strong> (trained on ATRW without biological horizontal flip corruption), the system cuts manual biologist triage time by <strong>over 75%</strong> while preserving complete audit reversibility.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <span style={{ fontSize: '12px', color: '#8b968f' }}>Benchmarked on NVIDIA GeForce RTX 4060 GPU</span>
              <button onClick={() => setShowAnalyticsModal(false)} className="secondary-button" style={{ width: 'auto', padding: '8px 16px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. REPORTS & EXPORTS MODAL                                                */}
      {/* ========================================================================= */}
      {showReportsModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">
                <Download size={20} style={{ color: '#2f6b4f' }} />
                <span>Forest Department Patrol & Intelligence Reports</span>
              </div>
              <button onClick={() => setShowReportsModal(false)} className="icon-button" style={{ width: 34, height: 34 }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="compare-box">
                  <FileText size={24} style={{ color: '#2f6b4f', marginBottom: 8 }} />
                  <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 750 }}>GIS GeoJSON Territory Layer</h4>
                  <p style={{ fontSize: '12.5px', color: '#68756d', marginBottom: 14 }}>
                    Export calculated MCP home range polygons for GIS mapping software (QGIS / ArcGIS).
                  </p>
                  <button onClick={downloadGeoJSON} className="primary-button">
                    Download Tiger GeoJSON
                  </button>
                </div>

                <div className="compare-box">
                  <MapPin size={24} style={{ color: '#2563eb', marginBottom: 8 }} />
                  <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 750 }}>Patrol Sighting CSV Log</h4>
                  <p style={{ fontSize: '12.5px', color: '#68756d', marginBottom: 14 }}>
                    Export full chronological telemetry log of all camera trap captures and GPS stations.
                  </p>
                  <button onClick={downloadCSVLog} className="secondary-button">
                    Download CSV Sighting Log
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <span style={{ fontSize: '12px', color: '#8b968f' }}>Compliant with National Tiger Conservation Authority (NTCA) guidelines</span>
              <button onClick={() => setShowReportsModal(false)} className="secondary-button" style={{ width: 'auto', padding: '8px 16px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. HUMAN-IN-THE-LOOP (HITL) REVIEW MODAL                                  */}
      {/* ========================================================================= */}
      {showReviewModal && currentReviewItem && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">
                <Eye className="text-amber-500" size={22} />
                <span>Human-in-the-Loop Stripe Verification</span>
                <span className="alert-badge warning" style={{ marginLeft: 10 }}>
                  Review {reviewIdx + 1} of {pendingReviews.length}
                </span>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="icon-button" style={{ width: 34, height: 34 }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="compare-grid">
                {/* Left Pane */}
                <div className="compare-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="field-label" style={{ color: '#c98222', margin: 0 }}>Unresolved Sighting</span>
                    <span style={{ fontSize: '12px', color: '#8b968f' }}>Capture #{currentReviewItem.id}</span>
                  </div>

                  <div className="compare-img-wrap">
                    <img 
                      src={`${API_BASE}${currentReviewItem.flank_url || currentReviewItem.raw_url}`} 
                      alt="Candidate Flank" 
                      style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                      onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=500&q=80"; }}
                    />
                  </div>

                  <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#17231c' }}>
                    <div><strong>Predicted Individual:</strong> {currentReviewItem.candidate_tiger_id || "Unmatched"}</div>
                    <div><strong>Distance Score:</strong> <span style={{ color: '#c98222', fontWeight: 'bold' }}>{currentReviewItem.distance_score}</span> (Uncertainty Margin)</div>
                    <div><strong>Station:</strong> {currentReviewItem.station}</div>
                    <div><strong>Timestamp:</strong> {new Date(currentReviewItem.timestamp).toLocaleString()}</div>
                  </div>
                </div>

                {/* Right Pane */}
                <div className="compare-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="field-label" style={{ color: '#2f6b4f', margin: 0 }}>Catalogue Reference ({currentReviewItem.candidate_tiger_id})</span>
                    <span style={{ fontSize: '12px', color: '#8b968f' }}>Baseline Stripe Archive</span>
                  </div>

                  <div className="compare-img-wrap">
                    <img 
                      src={`${API_BASE}/data/raw/t1_historical_0.jpg`} 
                      alt="Catalogue Reference" 
                      style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                      onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1549480017-d76466a4b7e8?w=500&q=80"; }}
                    />
                  </div>

                  <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#17231c' }}>
                    <div><strong>Known Territory:</strong> Pench Core Central</div>
                    <div><strong>Catalogue Status:</strong> Enrolled Resident</div>
                    <div><strong>Stripe Topology:</strong> Compare vertical dorso-lateral bifurcations</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select 
                  value={reassignTargetId}
                  onChange={(e) => setReassignTargetId(e.target.value)}
                  className="select-control"
                  style={{ minWidth: 150 }}
                >
                  <option value="">Reassign to...</option>
                  {tigers.map((t) => (
                    <option key={t.id} value={t.id}>{t.id} ({t.name || "Unnamed"})</option>
                  ))}
                </select>
                
                {reassignTargetId && (
                  <button 
                    onClick={() => handleResolveReview("reassign", reassignTargetId)}
                    disabled={isResolvingReview}
                    className="acknowledge-button"
                    style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}
                  >
                    <UserCheck size={14} /> Assign {reassignTargetId}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button 
                  onClick={() => handleResolveReview("reject")}
                  disabled={isResolvingReview}
                  className="secondary-button"
                  style={{ width: 'auto', padding: '10px 16px' }}
                >
                  Reject Frame
                </button>

                <button 
                  onClick={() => handleResolveReview("new_tiger")}
                  disabled={isResolvingReview}
                  className="secondary-button"
                  style={{ width: 'auto', padding: '10px 16px', background: '#f5f3ff', color: '#6d28d9', borderColor: '#ddd6fe' }}
                >
                  <UserPlus size={14} style={{ marginRight: 6 }} /> Enroll New Tiger
                </button>

                <button 
                  onClick={() => handleResolveReview("confirm")}
                  disabled={isResolvingReview}
                  className="primary-button"
                  style={{ width: 'auto', padding: '10px 22px' }}
                >
                  {isResolvingReview ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} style={{ marginRight: 6 }} />}
                  Confirm Match ({currentReviewItem.candidate_tiger_id})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SAFE QUARANTINE BIN MODAL (Pillar i)                                   */}
      {/* ========================================================================= */}
      {showQuarantineModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">
                <HardDrive size={20} style={{ color: '#2f6b4f' }} />
                <span>Quarantined Blank Frames Inspector (Safe Staging)</span>
                <span className="alert-badge normal" style={{ marginLeft: 10 }}>
                  {quarantinedList.length} staged frames
                </span>
              </div>
              <button onClick={() => setShowQuarantineModal(false)} className="icon-button" style={{ width: 34, height: 34 }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#68756d', marginBottom: 16 }}>
                Images automatically classified as blank by MegaDetector. Review before permanent purge, or one-click restore false-negatives into the tiger tracking dataset.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {quarantinedList.map((item, idx) => (
                  <div key={idx} className="compare-box">
                    <div className="compare-img-wrap" style={{ marginTop: 0 }}>
                      <img 
                        src={`${API_BASE}${item.image_url}`} 
                        alt={item.filename}
                        style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                        onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=500&q=80"; }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#8b968f', marginBottom: 10 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{item.filename}</span>
                      <span>{item.size_kb} KB</span>
                    </div>
                    <button 
                      onClick={() => handleRestoreQuarantine(item.filename)}
                      disabled={isRestoring}
                      className="acknowledge-button"
                      style={{ width: '100%', justifyContent: 'center', color: '#2f6b4f', borderColor: '#cfe3d3' }}
                    >
                      <Undo2 size={13} /> Restore & Re-evaluate
                    </button>
                  </div>
                ))}

                {quarantinedList.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', padding: '40px 0', textAlign: 'center', color: '#8b968f', fontSize: '14px' }}>
                    No images currently in quarantine stage.
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <span style={{ fontSize: '12px', color: '#8b968f' }}>Safe stage-delete ensures zero data loss</span>
              <button onClick={() => setShowQuarantineModal(false)} className="secondary-button" style={{ width: 'auto', padding: '8px 16px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}