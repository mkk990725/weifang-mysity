const places = window.WEIFANG_PLACES || [];

const state = {
  activeCategory: "全部",
  query: "",
  selectedId: places[0]?.id,
  threeD: true,
  touring: false,
  tourTimer: null,
  moving: false
};

const categoryColors = {
  全部: "#245d4f",
  文化: "#245d4f",
  园林: "#8a5a24",
  非遗: "#a33d2d",
  古城: "#5d4b8c"
};

const map = new maplibregl.Map({
  container: "map",
  center: [119.05, 36.72],
  zoom: 9.45,
  pitch: 58,
  bearing: -18,
  antialias: true,
  style: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors"
      }
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm"
      }
    ]
  }
});

map.addControl(
  new maplibregl.NavigationControl({
    visualizePitch: true,
    showCompass: true,
    showZoom: true
  }),
  "bottom-right"
);

const filters = document.getElementById("filters");
const placeList = document.getElementById("placeList");
const detailPanel = document.getElementById("detailPanel");
const searchInput = document.getElementById("searchInput");
const threeDButton = document.getElementById("threeDButton");
const tourButton = document.getElementById("tourButton");
const markers = new Map();
let lastDetailId = null;

function toLngLat(place) {
  return [place.coordinates[1], place.coordinates[0]];
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
    <span class="marker-pin">${place.category}</span>
    <strong>${place.name}</strong>
  `;
  marker.addEventListener("click", () => selectPlace(place.id, true));
  return marker;
}

function renderMarkers() {
  const visibleIds = new Set(filteredPlaces().map((place) => place.id));

  markers.forEach((marker, id) => {
    if (!visibleIds.has(id)) {
      marker.remove();
      markers.delete(id);
    }
  });

  filteredPlaces().forEach((place) => {
    let marker = markers.get(place.id);
    if (!marker) {
      marker = new maplibregl.Marker({
        element: createMarkerElement(place),
        anchor: "bottom",
        offset: [0, -8]
      })
        .setLngLat(toLngLat(place))
        .addTo(map);
      markers.set(place.id, marker);
    }

    marker.getElement().classList.toggle("is-selected", place.id === state.selectedId);
  });
}

function updateMarkerSelection() {
  markers.forEach((marker, id) => {
    marker.getElement().classList.toggle("is-selected", id === state.selectedId);
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
  const visiblePlaces = filteredPlaces();
  const features =
    visiblePlaces.length > 1
      ? [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: visiblePlaces.map(toLngLat)
            }
          }
        ]
      : [];

  const source = map.getSource("place-route");
  const route = {
    type: "FeatureCollection",
    features
  };

  if (source) {
    source.setData(route);
    return;
  }

  map.addSource("place-route", {
    type: "geojson",
    data: route
  });

  map.addLayer({
    id: "place-route-glow",
    type: "line",
    source: "place-route",
    paint: {
      "line-color": "#f0b35a",
      "line-opacity": 0.38,
      "line-width": 8,
      "line-blur": 4
    }
  });

  map.addLayer({
    id: "place-route",
    type: "line",
    source: "place-route",
    paint: {
      "line-color": "#a33d2d",
      "line-opacity": 0.72,
      "line-width": 2,
      "line-dasharray": [1.2, 1.2]
    }
  });
}

function easeToPlace(place, zoom = 13.15) {
  if (state.moving) map.stop();
  state.moving = true;

  map.easeTo({
    center: toLngLat(place),
    zoom,
    pitch: state.threeD ? 64 : 0,
    bearing: state.threeD ? -24 : 0,
    duration: 980,
    easing: (time) => 1 - Math.pow(1 - time, 3),
    essential: true
  });
}

function fitVisiblePlaces() {
  const visiblePlaces = filteredPlaces();
  if (!visiblePlaces.length) return;

  const bounds = new maplibregl.LngLatBounds();
  visiblePlaces.forEach((place) => bounds.extend(toLngLat(place)));
  map.fitBounds(bounds, {
    padding: { top: 170, right: 470, bottom: 170, left: 70 },
    maxZoom: 10.4,
    pitch: state.threeD ? 56 : 0,
    bearing: state.threeD ? -18 : 0,
    duration: 700
  });
}

function selectPlace(id, moveMap = false) {
  if (state.selectedId === id) {
    const current = places.find((item) => item.id === id);
    if (moveMap && current) easeToPlace(current, Math.max(map.getZoom(), 13.15));
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
  }

  renderFilters();
  renderMarkers();
  renderList();
  updateMarkerSelection();
  updateListSelection();
  renderDetail();
  if (map.loaded()) renderRouteLayer();
  if (moveMap) fitVisiblePlaces();
}

function toggleThreeD() {
  state.threeD = !state.threeD;
  threeDButton.classList.toggle("is-active", state.threeD);
  threeDButton.setAttribute("aria-pressed", String(state.threeD));

  const selected = places.find((place) => place.id === state.selectedId);
  if (selected) easeToPlace(selected, map.getZoom());
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

map.on("load", () => {
  renderAll({ moveMap: true });
  threeDButton.classList.add("is-active");
});

map.on("moveend", () => {
  state.moving = false;
});
