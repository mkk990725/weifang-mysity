const places = window.WEIFANG_PLACES || [];

const WORLD = {
  width: 1400,
  height: 900,
  padX: 120,
  padY: 110
};

const state = {
  activeCategory: "全部",
  query: "",
  selectedId: places[0]?.id,
  scale: 1,
  tx: 0,
  ty: 0,
  editMode: false,
  detailOpen: false,
  touring: false,
  tourTimer: null,
  layout: {}
};

const categoryColors = {
  全部: "#2d6654",
  文化: "#2d6654",
  园林: "#8a6024",
  非遗: "#ad4637",
  古城: "#5d4b8c"
};

const filters = document.getElementById("filters");
const placeList = document.getElementById("placeList");
const detailPanel = document.getElementById("detailPanel");
const detailToggle = document.getElementById("detailToggle");
const searchInput = document.getElementById("searchInput");
const markerLayer = document.getElementById("markerLayer");
const routeLayer = document.getElementById("routeLayer");
const footstepsLayer = document.getElementById("footstepsLayer");
const mapCanvas = document.getElementById("mapCanvas");
const editButton = document.getElementById("editButton");
const tourButton = document.getElementById("tourButton");
const zoomInButton = document.getElementById("zoomInButton");
const zoomOutButton = document.getElementById("zoomOutButton");
const editPanel = document.getElementById("editPanel");
const layoutOutput = document.getElementById("layoutOutput");
const mapViewport = document.getElementById("map");
const viewport = {
  width: window.innerWidth,
  height: window.innerHeight
};

const bounds = places.reduce(
  (box, place) => {
    const [lat, lng] = place.coordinates;
    return {
      minLat: Math.min(box.minLat, lat),
      maxLat: Math.max(box.maxLat, lat),
      minLng: Math.min(box.minLng, lng),
      maxLng: Math.max(box.maxLng, lng)
    };
  },
  { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity }
);

function project(place) {
  if (state.layout[place.id]) return state.layout[place.id];

  const [lat, lng] = place.coordinates;
  const width = WORLD.width - WORLD.padX * 2;
  const height = WORLD.height - WORLD.padY * 2;
  const lngSpan = Math.max(0.01, bounds.maxLng - bounds.minLng);
  const latSpan = Math.max(0.01, bounds.maxLat - bounds.minLat);
  return {
    x: WORLD.padX + ((lng - bounds.minLng) / lngSpan) * width,
    y: WORLD.height - WORLD.padY - ((lat - bounds.minLat) / latSpan) * height
  };
}

function screenToWorld(clientX, clientY) {
  const rect = mapViewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.tx) / state.scale,
    y: (clientY - rect.top - state.ty) / state.scale
  };
}

function refreshViewport() {
  viewport.width = mapViewport.clientWidth;
  viewport.height = mapViewport.clientHeight;
}

function uniqueCategories() {
  return ["全部", ...new Set(places.map((place) => place.category))];
}

function matchesPlace(place) {
  const categoryMatch = state.activeCategory === "全部" || place.category === state.activeCategory;
  const query = state.query.trim().toLowerCase();
  if (!query) return categoryMatch;

  const text = [
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

  return categoryMatch && text.includes(query);
}

function filteredPlaces() {
  return places.filter(matchesPlace);
}

function pathFromPoints(points) {
  if (!points.length) return "";
  return points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const prev = points[index - 1];
      const cx = (prev.x + point.x) / 2;
      const cy = (prev.y + point.y) / 2 - 38;
      return `Q ${cx} ${cy} ${point.x} ${point.y}`;
    })
    .join(" ");
}

function renderFilters() {
  filters.innerHTML = uniqueCategories()
    .map((category) => {
      const active = category === state.activeCategory ? "is-active" : "";
      return `<button class="filter-chip ${active}" data-category="${category}" type="button">${category}</button>`;
    })
    .join("");
}

function renderRoute() {
  const visible = filteredPlaces();
  const points = visible.map(project);
  const path = pathFromPoints(points);
  routeLayer.innerHTML = path
    ? `<path class="living-route" d="${path}" pathLength="100" />`
    : "";

  const steps = [];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const count = 5;
    for (let step = 1; step <= count; step += 1) {
      const t = step / (count + 1);
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
      steps.push(`<g class="footstep" style="--delay:${(index * count + step) * 120}ms" transform="translate(${x} ${y}) rotate(${angle})">
        <ellipse cx="-5" cy="-3" rx="3" ry="6" />
        <ellipse cx="5" cy="3" rx="3" ry="6" />
      </g>`);
    }
  }
  footstepsLayer.innerHTML = steps.join("");
}

function renderMarkers() {
  markerLayer.innerHTML = filteredPlaces()
    .map((place) => {
      const point = project(place);
      const selected = place.id === state.selectedId ? "is-selected" : "";
      const editable = state.editMode ? "is-editable" : "";
      const color = categoryColors[place.category] || categoryColors.全部;
      return `
        <button class="map-marker ${selected} ${editable}" data-place-id="${place.id}" type="button" style="--x:${point.x}px;--y:${point.y}px;--marker-color:${color}">
          <span class="marker-post"></span>
          <span class="marker-pin">${place.category}</span>
          <strong>${place.name}</strong>
        </button>
      `;
    })
    .join("");
}

function renderList() {
  const visible = filteredPlaces();
  if (!visible.length) {
    placeList.innerHTML = '<p class="empty-state">没有匹配的已核验地点。</p>';
    return;
  }

  placeList.innerHTML = visible
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

function renderDetail() {
  const place = places.find((item) => item.id === state.selectedId) || filteredPlaces()[0] || places[0];
  if (!place) {
    detailPanel.innerHTML = "";
    return;
  }

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
}

function setDetailOpen(open) {
  state.detailOpen = open;
  detailPanel.classList.toggle("is-open", state.detailOpen);
  detailToggle.classList.toggle("is-open", state.detailOpen);
  detailToggle.setAttribute("aria-expanded", String(state.detailOpen));
}

function updateSelectionClasses() {
  markerLayer.querySelectorAll("[data-place-id]").forEach((marker) => {
    marker.classList.toggle("is-selected", marker.dataset.placeId === state.selectedId);
  });

  placeList.querySelectorAll("[data-place-id]").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.placeId === state.selectedId);
  });
}

function updateLayoutOutput() {
  const data = Object.fromEntries(
    Object.entries(state.layout).map(([id, point]) => [id, {
      x: Math.round(point.x),
      y: Math.round(point.y)
    }])
  );
  layoutOutput.value = JSON.stringify(data, null, 2);
}

function getMinimumScale() {
  return Math.max(viewport.width / WORLD.width, viewport.height / WORLD.height, 0.65);
}

function clampView() {
  const minScale = getMinimumScale();
  state.scale = Math.max(minScale, Math.min(2.4, state.scale));

  const scaledWidth = WORLD.width * state.scale;
  const scaledHeight = WORLD.height * state.scale;

  if (scaledWidth <= viewport.width) {
    state.tx = (viewport.width - scaledWidth) / 2;
  } else {
    state.tx = Math.min(0, Math.max(viewport.width - scaledWidth, state.tx));
  }

  if (scaledHeight <= viewport.height) {
    state.ty = (viewport.height - scaledHeight) / 2;
  } else {
    state.ty = Math.min(0, Math.max(viewport.height - scaledHeight, state.ty));
  }
}

function applyTransform() {
  clampView();
  mapCanvas.style.transform = `matrix(${state.scale}, 0, 0, ${state.scale}, ${state.tx}, ${state.ty})`;
}

function centerOnPlace(id) {
  const place = places.find((item) => item.id === id);
  if (!place) return;
  const point = project(place);
  state.tx = viewport.width / 2 - point.x * state.scale;
  state.ty = viewport.height / 2 - point.y * state.scale;
  applyTransform();
}

function selectPlace(id, { moveMap = false, openDetail = true } = {}) {
  state.selectedId = id;
  updateSelectionClasses();
  renderDetail();
  if (openDetail) setDetailOpen(true);
  if (moveMap) centerOnPlace(id);
}

function renderAll({ moveMap = false } = {}) {
  const visible = filteredPlaces();
  if (visible.length && !visible.some((place) => place.id === state.selectedId)) {
    state.selectedId = visible[0].id;
  }
  renderFilters();
  renderRoute();
  renderMarkers();
  renderList();
  renderDetail();
  updateLayoutOutput();
  if (moveMap && state.selectedId) centerOnPlace(state.selectedId);
}

function toggleEditMode() {
  state.editMode = !state.editMode;
  editButton.classList.toggle("is-active", state.editMode);
  editButton.setAttribute("aria-pressed", String(state.editMode));
  editPanel.classList.toggle("is-visible", state.editMode);
  renderMarkers();
}

function zoomBy(delta, apply = true) {
  state.scale = Math.max(getMinimumScale(), Math.min(2.4, state.scale + delta));
  if (apply) applyTransform();
}

function advanceTour() {
  const visible = filteredPlaces();
  if (!visible.length) return;
  const currentIndex = Math.max(0, visible.findIndex((place) => place.id === state.selectedId));
  const next = visible[(currentIndex + 1) % visible.length];
  selectPlace(next.id, { moveMap: true });
}

function toggleTour() {
  state.touring = !state.touring;
  tourButton.classList.toggle("is-active", state.touring);
  tourButton.setAttribute("aria-pressed", String(state.touring));
  if (state.touring) {
    advanceTour();
    state.tourTimer = window.setInterval(advanceTour, 4800);
  } else {
    window.clearInterval(state.tourTimer);
  }
}

let panStart = null;
let dragMarker = null;
let frameRequested = false;

function scheduleTransform() {
  if (frameRequested) return;
  frameRequested = true;
  window.requestAnimationFrame(() => {
    frameRequested = false;
    applyTransform();
  });
}

mapViewport.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".map-marker")) return;
  refreshViewport();
  mapViewport.setPointerCapture?.(event.pointerId);
  mapCanvas.classList.add("is-dragging");
  panStart = {
    x: event.clientX,
    y: event.clientY,
    tx: state.tx,
    ty: state.ty
  };
});

window.addEventListener("pointermove", (event) => {
  if (dragMarker) {
    const point = screenToWorld(event.clientX, event.clientY);
    state.layout[dragMarker] = {
      x: Math.max(40, Math.min(WORLD.width - 40, point.x)),
      y: Math.max(40, Math.min(WORLD.height - 40, point.y))
    };
    renderRoute();
    renderMarkers();
    updateLayoutOutput();
    return;
  }

  if (!panStart) return;
  state.tx = panStart.tx + event.clientX - panStart.x;
  state.ty = panStart.ty + event.clientY - panStart.y;
  scheduleTransform();
});

window.addEventListener("pointerup", () => {
  panStart = null;
  dragMarker = null;
  mapCanvas.classList.remove("is-dragging");
});

markerLayer.addEventListener("pointerdown", (event) => {
  const marker = event.target.closest("[data-place-id]");
  if (!marker) return;
  const id = marker.dataset.placeId;
  if (state.editMode) {
    dragMarker = id;
    marker.setPointerCapture?.(event.pointerId);
  }
});

markerLayer.addEventListener("click", (event) => {
  const marker = event.target.closest("[data-place-id]");
  if (!marker || dragMarker) return;
  selectPlace(marker.dataset.placeId);
});

placeList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-place-id]");
  if (!card) return;
  if (state.touring) toggleTour();
  selectPlace(card.dataset.placeId);
});

filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.activeCategory = button.dataset.category;
  renderAll({ moveMap: true });
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderAll({ moveMap: true });
});

mapViewport.addEventListener("wheel", (event) => {
  event.preventDefault();
  refreshViewport();
  const before = screenToWorld(event.clientX, event.clientY);
  zoomBy(event.deltaY > 0 ? -0.08 : 0.08, false);
  state.tx = event.clientX - before.x * state.scale;
  state.ty = event.clientY - before.y * state.scale;
  applyTransform();
}, { passive: false });

window.addEventListener("resize", () => {
  refreshViewport();
  applyTransform();
});

zoomInButton.addEventListener("click", () => zoomBy(0.12));
zoomOutButton.addEventListener("click", () => zoomBy(-0.12));
editButton.addEventListener("click", toggleEditMode);
tourButton.addEventListener("click", toggleTour);
detailToggle.addEventListener("click", () => setDetailOpen(!state.detailOpen));

refreshViewport();
renderAll();
centerOnPlace(state.selectedId);
