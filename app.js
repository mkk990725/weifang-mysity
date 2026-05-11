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
  editMode: false,
  layout: {},
  pageFlip: null,
  pageMeta: [],
  pageIndexByPlaceId: new Map()
};

const filters = document.getElementById("filters");
const searchInput = document.getElementById("searchInput");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const editButton = document.getElementById("editButton");
const pageCounter = document.getElementById("pageCounter");
const pageLabel = document.getElementById("pageLabel");
const book = document.getElementById("book");
const editDrawer = document.getElementById("editDrawer");
const layoutOutput = document.getElementById("layoutOutput");

const categoryColors = {
  全部: "#2d6654",
  文化: "#2d6654",
  园林: "#8a6024",
  非遗: "#ad4637",
  古城: "#5d4b8c"
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeUrl(value) {
  return encodeURI(String(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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

function renderFilters() {
  filters.innerHTML = uniqueCategories()
    .map((category) => {
      const active = category === state.activeCategory ? "is-active" : "";
      return `<button class="filter-chip ${active}" data-category="${escapeHtml(category)}" type="button">${escapeHtml(category)}</button>`;
    })
    .join("");
}

function mapSvg(activeId = null) {
  const markers = filteredPlaces()
    .map((place) => {
      const point = project(place);
      const active = place.id === activeId ? "is-active" : "";
      const color = categoryColors[place.category] || categoryColors.全部;
      return `
        <button class="overview-marker ${active}" data-place-id="${escapeHtml(place.id)}" type="button" style="left:${(point.x / WORLD.width) * 100}%;top:${(point.y / WORLD.height) * 100}%;--marker-color:${color}">
          <span>${escapeHtml(place.category)}</span>
          <strong>${escapeHtml(place.name)}</strong>
        </button>
      `;
    })
    .join("");

  return `
    <div class="overview-map">
      <svg class="map-svg" viewBox="0 0 ${WORLD.width} ${WORLD.height}" aria-hidden="true">
        <rect class="paper-fill" x="0" y="0" width="${WORLD.width}" height="${WORLD.height}" />
        <path class="river river-main" d="M70 645 C230 570 305 610 430 535 C570 450 700 510 850 420 C1020 315 1125 350 1330 265" />
        <path class="river river-side" d="M500 840 C610 730 680 675 790 610 C890 550 950 500 1010 420" />
        <path class="road road-highway" d="M-20 130 C210 80 430 125 670 92 C910 60 1085 68 1430 35" />
        <path class="road road-major" d="M85 420 C250 330 400 360 555 330 C740 300 890 240 1315 210" />
        <path class="road road-major" d="M150 760 C355 640 560 655 720 590 C890 520 1110 565 1280 450" />
        <path class="road road-major" d="M90 545 C270 500 475 485 640 455 C830 420 1020 360 1340 330" />
        <path class="road road-major" d="M-10 700 C220 720 430 810 660 805 C910 802 1100 760 1425 790" />
        <path class="road road-minor" d="M255 160 C350 285 390 380 500 505 C610 635 710 705 830 785" />
        <path class="road road-minor" d="M1030 125 C960 265 945 380 900 520 C860 640 800 710 760 835" />
        <path class="road road-minor" d="M330 705 C430 580 540 520 620 410 C700 300 820 265 990 210" />
        <path class="road road-minor" d="M680 90 C735 220 725 350 770 475 C820 620 940 715 1040 850" />
        <path class="road road-minor" d="M1180 95 C1110 210 1080 330 1098 480 C1118 640 1165 730 1240 845" />
        <g class="building-layer">
          <g class="building building-tall" transform="translate(675 270)">
            <polygon class="roof" points="0,20 45,0 98,18 52,39" />
            <polygon class="front" points="0,20 52,39 52,128 0,108" />
            <polygon class="side" points="52,39 98,18 98,104 52,128" />
            <path class="windows" d="M16 43 H37 M16 66 H37 M16 89 H37 M66 55 H83 M66 78 H83" />
          </g>
          <g class="building" transform="translate(930 360)">
            <polygon class="roof" points="0,18 35,0 80,17 45,35" />
            <polygon class="front" points="0,18 45,35 45,98 0,82" />
            <polygon class="side" points="45,35 80,17 80,76 45,98" />
            <path class="windows" d="M13 40 H32 M13 60 H32 M56 45 H70 M56 64 H70" />
          </g>
          <g class="building building-low" transform="translate(435 575)">
            <polygon class="roof" points="0,16 52,0 116,18 62,35" />
            <polygon class="front" points="0,16 62,35 62,76 0,58" />
            <polygon class="side" points="62,35 116,18 116,58 62,76" />
            <path class="windows" d="M15 36 H49 M73 39 H99" />
          </g>
        </g>
        <g class="label-layer">
          <text x="210" y="250">潍城老街</text>
          <text x="760" y="330">奎文城心</text>
          <text x="985" y="585">风筝走廊</text>
          <text x="430" y="745">青州方向</text>
          <text class="road-label" x="210" y="405">东风街</text>
          <text class="road-label" x="875" y="505">胜利街</text>
          <text class="road-label" x="720" y="575">健康街</text>
          <text class="road-label vertical-label" x="1035" y="205">北海路</text>
          <text class="road-label vertical-label" x="700" y="130">潍州路</text>
          <text class="road-label" x="118" y="115">济青高速方向</text>
        </g>
      </svg>
      <div class="overview-markers">${markers}</div>
    </div>
  `;
}

function miniMap(place) {
  const point = project(place);
  const color = categoryColors[place.category] || categoryColors.全部;
  return `
    <div class="mini-map">
      <svg viewBox="0 0 1400 900" aria-hidden="true">
        <rect class="paper-fill" x="0" y="0" width="1400" height="900" />
        <path class="mini-road" d="M70 645 C230 570 305 610 430 535 C570 450 700 510 850 420 C1020 315 1125 350 1330 265" />
        <path class="mini-road light" d="M150 760 C355 640 560 655 720 590 C890 520 1110 565 1280 450" />
        <circle cx="${point.x}" cy="${point.y}" r="18" fill="${color}" opacity="0.85" />
        <circle cx="${point.x}" cy="${point.y}" r="34" fill="none" stroke="${color}" stroke-width="6" opacity="0.22" />
      </svg>
    </div>
  `;
}

function renderCoverPage() {
  const sample = filteredPlaces()[0];
  return `
    <section class="page page-cover" data-density="hard" data-page-kind="cover">
      <div class="cover-shell">
        <p class="eyebrow">Weifang Living Book</p>
        <h2>潍坊好吃好玩翻页地图</h2>
        <p class="cover-copy">真实地点信息放在书页里，地图用手绘翻页的方式展开。点击路牌、翻页或筛选，都像在翻一本城市手帐。</p>
        <div class="cover-actions">
          <button type="button" data-jump-page="1">进入总览</button>
          ${sample ? `<button type="button" data-place-id="${escapeHtml(sample.id)}">看第一个地点</button>` : ""}
        </div>
        <div class="cover-badges">
          <span>真实地址</span>
          <span>公开来源</span>
          <span>手绘表达</span>
          <span>可编辑布局</span>
        </div>
      </div>
      <div class="cover-art">
        <img src="./assets/cartoon-map-reference.jpg" alt="潍坊翻页地图风格参考" />
      </div>
    </section>
  `;
}

function renderOverviewPage() {
  const visible = filteredPlaces();
  const chips = visible
    .map(
      (place) => `<button type="button" class="overview-chip" data-place-id="${escapeHtml(place.id)}">${escapeHtml(place.name)}</button>`
    )
    .join("");

  return `
    <section class="page page-overview" data-page-kind="overview">
      <div class="page-head">
        <div>
          <p>总览页</p>
          <h2>潍坊城市路网与点位</h2>
        </div>
        <span>点击路牌跳到详情页</span>
      </div>
      ${mapSvg(state.selectedId)}
      <div class="overview-strip">${chips || '<p class="empty-state">没有匹配到地点。</p>'}</div>
    </section>
  `;
}

function renderPlacePage(place, pageNumber, totalPages) {
  const tags = place.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const highlights = place.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const sources = place.sources
    .map((source) => `<a href="${safeUrl(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a>`)
    .join("");

  return `
    <section class="page page-place" data-page-kind="place" data-place-id="${escapeHtml(place.id)}">
      <div class="page-head">
        <div>
          <p>${escapeHtml(place.district)} · ${escapeHtml(place.category)}</p>
          <h2>${escapeHtml(place.name)}</h2>
        </div>
        <span>${pageNumber} / ${totalPages}</span>
      </div>
      <div class="place-layout">
        <figure class="place-visual" style="background-image:url('${safeUrl(place.image.url)}')">
          <figcaption>${escapeHtml(place.image.credit)}</figcaption>
        </figure>
        <div class="place-copy">
          <div class="tag-row">${tags}</div>
          <dl class="facts">
            <div><dt>地址</dt><dd>${escapeHtml(place.address)}</dd></div>
            <div><dt>电话</dt><dd>${escapeHtml(place.phone)}</dd></div>
            <div><dt>开放</dt><dd>${escapeHtml(place.hours)}</dd></div>
            <div><dt>票务</dt><dd>${escapeHtml(place.ticket)}</dd></div>
          </dl>
          <ul class="highlights">${highlights}</ul>
          <div class="source-list">
            <strong>公开来源</strong>
            ${sources}
          </div>
        </div>
      </div>
      <div class="page-footer">
        ${miniMap(place)}
        <button type="button" class="page-jump" data-jump-page="1">回到总览</button>
      </div>
    </section>
  `;
}

function renderBackCover() {
  return `
    <section class="page page-back" data-density="hard" data-page-kind="back">
      <div class="back-shell">
        <p class="eyebrow">Back Cover</p>
        <h2>继续扩展这本潍坊手绘书</h2>
        <p class="cover-copy">后面可以继续加更多餐饮、景点、非遗和街区页，也可以把点位布局导出成 JSON 做二次编辑。</p>
        <div class="cover-badges">
          <span>更多地点</span>
          <span>布局导出</span>
          <span>页面扩展</span>
        </div>
      </div>
    </section>
  `;
}

function buildPageModel() {
  const visible = filteredPlaces();
  const pages = [];
  const meta = [];
  const placeIndexById = new Map();

  pages.push(renderCoverPage());
  meta.push({ type: "cover", title: "封面" });

  pages.push(renderOverviewPage());
  meta.push({ type: "overview", title: "总览" });

  visible.forEach((place, index) => {
    const pageIndex = pages.length;
    placeIndexById.set(place.id, pageIndex);
    pages.push(renderPlacePage(place, index + 3, visible.length + 3));
    meta.push({ type: "place", title: place.name, placeId: place.id });
  });

  pages.push(renderBackCover());
  meta.push({ type: "back", title: "封底" });

  return { pages, meta, placeIndexById };
}

function setDrawerVisible(open) {
  state.editMode = open;
  editButton.classList.toggle("is-active", state.editMode);
  editButton.setAttribute("aria-pressed", String(state.editMode));
  editDrawer.hidden = !state.editMode;
  if (state.editMode) updateLayoutOutput();
}

function updateLayoutOutput() {
  const data = Object.fromEntries(
    Object.entries(state.layout).map(([id, point]) => [
      id,
      {
        x: Math.round(point.x),
        y: Math.round(point.y)
      }
    ])
  );
  layoutOutput.value = JSON.stringify(data, null, 2);
}

function renderBook() {
  const { pages, meta, placeIndexById } = buildPageModel();
  state.pageMeta = meta;
  state.pageIndexByPlaceId = placeIndexById;
  book.innerHTML = pages.join("");
}

function updateCounter(pageIndex = 0) {
  const total = state.pageMeta.length || 1;
  const current = clamp(pageIndex + 1, 1, total);
  pageCounter.textContent = `${String(current).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const meta = state.pageMeta[pageIndex] || state.pageMeta[0];
  pageLabel.textContent = meta?.title || "封面";
}

function syncSelectionFromPage(pageIndex) {
  const meta = state.pageMeta[pageIndex];
  if (!meta) return;
  if (meta.type === "place") {
    state.selectedId = meta.placeId;
  } else if (!filteredPlaces().some((place) => place.id === state.selectedId)) {
    state.selectedId = filteredPlaces()[0]?.id;
  }
  updateCounter(pageIndex);
}

function bindPageFlip() {
  if (!window.St?.PageFlip) {
    book.innerHTML = `
      <section class="page page-cover" data-density="hard">
        <div class="cover-shell">
          <h2>翻页引擎未加载</h2>
          <p class="cover-copy">页面已生成，但 StPageFlip CDN 没有成功加载。</p>
        </div>
      </section>
    `;
    return;
  }

  if (state.pageFlip) {
    state.pageFlip.destroy();
  }

  state.pageFlip = new window.St.PageFlip(book, {
    width: 560,
    height: 760,
    size: "stretch",
    minWidth: 360,
    maxWidth: 1600,
    minHeight: 520,
    maxHeight: 980,
    drawShadow: true,
    flippingTime: 850,
    usePortrait: true,
    showCover: true,
    autoSize: true,
    mobileScrollSupport: false,
    startPage: 0
  });

  state.pageFlip.loadFromHTML(book.querySelectorAll(".page"));
  state.pageFlip.on("flip", (event) => {
    syncSelectionFromPage(event.data);
  });
  state.pageFlip.on("changeOrientation", () => state.pageFlip?.update());
  state.pageFlip.on("changeState", () => state.pageFlip?.update());
  updateCounter(0);
}

function rebuildBook({ pageIndex = 0 } = {}) {
  const visible = filteredPlaces();
  if (visible.length && !visible.some((place) => place.id === state.selectedId)) {
    state.selectedId = visible[0].id;
  }

  renderFilters();
  renderBook();
  bindPageFlip();

  const targetIndex = clamp(pageIndex, 0, Math.max(0, state.pageMeta.length - 1));
  if (state.pageFlip) {
    state.pageFlip.turnToPage(targetIndex);
    updateCounter(targetIndex);
  }
  updateLayoutOutput();
}

function gotoPage(pageIndex) {
  if (!state.pageFlip) return;
  const next = clamp(pageIndex, 0, Math.max(0, state.pageMeta.length - 1));
  state.pageFlip.flip(next, "top");
}

function gotoPlace(placeId) {
  const pageIndex = state.pageIndexByPlaceId.get(placeId);
  if (pageIndex == null) return;
  state.selectedId = placeId;
  gotoPage(pageIndex);
}

function nextPage() {
  state.pageFlip?.flipNext("top");
}

function prevPage() {
  state.pageFlip?.flipPrev("top");
}

function toggleEditMode() {
  setDrawerVisible(!state.editMode);
}

function placeClickHandler(target) {
  const pageButton = target.closest("[data-place-id], [data-jump-page]");
  if (!pageButton) return;
  const placeId = pageButton.dataset.placeId;
  const jumpPage = pageButton.dataset.jumpPage;
  if (placeId) {
    gotoPlace(placeId);
    return;
  }
  if (jumpPage != null) {
    gotoPage(Number(jumpPage));
  }
}

let dragState = null;

function updateDraggedMarker(clientX, clientY) {
  if (!dragState) return;
  const { marker, mapRect, id } = dragState;
  const x = clamp(((clientX - mapRect.left) / mapRect.width) * WORLD.width, 40, WORLD.width - 40);
  const y = clamp(((clientY - mapRect.top) / mapRect.height) * WORLD.height, 40, WORLD.height - 40);
  state.layout[id] = { x, y };
  marker.style.left = `${(x / WORLD.width) * 100}%`;
  marker.style.top = `${(y / WORLD.height) * 100}%`;
  updateLayoutOutput();
}

document.addEventListener("pointermove", (event) => {
  if (!dragState) return;
  updateDraggedMarker(event.clientX, event.clientY);
});

document.addEventListener("pointerup", () => {
  if (!dragState) return;
  dragState = null;
  rebuildBook({ pageIndex: state.pageFlip?.getCurrentPageIndex() || 0 });
});

book.addEventListener("pointerdown", (event) => {
  const marker = event.target.closest(".overview-marker");
  if (!marker || !state.editMode) return;
  event.preventDefault();
  event.stopPropagation();
  dragState = {
    id: marker.dataset.placeId,
    marker,
    mapRect: marker.closest(".overview-map").getBoundingClientRect()
  };
});

book.addEventListener("click", (event) => {
  placeClickHandler(event.target);
});

filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.activeCategory = button.dataset.category;
  rebuildBook({ pageIndex: 1 });
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  rebuildBook({ pageIndex: 1 });
});

prevButton.addEventListener("click", prevPage);
nextButton.addEventListener("click", nextPage);
editButton.addEventListener("click", toggleEditMode);

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") prevPage();
  if (event.key === "ArrowRight") nextPage();
});

window.addEventListener("resize", () => {
  state.pageFlip?.update();
});

rebuildBook({ pageIndex: 1 });
