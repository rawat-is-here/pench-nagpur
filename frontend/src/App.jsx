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
  CheckCircle2
} from 'lucide-react';

import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function App() {
  const [territory, setTerritory] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    active_cameras: 142,
    identified_tigers: 0,
    storage_saved_mb: 0.0,
    quarantined_images: 0
  });
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [tigers, setTigers] = useState([]);
  const [selectedTiger, setSelectedTiger] = useState("T-001");
  const [overlaps, setOverlaps] = useState([]);
  const API_BASE = "http://127.0.0.1:8000";

  // Fetch initial dynamic data on load
  const fetchDashboardData = async () => {
    try {
      const statsRes = await axios.get(`${API_BASE}/system_stats`);
      setStats(statsRes.data);

      const tigersRes = await axios.get(`${API_BASE}/tigers`);
      setTigers(tigersRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchTerritoryData = async (tigerId) => {
    if (!tigerId) return;
    try {
      const terrRes = await axios.get(`${API_BASE}/territory/${tigerId}`);
      if (terrRes.data.status === "calculated") {
        setTerritory(terrRes.data);
      } else {
        setTerritory(null);
      }

      const overlapsRes = await axios.get(`${API_BASE}/territory_overlaps`);
      setOverlaps(overlapsRes.data.overlaps || []);
    } catch (error) {
      console.error("Error fetching territory details:", error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Start with a clean, dynamic system alert
    setAlerts([{
      id: Date.now(),
      severity: "NORMAL",
      alert_type: "SYSTEM",
      tiger_id: "NETWORK",
      message: "Command Center online. AI Models loaded into memory.",
      timestamp: new Date().toISOString(),
      evidence: {}
    }]);
  }, []);

  useEffect(() => {
    if (selectedTiger) {
      fetchTerritoryData(selectedTiger);
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

      // --- DYNAMIC ALERTS GENERATION ---
      const newTime = new Date().toLocaleTimeString();
      let newAlert = null;

      if (response.data.status === 'success') {
        newAlert = {
          id: Date.now(),
          type: "NORMAL",
          msg: `📸 Match: ${response.data.tiger_id} identified (Score: ${response.data.distance_score}). ${response.data.message}`,
          time: newTime
        };
      } else if (response.data.status === 'quarantined') {
        newAlert = {
          id: Date.now(),
          type: "SYSTEM",
          msg: `🛡️ Triage Active: Blank image quarantined. Saved storage.`,
          time: newTime
        };
      }

      // Add the new alert to the top of the feed
      if (newAlert) {
        setAlerts(prevAlerts => [newAlert, ...prevAlerts]);
      }

      // Refresh the KPI numbers to reflect the new upload
      fetchDashboardData();

    } catch (error) {
      console.error("Upload failed", error);
      setUploadStatus({ status: "error", message: "Failed to connect to the backend API." });
    } finally {
      setIsUploading(false);
    }
  };

  // Calculate active alerts (just counting how many 'CRITICAL' alerts exist in the dynamic feed)
  const criticalAlertCount = alerts.filter(a => a.type === 'CRITICAL').length;
  const handleResolveAlert = (alertId) => {
  setAlerts(prevAlerts =>
    prevAlerts.filter(alert => alert.id !== alertId)
  );
};

  return (
    <div className="app-shell">

      {/* =====================================================
        SIDEBAR
        ===================================================== */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-mark">
            <ShieldAlert size={22} />
          </div>

          <div className="brand-title">
            TigerWatch
          </div>

          <div className="brand-subtitle">
            Conservation Intelligence
          </div>

        </div>

        <div className="sidebar-section">

          <div className="sidebar-section-title">
            Overview
          </div>

          <button className="nav-item active">
            <Activity size={16} />
            <span className="nav-label">Dashboard</span>
          </button>

          <button className="nav-item">
            <Compass size={16} />
            <span className="nav-label">Live Map</span>
          </button>

        </div>

        <div className="sidebar-section">

          <div className="sidebar-section-title">
            Monitoring
          </div>

          <button className="nav-item">
            <Activity size={16} />
            <span className="nav-label">Tigers</span>
          </button>

          <button className="nav-item">
            <Camera size={16} />
            <span className="nav-label">Camera Traps</span>
          </button>

          <button className="nav-item">
            <MapPin size={16} />
            <span className="nav-label">Sightings</span>
          </button>

          <button className="nav-item">
            <Layers size={16} />
            <span className="nav-label">Territories</span>
          </button>

        </div>

        <div className="sidebar-section">

          <div className="sidebar-section-title">
            Intelligence
          </div>

          <button className="nav-item">
            <Activity size={16} />
            <span className="nav-label">Analytics</span>
          </button>

          <button className="nav-item">
            <Download size={16} />
            <span className="nav-label">Reports</span>
          </button>

        </div>

        <div className="sidebar-bottom">

          <button className="nav-item">
            <RefreshCw size={16} />
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
                <MapPin size={12} />
                Madhya Pradesh · India
              </div>
            </div>

          </div>


          <div className="topbar-actions">

            <div className="system-status">
              <span className="status-dot"></span>
              Monitoring Online
            </div>

            <button
              className="icon-button"
              onClick={fetchDashboardData}
              title="Refresh system data"
            >
              <RefreshCw size={16} />
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
                Tiger Intelligence Dashboard
              </h1>

              <p className="page-description">
                Monitor tiger activity, territories and camera-trap intelligence across Pench.
              </p>

            </div>

          </div>


          {/* =================================================
            KPI CARDS
            ================================================= */}

          <section className="stats-grid">

            {/* ACTIVE CAMERAS */}

            <div className="stat-card">

              <div className="stat-top">

                <div className="stat-label">
                  Active Cameras
                </div>

                <div className="stat-icon">
                  <Camera size={17} />
                </div>

              </div>

              <div>

                <div className="stat-value">
                  {stats.active_cameras}
                </div>

                <div className="stat-meta">
                  <strong>Live</strong> monitoring stations
                </div>

              </div>

            </div>


            {/* TIGERS */}

            <div className="stat-card">

              <div className="stat-top">

                <div className="stat-label">
                  Identified Tigers
                </div>

                <div className="stat-icon">
                  <Activity size={17} />
                </div>

              </div>

              <div>

                <div className="stat-value">
                  {stats.identified_tigers}
                </div>

                <div className="stat-meta">
                  Individuals in database
                </div>

              </div>

            </div>


            {/* STORAGE */}

            <div className="stat-card">

              <div className="stat-top">

                <div className="stat-label">
                  Storage Saved
                </div>

                <div className="stat-icon">
                  <HardDrive size={17} />
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
                  <AlertTriangle size={17} />
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


              {/* =================================================
                MAP
                ================================================= */}

              <div className="panel map-panel">

                <div className="panel-header">

                  <div className="panel-title">
                    <Compass size={17} />
                    Spatial Intelligence
                  </div>


                  <div>

                    <select 
                      value={selectedTiger}
                      onChange={(e) => setSelectedTiger(e.target.value)}
                      className="select-control"
                    >
                      {tigers.map((t) => (
                        <option key={t.id} value={t.id}>{t.id} ({t.name || "Unnamed"})</option>
                      ))}
                      {tigers.length === 0 && <option value="">No tigers enrolled</option>}
                    </select>

                  </div>

                </div>


                {/* MAP */}

                <div className="map-container">

                  <MapContainer
                    center={[21.65, 79.25]}
                    zoom={11}
                    minZoom={10}
                    maxBounds={[[21.15, 78.75], [22.15, 79.75]]}
                    style={{
                      height: "100%",
                      width: "100%"
                    }}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://carto.com/">Carto</a>'
                    />

                    {/* Pench Reserve Zones */}
                    <Polygon 
                      positions={[[21.71, 79.19], [21.71, 79.29], [21.61, 79.29], [21.61, 79.19]]} 
                      pathOptions={{ color: '#059669', fillColor: '#059669', fillOpacity: 0.08, weight: 2 }}
                    >
                      <Popup>
                        <strong className="text-emerald-400">Pench Core Forest Zone</strong><br/>
                        Strict wildlife protection core zone.
                      </Popup>
                    </Polygon>

                    <Polygon 
                      positions={[[21.75, 79.15], [21.75, 79.35], [21.55, 79.35], [21.55, 79.15]]} 
                      pathOptions={{ color: '#d97706', fillColor: '#d97706', fillOpacity: 0.03, weight: 1.5, dashArray: '5, 5' }}
                    >
                      <Popup>
                        <strong className="text-amber-500">Pench Buffer Zone</strong><br/>
                        Co-existence forest area bordering human settlements.
                      </Popup>
                    </Polygon>

                    <Polygon 
                      positions={[[21.55, 79.15], [21.55, 79.35], [21.50, 79.35], [21.50, 79.15]]} 
                      pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.06, weight: 1, dashArray: '3, 3' }}
                    >
                      <Popup>
                        <strong className="text-red-500">⚠️ Southern Village Border</strong><br/>
                        High conflict risk settlement boundaries (Lat &lt; 21.57).
                      </Popup>
                    </Polygon>

                    <Polygon 
                      positions={[[21.75, 79.33], [21.75, 79.38], [21.55, 79.38], [21.55, 79.33]]} 
                      pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.06, weight: 1, dashArray: '3, 3' }}
                    >
                      <Popup>
                        <strong className="text-red-500">⚠️ Eastern Village Border</strong><br/>
                        High conflict risk settlement boundaries (Lon &gt; 79.33).
                      </Popup>
                    </Polygon>

                    {/* Active Tiger Range Polygon */}
                    {territory && territory.polygon && territory.polygon.length > 0 && (
                      <Polygon 
                        positions={territory.polygon} 
                        pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.15, weight: 3 }} 
                      >
                        <Popup>
                          <strong className="text-emerald-500">Tiger {territory.tiger_id} Range</strong><br/>
                          Estimated Area: {territory.core_area_sqkm} sq km
                        </Popup>
                      </Polygon>
                    )}

                    {/* Centroid marker */}
                    {territory && territory.centroid && (
                      <Marker position={[territory.centroid.lat, territory.centroid.lon]}>
                        <Popup>
                          <strong>Tiger {territory.tiger_id} Centroid</strong><br/>
                          Lat: {territory.centroid.lat.toFixed(4)}<br/>
                          Lon: {territory.centroid.lon.toFixed(4)}
                        </Popup>
                      </Marker>
                    )}

                    {/* Capture points */}
                    {territory && territory.capture_points && territory.capture_points.map((pt, idx) => (
                      <CircleMarker 
                        key={`pt-${idx}`} 
                        center={[pt.lat, pt.lon]} 
                        radius={6} 
                        pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.8, weight: 1 }}
                      >
                        <Popup>
                          <strong>Capture Event:</strong> {territory.tiger_id}<br/>
                          <strong>Station:</strong> {pt.station}<br/>
                          <strong>Time:</strong> {new Date(pt.timestamp).toLocaleString()}
                        </Popup>
                      </CircleMarker>
                    ))}

                    {/* Overlaps polygons */}
                    {overlaps.map((ov, idx) => (
                      <Polygon 
                        key={`overlap-${idx}`}
                        positions={ov.polygon}
                        pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.25, weight: 2, dashArray: '5, 5' }}
                      >
                        <Popup>
                          <strong className="text-red-500">⚠️ Territory Overlap Zone</strong><br/>
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
                          Territory
                        </span>

                        <span className="map-metric-value">
                          {territory.core_area_sqkm} sq km
                        </span>

                      </div>

                      <div>

                        <span className="map-metric-label">
                          Tiger ID
                        </span>

                        <span className="map-metric-value">
                          {territory.tiger_id}
                        </span>

                      </div>

                      <div>

                        <span className="map-metric-label">
                          Status
                        </span>

                        <span className="map-metric-value">
                          Territory calculated
                        </span>

                      </div>

                    </div>

                  ) : (

                    <span className="panel-subtitle">
                      Waiting for territory data...
                    </span>

                  )}

                </div>

              </div>


              {/* =================================================
                AI OPERATIONS
                ================================================= */}

              <div className="panel">

                <div className="panel-header">

                  <div className="panel-title">
                    <Layers size={17} />
                    Camera Trap Intelligence
                  </div>

                  <span className="panel-subtitle">
                    AI processing pipeline
                  </span>

                </div>


                <div className="operations-grid">


                  {/* SINGLE IMAGE */}

                  <div className="operation-card">

                    <div className="operation-icon">
                      <Camera size={18} />
                    </div>

                    <h3 className="operation-title">
                      Analyze Camera Capture
                    </h3>

                    <p className="operation-description">
                      Upload a camera-trap image to run wildlife
                      detection and tiger identification.
                    </p>


                    <label
                      className="primary-button"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >

                      {isUploading ? (

                        <>
                          <Loader2
                            size={15}
                            className="animate-spin"
                            style={{ marginRight: 7 }}
                          />

                          Processing image...

                        </>

                      ) : (

                        "Upload Camera Image"

                      )}

                      <input
                        type="file"
                        className="hidden"
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
                            <strong>
                              Tiger match detected
                            </strong>

                            <br />

                            Individual:
                            {" "}
                            {uploadStatus.tiger_id}

                            <br />

                            Score:
                            {" "}
                            {uploadStatus.distance_score}

                          </>

                        ) : uploadStatus.status === "quarantined" ? (

                          <>
                            <strong>
                              Image quarantined
                            </strong>

                            <br />

                            {uploadStatus.message}
                          </>

                        ) : (

                          <>
                            <strong>
                              Processing error
                            </strong>

                            <br />

                            {uploadStatus.message}
                          </>

                        )}

                      </div>

                    )}

                  </div>


                  {/* BULK TRIAGE */}

                  {/* SYSTEM STATUS */}

                  <div className="operation-card">

                    <div className="operation-icon">
                      <Activity size={18} />
                    </div>

                    <h3 className="operation-title">
                      Monitoring System
                    </h3>

                    <p className="operation-description">
                      The camera-trap intelligence network is currently
                      connected to the Pench monitoring system.
                    </p>

                    <div className="result-box result-success">

                      <strong>System Online</strong>

                      <br />

                      AI detection pipeline ready

                      <br />

                      Camera network:
                      {" "}
                      {stats.active_cameras}
                      {" "}
                      active stations

                    </div>

                  </div>

                </div>

              </div>

            </div>


            {/* =================================================
              INTELLIGENCE FEED
              ================================================= */}

            <aside className="panel intelligence-panel">

              <div className="panel-header">

                <div className="panel-title">

                  <AlertCircle size={17} />

                  Intelligence Feed

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

                        <span
                          className={`alert-badge ${severity}`}
                        >
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

                        {" · "}

                        {alert.tiger_id}

                      </h4>


                      <p className="alert-message">
                        {alert.message}
                      </p>


                      {alert.evidence &&
                        Object.keys(alert.evidence).length > 0 && (

                          <div className="alert-evidence">

                            {alert.evidence.distance_km && (

                              <div>
                                Distance:
                                {" "}
                                {alert.evidence.distance_km.toFixed(2)}
                                {" "}
                                km
                              </div>

                            )}

                            {alert.evidence.station && (

                              <div>
                                Station:
                                {" "}
                                {alert.evidence.station}
                              </div>

                            )}

                          </div>

                        )}


                      <button
                        onClick={() =>
                          handleResolveAlert(alert.id)
                        }
                        className="acknowledge-button"
                      >

                        <Check size={12} />

                        Acknowledge

                      </button>

                    </div>

                  );

                })}


                {alerts.length === 0 && (

                  <div className="empty-state">

                    <div className="empty-state-icon">
                      <CheckCircle2 size={21} />
                    </div>

                    <div className="empty-state-title">
                      All systems nominal
                    </div>

                    <div className="empty-state-text">
                      No active deviations or alerts have
                      been detected across the monitoring network.
                    </div>

                  </div>

                )}

              </div>

            </aside>

          </section>

        </main>

      </div>

    </div>
  );
}