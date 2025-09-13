/* Render paginated "all recently added movies" (18 per page) */

const MOVIES_PER_PAGE = 18;

// Global image error fallback (standalone safe)
window.__imgError = function (imgEl) {
  try {
    if (!imgEl || (imgEl.dataset && imgEl.dataset.fallbackApplied)) return;
    const svg =
      "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'>" +
      "<rect width='100%' height='100%' fill='#1f1f1f'/>" +
      "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#9aa0a6' font-family='Arial, sans-serif' font-size='16'>Error loading image</text>" +
      "</svg>";
    const url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
    imgEl.onerror = null;
    imgEl.src = url;
    imgEl.alt = "Error loading image";
    if (imgEl.dataset) imgEl.dataset.fallbackApplied = "1";
  } catch (_) {
    if (imgEl) imgEl.src = "images/placeholder.png";
  }
};

function getPageFromLocation() {
  const p = parseInt(
    new URLSearchParams(window.location.search).get("page") || "1",
    10
  );
  return Number.isNaN(p) || p < 1 ? 1 : p;
}

async function loadNavbar() {
  const container = document.getElementById("navbar-container");
  if (!container) return;
  try {
    const res = await fetch("components/navbar.html", { cache: "no-store" });
    container.innerHTML = await res.text();
    setActiveNavLink();
    initNavbarInteractions();
    initSearchDemo();
  } catch (e) {
    console.error("loadNavbar:", e);
  }
}

function setActiveNavLink() {
  let file = window.location.pathname.split("/").pop();
  if (!file || file === "") file = "index.html";
  document
    .querySelectorAll(
      "#navbar-container .nav-right a, #navbar-container .mobile-nav a"
    )
    .forEach((a) =>
      a.classList.toggle("active", a.getAttribute("href") === file)
    );
}

function initNavbarInteractions() {
  const burger = document.getElementById("hamburger");
  const mobileNav = document.getElementById("navLinks");
  if (!burger || !mobileNav) return;
  burger.addEventListener("click", () => mobileNav.classList.toggle("show"));
  document.addEventListener("click", (e) => {
    if (!mobileNav.classList.contains("show")) return;
    if (!mobileNav.contains(e.target) && e.target !== burger)
      mobileNav.classList.remove("show");
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && mobileNav.classList.contains("show"))
      mobileNav.classList.remove("show");
  });
}

function initSearchDemo() {
  const form = document.getElementById("searchForm");
  const input = document.getElementById("searchInput");
  if (!form || !input) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const kw = (input.value || "").trim();
    if (!kw) return;
    window.location.href = `search.html?q=${encodeURIComponent(kw)}`;
  });
}

// --- Ads via site meta (same as script.js) ---
let __siteMetaCache = null;
async function fetchSiteMeta() {
  if (__siteMetaCache) return __siteMetaCache;
  const url = "https://yangontv.org/api/";
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 10000);
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(to);
    throw new Error(
      e.name === "AbortError" ? "Site meta timeout" : "Site meta network error"
    );
  }
  clearTimeout(to);
  if (!res.ok) throw new Error("Site meta HTTP " + res.status);
  const json = await res.json().catch(() => {
    throw new Error("Site meta invalid JSON");
  });
  if (!json || json.status !== "success" || !json.data)
    throw new Error("Site meta unexpected response");
  __siteMetaCache = json.data;
  return __siteMetaCache;
}

async function renderAdHtml() {
  const adContainer = document.getElementById("ad-container");
  if (!adContainer) return;
  try {
    const meta = await fetchSiteMeta();
    const banners = Array.isArray(meta.banners) ? meta.banners.slice() : [];

    // Helper: pick two random banners, prefer 'home' type
    function pickTwoRandom(bList) {
      if (!Array.isArray(bList) || bList.length === 0) return [];
      const homes = bList.filter(
        (b) => (b.type || "").toLowerCase() === "home"
      );
      const others = bList.filter(
        (b) => (b.type || "").toLowerCase() !== "home"
      );
      const pool = homes.length >= 2 ? homes : homes.concat(others);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, Math.min(2, pool.length));
    }

    const picks = pickTwoRandom(banners);

    const safe = (s) => String(s || "").trim();
    const html = picks
      .map((b) => {
        const href = safe(b.link || "#");
        const img = safe(b.image || "");
        const name = (b.name || "Ad").replace(
          /[<>&"]/g,
          (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
        );
        return `<a href="${href}" target="_blank" rel="noopener"><img class="ad-img" src="${img}" alt="${name}"></a>`;
      })
      .join("");

    adContainer.innerHTML = html || "";
    adContainer.style.textAlign = "center";
    adContainer.querySelectorAll("a").forEach((a) => {
      a.style.display = "inline-block";
      a.style.margin = "0 8px";
    });
  } catch (e) {
    adContainer.innerHTML = "<p style='color:red;'>Failed to load ad.</p>";
    console.error("renderAdHtml:", e);
  }
}

async function fetchMoviesPage(baseUrl, page = 1) {
  // Use YangonTV public API; map response to the shape our renderers expect
  const url = `${baseUrl}?page=${encodeURIComponent(page)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  // helper to normalize poster/backdrop URLs from various formats
  const normalizeMediaUrl = (s) => {
    if (!s) return "";
    let v = String(s).trim().replace(/\t/g, "").replace(/\\/g, "/");
    if (/^https?:\/\//i.test(v)) return v;
    // Extract '/uploads/...' if present anywhere in the string
    const idx = v.indexOf("/uploads/");
    if (idx >= 0) {
      const path = v.slice(idx).replace(/\/\/+/g, "/");
      return `https://yangontv.org/admin%20panel${path}`;
    }
    // If it begins with a single slash but not uploads, prefix domain
    if (v.startsWith("/")) return `https://yangontv.org${v}`;
    return v;
  };

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      throw new Error("Invalid JSON from API");
    }

    if (!json || json.status !== "success" || !Array.isArray(json.data)) {
      throw new Error("API response missing data");
    }

    // Map items to our expected fields: id, title, image, duration, year
    const mapped = json.data.map((it) => ({
      id: it.id,
      title: it.title || it.name || "Untitled",
      image: normalizeMediaUrl(it.poster || it.image || ""),
      duration: it.duration || "",
      year: it.release_year || it.year || "",
    }));

    const total = Number(json.count) || mapped.length;
    return {
      total,
      page: Number(page) || 1,
      perPage: MOVIES_PER_PAGE,
      data: mapped,
    };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function renderMoviesGridInto(containerId, movies) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (!movies || movies.length === 0) {
    container.innerHTML = "<p>No movies available.</p>";
    return;
  }
  movies.forEach((item) => {
    const title = item.title || "Untitled";
    const poster = item.image || "images/placeholder.png";
    const duration = item.duration ? `${item.duration} mins` : "";
    const year = item.year || "";
    const id = item.id || "";
    const a = document.createElement("a");
    a.className = "movie-card";
    a.href = `detail.html?id=${encodeURIComponent(id)}`;
    a.setAttribute("role", "link");
    a.setAttribute("aria-label", title);
    a.dataset.id = id;
    a.innerHTML = `
      <div class="movie-poster-wrap">
  <img src="${poster}" alt="${title}" onerror="window.__imgError && window.__imgError(this)">
      </div>
      <h6>${title}</h6>
      ${duration ? `<p>${duration}</p>` : ""}
      ${year ? `<p>${year}</p>` : ""}
    `;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (id) window.location.href = `detail.html?id=${encodeURIComponent(id)}`;
    });
    container.appendChild(a);
  });
}

function renderPagination(
  containerId,
  totalCount,
  currentPage,
  perPage = MOVIES_PER_PAGE
) {
  const totalPages = Math.max(
    1,
    Math.ceil((Number(totalCount) || 0) / perPage)
  );
  let pagContainer = document.getElementById(containerId + "-pagination");
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!pagContainer) {
    pagContainer = document.createElement("div");
    pagContainer.id = containerId + "-pagination";
    pagContainer.className = "pagination";
    container.insertAdjacentElement("afterend", pagContainer);
  }

  // Store current page + perPage on the container for click handler to reference
  pagContainer.dataset.currentPage = String(currentPage);
  pagContainer.dataset.perPage = String(perPage);

  const windowSize = 7;
  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  let end = start + windowSize - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - windowSize + 1);
  }

  const makeBtn = (p, label = null, cls = "") =>
    typeof p === "number"
      ? `<button class="pg-btn ${cls}" data-page="${p}">${label ?? p}</button>`
      : `<button class="pg-btn ${cls}" data-action="${p}">${
          label ?? p
        }</button>`;

  let html = "";
  html += makeBtn("prev", "Prev", currentPage === 1 ? "disabled" : "");
  if (start > 1) html += makeBtn(1, "1");
  if (start > 2) html += `<span class="pg-ellipsis">…</span>`;
  for (let p = start; p <= end; p++)
    html += makeBtn(p, String(p), p === currentPage ? "active" : "");
  if (end < totalPages - 1) html += `<span class="pg-ellipsis">…</span>`;
  if (end < totalPages) html += makeBtn(totalPages, String(totalPages));
  html += makeBtn("next", "Next", currentPage === totalPages ? "disabled" : "");

  pagContainer.innerHTML = html;

  // determine correct renderer based on containerId
  const renderer = containerId.includes("trending")
    ? renderTrendingAll
    : renderPopularAll;

  // Delegated click handling
  pagContainer.removeEventListener?.("click", pagContainer._pgHandler);
  pagContainer._pgHandler = function (ev) {
    const btn = ev.target.closest(".pg-btn");
    if (!btn) return;
    if (btn.classList.contains("disabled")) return;

    let p;
    const cur = parseInt(pagContainer.dataset.currentPage || "1", 10);
    if (btn.dataset.page) {
      p = Math.max(
        1,
        Math.min(totalPages, parseInt(btn.dataset.page, 10) || 1)
      );
    } else if (btn.dataset.action === "prev") {
      p = Math.max(1, cur - 1);
    } else if (btn.dataset.action === "next") {
      p = Math.min(totalPages, cur + 1);
    } else {
      return;
    }

    if (p === cur) return;

    const params = new URLSearchParams(window.location.search);
    params.set("page", String(p));
    history.pushState({}, "", `${location.pathname}?${params.toString()}`);

    // call the proper renderer immediately
    pagContainer.dataset.currentPage = String(p);
    renderer(p);

    // refresh ads on each page change
    if (typeof renderAdHtml === "function") {
      try {
        renderAdHtml();
      } catch (_) {}
    }

    // also fire popstate for any other listeners
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo({ top: 200, behavior: "smooth" });
  };
  pagContainer.addEventListener("click", pagContainer._pgHandler);
}

// Configure endpoints – update TRENDING_API to real trending when available
const POPULAR_API = "https://yangontv.org/api/movies"; // recently added
const TRENDING_API = "https://yangontv.org/api/popular";

async function renderPopularAll(page = 1) {
  const containerId = "popular-movies-container-all";
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "<p class='loading-msg'>Loading...</p>";
  try {
    const json = await fetchMoviesPage(POPULAR_API, page);
    const perPage = Number(json.perPage) || MOVIES_PER_PAGE;
    const total = Number(json.total) || Number(json.count) || 0;

    // Render exactly the items returned for this page
    renderMoviesGridInto(containerId, json.data || []);

    // Render pagination using total and perPage from API
    renderPagination(containerId, total, Number(json.page) || page, perPage);
  } catch (err) {
    container.innerHTML = `<div style="color:#f66">Failed to load movies: ${String(
      err.message || err
    )}</div>`;
    console.error("renderPopularAll:", err);
  }
}

// Render paginated trending movies (uses same API, reversed order client-side)
async function renderTrendingAll(page = 1) {
  const containerId = "trending-movies-container-all";
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(
      "[allMovies] renderTrendingAll: container not found:",
      containerId
    );
    return;
  }
  container.innerHTML = "<p class='loading-msg'>Loading...</p>";
  try {
    console.debug("[allMovies] renderTrendingAll: requesting page", page);
    const json = await fetchMoviesPage(TRENDING_API, page);
    console.debug("[allMovies] renderTrendingAll: api response", json);

    const perPage = Number(json.perPage) || MOVIES_PER_PAGE;
    const total = Number(json.total) || Number(json.count) || 0;
    const apiPage = Number(json.page) || page;

    // Render items as-is (no reverse), first page length already controlled by API/perPage
    const itemsPage = Array.isArray(json.data)
      ? json.data.slice(0, perPage)
      : [];

    renderMoviesGridInto(containerId, itemsPage);

    // Render pagination using total and perPage from API
    renderPagination(containerId, total, apiPage, perPage);
  } catch (err) {
    container.innerHTML = `<div style="color:#f66">Failed to load popular movies: ${String(
      err.message || err
    )}</div>`;
    console.error("[allMovies] renderTrendingAll error:", err);
  }
}

// Init handler: call popular/trending if their containers exist
document.addEventListener("DOMContentLoaded", () => {
  const popularContainer = document.getElementById(
    "popular-movies-container-all"
  );
  const trendingContainer = document.getElementById(
    "trending-movies-container-all"
  );
  if (!popularContainer && !trendingContainer) return;

  loadNavbar();
  renderAdHtml();

  const page = getPageFromLocation();
  console.debug(
    "[allMovies] init: page from location",
    page,
    "popularContainer?",
    !!popularContainer,
    "trendingContainer?",
    !!trendingContainer
  );

  if (popularContainer) renderPopularAll(page);
  if (trendingContainer) renderTrendingAll(page);

  window.addEventListener("popstate", () => {
    const p = getPageFromLocation();
    if (popularContainer) renderPopularAll(p);
    if (trendingContainer) renderTrendingAll(p);
  });
});
