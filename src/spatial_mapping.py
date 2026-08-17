import os
import pandas as pd
import numpy as np
import geopandas as gpd
from shapely.geometry import MultiPoint, Polygon
from src.db import get_db

# Thread-safe in-memory cache for territories
_territory_cache = {}

# Fallback dataset loader from data/display_dataset/locations_90.csv
_dataset_df = None

def _get_dataset_df():
    global _dataset_df
    if _dataset_df is None:
        csv_path = os.path.join("data", "display_dataset", "locations_90.csv")
        if os.path.exists(csv_path):
            try:
                _dataset_df = pd.read_csv(csv_path)
            except Exception as e:
                print(f"Error loading display dataset CSV: {e}")
    return _dataset_df

def invalidate_territory_cache(tiger_id=None):
    """Invalidates the territory cache for a specific tiger, or all tigers."""
    global _territory_cache
    if tiger_id:
        _territory_cache.pop(tiger_id, None)
        print(f"Invalidated territory cache for tiger {tiger_id}")
    else:
        _territory_cache.clear()
        print("Invalidated all territory caches")

def calculate_territory(tiger_id):
    """
    Fetches captures for a tiger from Supabase (or fallback display dataset) and calculates:
    - area_in_sqkm: float
    - centroid_dict: {"lat": float, "lon": float}
    - radius_meters: float (home range buffer radius centered on the centroid)
    - radius_km: float
    - polygon_coordinates: list of [lat, lon] pairs for Leaflet mapping
    - capture_points: list of dicts containing lat, lon, station, timestamp, image_name
    - tiger_alias: str
    - sector: str
    - zone: str
    """
    global _territory_cache
    if tiger_id in _territory_cache:
        cached = _territory_cache[tiger_id]
        return (
            cached["area"], 
            cached["centroid"], 
            cached["radius_meters"],
            cached["radius_km"],
            cached["polygon"], 
            cached.get("capture_points", []),
            cached.get("tiger_alias", f"Tiger {tiger_id}"),
            cached.get("sector", "Pench National Park"),
            cached.get("zone", "Core Zone")
        )

    db = get_db()
    points = []
    tiger_alias = f"Tiger {tiger_id}"
    sector = "Pench Reserve"
    zone = "Core Zone"
    
    # 1. Try querying Supabase
    if db:
        try:
            res = db.table("captures")\
                    .select("latitude, longitude, station, timestamp, image_path")\
                    .eq("tiger_id", tiger_id)\
                    .eq("status", "processed")\
                    .execute()
            if res.data and len(res.data) > 0:
                points = res.data
        except Exception as e:
            print(f"Database query note for tiger {tiger_id}: {e}")

    # 2. If no points from DB, load from display dataset CSV
    df = _get_dataset_df()
    if (not points or len(points) == 0) and df is not None:
        tiger_rows = df[df["tiger_id"] == tiger_id]
        if not tiger_rows.empty:
            tiger_alias = tiger_rows.iloc[0].get("tiger_alias", tiger_alias)
            sector = tiger_rows.iloc[0].get("sector", sector)
            zone = tiger_rows.iloc[0].get("zone", zone)
            for _, r in tiger_rows.iterrows():
                points.append({
                    "latitude": float(r["latitude"]),
                    "longitude": float(r["longitude"]),
                    "station": str(r["station_id"]),
                    "timestamp": str(r["timestamp"]),
                    "image_path": str(r["image_name"])
                })

    if not points:
        # Default fallback
        fallback_centroid = {"lat": 21.650, "lon": 79.200}
        return 0.0, fallback_centroid, 1200.0, 1.20, [], [], tiger_alias, sector, zone
        
    capture_points = [
        {
            "lat": float(p["latitude"]), 
            "lon": float(p["longitude"]), 
            "station": p.get("station", "STATION_UNKNOWN"), 
            "timestamp": p.get("timestamp", ""),
            "image_name": p.get("image_path", "")
        } 
        for p in points
    ]
    
    lats = [float(p["latitude"]) for p in points]
    lons = [float(p["longitude"]) for p in points]
    
    # Project to metric system (UTM Zone 44N covers Central India: Pench)
    df_pts = pd.DataFrame({"latitude": lats, "longitude": lons})
    gdf = gpd.GeoDataFrame(
        df_pts, 
        geometry=gpd.points_from_xy(df_pts.longitude, df_pts.latitude),
        crs="EPSG:4326"
    )
    gdf_metric = gdf.to_crs(epsg=32644)
    multipoint = MultiPoint(gdf_metric.geometry.tolist())
    
    # Convex Hull
    mcp = multipoint.convex_hull
    centroid_metric = mcp.centroid
    centroid_gps = gpd.GeoSeries([centroid_metric], crs="EPSG:32644").to_crs(epsg=4326).iloc[0]
    centroid = {"lat": round(float(centroid_gps.y), 6), "lon": round(float(centroid_gps.x), 6)}
    
    # Calculate distances from centroid to all capture points
    dists = [centroid_metric.distance(geom) for geom in gdf_metric.geometry]
    max_dist = max(dists) if dists else 800.0
    
    # If the convex hull is a Point or LineString (collinear points or < 3 points)
    if not isinstance(mcp, Polygon) or len(points) < 3:
        # Buffer the point / line by 1200m
        buffered_metric = mcp.buffer(1200.0)
        area_sqkm = round(buffered_metric.area / 1_000_000, 2)
        radius_meters = round(max(max_dist * 1.25, 1200.0), 1)
        radius_km = round(radius_meters / 1000.0, 2)
        
        # Project buffered boundary to GPS
        boundary_gdf = gpd.GeoDataFrame(geometry=[buffered_metric], crs="EPSG:32644").to_crs(epsg=4326)
        coords = list(boundary_gdf.geometry.iloc[0].exterior.coords)
        polygon_gps = [[round(c[1], 6), round(c[0], 6)] for c in coords]
        
        result = {
            "area": area_sqkm,
            "centroid": centroid,
            "radius_meters": radius_meters,
            "radius_km": radius_km,
            "polygon": polygon_gps,
            "capture_points": capture_points,
            "tiger_alias": tiger_alias,
            "sector": sector,
            "zone": zone
        }
        _territory_cache[tiger_id] = result
        return area_sqkm, centroid, radius_meters, radius_km, polygon_gps, capture_points, tiger_alias, sector, zone
        
    # Calculate geometric area in sq km
    area_sqkm = round(mcp.area / 1_000_000, 2)
    
    # Biological home range circular radius on centroid:
    # Buffer the observed convex hull slightly (15-20%) to represent the active home range radius
    radius_meters = round(max(max_dist * 1.15, np.sqrt(max(area_sqkm, 1.0) * 1_000_000 / np.pi), 900.0), 1)
    radius_km = round(radius_meters / 1000.0, 2)
    
    # Project boundary back to GPS (EPSG:4326)
    exterior_coords = list(mcp.exterior.coords)
    boundary_gdf = gpd.GeoDataFrame(
        geometry=[Polygon(exterior_coords)],
        crs="EPSG:32644"
    ).to_crs(epsg=4326)
    
    boundary_polygon = list(boundary_gdf.geometry.iloc[0].exterior.coords)
    # Convert boundary coords from [lon, lat] to [lat, lon] for Leaflet
    polygon_gps = [[round(coord[1], 6), round(coord[0], 6)] for coord in boundary_polygon]
    
    # Cache the result
    result = {
        "area": area_sqkm,
        "centroid": centroid,
        "radius_meters": radius_meters,
        "radius_km": radius_km,
        "polygon": polygon_gps,
        "capture_points": capture_points,
        "tiger_alias": tiger_alias,
        "sector": sector,
        "zone": zone
    }
    _territory_cache[tiger_id] = result
    
    return area_sqkm, centroid, radius_meters, radius_km, polygon_gps, capture_points, tiger_alias, sector, zone

def get_all_territories_data():
    """
    Computes territory polygons, centroids, radii, and capture points for all 30 tigers.
    Returns a comprehensive list of territory objects ready for mapping.
    """
    df = _get_dataset_df()
    if df is not None:
        tiger_ids = sorted(df["tiger_id"].unique().tolist())
    else:
        tiger_ids = [f"T-{i:03d}" for i in range(1, 31)]
        
    results = []
    for t_id in tiger_ids:
        area, centroid, radius_m, radius_km, poly, pts, alias, sector, zone = calculate_territory(t_id)
        results.append({
            "tiger_id": t_id,
            "tiger_alias": alias,
            "core_area_sqkm": area,
            "centroid": centroid,
            "radius_meters": radius_m,
            "radius_km": radius_km,
            "polygon": poly,
            "capture_points": pts,
            "sector": sector,
            "zone": zone
        })
    return results

def get_territory_overlaps():
    """
    Calculates territorial overlaps between all tigers with calculated polygons.
    Returns list of overlap info, including intersection polygon coordinates and area.
    """
    territories = get_all_territories_data()
    geometries = {}
    
    for t in territories:
        poly_coords = t.get("polygon", [])
        if len(poly_coords) >= 3:
            # Convert [lat, lon] to [lon, lat] for Shapely
            lon_lat_coords = [(c[1], c[0]) for c in poly_coords]
            gdf = gpd.GeoDataFrame(geometry=[Polygon(lon_lat_coords)], crs="EPSG:4326").to_crs(epsg=32644)
            geometries[t["tiger_id"]] = (gdf.geometry.iloc[0], t["tiger_alias"])
                
    overlaps = []
    keys = list(geometries.keys())
    for i in range(len(keys)):
        for j in range(i+1, len(keys)):
            t1 = keys[i]
            t2 = keys[j]
            geom1, alias1 = geometries[t1]
            geom2, alias2 = geometries[t2]
            
            if geom1.intersects(geom2):
                intersection = geom1.intersection(geom2)
                if isinstance(intersection, Polygon) and intersection.area > 100:
                    overlap_area = intersection.area / 1_000_000
                    # Project intersection back to GPS to draw
                    boundary_gdf = gpd.GeoDataFrame(geometry=[intersection], crs="EPSG:32644").to_crs(epsg=4326)
                    coords = list(boundary_gdf.geometry.iloc[0].exterior.coords)
                    polygon_gps = [[round(c[1], 6), round(c[0], 6)] for c in coords]
                    
                    overlaps.append({
                        "tiger_1": t1,
                        "alias_1": alias1,
                        "tiger_2": t2,
                        "alias_2": alias2,
                        "overlap_area_sqkm": round(overlap_area, 4),
                        "polygon": polygon_gps
                    })
                    
    return overlaps