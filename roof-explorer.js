(() => {
  const $ = id => document.getElementById(id);
  const panel = $("roof-explorer");
  const mapNode = $("roof-map");
  const mapStatus = $("roof-map-status");
  const drawStatus = $("roof-draw-status");
  const locationStatus = $("roof-location");
  const analysisStatus = $("roof-analysis-status");
  const searchField = $("roof-query");
  const suggestionList = $("roof-suggestions");
  const suggestionStatus = $("roof-suggestion-status");
  const settings = $("roof-inputs");
  const analyzeButton = $("roof-analyze");
  const chart = $("roof-chart");
  const layers = [...panel.querySelectorAll("[data-roof-layer]")];
  const moduleArea = { 400: 2, 550: 2.6, 650: 3.1 };
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const format = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });
  const solarParameter = "ALLSKY_SFC_SW_DWN";
  const defaultLocation = [6.5244, 3.3792];
  const geocoder = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
  const satelliteTile = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false";
  const roofZoom = 19;
  const maxZoom = 20;
  let map, shapeLayer, locationMark, activeLayer, mapLoading = false, mapReady = false;
  let foundPoint = null;
  let drawing = false, corners = [], traced = null, sunlight = null, generation = null;
  let analysisRequest, locationRequest = 0;
  let suggestionRequest, suggestionTimer, suggestions = [], selectedSuggestion = -1;
  let savedLocation = { point: defaultLocation, zoom: 13 };

  function readSetting(name) {
    const field = settings.querySelector(`[name="${name}"]`);
    return Math.min(Number(field.max || Infinity), Math.max(Number(field.min || 0), Number(field.value)));
  }

  function updateControls() {
    $("roof-draw").disabled = !mapReady;
    $("roof-draw").setAttribute("aria-pressed", String(drawing));
    $("roof-finish").disabled = !drawing || corners.length < 3;
    $("roof-undo").disabled = !drawing || !corners.length;
    $("roof-reset").disabled = !drawing && !traced;
    analyzeButton.disabled = !traced || Boolean(analysisRequest);
    $("roof-print").disabled = !sunlight;
    mapNode.classList.toggle("is-drawing", drawing);
  }

  function loadMapScript() {
    if (window.L) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "assets/leaflet/leaflet.css";
      css.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      css.crossOrigin = "anonymous";
      const script = document.createElement("script");
      script.src = "assets/leaflet/leaflet.js";
      script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
      script.crossOrigin = "anonymous";
      const assets = [css, script].map(asset => new Promise((loaded, failed) => {
        asset.onload = loaded;
        asset.onerror = failed;
        document.head.append(asset);
      }));
      Promise.all(assets).then(resolve, reject);
    });
  }

  function redraw() {
    if (!map) return;
    shapeLayer.clearLayers();
    if (!corners.length) return;
    const style = { color: "#d8f482", weight: 3, interactive: false };
    if (traced) L.polygon(corners, { ...style, fillOpacity: .24 }).addTo(shapeLayer);
    else L.polyline(corners, style).addTo(shapeLayer);
    corners.forEach(point => L.circleMarker(point, { ...style, radius: 4, fillColor: "#11251a", fillOpacity: 1 }).addTo(shapeLayer));
  }

  function markLocation() {
    if (!map) return;
    locationMark?.remove();
    if (!foundPoint) return;
    locationMark = L.circleMarker(foundPoint, {
      className: "roof-location-marker", radius: 7, weight: 3, color: "#fff",
      fillColor: "#3c7a1e", fillOpacity: 1, interactive: false,
    }).addTo(map);
  }

  function createSatelliteLayer() {
    const imagery = L.tileLayer(satelliteTile, {
      maxZoom,
      attribution: 'Imagery © <a href="https://www.esri.com/en-us/home">Esri</a>, Maxar, Earthstar Geographics and the GIS community',
    });
    const createTile = imagery.createTile.bind(imagery);
    imagery.createTile = function(coords, done) {
      if (coords.z <= roofZoom) return createTile(coords, done);

      const tile = document.createElement("canvas");
      tile.width = tile.height = 256;
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        const canvas = tile.getContext("2d");
        if (tile.dataset.enlarged) {
          const size = image.naturalWidth / 2;
          canvas.drawImage(image, (coords.x % 2) * size, (coords.y % 2) * size, size, size, 0, 0, 256, 256);
        } else {
          canvas.drawImage(image, 0, 0, 256, 256);
        }
        done(null, tile);
      };
      image.onerror = () => {
        if (tile.dataset.enlarged) {
          done(new Error("Satellite image unavailable"), tile);
          return;
        }
        tile.dataset.enlarged = "true";
        image.src = L.Util.template(satelliteTile, { z: roofZoom, x: Math.floor(coords.x / 2), y: Math.floor(coords.y / 2) });
      };
      image.src = imagery.getTileUrl(coords);
      return tile;
    };
    return imagery;
  }

  async function initMap() {
    if (panel.hidden || mapLoading) return;
    if (map) {
      map.invalidateSize({ pan: false });
      return;
    }
    mapLoading = true;
    try {
      await loadMapScript();
      map = L.map(mapNode, { scrollWheelZoom: false, minZoom: 3, maxZoom });
      map.setView(savedLocation.point, savedLocation.zoom);
      const imagery = createSatelliteLayer();
      const streets = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxNativeZoom: roofZoom, maxZoom,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      });
      const basemaps = { satellite: imagery, street: streets };
      const detailNote = $("roof-imagery-detail");
      map.on("zoomend", () => {
        detailNote.hidden = activeLayer !== imagery || map.getZoom() !== maxZoom ||
          !mapNode.querySelector(".leaflet-tile-loaded[data-enlarged]");
      });
      for (const layer of Object.values(basemaps)) {
        layer.on("tileload", event => {
          if (layer !== activeLayer) return;
          mapStatus.hidden = true;
          if (event.coords.z === map.getZoom() && event.tile.dataset.enlarged) detailNote.hidden = false;
        });
        layer.on("tileerror", () => {
          if (layer !== activeLayer || mapStatus.hidden) return;
          mapStatus.textContent = "Map tiles are unavailable. Try the other map view or enter the roof coordinates below.";
        });
      }
      function showLayer(name) {
        if (activeLayer) activeLayer.remove();
        detailNote.hidden = true;
        mapStatus.textContent = "Loading map…";
        mapStatus.hidden = false;
        activeLayer = basemaps[name];
        activeLayer.addTo(map);
        layers.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.roofLayer === name)));
      }
      layers.forEach(button => {
        button.disabled = false;
        button.addEventListener("click", () => {
          if (button.getAttribute("aria-pressed") !== "true") showLayer(button.dataset.roofLayer);
        });
      });
      showLayer("satellite");
      L.control.scale({ imperial: false }).addTo(map);
      shapeLayer = L.layerGroup().addTo(map);
      markLocation();
      map.on("click", event => {
        if (!drawing) return;
        const point = event.latlng.wrap();
        corners.push([point.lat, point.lng]);
        drawStatus.textContent = `${corners.length} corners added. ${corners.length < 3 ? "Add at least three." : "Finish the outline when ready."}`;
        redraw();
        updateControls();
      });
      mapReady = true;
      redraw();
      if (traced) map.fitBounds(corners, { padding: [35, 35], maxZoom: roofZoom });
      updateControls();
    } catch {
      mapStatus.textContent = "The map could not load. Enter the roof coordinates below to continue.";
    } finally {
      mapLoading = false;
    }
  }

  function parsePoint(text) {
    const parts = text.split(",").map(part => part.trim());
    if (parts.length !== 2 || parts.some(part => !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(part))) return null;
    const [lat, lon] = parts.map(Number);
    return Math.abs(lat) <= 85 && Math.abs(lon) <= 180 ? [lat, lon] : null;
  }

  function validOutline(points) {
    if (points.length < 3) return null;
    const center = points.reduce(([lat, lon], point) => [lat + point[0] / points.length, lon + point[1] / points.length], [0, 0]);
    const metersPerDegree = 6371008.8 * Math.PI / 180;
    const lonScale = Math.cos(center[0] * Math.PI / 180) * metersPerDegree;
    const projected = points.map(([lat, lon]) => [(lon - center[1]) * lonScale, (lat - center[0]) * metersPerDegree]);
    const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const within = (a, b, c) => c.every((value, axis) => value >= Math.min(a[axis], b[axis]) && value <= Math.max(a[axis], b[axis]));
    function intersects(a, b, c, d) {
      const [abc, abd, cda, cdb] = [turn(a, b, c), turn(a, b, d), turn(c, d, a), turn(c, d, b)];
      return (abc * abd < 0 && cda * cdb < 0) ||
        (abc === 0 && within(a, b, c)) || (abd === 0 && within(a, b, d)) ||
        (cda === 0 && within(c, d, a)) || (cdb === 0 && within(c, d, b));
    }
    let twiceArea = 0;
    for (let i = 0; i < projected.length; i += 1) {
      const next = (i + 1) % projected.length;
      const [a, b] = [projected[i], projected[next]];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < .01) return null;
      twiceArea += a[0] * b[1] - b[0] * a[1];
      for (let j = i + 2; j < projected.length; j += 1) {
        const end = (j + 1) % projected.length;
        if (end !== i && intersects(a, b, projected[j], projected[end])) return null;
      }
    }
    const area = Math.abs(twiceArea) / 2;
    return area > .1 ? { area, center } : null;
  }

  function showEstimate() {
    const usable = readSetting("usable");
    const moduleWatts = readSetting("module");
    $("roof-usable-percent").textContent = `${usable}%`;
    $("roof-area").textContent = traced ? `${format.format(traced.area)} m²` : "—";
    const footprint = traced ? traced.area * usable / 100 : 0;
    const count = Math.floor(footprint / moduleArea[moduleWatts]);
    const capacity = count * moduleWatts / 1000;
    const net = (1 - readSetting("shade") / 100) * (1 - readSetting("loss") / 100);
    generation = sunlight?.map((value, index) => value * days[index] * capacity * net) || null;
    $("roof-usable").textContent = traced ? `${format.format(footprint)} m²` : "—";
    $("roof-panels").textContent = traced ? format.format(count) : "—";
    $("roof-capacity").textContent = traced ? `${format.format(capacity)} kWp` : "—";
    $("roof-annual").textContent = generation ? format.format(generation.reduce((sum, value) => sum + value, 0)) : "—";
    $("roof-sunlight").textContent = sunlight
      ? `${format.format(sunlight.reduce((sum, value, index) => sum + value * days[index], 0) / 365)} kWh/m²/day` : "—";
    renderChart();
  }

  function renderChart() {
    const isGeneration = $("roof-chart-mode").value === "generation";
    const values = isGeneration ? generation : sunlight;
    chart.hidden = !values;
    $("roof-chart-empty").hidden = Boolean(values);
    const reading = $("roof-chart-value");
    reading.hidden = !values;
    if (!values) {
      chart.replaceChildren();
      return;
    }
    const units = isGeneration ? "kWh/month" : "kWh/m²/day";
    const max = Math.max(...values) || 1;
    reading.textContent = "Select a month to see its value.";
    chart.replaceChildren(...values.map((value, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const bar = document.createElement("span");
      const month = document.createElement("span");
      const label = `${format.format(value)} ${units}`;
      const monthLabel = `${months[index]}: ${label}`;
      button.type = "button";
      button.title = monthLabel;
      button.setAttribute("aria-label", monthLabel);
      button.addEventListener("click", () => { reading.textContent = monthLabel; });
      bar.className = "roof-chart-bar";
      bar.style.setProperty("--roof-bar", `${value / max * 100}%`);
      bar.setAttribute("aria-hidden", "true");
      month.textContent = months[index];
      button.append(bar, month);
      item.append(button);
      return item;
    }));
  }

  function clearAnalysis() {
    analysisRequest?.abort();
    analysisRequest = null;
    sunlight = null;
    analysisStatus.textContent = traced ? "Roof traced. Run the analysis to load sunlight data." : "Trace a roof to begin.";
    showEstimate();
    updateControls();
  }

  function finishOutline(points, fit = false) {
    const outline = validOutline(points);
    if (!outline) {
      drawStatus.textContent = "Use at least three distinct corners in order around the roof, with no crossing edges.";
      return;
    }
    corners = points;
    traced = outline;
    drawing = false;
    clearAnalysis();
    redraw();
    if (fit) {
      savedLocation = { point: outline.center, zoom: 19 };
      foundPoint = null;
      markLocation();
      locationStatus.textContent = `Roof center: ${outline.center.map(value => value.toFixed(5)).join(", ")}`;
      if (map) map.fitBounds(corners, { padding: [35, 35], maxZoom: roofZoom });
    }
    drawStatus.textContent = "Roof outline complete. Use Analyze solar potential to load seasonal data.";
  }

  $("roof-draw").addEventListener("click", () => {
    drawing = true;
    corners = [];
    traced = null;
    clearAnalysis();
    redraw();
    drawStatus.textContent = "Tap or click each corner around one roof face, then finish the outline.";
  });
  $("roof-finish").addEventListener("click", () => finishOutline(corners));
  $("roof-undo").addEventListener("click", () => {
    corners.pop();
    redraw();
    updateControls();
    drawStatus.textContent = `${corners.length} corners in the outline.`;
  });
  $("roof-reset").addEventListener("click", () => {
    corners = [];
    drawing = false;
    traced = null;
    $("roof-vertices").value = "";
    clearAnalysis();
    redraw();
    drawStatus.textContent = "Roof cleared. Draw a new outline or enter its coordinates.";
  });
  $("roof-apply-coordinates").addEventListener("click", () => {
    const points = $("roof-vertices").value.trim().split(/\r?\n/).filter(line => line.trim()).map(parsePoint);
    if (points.some(point => !point)) {
      drawStatus.textContent = "Use one valid latitude, longitude pair on each line.";
      return;
    }
    if (points.length > 3 && points[0].every((value, axis) => value === points.at(-1)[axis])) points.pop();
    finishOutline(points, true);
  });

  function locate(point, label, zoom) {
    savedLocation = { point, zoom };
    foundPoint = point;
    if (map) map.setView(point, zoom);
    markLocation();
    locationStatus.textContent = label;
  }

  async function lookupPlace(endpoint, params, signal) {
    const query = new URLSearchParams({ ...params, f: "json" });
    const response = await fetch(`${geocoder}/${endpoint}?${query}`, { signal });
    if (!response.ok) throw Error("Location service unavailable");
    const data = await response.json();
    if (data.error) throw Error("Location service unavailable");
    return data;
  }

  function closeSuggestions() {
    clearTimeout(suggestionTimer);
    suggestionRequest?.abort();
    suggestionRequest = null;
    suggestions = [];
    selectedSuggestion = -1;
    suggestionList.hidden = true;
    suggestionList.replaceChildren();
    searchField.setAttribute("aria-expanded", "false");
    searchField.removeAttribute("aria-activedescendant");
    suggestionStatus.textContent = "";
  }

  async function showSuggestions(query) {
    const request = new AbortController();
    suggestionRequest = request;
    const timeout = setTimeout(() => request.abort(), 8000);
    try {
      const [latitude, longitude] = defaultLocation;
      const data = await lookupPlace("suggest", {
        text: query, maxSuggestions: "5", location: `${longitude},${latitude}`,
      }, request.signal);
      if (suggestionRequest !== request || panel.hidden || document.activeElement !== searchField) return;

      const exactPlace = item => item.text.split(",")[0].toLowerCase() === query.toLowerCase();
      suggestions = (data.suggestions || []).filter(item => item.text && item.magicKey && !item.isCollection)
        .sort((first, second) => Number(exactPlace(second)) - Number(exactPlace(first)));
      if (!suggestions.length) return;
      suggestionList.replaceChildren(...suggestions.map((item, index) => {
        const option = document.createElement("li");
        option.id = `roof-suggestion-${index}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.dataset.index = index;
        option.textContent = item.text;
        return option;
      }));
      suggestionList.hidden = false;
      searchField.setAttribute("aria-expanded", "true");
      suggestionStatus.textContent = `${suggestions.length} location suggestions available.`;
    } catch {
      // The explicit property search is still available if autocomplete fails.
    } finally {
      clearTimeout(timeout);
      if (suggestionRequest === request) suggestionRequest = null;
    }
  }

  function scheduleSuggestions() {
    closeSuggestions();
    const query = searchField.value.trim();
    if (query.length < 3 || /^[\s\d.,+\-]+$/.test(query)) return;
    suggestionTimer = setTimeout(() => showSuggestions(query), 350);
  }

  function selectSuggestion(index) {
    const item = suggestions[index];
    if (!item) return;
    searchField.value = item.text;
    closeSuggestions();
    findProperty(item.text, item.magicKey);
  }

  searchField.addEventListener("input", scheduleSuggestions);
  searchField.addEventListener("focus", scheduleSuggestions);
  searchField.addEventListener("blur", closeSuggestions);
  suggestionList.addEventListener("mousedown", event => event.preventDefault());
  suggestionList.addEventListener("click", event => {
    const option = event.target.closest("[role=option]");
    if (!option) return;
    selectSuggestion(Number(option.dataset.index));
    if (event.pointerType === "touch") searchField.blur();
  });

  searchField.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (!suggestionList.hidden) event.preventDefault();
      closeSuggestions();
      return;
    }
    if (suggestionList.hidden) return;
    if (event.key === "Enter" && selectedSuggestion >= 0) {
      event.preventDefault();
      selectSuggestion(selectedSuggestion);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const length = suggestions.length;
    selectedSuggestion = event.key === "ArrowDown"
      ? (selectedSuggestion + 1) % length
      : (selectedSuggestion <= 0 ? length - 1 : selectedSuggestion - 1);
    [...suggestionList.children].forEach((option, index) =>
      option.setAttribute("aria-selected", String(index === selectedSuggestion)));
    const option = suggestionList.children[selectedSuggestion];
    searchField.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView({ block: "nearest" });
  });

  async function findProperty(query, magicKey) {
    if (!query) return;
    const id = ++locationRequest;
    const coordinates = parsePoint(query);
    if (coordinates) {
      locate(coordinates, query, 19);
      return;
    }
    locationStatus.textContent = "Looking for your property…";
    try {
      const params = { SingleLine: query, maxLocations: "1" };
      if (magicKey) params.magicKey = magicKey;
      const data = await lookupPlace("findAddressCandidates", params, AbortSignal.timeout(12000));
      if (id !== locationRequest) return;
      const match = data.candidates?.[0];
      if (!match) {
        locationStatus.textContent = "No match found. Try a nearby landmark or enter coordinates.";
        return;
      }
      const extent = match.extent;
      if (map && extent && Math.abs(extent.xmax - extent.xmin) > .002) {
        map.fitBounds([[extent.ymin, extent.xmin], [extent.ymax, extent.xmax]], { maxZoom: 19 });
        savedLocation = { point: [match.location.y, match.location.x], zoom: map.getZoom() };
        foundPoint = savedLocation.point;
        markLocation();
        locationStatus.textContent = match.address;
      } else locate([match.location.y, match.location.x], match.address, 19);
    } catch {
      if (id === locationRequest) locationStatus.textContent = "Property search is unavailable. You can still enter latitude and longitude.";
    }
  }

  $("roof-search").addEventListener("submit", event => {
    event.preventDefault();
    closeSuggestions();
    findProperty(searchField.value.trim());
  });

  $("roof-geolocate").addEventListener("click", () => {
    if (!navigator.geolocation) {
      locationStatus.textContent = "Location is unavailable on this device. Search for your address instead.";
      return;
    }
    const id = ++locationRequest;
    locationStatus.textContent = "Waiting for your device location…";
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (id === locationRequest) locate([coords.latitude, coords.longitude], "Your current location", 19);
    }, () => {
      if (id === locationRequest) locationStatus.textContent = "Could not use your location. Search for a place or enter coordinates.";
    }, { timeout: 10000 });
  });

  analyzeButton.addEventListener("click", async () => {
    if (!traced || analysisRequest) return;
    const [latitude, longitude] = traced.center;
    const request = new AbortController();
    analysisRequest = request;
    updateControls();
    analysisStatus.textContent = "Loading regional sunlight data from NASA POWER…";
    const timeout = setTimeout(() => request.abort(), 15000);
    try {
      const params = new URLSearchParams({ latitude: latitude.toFixed(5), longitude: longitude.toFixed(5), parameters: solarParameter, community: "RE", format: "JSON" });
      const response = await fetch(`https://power.larc.nasa.gov/api/temporal/climatology/point?${params}`, { signal: request.signal });
      if (!response.ok) throw Error();
      const data = await response.json();
      const source = data.properties?.parameter?.[solarParameter];
      const readings = months.map(month => source?.[month.toUpperCase()]);
      if (readings.some(value => !Number.isFinite(value) || value < 0)) throw Error();
      if (analysisRequest !== request) return;
      sunlight = readings;
      showEstimate();
      analysisStatus.textContent = "Seasonal estimate based on NASA POWER monthly climatology.";
    } catch {
      if (analysisRequest === request) analysisStatus.textContent = "Sunlight data could not load. Try the analysis again. Roof measurements are still available.";
    } finally {
      clearTimeout(timeout);
      if (analysisRequest === request) {
        analysisRequest = null;
        updateControls();
      }
    }
  });

  settings.addEventListener("input", showEstimate);
  $("roof-chart-mode").addEventListener("change", renderChart);
  $("roof-print").addEventListener("click", () => window.print());
  new MutationObserver(initMap).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  initMap();
  updateControls();
})();
