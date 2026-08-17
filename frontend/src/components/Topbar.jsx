import React, { useState, useEffect } from 'react';
import { MapPin, RefreshCw, Clock, ShieldCheck } from 'lucide-react';

export default function Topbar({ onRefresh, isRefreshing }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-title-wrap">
        <span className="reserve-badge">PENCH SECTOR-7</span>
        <div>
          <div className="topbar-title">
            Pench Tiger Reserve Command & Intelligence
          </div>
          <div className="topbar-subtitle flex items-center gap-1.5">
            <MapPin size={11} className="text-emerald-700" />
            <span>Madhya Pradesh & Maharashtra Border · UTM Zone 44N</span>
          </div>
        </div>
      </div>

      <div className="topbar-actions">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-medium">
          <Clock size={13} className="text-emerald-600" />
          <span>{time || '12:00:00'} IST</span>
        </div>

        <div className="system-status-pill">
          <span className="status-beacon"></span>
          <span>Sensor Grid Active</span>
        </div>

        <button
          className="icon-btn"
          onClick={onRefresh}
          title="Refresh system intelligence"
          disabled={isRefreshing}
        >
          <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-emerald-700' : ''} />
        </button>
      </div>
    </header>
  );
}