// Horizontal drag-to-scroll for the genre scroller
(function () {
  const scroller = document.getElementById("genre-scroller");
  if (!scroller) return;
  let isDown = false,
    startX = 0,
    scrollStart = 0,
    moved = 0;

  function swallowClickOnce(el) {
    function handler(e) {
      e.preventDefault();
      el.removeEventListener("click", handler, true);
    }
    el.addEventListener("click", handler, true);
  }

  // Mouse
  scroller.addEventListener("mousedown", (e) => {
    isDown = true;
    startX = e.pageX - scroller.offsetLeft;
    scrollStart = scroller.scrollLeft;
    moved = 0;
  });
  window.addEventListener("mouseup", () => {
    isDown = false;
  });
  scroller.addEventListener("mouseleave", () => {
    isDown = false;
  });
  scroller.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - scroller.offsetLeft;
    const walk = x - startX;
    moved += Math.abs(walk);
    scroller.scrollLeft = scrollStart - walk;
    startX = x;
  });

  // Touch
  let tStartX = 0,
    tScrollStart = 0,
    tMoved = 0;
  scroller.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      tStartX = t.pageX;
      tScrollStart = scroller.scrollLeft;
      tMoved = 0;
    },
    { passive: true }
  );
  scroller.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      const dx = t.pageX - tStartX;
      tMoved += Math.abs(dx);
      scroller.scrollLeft = tScrollStart - dx;
      tStartX = t.pageX;
    },
    { passive: true }
  );

  scroller.addEventListener(
    "click",
    (e) => {
      const threshold = 8;
      if (moved > threshold || tMoved > threshold) {
        const link = e.target.closest("a");
        if (link) swallowClickOnce(link);
      }
      moved = 0;
      tMoved = 0;
    },
    true
  );

  scroller.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        scroller.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    },
    { passive: false }
  );
})();
