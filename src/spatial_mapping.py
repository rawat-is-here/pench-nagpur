import os
import pandas as pd
import numpy as np
import geopandas as gpd
from shapely.geometry import MultiPoint, Polygon
from src.db import get_db, get_all_tigers, get_tiger

# Thread-safe in-memory cache for computed territories
_territory_cache = {}

def invalidate_territory_cache(tiger_id=None):
    """Invalidates the territory cache for a specific tiger, or all tigers."""
    global _territory_cache
    if tiger_id:
        _territory_cache.pop(tiger_id, None)
    else:
        _territory_cache.clear()

def _compute_geometry_from_points(points, tiger_id, tiger_alias="Tiger", sector="Pench Core Sanctuary", zone="Core Zone"):
    """Core mathematical engine to compute MCP polygon, centroid, and centroid radius from points."""
    if not points or len(points) == 0:
        return 0.0, None, 0.0, 0.0, [], [], tiger_alias, sector, zone

    capture_points = [
        {
            "lat": float(p["latitude"]), 
            "lon": float(p["longitude"]), 
            "station": p.get("station", "CAMERA_NODE"), 
            "timestamp": p.get("timestamp", ""),
            "image_name": os.path.basename(p.get("image_path", "")) if p.get("image_path") else ""
        } 
        for p in points
    ]
    
    lats = [float(p["latitude"]) for p in points]
    lons = [float(p["longitude"]) for p in points]
    
    df_pts = pd.DataFrame({"latitude": lats, "longitude": lons})
    gdf = gpd.GeoDataFrame(
        df_pts, 
        geometry=gpd.points_from_xy(df_pts.longitude, df_pts.latitude),
        crs="EPSG:4326"
    )
    gdf_metric = gdf.to_crs(epsg=32644)
    multipoint = MultiPoint(gdf_metric.geometry.tolist())
    
    mcp = multipoint.convex_hull
    centroid_metric = mcp.centroid
    centroid_gps = gpd.GeoSeries([centroid_metric], crs="EPSG:32644").to_crs(epsg=4326).iloc[0]
    centroid = {"lat": round(float(centroid_gps.y), 6), "lon": round(float(centroid_gps.x), 6)}
    
    dists = [centroid_metric.distance(geom) for geom in gdf_metric.geometry]
    max_dist = max(dists) if dists else 800.0
    
    if not isinstance(mcp, Polygon) or len(points) < 3:
        buffered_metric = mcp.buffer(1200.0)
        area_sqkm = round(buffered_metric.area / 1_000_000, 2)
        radius_meters = round(max(max_dist * 1.25, 1200.0), 1)
        radius_km = round(radius_meters / 1000.0, 2)
        
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
        
    area_sqkm = round(mcp.area / 1_000_000, 2)
    radius_meters = round(max(max_dist * 1.15, np.sqrt(max(area_sqkm, 1.0) * 1_000_000 / np.pi), 900.0), 1)
    radius_km = round(radius_meters / 1000.0, 2)
    
    exterior_coords = list(mcp.exterior.coords)
    boundary_gdf = gpd.GeoDataFrame(
        geometry=[Polygon(exterior_coords)],
        crs="EPSG:32644"
    ).to_crs(epsg=4326)
    
    boundary_polygon = list(boundary_gdf.geometry.iloc[0].exterior.coords)
    polygon_gps = [[round(coord[1], 6), round(coord[0], 6)] for coord in boundary_polygon]
    
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

def calculate_territory(tiger_id):
    """Fetches captures for a single tiger from Supabase and calculates its home range."""
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
            cached.get("sector", "Pench Reserve"),
            cached.get("zone", "Core Zone")
        )

    db = get_db()
    points = []
    tiger_alias = f"Tiger {tiger_id}"
    
    try:
        tiger_info = get_tiger(tiger_id)
        if tiger_info and tiger_info.get("name"):
            tiger_alias = tiger_info.get("name")
    except Exception:
        pass

    if db:
        try:
            res = db.table("captures")\
                    .select("latitude, longitude, station, timestamp, image_path")\
                    .eq("tiger_id", tiger_id)\
                    .eq("status", "processed")\
                    .execute()
            if res.data:
                points = [
                    p for p in res.data 
                    if p.get("latitude") is not None and p.get("longitude") is not None
                ]
        except Exception as e:
            print(f"Error querying captures for tiger {tiger_id}: {e}")

    return _compute_geometry_from_points(points, tiger_id, tiger_alias)

def get_all_territories_data():
    """
    Computes territory polygons, centroids, radii, and capture points for all tigers
    using a single high-performance batch query from Supabase.
    """
    db = get_db()
    if not db:
        return []
        
    try:
        tigers_res = db.table("tigers").select("*").execute()
        tigers_map = {t["id"]: t.get("name", f"Tiger {t['id']}") for t in (tigers_res.data or [])}
        
        captures_res = db.table("captures")\
                         .select("tiger_id, latitude, longitude, station, timestamp, image_path")\
                         .eq("status", "processed")\
                         .execute()
                         
        captures = captures_res.data or []
        if not captures:
            return []
            
        # Group captures by tiger_id
        grouped = {}
        for c in captures:
            t_id = c.get("tiger_id")
            if not t_id or c.get("latitude") is None or c.get("longitude") is None:
                continue
            if t_id not in grouped:
                grouped[t_id] = []
            grouped[t_id].append(c)
            
        results = []
        for t_id, pts in grouped.items():
            alias = tigers_map.get(t_id, f"Tiger {t_id}")
            area, centroid, radius_m, radius_km, poly, capture_points, _, sector, zone = _compute_geometry_from_points(
                pts, t_id, alias
            )
            if centroid is not None and len(capture_points) > 0:
                results.append({
                    "tiger_id": t_id,
                    "tiger_alias": alias,
                    "core_area_sqkm": area,
                    "centroid": centroid,
                    "radius_meters": radius_m,
                    "radius_km": radius_km,
                    "polygon": poly,
                    "capture_points": capture_points,
                    "sector": sector,
                    "zone": zone
                })
                
        return sorted(results, key=lambda x: x["tiger_id"])
    except Exception as e:
        print(f"Error computing all territories in batch: {e}")
        return []

def get_territory_overlaps():
    """Calculates territorial overlaps between active territories. Returns [] when empty."""
    territories = get_all_territories_data()
    if not territories or len(territories) < 2:
        return []
        
    geometries = {}
    for t in territories:
        poly_coords = t.get("polygon", [])
        if len(poly_coords) >= 3:
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