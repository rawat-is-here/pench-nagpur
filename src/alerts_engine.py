from shapely.geometry import Point
import geopandas as gpd
import pandas as pd
import json
from datetime import datetime, timezone, timedelta
from src.db import get_db, add_alert, get_all_tigers

def is_buffer_station(lat, lon):
    """Core Box: Lat [21.61, 21.71], Lon [79.19, 79.29]. Anything outside is buffer."""
    in_core = (21.61 <= lat <= 21.71) and (79.19 <= lon <= 79.29)
    return not in_core

def is_village_adjacent(lat, lon):
    """Village boundaries near buffer edges: South boundary (< 21.57) or East boundary (> 79.33)."""
    return (lat < 21.57) or (lon > 79.33)

def run_alerts_check(tiger_id, lat, lon, station, timestamp):
    """
    Compares the current capture event to historical baseline and triggers alerts
    for range shifts, first station capture, buffer proximity, or village adjacency.
    """
    db = get_db()
    
    # Fetch captures for this tiger, ordered by timestamp descending
    try:
        if db:
            res = db.table("captures")\
                    .select("id, latitude, longitude, station, timestamp")\
                    .eq("tiger_id", tiger_id)\
                    .eq("status", "processed")\
                    .order("timestamp", desc=True)\
                    .execute()
            captures = res.data
        else:
            captures = []
    except Exception as e:
        print(f"Error querying captures in alerts check: {e}")
        return
        
    if len(captures) <= 1:
        # First capture of this tiger, no baseline to compare against
        return
        
    # Current capture is captures[0]
    # History is captures[1:]
    history = captures[1:]
    
    # 1. Check for range shift (Distance from historical centroid)
    hist_lats = [c["latitude"] for c in history if c.get("latitude") is not None]
    hist_lons = [c["longitude"] for c in history if c.get("longitude") is not None]
    
    if hist_lats and hist_lons:
        df_hist = pd.DataFrame({"latitude": hist_lats, "longitude": hist_lons})
        gdf_hist = gpd.GeoDataFrame(df_hist, geometry=gpd.points_from_xy(df_hist.longitude, df_hist.latitude), crs="EPSG:4326")
        gdf_hist_metric = gdf_hist.to_crs(epsg=32644)
        
        # Calculate union centroid
        centroid_metric = gdf_hist_metric.geometry.union_all().centroid
        
        # Current location
        current_pt = gpd.GeoDataFrame([1], geometry=[Point(lon, lat)], crs="EPSG:4326").to_crs(epsg=32644).geometry.iloc[0]
        
        # Distance in meters
        distance_meters = centroid_metric.distance(current_pt)
        distance_km = distance_meters / 1000.0
        
        is_current_in_buffer = is_buffer_station(lat, lon)
        
        # Thresholds: 5km in buffer, 4km in core (corresponding to ~15-20 sq km area displacement)
        threshold_km = 5.0 if is_current_in_buffer else 4.0
        
        if distance_km >= threshold_km:
            region = "BUFFER" if is_current_in_buffer else "CORE"
            msg = f"RANGE SHIFT DETECTED: Tiger {tiger_id} has deviated {distance_km:.2f} km from its historical core center in the {region} zone."
            evidence = {
                "distance_km": round(distance_km, 2),
                "threshold_km": threshold_km,
                "region": region,
                "station": station,
                "current_location": {"lat": lat, "lon": lon}
            }
            try:
                add_alert(tiger_id, "RANGE_SHIFT", "CRITICAL", msg, evidence)
            except Exception as e:
                print(f"Error adding range shift alert: {e}")



    # 2. Check for first time capture at a new station ID
    history_stations = {c.get("station") for c in history if c.get("station")}
    if station and station not in history_stations:
        is_curr_buffer = is_buffer_station(lat, lon)
        severity = "WARNING" if is_curr_buffer else "INFO"
        msg = f"FIRST-TIME STATION DETECTION: Tiger {tiger_id} recorded at {station} for the first time (Novel Corridor / Territorial Expansion)."
        evidence = {
            "first_time_station": station,
            "total_stations_visited": len(history_stations) + 1,
            "previous_stations": list(history_stations)[:5],
            "is_buffer_zone": is_curr_buffer,
            "location": {"lat": lat, "lon": lon}
        }
        try:
            add_alert(tiger_id, "NEW_STATION_CAPTURE", severity, msg, evidence)
        except Exception as e:
            print(f"Error adding new station alert: {e}")

    # 3. Check for movement into/towards Buffer or Village-adjacent stations
    prev_capture = history[0]
    prev_lat, prev_lon = prev_capture.get("latitude"), prev_capture.get("longitude")
    if prev_lat is not None and prev_lon is not None:
        was_prev_in_core = not is_buffer_station(prev_lat, prev_lon)
        if is_buffer_station(lat, lon) and was_prev_in_core:
            msg = f"CORE TO BUFFER MOVEMENT: Tiger {tiger_id} has moved from core forest into the buffer zone (Station: {station})."
            evidence = {
                "from_station": prev_capture.get("station"),
                "to_station": station,
                "current_location": {"lat": lat, "lon": lon}
            }
            try:
                add_alert(tiger_id, "BUFFER_PROXIMITY", "WARNING", msg, evidence)
            except Exception as e:
                print(f"Error adding core to buffer alert: {e}")
        
    if is_village_adjacent(lat, lon):
        msg = f"VILLAGE ADJACENT CAPTURE: Tiger {tiger_id} detected at {station} close to human settlement borders."
        evidence = {
            "station": station,
            "current_location": {"lat": lat, "lon": lon}
        }
        try:
            add_alert(tiger_id, "VILLAGE_PROXIMITY", "CRITICAL", msg, evidence)
        except Exception as e:
            print(f"Error adding village adjacent alert: {e}")

_last_absence_check_time = None
_cached_absence_alerts = []

def check_prolonged_absences(absence_threshold_days=14, force=False):
    """
    High-performance batch scanner that identifies tigers not recorded across 
    the sensor grid for > absence_threshold_days using optimized batch SQL queries.
    """
    global _last_absence_check_time, _cached_absence_alerts
    now = datetime.now(timezone.utc)
    
    # Throttle automatic execution to once every 2 minutes unless forced
    if not force and _last_absence_check_time:
        if (now - _last_absence_check_time).total_seconds() < 120:
            return _cached_absence_alerts

    db = get_db()
    if not db:
        return []
        
    alerts_raised = []
    try:
        # 1. Single batch query for all processed captures
        captures_res = db.table("captures")\
                         .select("tiger_id, station, timestamp, latitude, longitude")\
                         .eq("status", "processed")\
                         .order("timestamp", desc=True)\
                         .execute()
        captures = captures_res.data or []
        if not captures:
            return []

        # Find latest capture per tiger in memory (O(N))
        latest_by_tiger = {}
        station_recent_activity = {}
        for c in captures:
            t_id = c.get("tiger_id")
            st = c.get("station")
            ts = c.get("timestamp")
            if t_id and t_id not in latest_by_tiger:
                latest_by_tiger[t_id] = c
            if st and st not in station_recent_activity and ts:
                station_recent_activity[st] = ts

        # 2. Single batch query for all active PROLONGED_ABSENCE alerts
        active_alerts_res = db.table("alerts")\
                              .select("tiger_id")\
                              .eq("alert_type", "PROLONGED_ABSENCE")\
                              .eq("resolved", False)\
                              .execute()
        existing_alert_tigers = {a["tiger_id"] for a in (active_alerts_res.data or []) if a.get("tiger_id")}

        # 3. Evaluate each tiger against absence threshold
        for t_id, last_cap in latest_by_tiger.items():
            if t_id in existing_alert_tigers:
                continue

            ts_str = last_cap.get("timestamp")
            if not ts_str:
                continue

            try:
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                days_absent = (now - dt).days

                if days_absent >= absence_threshold_days:
                    station_name = last_cap.get("station")
                    camera_active = False
                    if station_name and station_name in station_recent_activity:
                        last_st_ts = station_recent_activity[station_name]
                        try:
                            st_dt = datetime.fromisoformat(last_st_ts.replace("Z", "+00:00"))
                            if (now - st_dt).days <= 7:
                                camera_active = True
                        except Exception:
                            camera_active = True

                    survey_check = "CONFIRMED: Camera station is operating normally." if camera_active else "SUSPECTED ARTEFACT: Sensor station might be inactive."
                    confidence = 0.90 if camera_active else 0.40
                    severity = "WARNING" if camera_active else "INFO"

                    msg = f"PROLONGED ABSENCE ALERT: Tiger {t_id} has not been recorded across the sensor grid for {days_absent} days (Last seen: {station_name})."
                    evidence = {
                        "days_absent": days_absent,
                        "last_seen_station": station_name,
                        "last_seen_timestamp": ts_str,
                        "last_location": {
                            "lat": last_cap.get("latitude"),
                            "lon": last_cap.get("longitude")
                        },
                        "survey_artefact_check": survey_check,
                        "confidence": confidence
                    }
                    add_alert(t_id, "PROLONGED_ABSENCE", severity, msg, evidence)
                    alerts_raised.append({"tiger_id": t_id, "days_absent": days_absent})
            except Exception as ex:
                print(f"Error parsing timestamp for tiger {t_id}: {ex}")

        _last_absence_check_time = now
        _cached_absence_alerts = alerts_raised
    except Exception as e:
        print(f"Error checking prolonged absences: {e}")
        
    return alerts_raised

def check_deviation(tiger_id, lat, lon):
    """
    Checks range deviation for a single coordinate ping.
    Maintains compatibility with existing REST endpoints.
    """
    db = get_db()
    try:
        if db:
            res = db.table("captures")\
                    .select("latitude, longitude")\
                    .eq("tiger_id", tiger_id)\
                    .eq("status", "processed")\
                    .execute()
            points = res.data
        else:
            points = []
    except Exception as e:
        print(f"Error fetching captures for check_deviation: {e}")
        points = []
        
    if not points:
        return "NORMAL", 0.0
        
    df_hist = pd.DataFrame(points)
    gdf_hist = gpd.GeoDataFrame(df_hist, geometry=gpd.points_from_xy(df_hist.longitude, df_hist.latitude), crs="EPSG:4326")
    gdf_hist_metric = gdf_hist.to_crs(epsg=32644)
    centroid_metric = gdf_hist_metric.geometry.union_all().centroid
    
    current_pt = gpd.GeoDataFrame([1], geometry=[Point(lon, lat)], crs="EPSG:4326").to_crs(epsg=32644).geometry.iloc[0]
    distance_meters = centroid_metric.distance(current_pt)
    distance_km = distance_meters / 1000.0
    
    # Call run_alerts_check to log alerts if any
    run_alerts_check(tiger_id, lat, lon, "GPS_PING", datetime.now(timezone.utc).isoformat())
    
    is_buffer = is_buffer_station(lat, lon)
    threshold_km = 5.0 if is_buffer else 4.0
    
    if distance_km >= threshold_km or is_village_adjacent(lat, lon):
        return "CRITICAL", distance_km
        
    return "NORMAL", distance_km