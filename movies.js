async function loadNavbar() {
  const container = document.getElementById("navbar-container");
  if (!container) return;
  try {
    const res = await fetch("components/navbar.html", { cache: "no-store" });
    const html = await res.text();
    container.innerHTML = html;
    setActiveNavLink(); // NEW: highlight current page
    initNavbarInteractions();
    initSearchDemo();
  } catch (e) {
    console.error("Failed to load navbar:", e);
  }
}

// Global image error fallback for movie cards (duplicated here for standalone use)
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

function setActiveNavLink() {
  // Get last part of path (e.g. movies.html). Treat empty as [index.html](http://_vscodecontentref_/1)
  let file = window.location.pathname.split("/").pop();
  if (!file || file === "") file = "index.html";

  const links = document.querySelectorAll(
    "#navbar-container .nav-right a, #navbar-container .mobile-nav a"
  );

  links.forEach((a) => a.classList.remove("active"));

  links.forEach((a) => {
    const href = a.getAttribute("href");
    if (href === file || (file === "index.html" && href === "index.html")) {
      a.classList.add("active");
    }
  });
}

function initNavbarInteractions() {
  const burger = document.getElementById("hamburger");
  const mobileNav = document.getElementById("navLinks");
  if (!burger || !mobileNav) return;
  burger.addEventListener("click", () => {
    mobileNav.classList.toggle("show");
  });
  // Optional: close on outside click
  document.addEventListener("click", (e) => {
    if (!mobileNav.classList.contains("show")) return;
    if (!mobileNav.contains(e.target) && e.target !== burger) {
      mobileNav.classList.remove("show");
    }
  });
  // Optional: reset on resize above breakpoint
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && mobileNav.classList.contains("show")) {
      mobileNav.classList.remove("show");
    }
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

// Ads via site meta (match script.js)
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
    const adHtml = picks
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

    adContainer.innerHTML = adHtml || "";
    adContainer.style.textAlign = "center";
    adContainer.querySelectorAll("a").forEach((a) => {
      a.style.display = "inline-block";
      a.style.margin = "0 8px";
    });
  } catch (e) {
    adContainer.innerHTML = "<p style='color:red;'>Failed to load ad.</p>";
    console.error("Failed to load ad:", e);
  }
}

// Render slider content from API (no local slider.html)
async function renderSliderHtml() {
  const sliderContainer = document.getElementById("slider-container");
  if (!sliderContainer) return;
  try {
    const meta = await fetchSiteMeta();
    const slides = Array.isArray(meta.slides) ? meta.slides : [];

    if (!slides.length) {
      sliderContainer.innerHTML = "";
      return;
    }

    const esc = (s) =>
      String(s || "").replace(
        /[<>&"]/g,
        (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
      );
    const slidesHtml = slides
      .map((s, i) => {
        const img = esc((s.image || "").trim());
        const link = esc((s.link || "").trim());
        return `<img src="${img}" alt="Slide ${
          i + 1
        }" class="slide" data-link="${link}">`;
      })
      .join("");
    const dotsHtml = slides
      .map((_, i) => `<span class=\"slider-dot\" data-slide=\"${i}\"></span>`)
      .join("");

    sliderContainer.innerHTML = `
      <div class="slider">
        <div class="slides">${slidesHtml}</div>
        <div class="slider-dots">${dotsHtml}</div>
      </div>
    `;

    sliderContainer.querySelectorAll(".slide").forEach((img) => {
      const url = img.getAttribute("data-link");
      if (url) {
        img.style.cursor = "pointer";
        img.addEventListener("click", () =>
          window.open(url, "_blank", "noopener")
        );
      }
    });

    initSlider();
  } catch (e) {
    sliderContainer.innerHTML =
      "<p style='color:red;'>Failed to load slider.</p>";
    console.error("Failed to load slider:", e);
  }
}

// Automated slider logic
function initSlider() {
  const slider = document.querySelector("#slider-container .slider");
  const slides = slider?.querySelector(".slides");
  const slideImgs = slides?.querySelectorAll(".slide");
  const dots = slider?.querySelectorAll(".slider-dot");
  if (!slider || !slides || !slideImgs || slideImgs.length === 0) return;

  let current = 0;
  const total = slideImgs.length;
  let intervalId;

  function goToSlide(idx) {
    slides.style.transform = `translateX(-${idx * 100}%)`;
    if (dots) {
      dots.forEach((dot) => dot.classList.remove("active"));
      if (dots[idx]) dots[idx].classList.add("active");
    }
  }

  function nextSlide() {
    current = (current + 1) % total;
    goToSlide(current);
  }

  // Start auto sliding
  intervalId = setInterval(nextSlide, 3000);

  // Pause on hover
  slider.addEventListener("mouseenter", () => clearInterval(intervalId));
  slider.addEventListener("mouseleave", () => {
    intervalId = setInterval(nextSlide, 3000);
  });

  // Dot controls
  if (dots) {
    dots.forEach((dot, idx) => {
      dot.addEventListener("click", () => {
        current = idx;
        goToSlide(current);
      });
    });
  }

  // Initialize position and active dot
  goToSlide(current);
}

// helper: determine type from URL like "?series" or "?movies"
function typeFromLocation() {
  const q = (window.location.search || "").replace(/^\?/, "");
  return q === "series" ? "series" : q === "movies" ? "movies" : "movies";
}

/* ---------- API DATA LOADING (NEW API ONLY) ---------- */

function showLoading() {
  ["popular-movies-container", "trending-movies-container"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "<p class='loading-msg'>Loading...</p>";
  });
}

function showDataError(msg, raw = "") {
  ["popular-movies-container", "trending-movies-container"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.innerHTML = `<div style="color:#f66;font-size:.75rem;">
        ${msg}
        <button id="retryFetch" style="margin-left:6px;">Retry</button>
        ${
          raw
            ? `<details style="margin-top:4px;"><summary style="cursor:pointer;">Details</summary><pre style="white-space:pre-wrap;font-size:.65rem;">${raw
                .replace(
                  /[<>&]/g,
                  (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])
                )
                .slice(0, 2000)}</pre></details>`
            : ""
        }
      </div>`;
  });
}

// (old local API helpers removed)

// Fetch movies list (YangonTV public API)
async function fetchMoviesList(page = 1) {
  const url = `https://yangontv.org/api/movies?page=${encodeURIComponent(
    page
  )}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const normalizeMediaUrl = (s) => {
    if (!s) return "";
    let v = String(s).trim().replace(/\t/g, "").replace(/\\/g, "/");
    if (/^https?:\/\//i.test(v)) return v;
    const idx = v.indexOf("/uploads/");
    if (idx >= 0) {
      const path = v.slice(idx).replace(/\/\/+/g, "/");
      return `https://yangontv.org/admin%20panel${path}`;
    }
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
    const json = await res.json();
    if (!json || json.status !== "success" || !Array.isArray(json.data))
      throw new Error("Invalid API response");

    return json.data.map((it) => ({
      id: it.id,
      title: it.title || it.name || "Untitled",
      image: normalizeMediaUrl(it.poster || it.image || ""),
      duration: it.duration || "",
      year: it.release_year || it.year || "",
    }));
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// Replace DOMContentLoaded initializer to use movies endpoint and render 12 items each
document.addEventListener("DOMContentLoaded", async () => {
  loadNavbar();
  renderAdHtml();
  renderSliderHtml();

  showLoading();

  let movies;
  try {
    movies = await fetchMoviesList(1); // use page=1
  } catch (e) {
    console.error("[API] Failed to load movies:", e);
    showDataError("Failed to load movies: " + (e.message || e));
    document.addEventListener(
      "click",
      (ev) => {
        if (ev.target && ev.target.id === "retryFetch") {
          showLoading();
          setTimeout(() => location.reload(), 50);
        }
      },
      { once: true }
    );
    return;
  }

  // Ensure we have an array
  if (!Array.isArray(movies)) {
    showDataError("API returned no movies.");
    return;
  }

  // Render 12 items for popular and 12 for popular (second block shows another set)
  const popular12 = movies.slice(0, 12);
  const trending12 = movies.slice(0, 12).slice().reverse();

  renderMoviesInto("popular-movies-container", popular12);
  renderMoviesInto("trending-movies-container", trending12);
});

// (Optional) expose for console debugging
window.__dumpMediaData = () => {
  console.log(
    "Recently added container HTML:",
    document.getElementById("popular-movies-container")?.innerHTML
  );
  console.log(
    "Popular (second) container HTML:",
    document.getElementById("trending-movies-container")?.innerHTML
  );
};

// Update initMediaToggle to NOT fallback to local data.js
function initMediaToggle(globalData) {
  if (!globalData) return;

  const container = document.getElementById("mediaToggle");
  if (!container) return;
  const links = container.querySelectorAll("a[data-type]");

  links.forEach((a) => a.setAttribute("href", `index.html?${a.dataset.type}`));

  function setActive(type, push = true) {
    links.forEach((a) => a.classList.toggle("active", a.dataset.type === type));

    const typeTitle = type === "series" ? "Series" : "Movies";

    // Because duplicate id="header-container" exists, use all matching elements
    document.querySelectorAll("#header-container h5").forEach((h5, idx) => {
      h5.textContent = (idx === 0 ? "Recently Added " : "Popular ") + typeTitle;
    });

    const popular = getItemsForType(globalData, type);
    const trending = popular.slice().reverse();

    renderMoviesInto("popular-movies-container", popular);
    renderMoviesInto("trending-movies-container", trending);

    if (push) history.pushState({ type }, "", `index.html?${type}`);
  }

  links.forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      setActive(a.dataset.type, true);
    });
  });

  window.addEventListener("popstate", () => {
    setActive(typeFromLocation(), false);
  });

  setActive(typeFromLocation(), false);
}

// getItemsForType unchanged but now only uses provided globalData
function getItemsForType(globalData, type) {
  if (!globalData) return [];
  if (type === "series" && Array.isArray(globalData.series))
    return globalData.series.slice(0, 6);
  if (type !== "series" && Array.isArray(globalData.movies))
    return globalData.movies.slice(0, 6);
  return [];
}

function renderMoviesInto(containerId, movies, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";
  if (!movies || movies.length === 0) {
    container.innerHTML = "<p>No movies available.</p>";
    return;
  }

  // PAGE IS MOVIES-ONLY: force type to 'movies'
  const currentType = "movies";

  movies.forEach((item) => {
    const title = item.title || item.name || "Untitled";
    const poster = item.image || item.poster || "images/placeholder.png";
    const duration = item.duration || "";
    const year =
      item.year || (item.release_date ? item.release_date.split("-")[0] : "");
    const id = item.id || "";

    const itemCardLink = document.createElement("a");
    itemCardLink.classList.add("movie-card");
    itemCardLink.setAttribute(
      "href",
      `detail.html?id=${encodeURIComponent(id)}${
        currentType === "series" ? "&type=series" : ""
      }`
    );
    itemCardLink.setAttribute("role", "link");
    itemCardLink.setAttribute("aria-label", title);
    itemCardLink.dataset.id = id;
    itemCardLink.dataset.type = currentType;

    itemCardLink.innerHTML = `
            <div class="movie-poster-wrap">
              <img src="${poster}" alt="${title}" onerror="window.__imgError && window.__imgError(this)">
            </div>
            <h6>${title}</h6>
            ${duration ? `<p>${duration} mins</p>` : ""}
            ${year ? `<p>${year}</p>` : ""}
        `;

    itemCardLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (id) {
        window.location.href = `detail.html?id=${encodeURIComponent(id)}`;
      }
    });

    container.appendChild(itemCardLink);
  });
}

// All references to the old local API have been removed; new API is used above.
// This script now relies solely on the API for data loading.
