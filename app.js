const places = window.WEIFANG_PLACES || [];
const state = {
  activeCategory: "全部",
  query: "",
  selectedId: places[0]?.id
};

const categoryColors = {
  "全部": "#2f5f4b",
  "文化": "#2f5f4b",
  "园林": "#8a5a24",
  "非遗": "#a33d2d",
  "古城": "#5d4b8c"
};

const map = L.map("map", {
  zoomControl: false,
  scrollWheelZoom: true
}).setView([36.72, 119.05], 10);

L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const markers = new Map();

const filters = document.getElementById("filters");
const placeList = document.getElementById("placeList");
const detailPanel = document.getElementById("detailPanel");
const searchInput = document.getElementById("searchInput");

function uniqueCategories() {
  return ["全部", ...new Set(places.map((place) => place.category))];
}

function matchesPlace(place) {
  const query = state.query.trim().toLowerCase();
  const categoryMatch = state.activeCategory === "全部" || place.category === state.activeCategory;
  if (!query) return categoryMatch;

  const text = [
    place.name,
    place.category,
    place.district,
    place.address,
    place.tags.join(" "),
    place.highlights.join(" ")
  ]
    .join(" ")
    .toLowerCase();

  return categoryMatch && text.includes(query);
}

function filteredPlaces() {
  return places.filter(matchesPlace);
}

function markerHtml(place, isSelected) {
  const color = categoryColors[place.category] || "#2f5f4b";
  return `<button class="map-marker ${isSelected ? "is-selected" : ""}" style="--marker-color:${color}" aria-label="${place.name}"><span>${place.category}</span></button>`;
}

function renderFilters() {
  filters.innerHTML = uniqueCategories()
    .map((category) => {
      const active = category === state.activeCategory ? "is-active" : "";
      return `<button class="filter-chip ${active}" data-category="${category}" type="button">${category}</button>`;
    })
    .join("");
}

function renderMarkers() {
  markerLayer.clearLayers();
  markers.clear();

  filteredPlaces().forEach((place) => {
    const marker = L.marker(place.coordinates, {
      icon: L.divIcon({
        className: "marker-shell",
        html: markerHtml(place, place.id === state.selectedId),
        iconSize: [78, 34],
        iconAnchor: [39, 17]
      })
    });

    marker.on("click", () => selectPlace(place.id, true));
    marker.addTo(markerLayer);
    markers.set(place.id, marker);
  });
}

function renderList() {
  const visiblePlaces = filteredPlaces();

  if (!visiblePlaces.length) {
    placeList.innerHTML = '<p class="empty-state">没有匹配的已核验地点。</p>';
    return;
  }

  placeList.innerHTML = visiblePlaces
    .map((place) => {
      const active = place.id === state.selectedId ? "is-active" : "";
      const tagText = place.tags.slice(0, 3).map((tag) => `<span>${tag}</span>`).join("");
      return `
        <button class="place-card ${active}" data-place-id="${place.id}" type="button">
          <span class="place-card__meta">${place.district} · ${place.category} · 核验${place.confidence}</span>
          <strong>${place.name}</strong>
          <small>${place.address}</small>
          <span class="tag-row">${tagText}</span>
        </button>
      `;
    })
    .join("");
}

function renderDetail() {
  const place = places.find((item) => item.id === state.selectedId) || filteredPlaces()[0] || places[0];
  if (!place) {
    detailPanel.innerHTML = "";
    return;
  }

  const highlights = place.highlights.map((item) => `<li>${item}</li>`).join("");
  const sources = place.sources
    .map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer">${source.label}</a>`)
    .join("");
  const tags = place.tags.map((tag) => `<span>${tag}</span>`).join("");

  detailPanel.innerHTML = `
    <article class="place-detail">
      <div class="detail-image" style="background-image:url('${place.image.url}')">
        <span>${place.image.credit}</span>
      </div>
      <div class="detail-body">
        <div class="detail-title">
          <div>
            <p>${place.district} · ${place.category}</p>
            <h2>${place.name}</h2>
          </div>
          <span>核验${place.confidence}</span>
        </div>
        <div class="detail-tags">${tags}</div>
        <dl class="fact-grid">
          <div><dt>地址</dt><dd>${place.address}</dd></div>
          <div><dt>电话</dt><dd>${place.phone}</dd></div>
          <div><dt>开放</dt><dd>${place.hours}</dd></div>
          <div><dt>票务</dt><dd>${place.ticket}</dd></div>
        </dl>
        <ul class="highlights">${highlights}</ul>
        <div class="source-list">
          <strong>来源</strong>
          ${sources}
        </div>
      </div>
    </article>
  `;
}

function syncMapView() {
  const visiblePlaces = filteredPlaces();
  if (!visiblePlaces.length) return;

  if (state.selectedId) {
    const selected = visiblePlaces.find((place) => place.id === state.selectedId);
    if (selected) {
      map.flyTo(selected.coordinates, Math.max(map.getZoom(), 12), { duration: 0.45 });
      return;
    }
  }

  const bounds = L.latLngBounds(visiblePlaces.map((place) => place.coordinates));
  map.fitBounds(bounds.pad(0.2), { maxZoom: 11 });
}

function selectPlace(id, moveMap = false) {
  state.selectedId = id;
  renderMarkers();
  renderList();
  renderDetail();

  if (moveMap) {
    const place = places.find((item) => item.id === id);
    if (place) map.flyTo(place.coordinates, 14, { duration: 0.45 });
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
  renderDetail();
  if (moveMap) syncMapView();
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
  selectPlace(button.dataset.placeId, true);
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderAll({ moveMap: true });
});

renderAll({ moveMap: true });
