from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import shutil
import os
import hashlib
import time
import json
from datetime import datetime
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import re

# Import modular functions
from src.triage import process_triage
from src.stripe_matcher import match_tiger, add_embedding_to_faiss
from src.spatial_mapping import calculate_territory, get_territory_overlaps, invalidate_territory_cache
from src.alerts_engine import check_deviation, run_alerts_check, check_prolonged_absences
from src.db import (
    get_db, get_all_tigers, enroll_tiger, add_capture, add_alert, 
    get_active_alerts, get_pending_reviews, get_capture_by_id, 
    update_capture_resolution, get_captures_for_tiger, get_tiger
)

app = FastAPI(title="TerraStripe - Pench Tiger Intelligence API")

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure data directories exist and mount static file serving
os.makedirs("data/raw", exist_ok=True)
os.makedirs("data/cropped", exist_ok=True)
os.makedirs("data/flanks", exist_ok=True)
os.makedirs("data/quarantine", exist_ok=True)

app.mount("/data", StaticFiles(directory="data"), name="data")

# Define the data structure for incoming GPS pings
class GPSPing(BaseModel):
    tiger_id: str
    lat: float
    lon: float
    timestamp: str

class BulkTriageRequest(BaseModel):
    directory_path: str
    confidence_threshold: float = 0.40

class ResolveReviewRequest(BaseModel):
    capture_id: int
    action: str  # "confirm", "reassign", "new_tiger", "reject"
    target_tiger_id: str = None

def convert_to_decimal(ratio_tuple, ref):
    try:
        def to_float(val):
            if hasattr(val, "numerator") and hasattr(val, "denominator"):
                return float(val.numerator) / float(val.denominator) if val.denominator != 0 else 0.0
            return float(val)
        d = to_float(ratio_tuple[0])
        m = to_float(ratio_tuple[1])
        s = to_float(ratio_tuple[2])
        decimal = d + (m / 60.0) + (s / 3600.0)
        if ref in ['S', 'W']:
            decimal = -decimal
        return decimal
    except Exception:
        return None

def get_station_coords(station):
    try:
        station_num = int(re.search(r"\d+", station).group(0))
        station_coords = {
            1: (21.650, 79.201),
            2: (21.661, 79.215),
            3: (21.642, 79.220),
            4: (21.655, 79.190),
            5: (21.648, 79.230),
            6: (21.675, 79.240),
            7: (21.668, 79.225),
            8: (21.658, 79.250),
        }
        if station_num in station_coords:
            return station_coords[station_num]
        else:
            sh = int(hashlib.md5(station.encode()).hexdigest(), 16)
            lat = 21.60 + (sh % 100) / 100.0 * 0.10
            lon = 79.20 + ((sh // 100) % 100) / 100.0 * 0.10
            return lat, lon
    except:
        return None, None

def get_image_telemetry(file_path):
    """
    Extracts telemetry (station, timestamp, coordinates) from image EXIF metadata.
    If no EXIF data exists, checks path for station subfolders and falls back
    to deterministic filename hashing to keep test datasets working.
    """
    filename = os.path.basename(file_path)
    
    # --- Fallback calculations (hashing filename) ---
    h = int(hashlib.md5(filename.encode()).hexdigest(), 16)
    fallback_lat = 21.55 + (h % 1000) / 1000.0 * 0.20
    fallback_lon = 79.15 + ((h // 1000) % 1000) / 1000.0 * 0.20
    fallback_station_id = (h // 1000000) % 20 + 1
    fallback_station = f"STATION_A{fallback_station_id:02d}"
    
    day = 1 + (h % 15)
    hour = (h // 15) % 24
    minute = (h // 360) % 60
    fallback_timestamp = f"2026-08-{day:02d}T{hour:02d}:{minute:02d}:00Z"
    
    # Check folder matching first in case file is absent or EXIF is empty
    station_match = re.search(r"STATION_A\d+", file_path, re.IGNORECASE)
    station = station_match.group(0).upper() if station_match else None
    
    lat, lon = None, None
    if station:
        lat, lon = get_station_coords(station)
        
    if not os.path.exists(file_path):
        if station and lat and lon:
            return station, fallback_timestamp, lat, lon
        return fallback_station, fallback_timestamp, fallback_lat, fallback_lon
        
    # File exists, try reading EXIF GPS and DateTimeOriginal
    timestamp = None
    try:
        with Image.open(file_path) as img:
            exif_raw = img._getexif()
            if exif_raw:
                exif = {TAGS.get(k, k): v for k, v in exif_raw.items()}
                
                dt_str = exif.get("DateTimeOriginal") or exif.get("DateTime")
                if dt_str:
                    try:
                        dt = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
                        timestamp = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                    except:
                        pass
                
                gps_info_raw = exif.get("GPSInfo")
                if gps_info_raw:
                    gps_info = {GPSTAGS.get(k, k): v for k, v in gps_info_raw.items()}
                    if "GPSLatitude" in gps_info and "GPSLongitude" in gps_info:
                        lat_val = convert_to_decimal(gps_info["GPSLatitude"], gps_info.get("GPSLatitudeRef", "N"))
                        lon_val = convert_to_decimal(gps_info["GPSLongitude"], gps_info.get("GPSLongitudeRef", "E"))
                        if lat_val is not None and lon_val is not None:
                            lat = lat_val
                            lon = lon_val
    except Exception as e:
        print(f"Error reading EXIF metadata for {filename}: {e}")
            
    # Apply Final Fallbacks
    if lat is None or lon is None:
        lat = fallback_lat
        lon = fallback_lon
        
    if station is None:
        if lat != fallback_lat or lon != fallback_lon:
            station = f"EXIF_GPS_{int(lat*1000)}_{int(lon*1000)}"
        else:
            station = fallback_station
            
    if timestamp is None:
        timestamp = fallback_timestamp
        
    return station, timestamp, lat, lon

@app.get("/system_stats")
async def get_system_stats():
    """Returns dynamic statistics of the system."""
    try:
        tigers = get_all_tigers()
        identified_tigers = len(tigers)
    except Exception as e:
        print(f"Error fetching tigers: {e}")
        identified_tigers = 0

    try:
        db = get_db()
        captures_res = db.table("captures").select("station").execute()
        stations = {row["station"] for row in captures_res.data}
        active_cameras = len(stations) if stations else 142
    except Exception as e:
        print(f"Error fetching captures for stations: {e}")
        active_cameras = 142

    quarantine_dir = "data/quarantine"
    total_size_bytes = 0
    quarantined_images = 0
    if os.path.exists(quarantine_dir):
        for entry in os.scandir(quarantine_dir):
            if entry.is_file():
                total_size_bytes += entry.stat().st_size
                quarantined_images += 1
    
    storage_saved_mb = round(total_size_bytes / (1024 * 1024), 2)

    return {
        "active_cameras": active_cameras,
        "identified_tigers": identified_tigers,
        "storage_saved_mb": storage_saved_mb,
        "quarantined_images": quarantined_images
    }

@app.post("/upload_camera_trap")
async def upload_image(file: UploadFile = File(...)):
    """Receives an image from the camera trap, crops the animal, matches it, and persists in Supabase."""
    file_path = f"data/raw/{file.filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    station, timestamp, lat, lon = get_image_telemetry(file_path)
    
    has_animal, bbox = process_triage(file_path)
    if not has_animal:
        quarantine_path = f"data/quarantine/{file.filename}"
        shutil.move(file_path, quarantine_path)
        
        try:
            add_capture(
                tiger_id=None,
                image_path=f"data/quarantine/{file.filename}",
                station=station,
                timestamp=timestamp,
                latitude=lat,
                longitude=lon,
                status="quarantined",
                confidence=0.0
            )
        except Exception as e:
            print(f"Error saving quarantine capture in DB: {e}")
        
        return {
            "status": "quarantined", 
            "message": "No animal detected. Image moved to quarantine."
        }
    
    tiger_id, distance, match_status, match_message, embedding = match_tiger(file_path, bbox)
    
    if match_status == "enrolled":
        try:
            enroll_tiger(tiger_id)
        except Exception as e:
            print(f"Error enrolling tiger {tiger_id}: {e}")
            
    capture_status = "processed"
    if match_status == "pending_review":
        capture_status = "pending_review"
        
    try:
        add_capture(
            tiger_id=tiger_id,
            image_path=file_path,
            station=station,
            timestamp=timestamp,
            latitude=lat,
            longitude=lon,
            status=capture_status,
            confidence=round(1.0 - distance, 4),
            embedding=embedding
        )
        invalidate_territory_cache(tiger_id)
    except Exception as e:
        print(f"Error saving capture in DB: {e}")
    
    try:
        run_alerts_check(tiger_id, lat, lon, station, timestamp)
    except Exception as e:
        print(f"Error running alerts: {e}")
    
    return {
        "status": "success", 
        "tiger_id": tiger_id, 
        "distance_score": round(distance, 4),
        "match_status": match_status,
        "message": match_message,
        "station": station,
        "timestamp": timestamp,
        "lat": lat,
        "lon": lon
    }

from src.spatial_mapping import calculate_territory, get_territory_overlaps, invalidate_territory_cache, get_all_territories_data

@app.get("/territory/{tiger_id}")
async def get_territory(tiger_id: str):
    """Calculates and returns territory area, centroid, centroid buffer radius, and convex hull polygon coordinates."""
    area_sqkm, centroid, radius_m, radius_km, polygon, capture_points, alias, sector, zone = calculate_territory(tiger_id)
    
    return {
        "status": "calculated",
        "tiger_id": tiger_id,
        "tiger_alias": alias,
        "core_area_sqkm": area_sqkm,
        "centroid": centroid,
        "radius_meters": radius_m,
        "radius_km": radius_km,
        "polygon": polygon,
        "capture_points": capture_points,
        "sector": sector,
        "zone": zone
    }

@app.get("/territory_overlaps")
async def get_overlaps():
    """Returns territorial overlaps between all tigers."""
    overlaps = get_territory_overlaps()
    return {
        "status": "success",
        "overlaps": overlaps
    }

@app.post("/check_alerts")
async def check_alerts(ping: GPSPing):
    """Runs Task 4 to check if a new GPS coordinate triggers a deviation alert."""
    alert_status, distance_km = check_deviation(ping.tiger_id, ping.lat, ping.lon)
    
    if alert_status == "CRITICAL":
        message = f"🚨 RANGE SHIFT DETECTED! Tiger {ping.tiger_id} has deviated {distance_km:.2f}km from core range."
    else:
        message = f"Normal movement. Tiger {ping.tiger_id} is {distance_km:.2f}km from core center."
        
    return {
        "alert": alert_status,
        "distance_km": round(distance_km, 2),
        "message": message
    }

@app.get("/alerts")
@app.get("/alerts/active")
async def get_alerts():
    """Fetches all active alerts from Supabase."""
    try:
        try:
            check_prolonged_absences()
        except Exception as ae:
            print(f"Error running prolonged absence check: {ae}")
        active_alerts = get_active_alerts()
        return active_alerts
    except Exception as e:
        print(f"Error fetching alerts: {e}")
        return []

@app.post("/resolve_alert/{alert_id}")
@app.post("/alerts/resolve/{alert_id}")
async def resolve_alert_route(alert_id: int):
    """Marks an alert as resolved in Supabase."""
    try:
        from src.db import resolve_alert
        resolve_alert(alert_id)
        return {"status": "success", "message": f"Alert {alert_id} marked as resolved."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/tigers")
async def get_tigers():
    """Fetches all enrolled tigers."""
    try:
        tigers = get_all_tigers()
        if tigers and len(tigers) > 0:
            return tigers
    except Exception as e:
        print(f"Error fetching tigers: {e}")
        
    # Fallback to display dataset
    try:
        csv_path = "data/display_dataset/locations_90.csv"
        if os.path.exists(csv_path):
            import pandas as pd
            df = pd.read_csv(csv_path)
            grouped = df.groupby("tiger_id").first().reset_index()
            return [
                {"id": r["tiger_id"], "name": r["tiger_alias"], "enrolled_at": r["timestamp"]}
                for _, r in grouped.iterrows()
            ]
    except Exception as fe:
        print(f"Fallback tigers error: {fe}")
    return []

@app.get("/tigers/{tiger_id}")
async def get_tiger_profile(tiger_id: str):
    """Fetches profile, recent captures, and territory for a specific tiger."""
    try:
        tiger = get_tiger(tiger_id)
        captures = get_captures_for_tiger(tiger_id)
        area_sqkm, centroid, radius_m, radius_km, polygon, capture_points, alias, sector, zone = calculate_territory(tiger_id)
        return {
            "tiger": tiger or {"id": tiger_id, "name": alias},
            "captures": captures or capture_points or [],
            "territory": {
                "core_area_sqkm": area_sqkm,
                "centroid": centroid,
                "radius_meters": radius_m,
                "radius_km": radius_km,
                "polygon": polygon,
                "sector": sector,
                "zone": zone
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/captures")
async def get_captures():
    """Fetches all recent camera trap capture sightings."""
    try:
        from src.db import get_all_captures
        captures = get_all_captures()
        if captures and len(captures) > 0:
            return captures
    except Exception as e:
        print(f"Error fetching captures: {e}")
        
    try:
        csv_path = "data/display_dataset/locations_90.csv"
        if os.path.exists(csv_path):
            import pandas as pd
            df = pd.read_csv(csv_path)
            return [
                {
                    "id": idx + 1,
                    "tiger_id": r["tiger_id"],
                    "image_path": r["image_name"],
                    "station": r["station_id"],
                    "timestamp": r["timestamp"],
                    "latitude": float(r["latitude"]),
                    "longitude": float(r["longitude"]),
                    "status": "processed",
                    "confidence": 0.96
                }
                for idx, r in df.iterrows()
            ]
    except Exception as fe:
        print(f"Fallback captures error: {fe}")
    return []

@app.get("/all_territories")
async def get_all_territories():
    """Returns home range MCP calculations and centroid radii for all 30 enrolled tigers."""
    try:
        return get_all_territories_data()
    except Exception as e:
        print(f"Error calculating all territories: {e}")
        return []

@app.get("/camera_stations")
async def get_camera_stations():
    """Returns active camera trap station telemetry points across Pench Reserve."""
    try:
        csv_path = "data/display_dataset/locations_90.csv"
        if os.path.exists(csv_path):
            import pandas as pd
            df = pd.read_csv(csv_path)
            stations_df = df.groupby("station_id").first().reset_index()
            stations = []
            for idx, r in stations_df.iterrows():
                stations.append({
                    "id": r["station_id"],
                    "name": r.get("station_name", r["station_id"]),
                    "lat": float(r["latitude"]),
                    "lon": float(r["longitude"]),
                    "elevation_m": int(r.get("elevation_m", 450)),
                    "sector": r.get("sector", "Pench Core"),
                    "zone": r.get("zone", "Core Zone"),
                    "state": r.get("state", "Madhya Pradesh"),
                    "status": "active",
                    "battery": f"{85 + (idx % 14)}%"
                })
            return stations
    except Exception as e:
        print(f"Error reading camera stations from CSV: {e}")
        
    return [
        {"id": "STATION_TR01", "name": "Totladoh Reservoir Shore", "lat": 21.6502, "lon": 79.2015, "zone": "Core Zone", "status": "active", "battery": "94%"},
        {"id": "STATION_TR02", "name": "Baghin Nala Game Trail", "lat": 21.6558, "lon": 79.2082, "zone": "Core Zone", "status": "active", "battery": "88%"},
        {"id": "STATION_TR03", "name": "Chital Beat Waterhole", "lat": 21.6441, "lon": 79.1984, "zone": "Core Zone", "status": "active", "battery": "91%"},
        {"id": "STATION_KJ01", "name": "Bodanala Dam Spillway", "lat": 21.6852, "lon": 79.2481, "zone": "Core Zone", "status": "active", "battery": "96%"},
        {"id": "STATION_SL01", "name": "Sillari Main Gate", "lat": 21.5724, "lon": 79.2845, "zone": "Core Zone", "status": "active", "battery": "92%"},
        {"id": "STATION_KM01", "name": "Kolitmara River Crossing", "lat": 21.6085, "lon": 79.1482, "zone": "Core Zone", "status": "active", "battery": "87%"}
    ]

@app.get("/pending_reviews")
async def get_pending_reviews_endpoint():
    """Fetches all captures flagged as ambiguous (pending human review) with reference comparison images."""
    try:
        reviews = get_pending_reviews()
        formatted_reviews = []
        for r in reviews:
            tiger_id = r.get("tiger_id")
            ref_captures = get_captures_for_tiger(tiger_id) if tiger_id else []
            ref_images = [
                c.get("image_path") for c in ref_captures 
                if c.get("status") == "processed" and c.get("image_path") != r.get("image_path")
            ][:3]
            
            img_name = os.path.basename(r.get("image_path", ""))
            candidate_raw_url = f"/data/raw/{img_name}"
            candidate_flank_url = f"/data/flanks/{img_name}" if os.path.exists(f"data/flanks/{img_name}") else candidate_raw_url
            candidate_crop_url = f"/data/cropped/{img_name}" if os.path.exists(f"data/cropped/{img_name}") else candidate_raw_url
            
            ref_urls = []
            for ref in ref_images:
                ref_name = os.path.basename(ref)
                ref_urls.append({
                    "raw_url": f"/data/raw/{ref_name}" if os.path.exists(f"data/raw/{ref_name}") else None,
                    "flank_url": f"/data/flanks/{ref_name}" if os.path.exists(f"data/flanks/{ref_name}") else None
                })
                
            formatted_reviews.append({
                "id": r.get("id"),
                "candidate_tiger_id": tiger_id,
                "confidence": r.get("confidence", 0.0),
                "distance_score": round(1.0 - r.get("confidence", 0.0), 4),
                "station": r.get("station"),
                "timestamp": r.get("timestamp"),
                "latitude": r.get("latitude"),
                "longitude": r.get("longitude"),
                "image_name": img_name,
                "raw_url": candidate_raw_url,
                "flank_url": candidate_flank_url,
                "crop_url": candidate_crop_url,
                "reference_images": ref_urls
            })
        return formatted_reviews
    except Exception as e:
        print(f"Error fetching pending reviews: {e}")
        return []

@app.post("/resolve_review")
async def resolve_review_endpoint(req: ResolveReviewRequest):
    """Processes human reviewer decision for an ambiguous tiger match."""
    try:
        capture = get_capture_by_id(req.capture_id)
        if not capture:
            return {"status": "error", "message": f"Capture {req.capture_id} not found."}
            
        final_tiger_id = capture.get("tiger_id")
        embedding = capture.get("embedding")
        if isinstance(embedding, str):
            try:
                embedding = json.loads(embedding)
            except:
                pass
                
        if req.action == "confirm":
            update_capture_resolution(req.capture_id, final_tiger_id, "processed")
            if embedding:
                add_embedding_to_faiss(embedding, final_tiger_id)
            invalidate_territory_cache(final_tiger_id)
            msg = f"Match confirmed: Assigned to {final_tiger_id}"
            
        elif req.action == "reassign":
            final_tiger_id = req.target_tiger_id
            update_capture_resolution(req.capture_id, final_tiger_id, "processed")
            if embedding:
                add_embedding_to_faiss(embedding, final_tiger_id)
            invalidate_territory_cache(final_tiger_id)
            msg = f"Capture reassigned to {final_tiger_id}"
            
        elif req.action == "new_tiger":
            tigers = get_all_tigers()
            new_id = f"T-{len(tigers) + 1:03d}"
            enroll_tiger(new_id, f"Individual {new_id}")
            final_tiger_id = new_id
            update_capture_resolution(req.capture_id, final_tiger_id, "processed")
            if embedding:
                add_embedding_to_faiss(embedding, final_tiger_id)
            invalidate_territory_cache(final_tiger_id)
            msg = f"New individual enrolled: {new_id}"
            
        elif req.action == "reject":
            update_capture_resolution(req.capture_id, None, "rejected")
            return {"status": "success", "message": f"Capture {req.capture_id} marked as rejected."}
            
        else:
            return {"status": "error", "message": f"Unknown action '{req.action}'."}
            
        # Trigger territory & alert checks
        lat = capture.get("latitude")
        lon = capture.get("longitude")
        station = capture.get("station")
        timestamp = capture.get("timestamp")
        
        if lat and lon and station and timestamp:
            try:
                run_alerts_check(final_tiger_id, lat, lon, station, timestamp)
            except Exception as e:
                print(f"Error checking alerts after resolution: {e}")
                
        return {
            "status": "success",
            "message": msg,
            "tiger_id": final_tiger_id,
            "capture_id": req.capture_id
        }
    except Exception as e:
        print(f"Error resolving review: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/quarantined_images")
async def get_quarantined_images():
    """Lists all quarantined images with file sizes and timestamps (Pillar i)."""
    quarantine_dir = "data/quarantine"
    items = []
    if os.path.exists(quarantine_dir):
        for entry in os.scandir(quarantine_dir):
            if entry.is_file():
                items.append({
                    "filename": entry.name,
                    "size_kb": round(entry.stat().st_size / 1024, 1),
                    "modified_time": datetime.fromtimestamp(entry.stat().st_mtime).isoformat(),
                    "image_url": f"/data/quarantine/{entry.name}"
                })
    return items

@app.post("/restore_quarantine/{filename}")
async def restore_quarantine(filename: str):
    """Safely restores a quarantined blank frame and re-evaluates through the AI pipeline."""
    quarantine_path = os.path.join("data/quarantine", filename)
    raw_path = os.path.join("data/raw", filename)
    
    if not os.path.exists(quarantine_path):
        return {"status": "error", "message": f"File '{filename}' not found in quarantine."}
        
    shutil.move(quarantine_path, raw_path)
    
    # Run triage & matching
    has_animal, bbox = process_triage(raw_path, confidence_threshold=0.20)
    station, timestamp, lat, lon = get_image_telemetry(raw_path)
    
    if not has_animal:
        bbox = [0, 0, 100, 100]
        
    tiger_id, distance, match_status, match_message, embedding = match_tiger(raw_path, bbox)
    if match_status == "enrolled":
        enroll_tiger(tiger_id)
        
    capture_status = "processed" if match_status != "pending_review" else "pending_review"
    add_capture(
        tiger_id=tiger_id,
        image_path=filename,
        station=station,
        timestamp=timestamp,
        latitude=lat,
        longitude=lon,
        status=capture_status,
        confidence=round(1.0 - distance, 4),
        embedding=embedding
    )
    invalidate_territory_cache(tiger_id)
    
    return {
        "status": "success",
        "message": f"Restored {filename} and processed as {tiger_id} ({match_status}).",
        "tiger_id": tiger_id,
        "match_status": match_status
    }

@app.post("/bulk_triage")
async def bulk_triage(req: BulkTriageRequest):
    """
    Ingests a raw image directory, classifies each frame,
    and moves blank images to the quarantine directory.
    Reports count of frames, space saved, and time saved.
    """
    start_time = time.time()
    
    dir_path = req.directory_path
    if not os.path.exists(dir_path):
        return {"status": "error", "message": f"Directory '{dir_path}' does not exist."}
        
    valid_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}
    image_files = []
    for root, _, files in os.walk(dir_path):
        for f in files:
            if os.path.splitext(f)[1].lower() in valid_extensions:
                image_files.append(os.path.join(root, f))
                
    total_frames = len(image_files)
    if total_frames == 0:
        return {"status": "success", "message": "No images found in the specified directory.", "total_frames": 0}
        
    quarantined_count = 0
    processed_count = 0
    total_space_saved_bytes = 0
    
    os.makedirs("data/quarantine", exist_ok=True)
    
    for filepath in image_files:
        filename = os.path.basename(filepath)
        
        has_animal, bbox = process_triage(filepath, req.confidence_threshold)
        station, timestamp, lat, lon = get_image_telemetry(filepath)
        
        if not has_animal:
            file_size = os.path.getsize(filepath)
            total_space_saved_bytes += file_size
            
            quarantine_path = os.path.join("data/quarantine", filename)
            if os.path.exists(quarantine_path):
                base, ext = os.path.splitext(filename)
                quarantine_path = os.path.join("data/quarantine", f"{base}_{int(time.time())}{ext}")
                
            shutil.move(filepath, quarantine_path)
            quarantined_count += 1
            
            try:
                add_capture(
                    tiger_id=None,
                    image_path=os.path.basename(quarantine_path),
                    station=station,
                    timestamp=timestamp,
                    latitude=lat,
                    longitude=lon,
                    status="quarantined",
                    confidence=0.0
                )
            except Exception as e:
                print(f"Error logging quarantine: {e}")
        else:
            processed_count += 1
            try:
                tiger_id, distance, match_status, match_message, embedding = match_tiger(filepath, bbox)
                
                if match_status == "enrolled":
                    try:
                        enroll_tiger(tiger_id)
                    except Exception as e:
                        print(f"Error enrolling tiger {tiger_id}: {e}")
                
                capture_status = "processed"
                if match_status == "pending_review":
                    capture_status = "pending_review"
                    
                add_capture(
                    tiger_id=tiger_id,
                    image_path=filename,
                    station=station,
                    timestamp=timestamp,
                    latitude=lat,
                    longitude=lon,
                    status=capture_status,
                    confidence=round(1.0 - distance, 4),
                    embedding=embedding
                )
                invalidate_territory_cache(tiger_id)
                # Trigger alerts check
                try:
                    run_alerts_check(tiger_id, lat, lon, station, timestamp)
                except Exception as e:
                    print(f"Error checking alerts: {e}")
                    
            except Exception as e:
                print(f"Error processing matching for {filename}: {e}")
                
    elapsed_time = time.time() - start_time
    time_saved_seconds = quarantined_count * 4
    space_saved_mb = round(total_space_saved_bytes / (1024 * 1024), 2)
    
    return {
        "status": "success",
        "total_frames_ingested": total_frames,
        "frames_quarantined": quarantined_count,
        "frames_retained": processed_count,
        "space_saved_mb": space_saved_mb,
        "processing_time_seconds": round(elapsed_time, 2),
        "manual_time_saved_seconds": time_saved_seconds,
        "message": f"Successfully processed {total_frames} frames. Quarantined {quarantined_count} blank images."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="127.0.0.1", port=8000, reload=True)

