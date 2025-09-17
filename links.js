// Social Links Page Logic (moved from links.html)
(function () {
  // Load navbar if available
  document.addEventListener("DOMContentLoaded", function () {
    if (typeof loadNavbar === "function") loadNavbar();
  });

  const typeMap = {
    tg: "Telegram",
    fb: "Facebook",
    yt: "YouTube",
    tt: "TikTok",
    vb: "Viber",
  };
  const fallbackIcons = {
    tg: "https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg",
    fb: "https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_(2019).png",
    yt: "https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg",
    tt: "https://upload.wikimedia.org/wikipedia/en/0/0a/TikTok_logo.svg",
    vb: "https://upload.wikimedia.org/wikipedia/commons/7/73/Viber_2017_Logo.svg",
    default:
      "https://upload.wikimedia.org/wikipedia/commons/3/3f/OOjs_UI_icon_link-ltr.svg",
  };

  function resolveIcon(src, type) {
    if (!src) return fallbackIcons[type] || fallbackIcons.default;
    if (/^\//.test(src)) return "https://yangontv.org" + src; // relative path
    return src;
  }

  async function loadLinks() {
    const container = document.getElementById("links-container");
    if (!container) return;
    container.innerHTML =
      '<div style="opacity:0.7;font-size:1.1rem;">Loading...</div>';
    try {
      const res = await fetch("https://yangontv.org/api/social");
      const json = await res.json();
      if (!json || json.status !== "success" || !Array.isArray(json.data))
        throw new Error("Invalid data");
      container.innerHTML = "";
      json.data.forEach((item) => {
        const card = document.createElement("a");
        card.className = "social-card";
        card.href = item.link;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        const type = item.type;
        const primaryIcon = resolveIcon(item.icon, type);
        const fallback = fallbackIcons[type] || fallbackIcons.default;
        card.innerHTML = `<span class="social-icon"><img src="${primaryIcon}" alt="${type} icon" loading="lazy" onerror="this.onerror=null;this.src='${fallback}';"></span>
					<span class="social-info">
						<span class="social-name">${item.name}</span>
						<span class="social-type">${typeMap[item.type] || item.type}</span>
					</span>`;
        container.appendChild(card);
      });
    } catch (e) {
      container.innerHTML =
        '<div style="color:#f55;">Failed to load links.</div>';
    }
  }

  document.addEventListener("DOMContentLoaded", loadLinks);
})();
