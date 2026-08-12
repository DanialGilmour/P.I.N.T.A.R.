import urllib.request
import json
import os

print("Fetching road geometries from Overpass API...")
road_query = """[out:json][timeout:30];
(
  way["highway"](3.32,101.35,3.45,101.48);
);
out geom;"""

headers = {'User-Agent': 'PINTAR_GeoAI/1.0 (contact@team-bolehla.org)'}
req = urllib.request.Request('https://overpass-api.de/api/interpreter', data=road_query.encode('utf-8'), headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        road_data = json.loads(resp.read().decode('utf-8'))
        print(f"Fetched {len(road_data.get('elements', []))} road ways with geometry!")
        with open('Datasets/OSM/Roads_With_Geom.json', 'w', encoding='utf-8') as f:
            json.dump(road_data, f)
        print("Saved to Datasets/OSM/Roads_With_Geom.json")
except Exception as e:
    print("Error fetching roads:", e)

print("Fetching building geometries from Overpass API...")
bldg_query = """[out:json][timeout:30];
(
  way["building"](3.34,101.38,3.42,101.45);
);
out geom 500;"""

req2 = urllib.request.Request('https://overpass-api.de/api/interpreter', data=bldg_query.encode('utf-8'), headers=headers)
try:
    with urllib.request.urlopen(req2) as resp:
        bldg_data = json.loads(resp.read().decode('utf-8'))
        print(f"Fetched {len(bldg_data.get('elements', []))} building geometries!")
        with open('Datasets/OSM/Buildings_With_Geom.json', 'w', encoding='utf-8') as f:
            json.dump(bldg_data, f)
        print("Saved to Datasets/OSM/Buildings_With_Geom.json")
except Exception as e:
    print("Error fetching buildings:", e)
