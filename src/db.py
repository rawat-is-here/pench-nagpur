import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from .env
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://placeholder-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or "placeholder-key"

# Initialize Supabase client safely
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"[WARN] Supabase client initialization failed: {e}")
    supabase = None

def get_db():
    return supabase

# --- Tigers Table Helper Functions ---

def enroll_tiger(tiger_id: str, name: str = None):
    """Enrolls a new tiger in the tigers database."""
    if not supabase:
        return []
    try:
        data = {"id": tiger_id, "name": name or f"Tiger {tiger_id}"}
        response = supabase.table("tigers").upsert(data).execute()
        return response.data or []
    except Exception as e:
        print(f"[DB Error] enroll_tiger: {e}")
        return []

def get_tiger(tiger_id: str):
    """Retrieves a tiger record by ID."""
    if not supabase:
        return None
    try:
        response = supabase.table("tigers").select("*").eq("id", tiger_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"[DB Error] get_tiger: {e}")
        return None

def get_all_tigers():
    """Retrieves all tigers enrolled in the database."""
    if not supabase:
        return []
    try:
        response = supabase.table("tigers").select("*").execute()
        return response.data or []
    except Exception as e:
        print(f"[DB Error] get_all_tigers: {e}")
        return []

# --- Captures Table Helper Functions ---

def add_capture(tiger_id: str, image_path: str, station: str = None, timestamp: str = None, 
                latitude: float = None, longitude: float = None, status: str = "processed", 
                confidence: float = 1.0, embedding: list = None):
    """Inserts a new camera trap capture, guaranteeing parent tiger exists."""
    if not supabase:
        return []
    try:
        # Guarantee parent tiger exists in tigers table to satisfy foreign key
        if tiger_id:
            try:
                enroll_tiger(tiger_id, f"Resident Tiger {tiger_id}")
            except Exception:
                pass

        data = {
            "tiger_id": tiger_id,
            "image_path": image_path,
            "station": station,
            "timestamp": timestamp,
            "latitude": latitude,
            "longitude": longitude,
            "status": status,
            "confidence": confidence,
            "embedding": embedding
        }
        response = supabase.table("captures").insert(data).execute()
        return response.data or []
    except Exception as e:
        print(f"[DB Error] add_capture: {e}")
        return []

def get_captures_for_tiger(tiger_id: str):
    """Retrieves all captures for a specific tiger."""
    if not supabase:
        return []
    try:
        response = supabase.table("captures").select("*").eq("tiger_id", tiger_id).execute()
        return response.data or []
    except Exception as e:
        print(f"[DB Error] get_captures_for_tiger: {e}")
        return []

def get_all_captures():
    """Retrieves all captures from the database."""
    if not supabase:
        return []
    try:
        response = supabase.table("captures").select("*").execute()
        return response.data or []
    except Exception as e:
        print(f"[DB Error] get_all_captures: {e}")
        return []

def get_pending_reviews():
    """Retrieves all captures with status 'pending_review'."""
    if not supabase:
        return []
    try:
        response = supabase.table("captures").select("*").eq("status", "pending_review").order("id", desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"[DB Error] get_pending_reviews: {e}")
        return []

def get_capture_by_id(capture_id: int):
    """Retrieves a single capture by its ID."""
    if not supabase:
        return None
    try:
        response = supabase.table("captures").select("*").eq("id", capture_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"[DB Error] get_capture_by_id: {e}")
        return None

def update_capture_resolution(capture_id: int, tiger_id: str, status: str):
    """Updates a capture after human review resolution."""
    if not supabase:
        return []
    try:
        data = {
            "tiger_id": tiger_id,
            "status": status
        }
        response = supabase.table("captures").update(data).eq("id", capture_id).execute()
        return response.data or []
    except Exception as e:
        print(f"[DB Error] update_capture_resolution: {e}")
        return []

# --- Alerts Table Helper Functions ---

import time
import threading

_alerts_cache_lock = threading.Lock()
_alerts_cache = None
_alerts_cache_timestamp = 0
_ALERTS_CACHE_TTL = 3.0  # 3-second cache TTL for high-frequency dashboard queries

def invalidate_alerts_cache():
    """Invalidates the in-memory alerts cache."""
    global _alerts_cache, _alerts_cache_timestamp
    with _alerts_cache_lock:
        _alerts_cache = None
        _alerts_cache_timestamp = 0

def add_alert(tiger_id: str, alert_type: str, severity: str, message: str, evidence: dict = None, 
              station: str = None, latitude: float = None, longitude: float = None, timestamp: str = None):
    """Creates a new threat / spatial alert in the alerts table with JSONB evidence."""
    if not supabase:
        return []
    try:
        ev = evidence if isinstance(evidence, dict) else {}
        if station and "station" not in ev:
            ev["station"] = station
        if latitude is not None and longitude is not None and "location" not in ev:
            ev["location"] = {"lat": latitude, "lon": longitude}
            
        data = {
            "tiger_id": tiger_id,
            "alert_type": alert_type,
            "severity": severity,
            "message": message,
            "resolved": False,
            "evidence": ev
        }
        if timestamp:
            data["timestamp"] = timestamp
            
        response = supabase.table("alerts").insert(data).execute()
        invalidate_alerts_cache()
        return response.data or []
    except Exception as e:
        print(f"[DB Error] add_alert: {e}")
        return []

def get_active_alerts(force_refresh: bool = False):
    """Retrieves all unresolved threat alerts with high-performance memory caching."""
    global _alerts_cache, _alerts_cache_timestamp
    now = time.time()
    
    if not force_refresh and _alerts_cache is not None and (now - _alerts_cache_timestamp) < _ALERTS_CACHE_TTL:
        return _alerts_cache

    if not supabase:
        return []
        
    try:
        response = supabase.table("alerts")\
                           .select("*")\
                           .eq("resolved", False)\
                           .order("id", desc=True)\
                           .execute()
        results = response.data or []
        with _alerts_cache_lock:
            _alerts_cache = results
            _alerts_cache_timestamp = now
        return results
    except Exception as e:
        print(f"[DB Error] get_active_alerts: {e}")
        return _alerts_cache or []

def get_all_alerts(limit: int = 100):
    """Retrieves historical threat alerts (resolved and active)."""
    if not supabase:
        return []
    try:
        response = supabase.table("alerts")\
                           .select("*")\
                           .order("id", desc=True)\
                           .limit(limit)\
                           .execute()
        return response.data or []
    except Exception as e:
        print(f"[DB Error] get_all_alerts: {e}")
        return []

def get_alerts_for_tiger(tiger_id: str):
    """Retrieves all threat alerts associated with a specific tiger ID."""
    if not supabase:
        return []
    try:
        response = supabase.table("alerts")\
                           .select("*")\
                           .eq("tiger_id", tiger_id)\
                           .order("id", desc=True)\
                           .execute()
        return response.data or []
    except Exception as e:
        print(f"[DB Error] get_alerts_for_tiger: {e}")
        return []

def resolve_alert(alert_id: int):
    """Marks an alert as resolved and invalidates cache."""
    if not supabase:
        return []
    try:
        response = supabase.table("alerts").update({"resolved": True}).eq("id", alert_id).execute()
        invalidate_alerts_cache()
        return response.data or []
    except Exception as e:
        print(f"[DB Error] resolve_alert: {e}")
        return []