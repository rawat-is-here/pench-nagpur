import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// System Stats
export const getSystemStats = () => api.get('/system_stats');

// Territories & Spatial Intelligence
export const getTerritory = (tigerId = 'T-001') => api.get(`/territory/${tigerId}`);
export const getAllTerritories = () => api.get('/all_territories');
export const getTerritoryOverlaps = () => api.get('/territory_overlaps');
export const getCameraStations = () => api.get('/camera_stations');
export const getCaptures = () => api.get('/captures');

// Alerts
export const getActiveAlerts = () => api.get('/alerts');
export const resolveAlert = (alertId) => api.post(`/resolve_alert/${alertId}`);

// Tigers
export const getAllTigers = () => api.get('/tigers');
export const getTigerProfile = (tigerId) => api.get(`/tigers/${tigerId}`);

// Human-in-the-Loop Reviews
export const getPendingReviews = () => api.get('/pending_reviews');
export const resolveReview = (data) => api.post('/resolve_review', data);

// Safe Quarantine Recovery
export const getQuarantinedImages = () => api.get('/quarantined_images');
export const restoreQuarantine = (filename) => api.post(`/restore_quarantine/${filename}`);

// Image Upload & Ingestion
export const uploadCameraTrap = (formData) =>
  api.post('/upload_camera_trap', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// Batch Directory Triage
export const runBulkTriage = (directoryPath, confidenceThreshold = 0.40) =>
  api.post('/bulk_triage', {
    directory_path: directoryPath,
    confidence_threshold: confidenceThreshold,
  });

// Deviation Check
export const checkGPSAlert = (tigerId, lat, lon, timestamp) =>
  api.post('/check_alerts', {
    tiger_id: tigerId,
    lat,
    lon,
    timestamp: timestamp || new Date().toISOString(),
  });

export default api;