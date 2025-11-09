// YouTube Shorts-like viewer: show a single short at a time; swipe up/down to navigate
(function () {
  // Dynamic shorts loaded from API in groups of ~8
  const API_BASE = "https://yangontv.org/api/shorts";
  let nextGroupToLoad = 1;
  let isLoadingGroup = false;
  const SHORTS = [];

  function buildEmbedSrc(id) {
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      controls: "1",
      autoplay: "1", // start automatically
      mute: "1", // required for autoplay on most browsers
      loop: "1", // keep looping while active
      playlist: id, // required by YT to loop a single video
      enablejsapi: "1", // allow JS control for play/pause
    });
    try {
      if (location && /^https?:/i.test(location.protocol)) {
        params.set("origin", location.origin);
      }
    } catch (_) {}
    return `https://www.youtube.com/embed/${encodeURIComponent(
      id
    )}?${params.toString()}`;
  }

  // Persisted sound preference across navigations
  let preferSound = false;
  try {
    preferSound = localStorage.getItem("shortsSound") === "on";
  } catch (_) {}

  function setPreferSound(on) {
    preferSound = !!on;
    try {
      localStorage.setItem("shortsSound", on ? "on" : "off");
    } catch (_) {}
  }

  // Extract a YouTube ID from various link formats (shorts, watch, youtu.be)
  function extractYouTubeId(urlStr) {
    try {
      const u = new URL(urlStr);
      const host = u.hostname.replace(/^www\./, "");
      if (
        (host === "youtube.com" ||
          host === "m.youtube.com" ||
          host === "youtube-nocookie.com") &&
        u.pathname.startsWith("/shorts/")
      ) {
        const parts = u.pathname.split("/");
        return parts[2] || "";
      }
      if (
        (host === "youtube.com" ||
          host === "m.youtube.com" ||
          host === "youtube-nocookie.com") &&
        u.pathname === "/watch"
      ) {
        return u.searchParams.get("v") || "";
      }
      if (host === "youtu.be") {
        return (u.pathname.split("/")[1] || "").trim();
      }
      const segs = u.pathname.split("/").filter(Boolean);
      return segs[segs.length - 1] || "";
    } catch (_) {
      const m = String(urlStr).match(/[\/?=]([A-Za-z0-9_-]{6,})$/);
      return m ? m[1] : "";
    }
  }

  async function fetchShortsGroup(groupNum) {
    const url = `${API_BASE}?group=${encodeURIComponent(groupNum)}`;
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(to);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json || json.status !== "success" || !Array.isArray(json.data)) {
        throw new Error("Unexpected API response");
      }
      const items = json.data
        .map((it) => {
          const vid = extractYouTubeId(it.link || "");
          if (!vid) return null;
          const obj = {
            id: vid,
            title: "",
            detailUrl: it.movie_id
              ? `detail.html?id=${encodeURIComponent(it.movie_id)}`
              : `https://www.youtube.com/watch?v=${encodeURIComponent(vid)}`,
          };
          return obj;
        })
        .filter(Boolean);
      return items;
    } catch (e) {
      clearTimeout(to);
      console.error("Failed to load shorts group", groupNum, e);
      return [];
    }
  }

  async function ensureLoadNextGroup() {
    if (isLoadingGroup) return false;
    isLoadingGroup = true;
    const groupNum = nextGroupToLoad;
    const items = await fetchShortsGroup(groupNum);
    isLoadingGroup = false;
    if (items.length > 0) {
      SHORTS.push(...items);
      nextGroupToLoad = groupNum + 1;
      return true;
    }
    return false;
  }

  function createCard(item) {
    const card = document.createElement("article");
    card.className = "short-card";

    const iframe = document.createElement("iframe");
    iframe.className = "short-frame";
    iframe.src = buildEmbedSrc(item.id);
    iframe.title = item.title || "YouTube video";
    iframe.loading = "lazy";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;

    const meta = document.createElement("div");
    meta.className = "short-meta";
    meta.textContent = item.title || "";

    // Transparent gesture layer (captures swipe/wheel above iframe)
    const gesture = document.createElement("div");
    gesture.className = "short-gesture-layer";

    // Floating actions (View Detail)
    const action = document.createElement("div");
    action.className = "short-action";
    const btn = document.createElement("a");
    btn.className = "view-detail-btn";
    const detailUrl = getDetailUrl(item);
    btn.href = detailUrl;
    btn.target = isExternal(detailUrl) ? "_blank" : "_self";
    btn.rel = "noopener";
    btn.setAttribute(
      "aria-label",
      `Movie detail for ${item.title || "this video"}`
    );
    btn.innerHTML = `<i class="fas fa-info-circle" aria-hidden="true"></i><span>Movie Detail</span>`;
    action.appendChild(btn);

    card.appendChild(iframe);
    card.appendChild(gesture);
    card.appendChild(action);
    card.appendChild(meta);
    return card;
  }

  function isExternal(url) {
    try {
      const u = new URL(url, window.location.href);
      return u.origin !== window.location.origin;
    } catch (_) {
      return true;
    }
  }

  function getDetailUrl(item) {
    if (item && item.detailUrl) return item.detailUrl;
    // Fallback to YouTube watch URL
    const id = item && item.id ? String(item.id) : "";
    return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  }

  function mountCard(host, newCard, enterFrom) {
    // enterFrom: 'top' | 'bottom' | null
    if (enterFrom === "top") newCard.classList.add("enter-from-top");
    if (enterFrom === "bottom") newCard.classList.add("enter-from-bottom");
    // force style flush before activating animation
    host.appendChild(newCard);
    // next frame to apply active state
    requestAnimationFrame(() => {
      newCard.classList.add("enter-active");
      newCard.classList.remove("enter-from-top", "enter-from-bottom");
    });
    // initial state (autoplay expected)
    newCard.dataset.playing = "1";
    // Apply global sound preference (unmute on-ready-ish)
    if (preferSound) {
      const iframe = newCard.querySelector("iframe");
      // Attempt multiple times in case player hasn't initialized yet
      let tries = 0;
      const tryUnmute = () => {
        tries++;
        try {
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(
              JSON.stringify({ event: "command", func: "unMute", args: [] }),
              "*"
            );
            iframe.contentWindow.postMessage(
              JSON.stringify({ event: "command", func: "playVideo", args: [] }),
              "*"
            );
          }
        } catch (_) {}
        if (tries < 5) setTimeout(tryUnmute, 180);
      };
      setTimeout(tryUnmute, 120);
    }
  }

  function replaceCard(host, newCard, direction) {
    // direction: 'up' means user swiped up => move old up, new enters from bottom
    const oldCard = host.querySelector(".short-card");
    const enterFrom = direction === "up" ? "bottom" : "top";
    mountCard(host, newCard, enterFrom);
    if (!oldCard) return;
    const exitClass = direction === "up" ? "exit-to-top" : "exit-to-bottom";
    oldCard.classList.add(exitClass);
    // remove old after transition
    const cleanup = () => oldCard.remove();
    oldCard.addEventListener("transitionend", cleanup, { once: true });
    // Safety cleanup in case transitionend doesn't fire
    setTimeout(cleanup, 450);
  }

  function ShortsViewer({ list, host }) {
    let index = 0;
    let isAnimating = false;
    const NAV_COOLDOWN = 550; // ms: limit to one video per gesture
    let lastNavAt = 0;
    let activeTouchCard = null; // track which card received the touch

    function sendPlayerCommand(iframe, cmd) {
      if (!iframe || !iframe.contentWindow) return;
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: cmd, args: [] }),
          "*"
        );
      } catch (_) {}
    }

    function togglePlayPause(card) {
      const el = card || host.querySelector(".short-card");
      if (!el) return;
      const iframe = el.querySelector("iframe");
      if (!iframe) return;
      const playing = el.dataset.playing === "1"; // our local state
      if (playing) {
        sendPlayerCommand(iframe, "pauseVideo");
        el.dataset.playing = "0";
      } else {
        sendPlayerCommand(iframe, "playVideo");
        el.dataset.playing = "1";
      }
    }

    function unmuteAndPlay(card) {
      const el = card || host.querySelector(".short-card");
      if (!el) return;
      const iframe = el.querySelector("iframe");
      if (!iframe) return;
      sendPlayerCommand(iframe, "unMute");
      sendPlayerCommand(iframe, "playVideo");
      el.dataset.playing = "1";
    }

    function show(i, direction) {
      if (i < 0 || i >= list.length) return;
      const item = list[i];
      const card = createCard(item);
      if (!host.querySelector(".short-card")) {
        mountCard(host, card, null);
      } else {
        isAnimating = true;
        replaceCard(host, card, direction);
        setTimeout(() => (isAnimating = false), 340);
      }
      // Wire per-card gesture handlers (overlay above iframe)
      attachCardGestures(card);
      index = i;
      lastNavAt = Date.now();
    }

    function canNavigate() {
      const now = Date.now();
      if (isAnimating) return false;
      if (now - lastNavAt < NAV_COOLDOWN) return false;
      return true;
    }

    async function next() {
      if (!canNavigate()) return;
      const i = index + 1;
      if (i < list.length) {
        show(i, "up");
      } else {
        // Load next group on demand
        const loaded = await ensureLoadNextGroup();
        if (loaded && index + 1 < list.length) {
          show(index + 1, "up");
        }
      }
    }

    function prev() {
      if (!canNavigate()) return;
      const i = index - 1;
      if (i >= 0) show(i, "down");
    }

    // Touch swipe handling
    let startY = 0;
    let startX = 0;
    let startTime = 0;
    const THRESHOLD = 42; // px
    const TAP_DIST = 10; // px
    const TAP_TIME = 300; // ms

    function onTouchStart(e) {
      const t = e.touches[0];
      startY = t.clientY;
      startX = t.clientX;
      startTime = Date.now();
      activeTouchCard =
        e.target && e.target.closest ? e.target.closest(".short-card") : null;
    }
    function onTouchEnd(e) {
      const t = e.changedTouches[0];
      const dy = t.clientY - startY;
      const dx = t.clientX - startX;
      const dt = Date.now() - startTime;
      // Tap detection: small movement and quick
      if (Math.abs(dy) < TAP_DIST && Math.abs(dx) < TAP_DIST && dt < TAP_TIME) {
        if (!preferSound) {
          setPreferSound(true);
          unmuteAndPlay(activeTouchCard);
        } else {
          togglePlayPause(activeTouchCard);
        }
        activeTouchCard = null;
        return; // don't navigate on taps
      }
      const isVertical = Math.abs(dy) > Math.abs(dx) * 1.2;
      if (!isVertical) return;
      if (Math.abs(dy) < THRESHOLD) return;
      if (dt > 800 && Math.abs(dy) < THRESHOLD * 1.6) return; // ignore slow small drags
      if (dy < 0) next(); // swipe up => next
      else prev(); // swipe down => previous
      activeTouchCard = null;
    }

    // Wheel (desktop) support - optional, debounced
    let wheelLock = false;
    async function onWheel(e) {
      if (wheelLock || isAnimating) return;
      if (Math.abs(e.deltaY) < 20) return;
      wheelLock = true;
      if (e.deltaY > 0) await next();
      else prev();
      setTimeout(() => (wheelLock = false), NAV_COOLDOWN + 100);
    }

    // Keyboard support
    function onKey(e) {
      if (e.repeat) return; // ignore key auto-repeat
      if (e.key === "ArrowUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        next();
      }
    }

    // Attach listeners to host (fallback when not over iframe)
    host.addEventListener("touchstart", onTouchStart, { passive: true });
    host.addEventListener("touchend", onTouchEnd, { passive: true });
    host.addEventListener(
      "wheel",
      (e) => {
        onWheel(e);
      },
      { passive: true }
    );
    document.addEventListener("keydown", onKey);

    function attachCardGestures(card) {
      const layer = card.querySelector(".short-gesture-layer");
      if (!layer) return;
      layer.addEventListener("touchstart", onTouchStart, { passive: true });
      layer.addEventListener("touchend", onTouchEnd, { passive: true });
      layer.addEventListener("wheel", onWheel, { passive: true });
      layer.addEventListener("click", function (e) {
        // Click to unmute (first), else toggle play/pause on desktop
        if (!preferSound) {
          setPreferSound(true);
          unmuteAndPlay(card);
        } else {
          togglePlayPause(card);
        }
      });
    }

    // Public API (could be extended)
    return {
      show,
      next,
      prev,
      get index() {
        return index;
      },
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    const host = document.getElementById("shorts-list");
    if (!host) return;
    const viewer = ShortsViewer({ list: SHORTS, host });
    // Load first group; if fails, fall back to a demo video
    ensureLoadNextGroup().then((ok) => {
      if (ok && SHORTS.length > 0) {
        viewer.show(0);
      } else {
        const demo = [
          {
            id: "M7lc1UVf-VE",
            title: "YouTube IFrame API Intro (Demo)",
            detailUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
          },
        ];
        SHORTS.push(...demo);
        viewer.show(0);
      }
    });

    if (typeof window.updateBreadcrumb === "function") {
      setTimeout(window.updateBreadcrumb, 50);
    }
  });
})();
