// Search page logic (movies only)
const PAGE_SIZE = 18;
let _cachedResults = null;

// Global image error fallback (search page standalone)
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

// Normalize media URLs like other pages (handles /uploads paths, backslashes, tabs)
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

function getQueryKeyword() {
  const p = new URLSearchParams(location.search);
  return (p.get("q") || p.get("keyword") || "").trim();
}

function escapeHTML(str) {
  return str.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
  );
}

function updateHeading(keyword, total) {
  const h = document.getElementById("search-heading");
  const summary = document.getElementById("search-summary");
  if (!h || !summary) return;
  if (!keyword) {
    // Hide heading until a search is made
    h.style.display = "none";
    summary.textContent = "Enter a keyword to search movies.";
    return;
  }
  // Show and update heading after search
  h.style.display = "block";
  h.textContent = `Movies for "${keyword}"`;
  if (total != null) {
    summary.textContent =
      total === 0
        ? `No results found for "${keyword}".`
        : `${total} result${total === 1 ? "" : "s"} for "${keyword}".`;
  }
}

async function fetchSearch(keyword) {
  console.log(encodeURIComponent(keyword));
  const url = `https://yangontv.org/api/search/${encodeURIComponent(keyword)}`;
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
    if (e.name === "AbortError") throw new Error("Request timeout");
    throw new Error("Network error");
  }
  clearTimeout(to);
  // Treat 404 as "no results" instead of an error
  if (!res.ok) {
    if (res.status === 404) {
      return { status: "success", data: [] };
    }
    throw new Error("HTTP " + res.status);
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error("Invalid JSON");
  }
  if (!json || json.status !== "success" || !Array.isArray(json.data))
    throw new Error("Unexpected response");
  return json;
}

function renderCards(items, page) {
  const container = document.getElementById("search-results-container");
  if (!container) return;
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML =
      "<p style='font-size:.8rem;opacity:.7;white-space:nowrap;text-align:center;'>No movies available.</p>";
    return;
  }
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);
  pageItems.forEach((m) => {
    const title = escapeHTML(m.title || "Untitled");
    const posterUrl = normalizeMediaUrl(m.poster || m.image || "");
    const poster = escapeHTML(posterUrl || "images/placeholder.png");
    const year = m.release_year
      ? `<p>${escapeHTML(String(m.release_year))}</p>`
      : "";
    const duration = m.duration
      ? `<p>${escapeHTML(String(m.duration))} mins</p>`
      : "";
    const a = document.createElement("a");
    a.className = "movie-card";
    a.href = `detail.html?id=${encodeURIComponent(m.id)}`;
    a.innerHTML = `
      <div class="movie-poster-wrap">
        <img src="${poster}" alt="${title}" onerror="window.__imgError && window.__imgError(this)">
      </div>
      <h6>${title}</h6>
      ${year}
      ${duration}
    `;
    container.appendChild(a);
  });
}
function renderPagination(total, page, keyword) {
  const pag = document.getElementById("pagination");
  if (!pag) return;
  pag.innerHTML = "";
  if (total <= PAGE_SIZE) return;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function addBtn(label, p, disabled = false, active = false) {
    const btn = document.createElement("button");
    btn.textContent = label;
    if (active) btn.classList.add("active");
    btn.disabled = disabled;
    btn.addEventListener("click", () => {
      const params = new URLSearchParams(location.search);
      params.set("page", p);
      if (!params.get("q") && keyword) params.set("q", keyword);
      history.replaceState(
        null,
        "",
        `${location.pathname}?${params.toString()}`
      );
      renderResults(keyword, p);
      // refresh ads on each search page change
      if (typeof window.renderAdHtml === "function") {
        try {
          window.renderAdHtml();
        } catch (_) {}
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    pag.appendChild(btn);
  }

  addBtn("Prev", page - 1, page === 1);
  // Show limited window of pages
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = start + windowSize - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - windowSize + 1);
  }
  if (start > 1) addBtn("1", 1, false, page === 1);
  if (start > 2) {
    const ell = document.createElement("span");
    ell.style.cssText = "padding:6px 4px;font-size:.7rem;opacity:.6;";
    ell.textContent = "...";
    pag.appendChild(ell);
  }
  for (let p = start; p <= end; p++) {
    addBtn(String(p), p, false, p === page);
  }
  if (end < totalPages - 1) {
    const ell = document.createElement("span");
    ell.style.cssText = "padding:6px 4px;font-size:.7rem;opacity:.6;";
    ell.textContent = "...";
    pag.appendChild(ell);
  }
  if (end < totalPages)
    addBtn(String(totalPages), totalPages, false, page === totalPages);
  addBtn("Next", page + 1, page === totalPages);
}

async function renderResults(keyword, page = 1) {
  const container = document.getElementById("search-results-container");
  if (!container) return;
  if (!keyword) {
    updateHeading("", null);
    container.innerHTML =
      "<p style='font-size:.8rem;opacity:.7;white-space:nowrap;text-align:center;'>Type something to search.</p>";
    document.getElementById("pagination").innerHTML = "";
    return;
  }
  updateHeading(keyword, null);
  if (!_cachedResults) {
    container.innerHTML = "<p class='loading-msg'>Loading...</p>";
    try {
      const data = await fetchSearch(keyword);
      _cachedResults = data.data;
      updateHeading(keyword, _cachedResults.length);
    } catch (e) {
      // If any other error, show a general failure; 404 is already mapped to empty above
      container.innerHTML = `<p class="error-msg">Failed: ${escapeHTML(
        e.message
      )}</p>`;
      document.getElementById("pagination").innerHTML = "";
      return;
    }
  }
  const total = _cachedResults.length;
  if (total === 0) {
    container.innerHTML = `<p style="font-size:.9rem;white-space:nowrap;text-align:center;color:#fff;grid-column:1/-1;width:100%;">No movies are found for \"${escapeHTML(
      keyword
    )}\" in search</p>`;
    document.getElementById("pagination").innerHTML = "";
    return;
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(Math.max(1, page), totalPages);
  renderCards(_cachedResults, page);
  renderPagination(total, page, keyword);
}

function hookInlineForm(existingKeyword) {
  const form = document.getElementById("inlineSearchForm");
  const input = document.getElementById("inlineSearchInput");
  if (!form || !input) return;
  if (existingKeyword) input.value = existingKeyword;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const kw = input.value.trim();
    _cachedResults = null;
    const params = new URLSearchParams();
    if (kw) params.set("q", kw);
    history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
    renderResults(kw, 1);
    if (typeof window.renderAdHtml === "function") {
      try {
        window.renderAdHtml();
      } catch (_) {}
    }
  });
}

// Also override navbar search (if present) to redirect here
document.addEventListener("DOMContentLoaded", () => {
  // If script.js already loaded navbar & ad; we only add search-specific logic.
  const keyword = getQueryKeyword();
  const params = new URLSearchParams(location.search);
  const page = parseInt(params.get("page") || "1", 10) || 1;

  hookInlineForm(keyword);

  // Navbar search override (always attach)
  const navForm = document.getElementById("searchForm");
  const navInput = document.getElementById("searchInput");
  if (navForm && navInput) {
    navForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const kw = navInput.value.trim();
      if (!kw) return;
      if (location.pathname.endsWith("search.html")) {
        _cachedResults = null;
        history.replaceState(
          null,
          "",
          `search.html?q=${encodeURIComponent(kw)}`
        );
        hookInlineForm(kw);
        renderResults(kw, 1);
      } else {
        location.href = `search.html?q=${encodeURIComponent(kw)}`;
      }
    });
  }

  renderResults(keyword, page);
});
