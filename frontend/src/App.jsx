import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import Tigers from './pages/Tigers';
import Territories from './pages/Territories';
import Sightings from './pages/Sightings';
import CameraTraps from './pages/CameraTraps';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Increment trigger to signal data reload in child pages
    setRefreshTrigger(prev => prev + 1);
    // Simulate telemetry sync delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout onRefresh={handleRefresh} isRefreshing={isRefreshing} />}>
          <Route index element={<Dashboard refreshTrigger={refreshTrigger} />} />
          <Route path="live-map" element={<LiveMap />} />
          <Route path="tigers" element={<Tigers />} />
          <Route path="territories" element={<Territories />} />
          <Route path="sightings" element={<Sightings />} />
          <Route path="camera-traps" element={<CameraTraps />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
