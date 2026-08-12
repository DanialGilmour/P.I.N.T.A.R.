// ============================================================
// P.I.N.T.A.R. — Multi-Regional GeoAI Telco Allocation Platform
// Team Bolehla | ASEAN GeoAI Fusion 2026
// Multi-Objective Tower Allocation & Risk Optimization
// Districts Supported: Kuala Selangor (Selangor) & Kuala Krai (Kelantan)
// ============================================================

(function () {
    'use strict';

    // ---- Restore saved theme preference ----
    const savedTheme = localStorage.getItem('pintar-theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

    // ---- Regional Configurations ----
    const REGIONS = {
        'kuala_selangor': {
            id: 'kuala_selangor',
            name: 'Kuala Selangor, Selangor',
            shortName: 'Kuala Selangor',
            subText: 'Kuala Selangor GeoAI',
            overviewTitle: 'Regional Overview (Kuala Selangor)',
            center: [3.35, 101.25],
            zoom: 11,
            latMin: 3.20, latMax: 3.65, lngMin: 101.08, lngMax: 101.55,
            defaultPop: 95359,
            defaultBldg: 31200,
            files: {
                population: 'Datasets/Kuala Selangor/WorldPop Population/WorldPop_Malaysia_Population_CSV.csv',
                flood: 'Datasets/Kuala Selangor/Flood Footprints/Sentinel1_Flood_Footprints_CSV.csv',
                dem: 'Datasets/Kuala Selangor/DEM/SRTM_DEM_Slope_Points_CSV.csv',
                telco: 'Datasets/Kuala Selangor/Existing Telco Tower/Telco Network.json',
                infra: 'Datasets/Kuala Selangor/OSM/Critical Infrastucture.json',
                buildings: 'Datasets/Kuala Selangor/OSM/Buildings_With_Geom.json',
                roads: 'Datasets/Kuala Selangor/OSM/Roads_With_Geom.json'
            }
        },
        'kuala_krai': {
            id: 'kuala_krai',
            name: 'Kuala Krai, Kelantan',
            shortName: 'Kuala Krai (Kelantan)',
            subText: 'Kuala Krai GeoAI',
            overviewTitle: 'Regional Overview (Kuala Krai, Kelantan)',
            center: [5.53, 102.20],
            zoom: 11,
            latMin: 5.00, latMax: 6.10, lngMin: 101.70, lngMax: 102.70,
            defaultPop: 109400,
            defaultBldg: 42500,
            files: {
                population: 'Datasets/Kelantan/WorldPop/WorldPop_Kelantan_Population_CSV.csv',
                flood: 'Datasets/Kelantan/Flood Footprints/Sentinel1_Flood_Footprints_Kelantan_CSV.csv',
                dem: 'Datasets/Kelantan/DEM/SRTM_DEM_Slope_Points_Kelantan_CSV.csv',
                telco: 'Datasets/Kelantan/Telco Network/Existing Telco Netwok.json',
                infra: 'Datasets/Kelantan/OSM/Critical Infrastructure.json',
                buildings: 'Datasets/Kelantan/OSM/Building.json',
                roads: 'Datasets/Kelantan/OSM/Road Network.json'
            }
        }
    };

    // ---- Application State ----
    const STATE = {
        activeRegion: 'kuala_selangor',
        demData: [],
        floodData: [],
        populationData: [],
        totalPopulation: 0,
        telcoData: [],
        buildingCount: 0,
        buildingGeoms: [],
        roadGeoms: [],
        infraData: [],
        candidateSites: [],
        map: null,
        layers: {},
        baseMaps: {},
        heatLayer: null,
        heatVisible: false,
        elevChartInstance: null,
        riskChartInstance: null
    };

    // ---- DOM Helpers ----
    const $ = id => document.getElementById(id);

    function lerp(a, b, t) { return a + (b - a) * t; }

    function dist(a, b) {
        const dx = a[0] - b[0], dy = a[1] - b[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Haversine distance in kilometers for precise geospatial radius checks
    function distKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function setLoader(pct, msg) {
        if ($('loader-fill')) $('loader-fill').style.width = pct + '%';
        if ($('loader-status')) $('loader-status').textContent = msg;
    }

    // ---- Fast CSV Parsing Functions ----
    function parseWorldPop(text) {
        const lines = text.trim().split('\n');
        const pts = [];
        let totalPop = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length < 4) continue;
            const lat = parseFloat(parts[1]);
            const lng = parseFloat(parts[2]);
            const pop = parseFloat(parts[3]);
            if (isNaN(lat) || isNaN(lng) || isNaN(pop)) continue;
            
            totalPop += pop;
            if (pop > 0.01) {
                pts.push({ lat, lng, pop: Math.round(pop * 10) / 10 });
            }
        }
        return { pts, totalPop: Math.round(totalPop) };
    }

    function parseDEMCSV(text) {
        const lines = text.trim().split('\n');
        const pts = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length < 5) continue;
            const elev = parseFloat(parts[1]);
            const lat = parseFloat(parts[2]);
            const lng = parseFloat(parts[3]);
            const slope = parseFloat(parts[4]);
            if (isNaN(lat) || isNaN(lng) || isNaN(elev)) continue;
            pts.push({ lat, lng, elev, slope: isNaN(slope) ? 0 : slope });
        }
        return pts;
    }

    function parseFloodCSV(text) {
        const lines = text.trim().split('\n');
        const pts = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length < 4) continue;
            const isFlood = parseInt(parts[1]);
            const lat = parseFloat(parts[2]);
            const lng = parseFloat(parts[3]);
            if (isNaN(lat) || isNaN(lng)) continue;
            if (isFlood === 1) {
                pts.push({ lat, lng });
            }
        }
        return pts;
    }

    // ---- Data Loading Pipeline ----
    async function loadData(regionId) {
        const regId = regionId || STATE.activeRegion || 'kuala_selangor';
        const reg = REGIONS[regId] || REGIONS['kuala_selangor'];
        STATE.activeRegion = reg.id;

        // Clear existing state arrays
        STATE.demData = [];
        STATE.floodData = [];
        STATE.populationData = [];
        STATE.totalPopulation = 0;
        STATE.telcoData = [];
        STATE.buildingCount = 0;
        STATE.buildingGeoms = [];
        STATE.roadGeoms = [];
        STATE.infraData = [];
        STATE.candidateSites = [];

        setLoader(10, `Ingesting WorldPop regional population grid (${reg.shortName})…`);
        try {
            const popResp = await fetch(reg.files.population);
            const popText = await popResp.text();
            const { pts, totalPop } = parseWorldPop(popText);
            STATE.populationData = pts;
            STATE.totalPopulation = totalPop || reg.defaultPop;
            setLoader(30, `Parsed ${STATE.populationData.length.toLocaleString()} population cells (${STATE.totalPopulation.toLocaleString()} residents)…`);
        } catch (e) {
            console.warn('WorldPop CSV load error:', e);
            STATE.totalPopulation = reg.defaultPop;
        }

        setLoader(35, `Ingesting Sentinel-1 SAR flood risk footprints (${reg.shortName})…`);
        try {
            const floodResp = await fetch(reg.files.flood);
            const floodText = await floodResp.text();
            STATE.floodData = parseFloodCSV(floodText);
            setLoader(50, `Indexed ${STATE.floodData.length.toLocaleString()} Sentinel-1 flood footprint points…`);
        } catch (e) {
            console.warn('Flood CSV load error:', e);
        }

        setLoader(55, `Ingesting SRTM DEM terrain elevation dataset (${reg.shortName})…`);
        try {
            const demResp = await fetch(reg.files.dem);
            const demText = await demResp.text();
            STATE.demData = parseDEMCSV(demText);
            setLoader(70, `Parsed ${STATE.demData.length.toLocaleString()} elevation grid points…`);
        } catch (e) {
            console.warn('DEM CSV load error:', e);
        }

        setLoader(75, 'Ingesting existing telecommunication towers database…');
        try {
            const telcoResp = await fetch(reg.files.telco);
            const telcoJson = await telcoResp.json();
            STATE.telcoData = (telcoJson.elements || []).map(e => {
                let lat = e.lat, lon = e.lon;
                if ((!lat || !lon) && e.bounds) {
                    lat = (e.bounds.minlat + e.bounds.maxlat) / 2;
                    lon = (e.bounds.minlon + e.bounds.maxlon) / 2;
                }
                return { ...e, lat, lon };
            }).filter(e => e.lat && e.lon);
            setLoader(82, `Mapped ${STATE.telcoData.length} existing base stations & towers…`);
        } catch (e) {
            console.warn('Telco JSON load error:', e);
            STATE.telcoData = [];
        }

        setLoader(85, 'Loading critical infrastructure & public facilities…');
        try {
            const infraResp = await fetch(reg.files.infra);
            const infraJson = await infraResp.json();
            STATE.infraData = (infraJson.elements || []).filter(e => e.tags && e.tags.name);
        } catch (e) {
            STATE.infraData = [];
        }
        setLoader(90, `Loaded ${STATE.infraData.length} critical facilities…`);

        setLoader(92, 'Loading building & road network vector data…');
        try {
            const bldgResp = await fetch(reg.files.buildings);
            const bldgJson = await bldgResp.json();
            STATE.buildingGeoms = bldgJson.elements || [];
            STATE.buildingCount = STATE.buildingGeoms.length;
        } catch (e) {
            STATE.buildingCount = reg.defaultBldg;
        }

        try {
            if (reg.files.roads) {
                const roadResp = await fetch(reg.files.roads);
                const roadJson = await roadResp.json();
                STATE.roadGeoms = roadJson.elements || [];
            }
        } catch (e) {
            STATE.roadGeoms = [];
        }
        setLoader(98, `Mapped ${STATE.buildingCount.toLocaleString()} buildings & ${STATE.roadGeoms.length} road paths…`);

        setLoader(100, `Initializing ${reg.name} GeoAI environment…`);
        await new Promise(r => setTimeout(r, 350));
    }

    // ---- Clear Map Layers ----
    function clearAllLayers() {
        Object.keys(STATE.layers).forEach(k => {
            if (STATE.layers[k]) {
                STATE.map.removeLayer(STATE.layers[k]);
                delete STATE.layers[k];
            }
        });
        if (STATE.heatLayer) {
            STATE.map.removeLayer(STATE.heatLayer);
            STATE.heatLayer = null;
            STATE.heatVisible = false;
        }
        const btn3d = $('btn-3d');
        if (btn3d) {
            btn3d.style.background = '';
            btn3d.style.color = '';
        }
    }

    // ---- Dynamic Region Switcher ----
    async function switchRegion(regionId) {
        if (!REGIONS[regionId] || regionId === STATE.activeRegion) return;
        
        const loaderScreen = $('loading-screen');
        if (loaderScreen) {
            loaderScreen.classList.remove('hidden');
        }

        clearAllLayers();
        await loadData(regionId);

        const reg = REGIONS[regionId];

        // 1. Recenter Map Viewport to Selected Region Center
        if (STATE.map) {
            STATE.map.flyTo(reg.center, reg.zoom, { duration: 1.2 });
        }

        // 2. Re-render Layers according to current checkbox toggles
        renderPopulation();
        renderTelcoTowers();
        renderDEM();
        renderFlood();
        renderBuildings();
        renderInfra();
        generateCandidates();
        renderCandidates();

        const layerMap = {
            'lyr-population': 'population', 'lyr-telco': 'telco', 'lyr-dem': 'dem',
            'lyr-flood': 'flood', 'lyr-buildings': 'buildings', 'lyr-roads': 'roads',
            'lyr-infra': 'infra', 'lyr-candidates': 'candidates'
        };
        Object.entries(layerMap).forEach(([id, key]) => {
            const elem = $(id);
            if (elem) {
                if (elem.checked && STATE.layers[key]) {
                    STATE.map.addLayer(STATE.layers[key]);
                } else if (!elem.checked && STATE.layers[key]) {
                    STATE.map.removeLayer(STATE.layers[key]);
                }
            }
        });

        // 3. Update Header & Subtitles
        if ($('logo-sub-region')) $('logo-sub-region').textContent = reg.subText;
        if ($('overview-title')) $('overview-title').textContent = reg.overviewTitle;

        updateStats();
        renderCharts();
        renderSiteCards();

        if ($('site-detail')) $('site-detail').classList.add('hidden');

        if (loaderScreen) {
            setTimeout(() => loaderScreen.classList.add('hidden'), 350);
        }
    }

    // ---- Initialize Map with Natural Basemaps ----
    function initMap() {
        const defaultReg = REGIONS[STATE.activeRegion] || REGIONS['kuala_selangor'];
        STATE.map = L.map('map', {
            center: defaultReg.center,
            zoom: defaultReg.zoom,
            zoomControl: false,
            attributionControl: true
        });

        L.control.zoom({ position: 'bottomright' }).addTo(STATE.map);

        // Define Natural & Styled Basemaps
        STATE.baseMaps = {
            "🛰️ Satellite Imagery": L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
                subdomains: ['0', '1', '2', '3'],
                attribution: '&copy; Google Maps',
                maxZoom: 20
            }),
            "🌍 Esri Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri',
                maxZoom: 19,
                maxNativeZoom: 17
            }),
            "⛰️ Topographic Terrain": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri',
                maxZoom: 19,
                maxNativeZoom: 17
            }),
            "🌙 Dark Mode": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
                maxZoom: 19
            }),
            "☀️ Street Map": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 19
            })
        };

        // Set default basemap to Google Satellite Imagery
        STATE.baseMaps["🛰️ Satellite Imagery"].addTo(STATE.map);
        const layerControl = L.control.layers(STATE.baseMaps, {}, { position: 'topright', collapsed: true }).addTo(STATE.map);
        const container = layerControl.getContainer();

        // Prevent automatic hover expand/collapse
        if (container) {
            container.addEventListener('mouseover', (e) => e.stopPropagation(), true);
            container.addEventListener('mouseout', (e) => e.stopPropagation(), true);

            const toggleBtn = container.querySelector('.leaflet-control-layers-toggle');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (container.classList.contains('leaflet-control-layers-expanded')) {
                        layerControl.collapse();
                    } else {
                        layerControl.expand();
                    }
                });
            }
        }

        // Collapse when clicking anywhere else on the map
        STATE.map.on('click', () => {
            if (container.classList.contains('leaflet-control-layers-expanded')) {
                layerControl.collapse();
            }
        });
    }

    // ---- Color Helpers ----
    function elevColor(elev) {
        if (elev > 300) return '#b71c1c';
        if (elev > 200) return '#e65100';
        if (elev > 120) return '#f9a825';
        if (elev > 70)  return '#2e7d32';
        if (elev > 30)  return '#00838f';
        if (elev > 15)  return '#0d47a1';
        return '#1a237e';
    }

    // ---- Map Layer Rendering ----
    function renderPopulation() {
        const group = L.layerGroup();
        if (STATE.populationData && STATE.populationData.length > 0) {
            // 1. Smooth canvas heatmap
            if (typeof L.heatLayer === 'function') {
                const heatPoints = STATE.populationData.map(p => [p.lat, p.lng, Math.min(1.0, p.pop / 40)]);
                const heat = L.heatLayer(heatPoints, {
                    radius: 18,
                    blur: 14,
                    maxZoom: 17,
                    max: 1.0,
                    gradient: {
                        0.10: '#0d47a1',
                        0.20: '#00e5ff',
                        0.35: '#00e676',
                        0.50: '#ffd600',
                        0.68: '#ff9100',
                        0.82: '#ff3d00',
                        0.94: '#d50000',
                        1.00: '#9c27b0'
                    }
                });
                group.addLayer(heat);
            }

            // 2. Invisible interactive grid for click-popups
            const cellSize = 0.008;
            const gridMap = new Map();
            STATE.populationData.forEach(p => {
                const key = `${Math.floor(p.lat / cellSize)}_${Math.floor(p.lng / cellSize)}`;
                if (!gridMap.has(key)) {
                    gridMap.set(key, { cellY: Math.floor(p.lat / cellSize), cellX: Math.floor(p.lng / cellSize), totalPop: 0, count: 0 });
                }
                const cell = gridMap.get(key);
                cell.totalPop += p.pop;
                cell.count += 1;
            });

            gridMap.forEach(cell => {
                const south = cell.cellY * cellSize;
                const north = south + cellSize;
                const west = cell.cellX * cellSize;
                const east = west + cellSize;
                const pop = Math.round(cell.totalPop);
                if (pop <= 0) return;

                let tierLabel = 'Low Density (<8 residents)';
                if (pop > 140) tierLabel = 'Peak Urban Core (>140)';
                else if (pop > 100) tierLabel = 'High Suburban (100-140)';
                else if (pop > 65) tierLabel = 'Moderate Suburban (65-100)';
                else if (pop > 35) tierLabel = 'Moderate (35-65)';
                else if (pop > 18) tierLabel = 'Low-Moderate (18-35)';
                else if (pop > 8) tierLabel = 'Rural (8-18)';

                L.rectangle([[south, west], [north, east]], {
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    color: 'transparent',
                    weight: 0,
                    interactive: true
                }).bindPopup(`
                    <div style="font-family:'Inter',sans-serif;padding:2px;">
                        <h4 style="margin:0 0 4px;color:#ff007f;font-size:14px;">👥 Population Density Heatmap Cell</h4>
                        Cell Population Volume: <strong>${pop.toLocaleString()} residents</strong><br>
                        Heatmap Intensity Tier: <strong>${tierLabel}</strong><br>
                        Est. Peak Bandwidth Demand: <strong>${(pop * 2.2).toFixed(1)} Mbps</strong><br>
                        <small>Cell Bounds: ${south.toFixed(4)}°N, ${west.toFixed(4)}°E</small>
                    </div>
                `).addTo(group);
            });
        }
        STATE.layers.population = group;
        group.addTo(STATE.map);
    }

    function renderTelcoTowers() {
        const group = L.layerGroup();
        STATE.telcoData.forEach(t => {
            const icon = L.divIcon({
                html: `<div style="
                    font-size:18px;width:30px;height:30px;border-radius:50%;
                    background:rgba(10,14,26,0.9);border:2px solid #00e5ff;
                    box-shadow:0 0 14px rgba(0,229,255,0.8);
                    display:flex;align-items:center;justify-content:center;
                ">📡</div>`,
                className: '', iconSize: [30, 30], iconAnchor: [15, 15]
            });

            const tags = t.tags || {};
            const type = tags['tower:type'] || tags.man_made || 'Communication Tower';
            const operator = tags.operator || 'Telecom Operator';
            const height = tags.height ? `${tags.height}m` : 'Standard Mast';

            L.marker([t.lat, t.lon], { icon })
                .bindPopup(`
                    <div style="font-family:'Inter',sans-serif;">
                        <h4 style="margin:0 0 4px;color:#00e5ff;">📡 Existing Telco Base Station</h4>
                        Type: <strong>${type}</strong><br>
                        Operator: <strong>${operator}</strong><br>
                        Height: <strong>${height}</strong><br>
                        <small>${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}</small>
                    </div>
                `).addTo(group);

            L.circle([t.lat, t.lon], {
                radius: 1500, fillColor: '#00e5ff', fillOpacity: 0.05,
                color: '#00e5ff', weight: 1, dashArray: '4, 4'
            }).addTo(group);
        });
        STATE.layers.telco = group;
        group.addTo(STATE.map);
    }

    function renderDEM() {
        const group = L.layerGroup();
        const step = Math.max(1, Math.floor(STATE.demData.length / 2500));
        for (let i = 0; i < STATE.demData.length; i += step) {
            const p = STATE.demData[i];
            L.circleMarker([p.lat, p.lng], {
                radius: 2.5,
                fillColor: elevColor(p.elev),
                fillOpacity: 0.75,
                stroke: false
            }).bindPopup(`<strong>Terrain Elevation</strong><br>${p.elev}m ASL (Slope: ${p.slope.toFixed(1)}°)<br><small>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</small>`)
              .addTo(group);
        }
        STATE.layers.dem = group;
    }

    function renderFlood() {
        const group = L.layerGroup();
        const cellSize = 0.007;
        const floodMap = new Map();

        // 1. Ingest Past Sentinel-1 Flood Detections
        if (STATE.floodData && STATE.floodData.length > 0) {
            STATE.floodData.forEach(p => {
                const cellX = Math.floor(p.lng / cellSize);
                const cellY = Math.floor(p.lat / cellSize);
                const key = `${cellY}_${cellX}`;
                if (!floodMap.has(key)) {
                    floodMap.set(key, { cellY, cellX, pastCount: 0, demElevs: [] });
                }
                floodMap.get(key).pastCount += 1;
            });
        }

        // 2. Ingest DEM Elevation data for Forecasted Flood Vulnerability (<= 12m ASL)
        if (STATE.demData && STATE.demData.length > 0) {
            STATE.demData.forEach(p => {
                if (p.elev <= 12) {
                    const cellX = Math.floor(p.lng / cellSize);
                    const cellY = Math.floor(p.lat / cellSize);
                    const key = `${cellY}_${cellX}`;
                    if (!floodMap.has(key)) {
                        floodMap.set(key, { cellY, cellX, pastCount: 0, demElevs: [] });
                    }
                    floodMap.get(key).demElevs.push(p.elev);
                }
            });
        }

        // 3. Render outline-heavy, low-fill polygons
        floodMap.forEach(cell => {
            const south = cell.cellY * cellSize;
            const north = south + cellSize;
            const west = cell.cellX * cellSize;
            const east = west + cellSize;

            const hasPast = cell.pastCount > 0;
            const hasForecast = cell.demElevs.length > 0;
            if (!hasPast && !hasForecast) return;

            let fillColor, strokeColor, dashArray, fillOp, strokeWeight, title, desc;

            if (hasPast && hasForecast) {
                fillColor = 'rgba(156, 39, 176, 0.18)';
                strokeColor = '#e040fb';
                dashArray = null;
                fillOp = 0.18;
                strokeWeight = 2.2;
                title = '🚨 Dual Hazard Flood Zone (Past + Forecasted)';
                desc = `<strong>Past SAR Detections:</strong> ${cell.pastCount} water hits<br><strong>Forecasted Elevation:</strong> Lowland (${Math.min(...cell.demElevs)}m ASL)`;
            } else if (hasPast) {
                fillColor = 'rgba(255, 255, 255, 0.08)';
                strokeColor = '#b2ebf2';
                dashArray = '5, 5';
                fillOp = 0.08;
                strokeWeight = 1.8;
                title = '🌊 Past Historical Flood Footprint';
                desc = `<strong>Source:</strong> Sentinel-1 SAR Radar Observation<br><strong>Observed Hits:</strong> ${cell.pastCount} SAR flood footprints`;
            } else {
                fillColor = 'rgba(255, 23, 68, 0.14)';
                strokeColor = '#ff8a80';
                dashArray = '6, 6';
                fillOp = 0.14;
                strokeWeight = 1.8;
                title = '🔮 Forecasted Flood Vulnerability Zone';
                const avgElev = (cell.demElevs.reduce((a, b) => a + b, 0) / cell.demElevs.length).toFixed(1);
                desc = `<strong>Source:</strong> DEM Hydrological Vulnerability Model<br><strong>Mean Elevation:</strong> ${avgElev}m ASL (Monsoon Inundation Risk)`;
            }

            L.rectangle([[south, west], [north, east]], {
                fillColor: fillColor,
                fillOpacity: fillOp,
                color: strokeColor,
                weight: strokeWeight,
                dashArray: dashArray
            }).bindPopup(`
                <div style="font-family:'Inter',sans-serif;padding:2px;">
                    <h4 style="margin:0 0 4px;color:${strokeColor};font-size:14px;">${title}</h4>
                    ${desc}<br>
                    <small>Grid Bounds: ${south.toFixed(4)}°N, ${west.toFixed(4)}°E</small>
                </div>
            `).addTo(group);
        });

        STATE.layers.flood = group;
        group.addTo(STATE.map);
    }

    function renderInfra() {
        const icons = { police: '🚔', clinic: '🏥', school: '🏫', fire_station: '🚒', default: '🏛️' };
        const group = L.layerGroup();
        STATE.infraData.forEach(e => {
            const lat = e.lat, lon = e.lon;
            if (!lat || !lon) return;
            const tags = e.tags || {};
            const amenity = tags.amenity || 'default';
            const name = tags.name || 'Public Facility';
            const emoji = icons[amenity] || icons.default;
            const icon = L.divIcon({
                html: `<div style="
                    font-size:20px;padding:3px;border-radius:50%;
                    background:rgba(10,14,26,0.85);border:2px solid #ffab00;
                    box-shadow:0 0 10px rgba(255,171,0,0.6);
                    display:flex;align-items:center;justify-content:center;
                ">${emoji}</div>`,
                className: '', iconSize: [30, 30], iconAnchor: [15, 15]
            });
            L.marker([lat, lon], { icon })
                .bindPopup(`
                    <div style="font-family:'Inter',sans-serif;">
                        <strong style="color:#ffab00;">${name}</strong><br>
                        Type: <span style="text-transform:capitalize;">${amenity.replace('_', ' ')}</span>
                    </div>
                `).addTo(group);
        });
        STATE.layers.infra = group;
        group.addTo(STATE.map);
    }

    function renderBuildings() {
        const group = L.layerGroup();
        if (STATE.buildingGeoms && STATE.buildingGeoms.length > 0) {
            STATE.buildingGeoms.slice(0, 1500).forEach(b => {
                const buildingType = b.tags?.building || 'yes';
                const color = (b.tags?.amenity || b.tags?.office) ? '#ffb74d' : '#81c784';

                if (b.geometry && b.geometry.length >= 3) {
                    const coords = b.geometry.map(g => [g.lat, g.lon]);
                    L.polygon(coords, {
                        color: color, weight: 1.2, fillColor: color, fillOpacity: 0.4
                    }).bindPopup(`<strong>Building Footprint</strong><br>Type: ${buildingType}`)
                      .addTo(group);
                } else if (b.bounds) {
                    const southWest = [b.bounds.minlat, b.bounds.minlon];
                    const northEast = [b.bounds.maxlat, b.bounds.maxlon];
                    L.rectangle([southWest, northEast], {
                        color: color, weight: 1.2, fillColor: color, fillOpacity: 0.4
                    }).bindPopup(`<strong>Building Footprint</strong><br>Type: ${buildingType}`)
                      .addTo(group);
                }
            });
        }
        STATE.layers.buildings = group;
        group.addTo(STATE.map);
    }

    function renderRoads() {
        const group = L.layerGroup();
        if (STATE.roadGeoms && STATE.roadGeoms.length > 0) {
            STATE.roadGeoms.forEach(r => {
                if (!r.geometry || r.geometry.length < 2) return;
                const coords = r.geometry.map(g => [g.lat, g.lon]);
                const highwayType = r.tags?.highway || 'road';
                let color = '#ffffff', weight = 2, opacity = 0.6;
                if (highwayType === 'primary' || highwayType === 'trunk') {
                    color = '#ffa726'; weight = 4; opacity = 0.9;
                } else if (highwayType === 'secondary' || highwayType === 'tertiary') {
                    color = '#ffcc80'; weight = 3; opacity = 0.8;
                }

                L.polyline(coords, { color, weight, opacity })
                  .bindPopup(`<strong>Road Segment</strong><br>${r.tags?.name || 'Local Path'}`)
                  .addTo(group);
            });
        }
        STATE.layers.roads = group;
        group.addTo(STATE.map);
    }

    // ---- Multi-Objective Candidate Optimization Engine ----
    function getElevationAndSlope(lat, lng) {
        if (!STATE.demData || STATE.demData.length === 0) return { elev: 25, slope: 2 };
        const nearby = STATE.demData.filter(p => dist([p.lat, p.lng], [lat, lng]) < 0.035);
        if (nearby.length > 0) {
            const avgE = Math.round(nearby.reduce((s, p) => s + p.elev, 0) / nearby.length);
            const avgS = Math.round(nearby.reduce((s, p) => s + p.slope, 0) / nearby.length);
            return { elev: avgE, slope: avgS };
        }
        return { elev: 25, slope: 2 };
    }

    function generateCandidates() {
        const reg = REGIONS[STATE.activeRegion] || REGIONS['kuala_selangor'];
        const latMin = reg.latMin, latMax = reg.latMax, lngMin = reg.lngMin, lngMax = reg.lngMax;
        const step = reg.id === 'kuala_krai' ? 0.025 : 0.018; 
        const rawCandidates = [];

        for (let lat = latMin; lat <= latMax; lat += step) {
            for (let lng = lngMin; lng <= lngMax; lng += step) {
                const { elev, slope } = getElevationAndSlope(lat, lng);

                // Population demand within 2.5 km
                const popNear = STATE.populationData
                    .filter(p => distKm(lat, lng, p.lat, p.lng) <= 2.5)
                    .reduce((sum, p) => sum + p.pop, 0);

                if (popNear < 8) continue; // Skip uninhabited areas

                // Distance to nearest existing tower
                let minTowerDist = 999;
                STATE.telcoData.forEach(t => {
                    const d = distKm(lat, lng, t.lat, t.lon);
                    if (d < minTowerDist) minTowerDist = d;
                });

                // Flood risk check (within 1.0 km)
                const nearFlood = STATE.floodData.some(f => distKm(lat, lng, f.lat, f.lng) <= 1.0);

                // Nearby facilities
                const bldgNear = STATE.buildingGeoms.filter(b => {
                    let bLat = b.geometry ? b.geometry[0]?.lat : (b.bounds ? (b.bounds.minlat + b.bounds.maxlat) / 2 : null);
                    let bLon = b.geometry ? b.geometry[0]?.lon : (b.bounds ? (b.bounds.minlon + b.bounds.maxlon) / 2 : null);
                    return bLat && bLon && distKm(lat, lng, bLat, bLon) <= 1.5;
                }).length;

                const infraNear = STATE.infraData.filter(e => e.lat && distKm(lat, lng, e.lat, e.lon) <= 2.0).length;

                // Scoring calculations
                let coverageScore = Math.min(popNear * 0.4 + (minTowerDist > 2.5 ? 35 : minTowerDist * 10) + infraNear * 8, 100);
                
                let risk = 5;
                if (nearFlood) risk += 45;
                if (elev < 12) risk += 25;
                if (slope > 12) risk += 20;
                risk = Math.min(risk, 100);

                const composite = Math.round(coverageScore * 0.55 + (100 - risk) * 0.45);

                rawCandidates.push({
                    lat, lng, elev, slope, risk, coverage: Math.round(coverageScore),
                    composite, popNear: Math.round(popNear), minTowerDist: minTowerDist.toFixed(1),
                    bldgNear, infraNear, nearFlood
                });
            }
        }

        // Rank by composite score and apply Non-Maximum Suppression (3.0 km separation)
        rawCandidates.sort((a, b) => b.composite - a.composite);
        const filtered = [];
        for (const c of rawCandidates) {
            if (!filtered.some(f => distKm(f.lat, f.lng, c.lat, c.lng) < 3.0)) {
                filtered.push(c);
                if (filtered.length >= 10) break;
            }
        }
        STATE.candidateSites = filtered;
    }

    function renderCandidates() {
        const group = L.layerGroup();
        STATE.candidateSites.forEach((s, i) => {
            const color = s.risk < 35 ? '#00e676' : s.risk < 60 ? '#ffab00' : '#ff5252';
            const icon = L.divIcon({
                html: `<div style="
                    width:34px;height:34px;border-radius:50%;
                    background:${color};display:flex;align-items:center;justify-content:center;
                    font-weight:900;font-size:14px;color:#0a0e1a;
                    border:3px solid #ffffff;box-shadow:0 0 20px ${color};
                    font-family:'Inter',sans-serif;
                ">${i + 1}</div>`,
                className: '', iconSize: [34, 34], iconAnchor: [17, 17]
            });

            L.marker([s.lat, s.lng], { icon })
                .bindPopup(`
                    <div style="font-family:'Inter',sans-serif;padding:4px;">
                        <h4 style="margin:0 0 6px;color:#00e5ff;font-size:14px;">Optimal Candidate Site #${i + 1}</h4>
                        <div style="font-size:12px;line-height:1.6;">
                            Overall Score: <strong style="color:${color}">${s.composite}/100</strong><br>
                            Risk Classification: <strong>${s.risk < 35 ? '🟢 Low Risk' : s.risk < 60 ? '🟡 Medium Risk' : '🔴 High Risk'} (${s.risk}/100)</strong><br>
                            Pop Demand (2.5km): <strong>~${s.popNear.toLocaleString()} residents</strong><br>
                            Dist to Existing Tower: <strong>${s.minTowerDist} km</strong><br>
                            Terrain Elev: <strong>${s.elev}m ASL</strong> (Slope: ${s.slope}°)<br>
                            Flood Hazard: <strong>${s.nearFlood ? '⚠️ SAR Flood Footprint' : '✅ Clear'}</strong>
                        </div>
                    </div>
                `).addTo(group);

            L.circle([s.lat, s.lng], {
                radius: 2000, fillColor: color, fillOpacity: 0.12,
                color: color, weight: 2, dashArray: '6, 6'
            }).addTo(group);
        });
        STATE.layers.candidates = group;
        group.addTo(STATE.map);
    }

    // ---- Heatmap Layer Toggle ----
    function toggleHeat() {
        if (STATE.heatVisible && STATE.heatLayer) {
            STATE.map.removeLayer(STATE.heatLayer);
            STATE.heatVisible = false;
            const btn = $('btn-3d');
            if (btn) { btn.style.background = ''; btn.style.color = ''; }
            return;
        }
        const pts = STATE.demData.map(p => [p.lat, p.lng, Math.min(p.elev / 350, 1)]);
        STATE.heatLayer = L.heatLayer(pts, { radius: 18, blur: 22, maxZoom: 14, gradient: { 0.2: '#1a237e', 0.4: '#00838f', 0.6: '#2e7d32', 0.8: '#f9a825', 1.0: '#b71c1c' } });
        STATE.heatLayer.addTo(STATE.map);
        STATE.heatVisible = true;
        const btn = $('btn-3d');
        if (btn) { btn.style.background = 'var(--accent-cyan)'; btn.style.color = '#0a0e1a'; }
    }

    // ---- UI & Chart Updates ----
    function updateStats() {
        if ($('val-points')) $('val-points').textContent = STATE.demData.length.toLocaleString();
        if ($('val-flood')) $('val-flood').textContent = STATE.floodData.length.toLocaleString();
        if ($('val-buildings')) $('val-buildings').textContent = (STATE.buildingCount || 31200).toLocaleString();
        if ($('val-infra')) $('val-infra').textContent = STATE.infraData.length;
        if ($('val-population')) $('val-population').textContent = STATE.totalPopulation.toLocaleString();
        if ($('val-telco')) $('val-telco').textContent = STATE.telcoData.length;
    }

    function renderCharts() {
        const bins = Array(8).fill(0);
        const labels = ['0-50m', '50-100m', '100-150m', '150-200m', '200-250m', '250-300m', '300-350m', '350m+'];
        STATE.demData.forEach(p => {
            const idx = Math.min(Math.floor(p.elev / 50), 7);
            bins[idx]++;
        });

        if ($('elevChart')) {
            if (STATE.elevChartInstance) {
                STATE.elevChartInstance.destroy();
            }
            STATE.elevChartInstance = new Chart($('elevChart'), {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        data: bins,
                        backgroundColor: labels.map((_, i) => `hsla(${200 - i * 25}, 80%, 55%, 0.85)`),
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
                        y: { grid: { color: 'rgba(99,102,241,0.08)' }, ticks: { color: '#64748b', font: { size: 10 } } }
                    }
                }
            });
        }

        const low = STATE.candidateSites.filter(s => s.risk < 35).length;
        const med = STATE.candidateSites.filter(s => s.risk >= 35 && s.risk < 60).length;
        const high = STATE.candidateSites.filter(s => s.risk >= 60).length;

        if ($('riskChart')) {
            if (STATE.riskChartInstance) {
                STATE.riskChartInstance.destroy();
            }
            STATE.riskChartInstance = new Chart($('riskChart'), {
                type: 'doughnut',
                data: {
                    labels: ['Low Risk', 'Medium Risk', 'High Risk'],
                    datasets: [{
                        data: [low || 6, med || 3, high || 1],
                        backgroundColor: ['#00e676', '#ffab00', '#ff5252'],
                        borderWidth: 0, hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '65%',
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12, usePointStyle: true } }
                    }
                }
            });
        }
    }

    function renderSiteCards() {
        const container = $('analysis-results');
        if (!container) return;
        container.innerHTML = '';
        STATE.candidateSites.forEach((s, i) => {
            const riskLabel = s.risk < 35 ? '🟢 Low' : s.risk < 60 ? '🟡 Med' : '🔴 High';
            const card = document.createElement('div');
            card.className = 'site-card';
            card.style.animationDelay = `${i * 0.06}s`;
            card.innerHTML = `
                <div class="site-card-header">
                    <span class="site-rank">Site #${i + 1}</span>
                    <span class="site-score" style="color:${s.composite > 60 ? '#00e676' : s.composite > 40 ? '#ffab00' : '#ff5252'}">${s.composite}/100</span>
                </div>
                <div class="site-coords">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</div>
                <div class="site-metrics">
                    <span class="metric">Risk: <strong>${riskLabel}</strong></span>
                    <span class="metric">Pop: <strong>~${s.popNear}</strong></span>
                    <span class="metric">Tower Dist: <strong>${s.minTowerDist}km</strong></span>
                </div>
            `;
            card.addEventListener('click', () => {
                STATE.map.flyTo([s.lat, s.lng], 14, { duration: 1 });
                showSiteDetail(s, i);
            });
            container.appendChild(card);
        });
    }

    function showSiteDetail(s, i) {
        const panel = $('site-detail');
        if (!panel) return;
        panel.classList.remove('hidden');
        if ($('site-title')) $('site-title').textContent = `Candidate Site #${i + 1} Multi-Objective Analysis`;
        if ($('detail-grid')) {
            $('detail-grid').innerHTML = `
                <div class="detail-item"><div class="label">Composite Score</div><div class="value" style="color:#00e5ff">${s.composite}/100</div></div>
                <div class="detail-item"><div class="label">Risk Classification</div><div class="value" style="color:${s.risk < 35 ? '#00e676' : s.risk < 60 ? '#ffab00' : '#ff5252'}">${s.risk}/100</div></div>
                <div class="detail-item"><div class="label">Pop. Demand (2.5km)</div><div class="value">~${s.popNear.toLocaleString()}</div></div>
                <div class="detail-item"><div class="label">Nearest Telco Tower</div><div class="value">${s.minTowerDist} km</div></div>
                <div class="detail-item"><div class="label">Terrain Elevation</div><div class="value">${s.elev}m ASL</div></div>
                <div class="detail-item"><div class="label">Flood Risk Zone</div><div class="value">${s.nearFlood ? '⚠️ Footprint' : '✅ Clear'}</div></div>
                <div class="detail-item"><div class="label">Nearby Facilities</div><div class="value">${s.infraNear}</div></div>
                <div class="detail-item"><div class="label">Coordinates</div><div class="value" style="font-size:0.7rem">${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</div></div>
            `;
        }
    }

    // ---- Event Bindings ----
    function bindEvents() {
        // Theme toggle
        if ($('btn-theme')) {
            $('btn-theme').addEventListener('click', () => {
                const html = document.documentElement;
                const isDark = html.getAttribute('data-theme') === 'dark';
                html.setAttribute('data-theme', isDark ? 'light' : 'dark');
                localStorage.setItem('pintar-theme', isDark ? 'light' : 'dark');
            });
        }

        // Region select dropdown listener
        if ($('region-select')) {
            $('region-select').addEventListener('change', (e) => {
                switchRegion(e.target.value);
            });
        }

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                if ($('panel-' + btn.dataset.panel)) {
                    $('panel-' + btn.dataset.panel).classList.add('active');
                }
            });
        });

        const layerMap = {
            'lyr-population': 'population', 'lyr-telco': 'telco', 'lyr-dem': 'dem',
            'lyr-flood': 'flood', 'lyr-buildings': 'buildings', 'lyr-roads': 'roads',
            'lyr-infra': 'infra', 'lyr-candidates': 'candidates'
        };

        Object.entries(layerMap).forEach(([id, key]) => {
            if ($(id)) {
                $(id).addEventListener('change', function () {
                    if (!STATE.layers[key]) return;
                    if (this.checked) STATE.map.addLayer(STATE.layers[key]);
                    else STATE.map.removeLayer(STATE.layers[key]);
                });
            }
        });

        if ($('btn-center')) {
            $('btn-center').addEventListener('click', () => {
                const reg = REGIONS[STATE.activeRegion] || REGIONS['kuala_selangor'];
                STATE.map.flyTo(reg.center, reg.zoom, { duration: 1 });
            });
        }

        if ($('btn-3d')) $('btn-3d').addEventListener('click', toggleHeat);

        if ($('btn-run-analysis')) {
            $('btn-run-analysis').addEventListener('click', () => {
                generateCandidates();
                if (STATE.layers.candidates) STATE.map.removeLayer(STATE.layers.candidates);
                renderCandidates();
                renderSiteCards();
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
                if ($('nav-analysis')) $('nav-analysis').classList.add('active');
                if ($('panel-analysis')) $('panel-analysis').classList.add('active');
            });
        }

        if ($('btn-clear')) {
            $('btn-clear').addEventListener('click', () => {
                if ($('analysis-results')) {
                    $('analysis-results').innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">No results yet. Click "Run Regional Optimization".</p>';
                }
                if ($('site-detail')) $('site-detail').classList.add('hidden');
                if (STATE.layers.candidates) STATE.map.removeLayer(STATE.layers.candidates);
            });
        }

        STATE.map.on('click', function (e) {
            const { lat, lng } = e.latlng;
            const { elev, slope } = getElevationAndSlope(lat, lng);
            const popNear = STATE.populationData.filter(p => distKm(lat, lng, p.lat, p.lng) <= 2.5).reduce((s, p) => s + p.pop, 0);
            
            let minTowerDist = 999;
            STATE.telcoData.forEach(t => {
                const d = distKm(lat, lng, t.lat, t.lon);
                if (d < minTowerDist) minTowerDist = d;
            });

            const nearFlood = STATE.floodData.some(f => distKm(lat, lng, f.lat, f.lng) <= 1.0);
            let risk = 5;
            if (nearFlood) risk += 45;
            if (elev < 12) risk += 25;

            const composite = Math.round(Math.min(popNear * 0.4 + (minTowerDist > 2.5 ? 35 : minTowerDist * 10), 100) * 0.55 + (100 - risk) * 0.45);

            const tooltip = $('info-tooltip');
            if (tooltip) {
                tooltip.classList.remove('hidden');
                if ($('tooltip-content')) {
                    $('tooltip-content').innerHTML = `
                        <strong>📍 Point Evaluation (${lat.toFixed(4)}, ${lng.toFixed(4)})</strong> &nbsp;
                        Elev: <strong>${elev}m</strong> |
                        Pop: <strong>~${Math.round(popNear)}</strong> |
                        Tower Dist: <strong>${minTowerDist.toFixed(1)}km</strong> |
                        Risk: <strong style="color:${risk < 35 ? '#00e676' : risk < 60 ? '#ffab00' : '#ff5252'}">${risk}/100</strong> |
                        Score: <strong style="color:#00e5ff">${composite}/100</strong>
                    `;
                }
                setTimeout(() => tooltip.classList.add('hidden'), 7000);
            }
        });
    }

    // ---- Boot Sequence ----
    async function boot() {
        try {
            await loadData('kuala_selangor');
            initMap();
            renderPopulation();
            renderTelcoTowers();
            renderDEM();
            renderFlood();
            renderBuildings();
            renderInfra();
            generateCandidates();
            renderCandidates();
            updateStats();
            renderCharts();
            renderSiteCards();
            bindEvents();
            if ($('loading-screen')) $('loading-screen').classList.add('hidden');
        } catch (err) {
            console.error('Boot error:', err);
            setLoader(0, 'Error initializing GeoAI engine: ' + err.message);
        }
    }

    document.addEventListener('DOMContentLoaded', boot);
})();
