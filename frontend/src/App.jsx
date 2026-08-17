import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import Tigers from './pages/Tigers';
import CameraTraps from './pages/CameraTraps';
import Sightings from './pages/Sightings';
import Territories from './pages/Territories';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleGlobalRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout onRefresh={handleGlobalRefresh} />}>
          <Route index element={<Dashboard refreshTrigger={refreshKey} />} />
          <Route path="live-map" element={<LiveMap />} />
          <Route path="tigers" element={<Tigers />} />
          <Route path="camera-traps" element={<CameraTraps />} />
          <Route path="sightings" element={<Sightings />} />
          <Route path="territories" element={<Territories />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}