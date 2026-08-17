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
        return [{"id": tiger_id, "name": name or f"Tiger {tiger_id}"}]
    try:
        data = {"id": tiger_id, "name": name or f"Tiger {tiger_id}"}
        response = supabase.table("tigers").upsert(data).execute()
        return response.data
    except Exception as e:
        print(f"[DB Error] enroll_tiger: {e}")
        return []

def get_tiger(tiger_id: str):
    """Retrieves a tiger record by ID."""
    if not supabase:
        return {"id": tiger_id, "name": f"Tiger {tiger_id}"}
    try:
        response = supabase.table("tigers").select("*").eq("id", tiger_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"[DB Error] get_tiger: {e}")
        return None

def get_all_tigers():
    """Retrieves all tigers enrolled in the database."""
    if not supabase:
        return [
            {"id": "T-001", "name": "Tiger T-001 (Collar)"},
            {"id": "T-002", "name": "Tiger T-002 (Collar)"},
            {"id": "T-104", "name": "Tiger T-104 (Collar)"}
        ]
    try:
        response = supabase.table("tigers").select("*").execute()
        return response.data
    except Exception as e:
        print(f"[DB Error] get_all_tigers: {e}")
        return []

# --- Captures Table Helper Functions ---

def add_capture(tiger_id: str, image_path: str, station: str, timestamp: str, latitude: float, longitude: float, status: str, confidence: float, embedding = None):
    """Logs a new camera trap capture."""
    if not supabase:
        return [{"tiger_id": tiger_id, "status": status, "confidence": confidence}]
    try:
        data = {
            "tiger_id": tiger_id,
            "image_path": image_path,
            "station": station,
            "timestamp": timestamp,
            "latitude": latitude,
            "longitude": longitude,
            "status": status,
            "confidence": confidence
        }
        if embedding is not None:
            data["embedding"] = embedding
        response = supabase.table("captures").insert(data).execute()
        return response.data
    except Exception as e:
        print(f"[DB Error] add_capture: {e}")
        return []

def get_captures_for_tiger(tiger_id: str):
    """Fetches all captures for a specific tiger."""
    if not supabase:
        return []
    try:
        response = supabase.table("captures").select("*").eq("tiger_id", tiger_id).execute()
        return response.data
    except Exception as e:
        print(f"[DB Error] get_captures_for_tiger: {e}")
        return []

def get_all_captures():
    """Fetches all captures."""
    if not supabase:
        return []
    try:
        response = supabase.table("captures").select("*").execute()
        return response.data
    except Exception as e:
        print(f"[DB Error] get_all_captures: {e}")
        return []

def get_pending_reviews():
    """Fetches all captures pending human reviewer resolution."""
    response = supabase.table("captures").select("*").eq("status", "pending_review").order("timestamp", desc=True).execute()
    return response.data

def get_capture_by_id(capture_id: int):
    """Retrieves a single capture by primary key ID."""
    response = supabase.table("captures").select("*").eq("id", capture_id).execute()
    return response.data[0] if response.data else None

def update_capture_resolution(capture_id: int, tiger_id: str, status: str = "processed"):
    """Updates the assigned tiger ID and status after human verification."""
    data = {"status": status}
    if tiger_id:
        data["tiger_id"] = tiger_id
    response = supabase.table("captures").update(data).eq("id", capture_id).execute()
    return response.data

# --- Alerts Table Helper Functions ---

def add_alert(tiger_id: str, alert_type: str, severity: str, message: str, evidence: dict = None):
    """Inserts a new deviation/trend alert."""
    if not supabase:
        return [{"id": 1, "tiger_id": tiger_id, "severity": severity, "message": message}]
    try:
        data = {
            "tiger_id": tiger_id,
            "alert_type": alert_type,
            "severity": severity,
            "message": message,
            "evidence": evidence or {}
        }
        response = supabase.table("alerts").insert(data).execute()
        return response.data
    except Exception as e:
        print(f"[DB Error] add_alert: {e}")
        return []

def get_active_alerts():
    """Retrieves all unresolved alerts, sorted by newest first."""
    if not supabase:
        return []
    try:
        response = supabase.table("alerts").select("*").eq("resolved", False).order("timestamp", desc=True).execute()
        return response.data
    except Exception as e:
        print(f"[DB Error] get_active_alerts: {e}")
        return []

def resolve_alert(alert_id: int):
    """Marks an alert as resolved."""
    if not supabase:
        return [{"id": alert_id, "resolved": True}]
    try:
        response = supabase.table("alerts").update({"resolved": True}).eq("id", alert_id).execute()
        return response.data
    except Exception as e:
        print(f"[DB Error] resolve_alert: {e}")
        return []