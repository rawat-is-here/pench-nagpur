import os
import json
import pandas as pd
from src.db import enroll_tiger, add_capture, add_alert, get_db

def seed():
    print("==================================================")
    print("[INFO] Seeding Pench Tiger Reserve Display Dataset (30 Tigers, 90 Captures)")
    print("==================================================")
    db = get_db()
    if not db:
        print("❌ Supabase DB connection failed.")
        return
        
    csv_path = "data/display_dataset/locations_90.csv"
    json_path = "data/display_dataset/metadata.json"
    
    if not os.path.exists(csv_path):
        print(f"❌ Could not find {csv_path}")
        return

    # 1. Clean existing records
    print("Clearing existing database records for fresh seed...")
    try:
        db.table("alerts").delete().neq("id", 0).execute()
        db.table("captures").delete().neq("id", 0).execute()
        db.table("tigers").delete().neq("id", "none").execute()
    except Exception as e:
        print("Database cleanup note:", e)

    # 2. Read dataset
    df = pd.read_csv(csv_path)
    with open(json_path, "r", encoding="utf-8") as f:
        meta_list = json.load(f)
        
    # Group unique tigers
    tigers_grouped = df.groupby("tiger_id").first().reset_index()
    
    print(f"Enrolling {len(tigers_grouped)} unique resident tigers into Supabase...")
    for _, row in tigers_grouped.iterrows():
        t_id = row["tiger_id"]
        alias = row["tiger_alias"]
        enroll_tiger(t_id, alias)
        
    print(f"Seeding {len(df)} telemetry captures across Pench camera trap grid...")
    for idx, row in df.iterrows():
        add_capture(
            tiger_id=row["tiger_id"],
            image_path=row["image_name"],
            station=row["station_id"],
            timestamp=row["timestamp"],
            latitude=float(row["latitude"]),
            longitude=float(row["longitude"]),
            status="processed",
            confidence=0.96
        )

    # 3. Add ambiguous sightings for Human-in-the-Loop demonstration
    print("Seeding Human-in-the-Loop pending reviews...")
    pending_items = [
        {
            "tiger_id": "T-001",
            "image_path": "T-001_1.jpg",
            "station": "STATION_TR02",
            "timestamp": "2026-08-16T14:20:00Z",
            "latitude": 21.654,
            "longitude": 79.206,
            "confidence": 0.73
        },
        {
            "tiger_id": "T-007",
            "image_path": "T-007_2.jpg",
            "station": "STATION_KJ05",
            "timestamp": "2026-08-16T18:45:00Z",
            "latitude": 21.701,
            "longitude": 79.265,
            "confidence": 0.68
        },
        {
            "tiger_id": "T-020",
            "image_path": "T-020_3.jpg",
            "station": "STATION_KM03",
            "timestamp": "2026-08-17T02:10:00Z",
            "latitude": 21.615,
            "longitude": 79.162,
            "confidence": 0.71
        }
    ]
    for p in pending_items:
        add_capture(
            tiger_id=p["tiger_id"],
            image_path=p["image_path"],
            station=p["station"],
            timestamp=p["timestamp"],
            latitude=p["latitude"],
            longitude=p["longitude"],
            status="pending_review",
            confidence=p["confidence"]
        )

    # 4. Add operational alerts
    print("Seeding tactical reserve alerts...")
    alerts = [
        {
            "tiger_id": "T-010",
            "alert_type": "BUFFER_PROXIMITY",
            "severity": "WARNING",
            "message": "BUFFER ZONE PROXIMITY: Tiger T-010 (Bawanthadi Roamer) detected near agricultural fringes (Station STATION_KJ14).",
            "evidence": {"station": "STATION_KJ14", "zone": "Buffer Zone", "sector": "Karmajhiri East Buffer (MP)"}
        },
        {
            "tiger_id": "T-027",
            "alert_type": "CORRIDOR_CROSSING",
            "severity": "CRITICAL",
            "message": "HIGHWAY CORRIDOR CROSSING: Tiger T-027 (Paoni Trail Sovereign) moving across NH-44 Paoni Underpass.",
            "evidence": {"station": "STATION_SG08", "zone": "Corridor Zone", "sector": "Paoni Highway Corridor (MH)"}
        },
        {
            "tiger_id": "T-002",
            "alert_type": "RANGE_SHIFT",
            "severity": "WARNING",
            "message": "RANGE SHIFT DETECTED: Tiger T-002 centroid shifted 3.8 km towards Ghatpendari River confluence.",
            "evidence": {"station": "STATION_TR06", "shift_km": 3.8, "sector": "Turia - Ghatpendari Overlap"}
        }
    ]
    for a in alerts:
        add_alert(
            tiger_id=a["tiger_id"],
            alert_type=a["alert_type"],
            severity=a["severity"],
            message=a["message"],
            evidence=a["evidence"]
        )

    print("[SUCCESS] Database seeding complete! 30 resident tigers, 93 captures, and 3 active alerts created.")

if __name__ == "__main__":
    seed()

