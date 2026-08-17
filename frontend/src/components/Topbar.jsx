import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Thermometer, Droplets, CloudRain, Wind, Moon, Radio, Sun } from 'lucide-react';

// Approximation function to dynamically calculate the current Moon Phase
const calculateMoonPhase = () => {
  const synodicMonth = 2551443; // Synodic month in seconds (29.53 days)
  const now = new Date();
  const knownNewMoon = new Date(1970, 0, 7, 20, 35, 0); // Reference base new moon
  const secondsSinceNewMoon = ((now.getTime() - knownNewMoon.getTime()) / 1000) % synodicMonth;
  const pct = secondsSinceNewMoon / synodicMonth;
  const age = pct * 29.53;
  
  let phaseName = 'New Moon';
  if (age < 1.84) phaseName = 'New Moon';
  else if (age < 5.53) phaseName = 'Waxing Crescent';
  else if (age < 9.22) phaseName = 'First Quarter';
  else if (age < 12.91) phaseName = 'Waxing Gibbous';
  else if (age < 16.60) phaseName = 'Full Moon';
  else if (age < 20.29) phaseName = 'Waning Gibbous';
  else if (age < 23.98) phaseName = 'Third Quarter';
  else if (age < 27.67) phaseName = 'Waning Crescent';
  else phaseName = 'New Moon';
  
  // Calculate relative illumination percentage (0% to 100%)
  const daysFromNew = Math.min(age, 29.53 - age);
  const illumination = Math.round((daysFromNew / 14.77) * 100);
  
  return `${phaseName} (${illumination}% Illum)`;
};

export default function Topbar({ onRefresh, isRefreshing }) {
  const [time, setTime] = useState('');
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');

  const enableDarkReader = () => {
    if (window.DarkReader) {
      window.DarkReader.enable({
        brightness: 100,
        contrast: 90,
        sepia: 10
      });
      document.documentElement.classList.add('dark');
    }
  };

  const disableDarkReader = () => {
    if (window.DarkReader) {
      window.DarkReader.disable();
    }
    document.documentElement.classList.remove('dark');
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      if (window.DarkReader) {
        enableDarkReader();
        setIsDark(true);
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/darkreader@4.9.86/darkreader.min.js';
        script.onload = () => {
          enableDarkReader();
          setIsDark(true);
        };
        document.head.appendChild(script);
      }
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDark) {
      disableDarkReader();
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      if (window.DarkReader) {
        enableDarkReader();
        localStorage.setItem('theme', 'dark');
        setIsDark(true);
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/darkreader@4.9.86/darkreader.min.js';
        script.onload = () => {
          enableDarkReader();
          localStorage.setItem('theme', 'dark');
          setIsDark(true);
        };
        document.head.appendChild(script);
      }
    }
  };
  const [weather, setWeather] = useState({
    temp: '31°C',
    humidity: '68%',
    precipitation: '0.2 mm',
    wind: '12 km/h NE',
    moonPhase: 'Gibbous (82% Illum)'
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch real-time weather metrics dynamically for Pench Tiger Reserve coordinates
  useEffect(() => {
    async function fetchLiveWeather() {
      try {
        const lat = 21.65;
        const lon = 79.22;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather API error');
        const data = await response.json();
        
        if (data && data.current) {
          const temp = `${Math.round(data.current.temperature_2m)}°C`;
          const humidity = `${data.current.relative_humidity_2m}%`;
          const precipitation = `${data.current.precipitation} mm`;
          
          // Map wind direction angle to human readable cardinals
          const dirAngle = data.current.wind_direction_10m;
          let cardinal = 'N';
          if (dirAngle >= 22.5 && dirAngle < 67.5) cardinal = 'NE';
          else if (dirAngle >= 67.5 && dirAngle < 112.5) cardinal = 'E';
          else if (dirAngle >= 112.5 && dirAngle < 157.5) cardinal = 'SE';
          else if (dirAngle >= 157.5 && dirAngle < 202.5) cardinal = 'S';
          else if (dirAngle >= 202.5 && dirAngle < 247.5) cardinal = 'SW';
          else if (dirAngle >= 247.5 && dirAngle < 292.5) cardinal = 'W';
          else if (dirAngle >= 292.5 && dirAngle < 337.5) cardinal = 'NW';
          
          const wind = `${Math.round(data.current.wind_speed_10m)} km/h ${cardinal}`;
          const moonPhase = calculateMoonPhase();
          
          setWeather({
            temp,
            humidity,
            precipitation,
            wind,
            moonPhase
          });
        }
      } catch (err) {
        console.error('Failed to query weather telemetry:', err);
        // Soft fallback to dynamic moon phase calculation even on offline errors
        setWeather(prev => ({
          ...prev,
          moonPhase: calculateMoonPhase()
        }));
      }
    }
    fetchLiveWeather();
  }, []);

  return (
    <header className="topbar">
      {/* Row 1: Heading & Actions */}
      <div className="flex w-full justify-between items-start gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-extrabold text-forest-950 tracking-tight leading-tight mt-0.5">
            Reserve Operations Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pench Tiger Reserve Core & Buffer Sectors · Real-Time MegaDetector V6 Triage & Biometric Re-ID
          </p>
        </div>

        <div className="topbar-actions flex items-center gap-3 self-center">
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
            onClick={toggleDarkMode}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{ color: isDark ? '#f59e0b' : '#4a5d52' }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button
            className="icon-btn"
            onClick={onRefresh}
            title="Refresh system intelligence"
            disabled={isRefreshing}
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-emerald-700' : ''} />
          </button>
        </div>
      </div>

      {/* Row 2: Weather & Meteorology analysis */}
      <div className="flex flex-wrap items-center gap-3 text-xs border-t border-slate-100 pt-2.5 mt-2.5 w-full">
        <span className="reserve-badge bg-emerald-100 text-emerald-800 border border-emerald-200">METEOROLOGY GRID</span>
        
        <span className="flex items-center gap-1">
          <Thermometer size={14} className="text-amber-600" />
          <span className="text-slate-600">Temp: <strong className="text-slate-900 font-semibold">{weather.temp}</strong></span>
        </span>
        <span className="text-slate-300">|</span>
        
        <span className="flex items-center gap-1">
          <Droplets size={14} className="text-sky-500" />
          <span className="text-slate-600">Humidity: <strong className="text-slate-900 font-semibold">{weather.humidity}</strong></span>
        </span>
        <span className="text-slate-300">|</span>
        
        <span className="flex items-center gap-1">
          <CloudRain size={14} className="text-indigo-500" />
          <span className="text-slate-600">Precipitation: <strong className="text-slate-900 font-semibold">{weather.precipitation}</strong></span>
        </span>
        <span className="text-slate-300">·</span>
        
        <span className="flex items-center gap-1">
          <Wind size={12} className="text-emerald-600" />
          <span className="text-slate-600">Wind: <strong className="text-slate-900 font-semibold">{weather.wind}</strong></span>
        </span>
        <span className="text-slate-300">·</span>
        
        <span className="flex items-center gap-1">
          <Moon size={12} className="text-purple-600" />
          <span className="text-slate-600">Moon Phase: <strong className="text-slate-900 font-semibold">{weather.moonPhase}</strong></span>
        </span>
      </div>
    </header>
  );
}