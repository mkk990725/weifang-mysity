const places = window.WEIFANG_PLACES || [];
const mapConfig = window.WEIFANG_MAP_CONFIG || {};

const state = {
  activeCategory: "全部",
  query: "",
  selectedId: places[0]?.id,
  threeD: true,
  touring: false,
  tourTimer: null,
  moving: false,
  initialized: false
};

const categoryColors = {
  全部: "#245d4f",
  文化: "#245d4f",
  园林: "#8a5a24",
  非遗: "#a33d2d",
  古城: "#5d4b8c"
};

let map = null;
let routeLine = null;
let lastDetailId = null;
const markers = new Map();

const filters = document.getElementById("filters");
const placeList = document.getElementById("placeList");
const detailPanel = document.getElementById("detailPanel");
const searchInput = document.getElementById("searchInput");
const threeDButton = document.getElementById("threeDButton");
const tourButton = document.getElementById("tourButton");
const mapContainer = document.getElementById("map");

function toLngLat(place) {
  return place.amapPosition || [place.coordinates[1], place.coordinates[0]];
}

function showMapError(message) {
  mapContainer.innerHTML = `<div class="map-error"><strong>地图未加载</strong><span>${message}</span></div>`;
}

function loadAmap() {
  if (!mapConfig.amapKey) {
    showMapError("请复制 config.example.js 为 config.js，并填入高德 Web JS API Key。");
    return;
  }

  if (mapConfig.amapSecurityJsCode) {
    window._AMapSecurityConfig = {
      securityJsCode: mapConfig.amapSecurityJsCode
    };
  }

  const script = document.createElement("script");
  script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(
    mapConfig.amapKey
  )}&plugin=AMap.ControlBar,AMap.ToolBar,AMap.Scale`;
  script.async = true;
  script.onerror = () => showMapError("高德地图脚本加载失败，请检查 Key、网络和高德后台安全配置。");
  script.onload = initMap;
  document.head.appendChild(script);
}

function initMap() {
  try {
    map = new AMap.Map("map", {
      viewMode: "3D",
      center: [119.05, 36.72],
      zoom: 9.45,
      pitch: 58,
      rotation: -18,
      resizeEnable: true,
      animateEnable: true,
      mapStyle: "amap://styles/fresh",
      features: ["bg", "road", "building", "point"]
    });

    AMap.plugin(["AMap.ControlBar", "AMap.ToolBar", "AMap.Scale"], () => {
      map.addControl(
        new AMap.ControlBar({
          position: {
            right: "18px",
            bottom: "138px"
          }
        })
      );
      map.addControl(
        new AMap.ToolBar({
          position: {
            right: "18px",
            bottom: "76px"
          }
        })
      );
      map.addControl(new AMap.Scale());
    });

    convertCoordinates().finally(() => {
      state.initialized = true;
      renderAll({ moveMap: true });
      threeDButton.classList.add("is-active");
    });

    map.on("moveend", () => {
      state.moving = false;
    });
  } catch (error) {
    showMapError("高德地图初始化失败，请检查 Web JS Key 是否启用、域名白名单和安全密钥配置。");
    console.error(error);
  }
}

function convertCoordinates() {
  if (!AMap.convertFrom || !places.length) return Promise.resolve();

  return new Promise((resolve) => {
    const gpsPositions = places.map((place) => [place.coordinates[1], place.coordinates[0]]);
    AMap.convertFrom(gpsPositions, "gps", (status, result) => {
      if (status === "complete" && result.locations?.length) {
        result.locations.forEach((location, index) => {
          places[index].amapPosition = [location.lng, location.lat];
        });
      }
      resolve();
    });
  });
}

function uniqueCategories() {
  return ["全部", ...new Set(places.map((place) => place.category))];
}

function matchesPlace(place) {
  const categoryMatch = state.activeCategory === "全部" || place.category === state.activeCategory;
  const query = state.query.trim().toLowerCase();
  if (!query) return categoryMatch;

  const searchableText = [
    place.name,
    place.category,
    place.district,
    place.address,
    place.phone,
    place.tags.join(" "),
    place.highlights.join(" ")
  ]
    .join(" ")
    .toLowerCase();

  return categoryMatch && searchableText.includes(query);
}

function filteredPlaces() {
  return places.filter(matchesPlace);
}

function renderFilters() {
  filters.innerHTML = uniqueCategories()
    .map((category) => {
      const active = category === state.activeCategory ? "is-active" : "";
      return `<button class="filter-chip ${active}" data-category="${category}" type="button">${category}</button>`;
    })
    .join("");
}

function createMarkerElement(place) {
  const marker = document.createElement("button");
  marker.className = "map-marker";
  marker.type = "button";
  marker.style.setProperty("--marker-color", categoryColors[place.category] || categoryColors.全部);
  marker.setAttribute("aria-label", place.name);
  marker.innerHTML = `
    <span class="marker-pulse"></span>
    <span class="marker-post"></span>
    <span class="marker-pin">${place.category}</span>
    <strong>${place.name}</strong>
  `;
  marker.addEventListener("click", () => selectPlace(place.id, true));
  return marker;
}

function renderMarkers() {
  if (!map) return;
  const visibleIds = new Set(filteredPlaces().map((place) => place.id));

  markers.forEach((marker, id) => {
    if (!visibleIds.has(id)) {
      map.remove(marker);
      markers.delete(id);
    }
  });

  filteredPlaces().forEach((place) => {
    let marker = markers.get(place.id);
    if (!marker) {
      marker = new AMap.Marker({
        position: toLngLat(place),
        content: createMarkerElement(place),
        anchor: "bottom-center",
        offset: new AMap.Pixel(0, -8)
      });
      marker.setMap(map);
      markers.set(place.id, marker);
    } else {
      marker.setPosition(toLngLat(place));
    }

    marker.getContent().classList.toggle("is-selected", place.id === state.selectedId);
  });
}

function updateMarkerSelection() {
  markers.forEach((marker, id) => {
    marker.getContent().classList.toggle("is-selected", id === state.selectedId);
  });
}

function renderList() {
  const visiblePlaces = filteredPlaces();
  if (!visiblePlaces.length) {
    placeList.innerHTML = '<p class="empty-state">没有匹配的已核验地点。</p>';
    return;
  }

  placeList.innerHTML = visiblePlaces
    .map((place, index) => {
      const active = place.id === state.selectedId ? "is-active" : "";
      const tags = place.tags.slice(0, 3).map((tag) => `<span>${tag}</span>`).join("");
      return `
        <button class="place-card ${active}" data-place-id="${place.id}" type="button" style="--delay:${index * 70}ms">
          <span>${place.district} · ${place.category} · 核验${place.confidence}</span>
          <strong>${place.name}</strong>
          <small>${place.address}</small>
          <em>${tags}</em>
        </button>
      `;
    })
    .join("");
}

function updateListSelection() {
  placeList.querySelectorAll("[data-place-id]").forEach((card) => {
    const isSelected = card.dataset.placeId === state.selectedId;
    card.classList.toggle("is-active", isSelected);
    if (isSelected) {
      card.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center"
      });
    }
  });
}

function renderDetail() {
  const place = places.find((item) => item.id === state.selectedId) || filteredPlaces()[0] || places[0];
  if (!place) {
    detailPanel.innerHTML = "";
    return;
  }

  if (place.id === lastDetailId) return;
  lastDetailId = place.id;
  detailPanel.classList.add("is-switching");

  const tags = place.tags.map((tag) => `<span>${tag}</span>`).join("");
  const highlights = place.highlights.map((item) => `<li>${item}</li>`).join("");
  const sources = place.sources
    .map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer">${source.label}</a>`)
    .join("");

  detailPanel.innerHTML = `
    <article class="place-detail">
      <div class="detail-image" style="background-image:url('${place.image.url}')">
        <span>${place.image.credit}</span>
      </div>
      <div class="detail-content">
        <div class="detail-heading">
          <p>${place.district} · ${place.category}</p>
          <h2>${place.name}</h2>
          <span>核验${place.confidence}</span>
        </div>
        <div class="detail-tags">${tags}</div>
        <dl class="facts">
          <div><dt>地址</dt><dd>${place.address}</dd></div>
          <div><dt>电话</dt><dd>${place.phone}</dd></div>
          <div><dt>开放</dt><dd>${place.hours}</dd></div>
          <div><dt>票务</dt><dd>${place.ticket}</dd></div>
        </dl>
        <ul class="highlights">${highlights}</ul>
        <div class="source-list">
          <strong>公开来源</strong>
          ${sources}
        </div>
      </div>
    </article>
  `;

  window.requestAnimationFrame(() => {
    detailPanel.classList.remove("is-switching");
  });
}

function renderRouteLayer() {
  if (!map) return;
  const path = filteredPlaces().map(toLngLat);
  if (path.length < 2) {
    if (routeLine) routeLine.hide();
    return;
  }

  if (!routeLine) {
    routeLine = new AMap.Polyline({
      path,
      strokeColor: "#4da6c8",
      strokeOpacity: 0.82,
      strokeWeight: 7,
      strokeStyle: "dashed",
      lineJoin: "round",
      lineCap: "round",
      zIndex: 40
    });
    routeLine.setMap(map);
  } else {
    routeLine.setPath(path);
    routeLine.show();
  }
}

function easeToPlace(place, zoom = 13.15) {
  if (!map) return;
  if (state.moving && map.stop) map.stop();
  state.moving = true;

  if (map.setPitch) map.setPitch(state.threeD ? 64 : 0);
  if (map.setRotation) map.setRotation(state.threeD ? -24 : 0);
  map.setZoomAndCenter(Math.max(zoom, 13.15), toLngLat(place), false, 900);
}

function fitVisiblePlaces() {
  if (!map) return;
  const visiblePlaces = filteredPlaces();
  if (!visiblePlaces.length) return;

  if (map.setPitch) map.setPitch(state.threeD ? 56 : 0);
  if (map.setRotation) map.setRotation(state.threeD ? -18 : 0);

  const overlays = visiblePlaces.map((place) => markers.get(place.id)).filter(Boolean);
  if (overlays.length > 1) {
    map.setFitView(overlays, false, [170, 470, 170, 70], 10.4);
  } else {
    map.setZoomAndCenter(12.6, toLngLat(visiblePlaces[0]), false, 650);
  }
}

function selectPlace(id, moveMap = false) {
  if (state.selectedId === id) {
    const current = places.find((item) => item.id === id);
    if (moveMap && current) easeToPlace(current, map?.getZoom?.() || 13.15);
    return;
  }

  state.selectedId = id;
  updateMarkerSelection();
  updateListSelection();
  renderDetail();

  if (moveMap) {
    const place = places.find((item) => item.id === id);
    if (place) easeToPlace(place);
  }
}

function renderAll({ moveMap = false } = {}) {
  const visiblePlaces = filteredPlaces();
  if (visiblePlaces.length && !visiblePlaces.some((place) => place.id === state.selectedId)) {
    state.selectedId = visiblePlaces[0].id;
    lastDetailId = null;
  }

  renderFilters();
  renderMarkers();
  renderList();
  updateMarkerSelection();
  updateListSelection();
  renderDetail();
  renderRouteLayer();
  if (moveMap) fitVisiblePlaces();
}

function toggleThreeD() {
  state.threeD = !state.threeD;
  threeDButton.classList.toggle("is-active", state.threeD);
  threeDButton.setAttribute("aria-pressed", String(state.threeD));

  const selected = places.find((place) => place.id === state.selectedId);
  if (selected) easeToPlace(selected, map?.getZoom?.() || 13.15);
}

function advanceTour() {
  const visiblePlaces = filteredPlaces();
  if (!visiblePlaces.length) return;
  const currentIndex = Math.max(0, visiblePlaces.findIndex((place) => place.id === state.selectedId));
  const nextPlace = visiblePlaces[(currentIndex + 1) % visiblePlaces.length];
  selectPlace(nextPlace.id, true);
}

function toggleTour() {
  state.touring = !state.touring;
  tourButton.classList.toggle("is-active", state.touring);
  tourButton.setAttribute("aria-pressed", String(state.touring));

  if (state.touring) {
    advanceTour();
    state.tourTimer = window.setInterval(advanceTour, 5200);
  } else {
    window.clearInterval(state.tourTimer);
  }
}

filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.activeCategory = button.dataset.category;
  renderAll({ moveMap: true });
});

placeList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-place-id]");
  if (!button) return;
  if (state.touring) toggleTour();
  selectPlace(button.dataset.placeId, true);
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderAll({ moveMap: true });
});

threeDButton.addEventListener("click", toggleThreeD);
tourButton.addEventListener("click", toggleTour);

renderFilters();
renderList();
renderDetail();
loadAmap();
