from src.db import get_db

try:
    db = get_db()
    print("Testing Supabase connection...")
    if db:
        tigers = db.table("tigers").select("id", count="exact").execute()
        captures = db.table("captures").select("id", count="exact").execute()
        alerts = db.table("alerts").select("id", count="exact").execute()
        print(f"Connection successful!")
        print(f"Tigers count: {tigers.count if hasattr(tigers, 'count') else len(tigers.data)}")
        print(f"Captures count: {captures.count if hasattr(captures, 'count') else len(captures.data)}")
        print(f"Alerts count: {alerts.count if hasattr(alerts, 'count') else len(alerts.data)}")
    else:
        print("Database client is None.")
except Exception as e:
    print("Connection failed:", e)

