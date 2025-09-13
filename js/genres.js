// Genres page logic using YangonTV API

(function () {
  const GENRES_API = "https://yangontv.org/api/genres";

  // Image error fallback (standalone safe)
  window.__imgError =
    window.__imgError ||
    function (imgEl) {
      try {
        if (!imgEl || (imgEl.dataset && imgEl.dataset.fallbackApplied)) return;
        const svg =
          "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'>" +
          "<rect width='100%' height='100%' fill='#1f1f1f'/>" +
          "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#9aa0a6' font-family='Arial, sans-serif' font-size='16'>Error loading image</text>" +
          "</svg>";
        const url =
          "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
        imgEl.onerror = null;
        imgEl.src = url;
        imgEl.alt = "Error loading image";
        if (imgEl.dataset) imgEl.dataset.fallbackApplied = "1";
      } catch (_) {
        if (imgEl) imgEl.src = "images/placeholder.png";
      }
    };

  function normalizeMediaUrl(s) {
    if (!s) return "";
    let v = String(s).trim().replace(/\t/g, "").replace(/\\/g, "/");
    if (/^https?:\/\//i.test(v)) return v;
    const idx = v.indexOf("/uploads/");
    if (idx >= 0) {
      const path = v.slice(idx).replace(/\/\/+/, "/");
      return `https://yangontv.org/admin%20panel${path}`;
    }
    if (v.startsWith("/")) return `https://yangontv.org${v}`;
    return v;
  }

  async function fetchGenres() {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(GENRES_API, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(to);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (
        !json ||
        json.status !== "success" ||
        !json.data ||
        !Array.isArray(json.data.genres)
      )
        throw new Error("Invalid response");
      return json.data.genres;
    } catch (e) {
      clearTimeout(to);
      throw e;
    }
  }

  async function fetchGenreMovies(name, page = 1) {
    const url = `${GENRES_API}/${encodeURIComponent(
      name
    )}?page=${encodeURIComponent(page)}`;
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(to);
      if (!res.ok) {
        if (res.status === 404) {
          return { items: [], total: 0, page };
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (!json || json.status !== "success" || !Array.isArray(json.data))
        throw new Error("Invalid response");
      const items = json.data.map((it) => ({
        id: it.id,
        title: it.title || it.name || "Untitled",
        image: normalizeMediaUrl(it.poster || it.image || ""),
        duration: it.duration || "",
        year: it.release_year || it.year || "",
      }));
      const total = Number(json.count) || items.length;
      return { items, total, page };
    } catch (e) {
      clearTimeout(to);
      throw e;
    }
  }

  function renderGenresButtons(genres) {
    const wrap = document.getElementById("genres-buttons");
    if (!wrap) return;
    wrap.innerHTML = "";
    genres.forEach((g) => {
      const btn = document.createElement("button");
      btn.className = "genre-badge";
      btn.type = "button";
      btn.textContent = g;
      btn.setAttribute("aria-label", `Filter by ${g}`);
      btn.addEventListener("click", () => selectGenre(g, 1));
      wrap.appendChild(btn);
    });
  }

  function renderMovies(items) {
    const cont = document.getElementById("genre-movies-container");
    if (!cont) return;
    cont.innerHTML = "";
    if (!items || items.length === 0) {
      cont.innerHTML = "<p>No movies found in this genre</p>";
      return;
    }
    items.forEach((m) => {
      const a = document.createElement("a");
      a.className = "movie-card";
      a.href = `detail.html?id=${encodeURIComponent(m.id)}`;
      a.innerHTML = `
        <div class="movie-poster-wrap">
          <img src="${m.image || "images/placeholder.png"}" alt="${
        m.title
      }" onerror="window.__imgError && window.__imgError(this)">
        </div>
        <h6>${m.title}</h6>
        ${m.duration ? `<p>${m.duration} mins</p>` : ""}
        ${m.year ? `<p>${m.year}</p>` : ""}
      `;
      cont.appendChild(a);
    });
  }

  function renderHeader(genreName) {
    const h = document.getElementById("genres-current");
    if (h) h.textContent = genreName ? `Select a genre` : "Select a genre";
    const sub = document.getElementById("genre-movies-title");
    if (sub) sub.textContent = genreName ? `Movies for (${genreName})` : "";
  }

  function estimatePerPage(lastItemsLen) {
    // Try to estimate perPage from first response length; fallback to 18
    return lastItemsLen > 0 ? lastItemsLen : 18;
  }

  function renderPagination(total, page, perPage, onPage) {
    const pag = document.getElementById("genre-pagination");
    if (!pag) return;
    pag.innerHTML = "";
    const totalPages = Math.max(
      1,
      Math.ceil((Number(total) || 0) / (perPage || 18))
    );
    if (totalPages <= 1) return;

    function addBtn(label, p, disabled = false, active = false) {
      const b = document.createElement("button");
      b.textContent = label;
      if (active) b.classList.add("active");
      b.disabled = disabled;
      b.addEventListener("click", () => {
        onPage(p);
        // refresh ads to rotate banners when page changes
        if (typeof window.renderAdHtml === "function") {
          try {
            window.renderAdHtml();
          } catch (_) {}
        }
      });
      pag.appendChild(b);
    }

    addBtn("Prev", page - 1, page === 1);
    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - windowSize + 1);
    }
    if (start > 1) addBtn("1", 1, false, page === 1);
    if (start > 2)
      pag.appendChild(
        Object.assign(document.createElement("span"), {
          textContent: "…",
          style: "padding:6px 4px;opacity:.6;",
        })
      );
    for (let p = start; p <= end; p++) addBtn(String(p), p, false, p === page);
    if (end < totalPages - 1)
      pag.appendChild(
        Object.assign(document.createElement("span"), {
          textContent: "…",
          style: "padding:6px 4px;opacity:.6;",
        })
      );
    if (end < totalPages)
      addBtn(String(totalPages), totalPages, false, page === totalPages);
    addBtn("Next", page + 1, page === totalPages);
  }

  let currentGenre = "";
  let currentPerPage = 18;

  async function selectGenre(name, page = 1) {
    currentGenre = name;
    renderHeader(name);
    const cont = document.getElementById("genre-movies-container");
    if (cont) cont.innerHTML = "<p class='loading-msg'>Loading...</p>";
    try {
      const { items, total } = await fetchGenreMovies(name, page);
      renderMovies(items);
      currentPerPage = estimatePerPage(items.length);
      renderPagination(total, page, currentPerPage, (p) =>
        selectGenre(name, p)
      );
      const params = new URLSearchParams(location.search);
      params.set("g", name);
      params.set("page", String(page));
      history.replaceState(
        null,
        "",
        `${location.pathname}?${params.toString()}`
      );
    } catch (e) {
      const msg = /404/.test(String(e && e.message))
        ? "No movies found in this genre"
        : `Failed to load ${name}: ${String(e.message || e)}`;
      if (cont) cont.innerHTML = `<p class="error-msg">${msg}</p>`;
      console.error("[genres] fetch error:", e);
    }
  }

  function initFromURL() {
    const p = new URLSearchParams(location.search);
    const g = p.get("g") || "";
    const page = parseInt(p.get("page") || "1", 10) || 1;
    if (g) selectGenre(g, page);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    // Navbar & ads handled by script.js if present on the page
    const btnWrap = document.getElementById("genres-buttons");
    const listWrap = document.getElementById("genre-movies-container");
    if (!btnWrap || !listWrap) return;

    try {
      const genres = await fetchGenres();
      renderGenresButtons(genres);
      initFromURL();
    } catch (e) {
      btnWrap.innerHTML = `<p class="error-msg">Failed to load genres: ${String(
        e.message || e
      )}</p>`;
      console.error("[genres] load error:", e);
    }
  });
})();
