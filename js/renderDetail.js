// Helper: get query param by name
function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

// Image error fallback (standalone safe)
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

// Render related movies/series cards (same style as main cards)
function renderRelatedCards(related, type = "movies") {
  if (!Array.isArray(related) || related.length === 0)
    return "<p>No related found.</p>";

  // Use the same markup as renderMoviesInto
  return `
    <div class="movie-card-container related-movie-card-container">
      ${related
        .map(
          (item) => `
        <a class="movie-card" href="detail.html?id=${encodeURIComponent(
          item.id
        )}${type === "series" ? "&type=series" : ""}" role="link" aria-label="${
            item.title || ""
          }" data-id="${item.id}" data-type="${type}">
          <div class="movie-poster-wrap">
            <img src="${item.image || "images/placeholder.png"}" alt="${
            item.title || ""
          }" onerror="window.__imgError && window.__imgError(this)">
          </div>
          <h6>${item.title || "Untitled"}</h6>
          ${item.duration ? `<p>${item.duration} mins</p>` : ""}
          ${item.year ? `<p>${item.year}</p>` : ""}
        </a>
      `
        )
        .join("")}
    </div>
  `;
}

async function renderDetail() {
  const id = getQueryParam("id");
  const type = "movies"; // new API is movies-only
  const container = document.getElementById("detail-container");
  if (!container) return;

  if (!id) {
    container.innerHTML = "<p style='color:red'>No ID provided.</p>";
    return;
  }

  // Fetch detail from YangonTV API
  const apiUrl = `https://yangontv.org/api/movies/${encodeURIComponent(id)}`;

  const normalizeMediaUrl = (s) => {
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
  };

  let apiJson;
  try {
    const res = await fetch(apiUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    apiJson = await res.json();
  } catch (e) {
    console.error("[detail] fetch failed:", e);
    container.innerHTML = "<p style='color:red'>Failed to load details.</p>";
    return;
  }

  if (!apiJson || apiJson.status !== "success" || !apiJson.data) {
    container.innerHTML = "<p style='color:red'>Invalid response.</p>";
    return;
  }

  const d = apiJson.data;
  const item = {
    id: d.id,
    title: d.title || "Untitled",
    year: d.release_year || d.year || "",
    image: normalizeMediaUrl(d.poster || d.image || ""),
    duration: d.duration || "",
    rating: d.rating || "",
    genres: Array.isArray(d.genres) ? d.genres : [],
    review: d.description || d.review || "",
    watchlink: d.watch || d.watchlink || "#",
    youTube: d.youtube || "",
    subcribe: d.telegram || d.subscribe || "",
    telegram: d.telegram || "",
  };
  const related = Array.isArray(d.related)
    ? d.related.map((r) => ({
        id: r.id,
        title: r.title || r.name || "Untitled",
        image: normalizeMediaUrl(r.poster || r.image || ""),
        duration: r.duration || "",
        year: r.release_year || r.year || "",
      }))
    : [];

  // Set document title for nicer breadcrumb label
  try {
    const base = type === "series" ? "Series" : "Movies";
    if (item.title) document.title = `${item.title} - ${base}`;
  } catch {}

  // Render genres as badges
  let genresHtml = "";
  if (Array.isArray(item.genres)) {
    genresHtml = item.genres
      .map(
        (g, i) =>
          `<a class="genre-link"><span class="genre-badge">${g}</span></a>${
            i < item.genres.length - 1 ? "," : ""
          }`
      )
      .join(" ");
  } else if (typeof item.genre === "string") {
    genresHtml = item.genre
      .split(",")
      .map(
        (g, i, arr) =>
          `<a class="genre-link"><span class="genre-badge">${g.trim()}</span></a>${
            i < arr.length - 1 ? "," : ""
          }`
      )
      .join(" ");
  }

  // YouTube embed (if available)
  let youTubeEmbed = "";
  const ytLink = item.youTube;
  if (ytLink) {
    let src = "";
    if (/youtube\.com\/embed\//.test(ytLink)) {
      src = ytLink;
    } else {
      // Extract video ID from various formats
      let videoId = "";
      try {
        const ytUrl = new URL(ytLink);
        if (ytUrl.hostname.includes("youtu.be")) {
          videoId = ytUrl.pathname.replace("/", "");
        } else if (ytUrl.searchParams.has("v")) {
          videoId = ytUrl.searchParams.get("v");
        } else {
          videoId = ytUrl.pathname.split("/").pop();
        }
      } catch {
        const match = ytLink.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
        if (match) videoId = match[1];
      }
      if (videoId) src = `https://www.youtube.com/embed/${videoId}`;
    }
    if (src) {
      youTubeEmbed = `
        <div class="youtube-embed-wrap" style="margin-bottom:1.5rem;">
          <iframe width="100%" height="340" src="${src}" 
            title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
          </iframe>
        </div>
      `;
    }
  }

  container.innerHTML = `
    <div class="movie-container">
      <div class="row-custom">
        <div class="col-img text-center-custom">
          <img src="${
            item.image || "images/example.jpg"
          }" class="movie-poster" alt="${
    item.title || ""
  }" onerror="window.__imgError && window.__imgError(this)" />
        </div>
        <div class="col-info">
          <h2>${item.title || "Title"}${item.year ? ` (${item.year})` : ""}</h2>
          <p>IMDB Rating: <strong>${
            item.rating ? item.rating : "N/A"
          }</strong></p>
          <p>Budget: <strong>${
            item.budget ? "$" + item.budget : "N/A"
          }</strong> / Revenue: <strong>${
    item.revenue ? "$" + item.revenue : "N/A"
  }</strong></p>
          <div class="genre-list">
            ${genresHtml}
          </div>
          <p>${item.review || item.description || "No review available."}</p>
        </div>
      </div>

      ${youTubeEmbed}

      <div class="action-buttons">
        <a href="${
          item.telegram || item.watchlink || "#"
        }" class="btn-telegram" target="_blank" rel="noopener">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:6px">
            <path fill="#fff" d="M9.036 15.803l-.378 5.324c.541 0 .775-.232 1.056-.51l2.538-2.431 5.259 3.85c.964.532 1.649.252 1.915-.893l3.47-16.266.001-.001c.308-1.437-.519-1.999-1.463-1.647L1.12 9.76c-1.41.548-1.389 1.336-.24 1.691l4.864 1.517L19.5 6.3c.69-.452 1.32-.202.802.25"/>
          </svg>
          <span>Watch full movie on Telegram</span>
        </a>
        <a href="${
          item.youTube || item.subcribe || "#"
        }" class="btn-red" target="_blank" rel="noopener">Subscribe to YouTube channel</a>
      </div>
      <p></p>
      <p></p>

      <div class="related-header">
        <h5>Related ${type === "series" ? "Series" : "Movies"}</h5>
      </div>
      ${renderRelatedCards(related, type)}
    </div>
  `;

  // Enable SPA-like navigation for related cards
  document
    .querySelectorAll(".related-movie-card-container .movie-card")
    .forEach((card) => {
      card.addEventListener("click", function (e) {
        e.preventDefault();
        const rid = card.dataset.id;
        const rtype = card.dataset.type;
        if (rid) {
          window.location.href = `detail.html?id=${encodeURIComponent(rid)}${
            rtype === "series" ? "&type=series" : ""
          }`;
        }
      });
      card.style.cursor = "pointer";
    });
}

// Run on page load
document.addEventListener("DOMContentLoaded", renderDetail);

// If breadcrumb script is loaded, update after detail renders
document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.updateBreadcrumb === "function") {
    // slight delay to ensure title has been set
    setTimeout(() => window.updateBreadcrumb(), 0);
  }
});
