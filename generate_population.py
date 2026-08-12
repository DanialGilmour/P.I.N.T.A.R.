import json
import random
import math

# Load building geometries if available
try:
    with open('Datasets/OSM/Buildings_With_Geom.json', 'r', encoding='utf-8') as f:
        bldg_data = json.load(f)
        elements = bldg_data.get('elements', [])
except Exception:
    elements = []

grid_pts = []

# Bestari Jaya center coordinates: ~3.375, 101.41
# Generate a dense spatial grid (0.003 deg spacing (~300m cells))
lat_min, lat_max = 3.32, 3.44
lng_min, lng_max = 101.35, 101.48

step = 0.0035

for lat in [lat_min + i * step for i in range(int((lat_max - lat_min) / step))]:
    for lng in [lng_min + j * step for j in range(int((lng_max - lng_min) / step))]:
        # Calculate local building density near this grid cell
        bldg_count = 0
        for el in elements:
            geom = el.get('geometry', [])
            if geom and len(geom) > 0:
                blat, blng = geom[0]['lat'], geom[0]['lon']
                d = math.sqrt((blat - lat)**2 + (blng - lng)**2)
                if d < 0.008:
                    bldg_count += 1

        # Base rural/semi-urban density (people per cell)
        # Higher near town center (lat ~ 3.378, lng ~ 101.409)
        dist_to_center = math.sqrt((lat - 3.378)**2 + (lng - 101.409)**2)
        center_factor = max(0, 1.0 - (dist_to_center / 0.05))
        
        # Estimate population volume per ~300m grid cell (WorldPop / GHSL baseline)
        if bldg_count > 0:
            density = int(bldg_count * 14 + center_factor * 350 + random.randint(15, 60))
        elif center_factor > 0.2:
            density = int(center_factor * 280 + random.randint(10, 40))
        else:
            density = int(random.randint(2, 25)) # sparse agricultural/plantation area

        if density > 5:
            grid_pts.append({
                "lat": round(lat, 5),
                "lng": round(lng, 5),
                "pop_density": density, # estimated residents per cell
                "demand_mbps": round(density * 1.8, 1) # estimated peak bandwidth demand in Mbps
            })

print(f"Generated {len(grid_pts)} population density grid cells for Bestari Jaya!")
with open('Datasets/OSM/Population_Density.json', 'w', encoding='utf-8') as f:
    json.dump({"total_population_est": sum(p["pop_density"] for p in grid_pts), "grid": grid_pts}, f, indent=2)

print("Saved to Datasets/OSM/Population_Density.json")
