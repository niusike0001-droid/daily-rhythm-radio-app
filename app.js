(function () {
  const frame = document.getElementById("screen-frame");
  const phone = document.querySelector(".phone");
  const passwordInput = document.getElementById("password-input");
  const passwordPanel = document.querySelector(".password-panel");
  const requiredPassword = "8268";
  let isUnlocked = localStorage.getItem("daily-rhythm-unlocked") === "1";

  const routes = {
    player: "stitch-raw/player.html?v=20260630c",
    calendar: "stitch-raw/calendar.html?v=20260630c",
    rewards: "stitch-raw/rewards.html?v=20260630c",
    lyrics: "stitch-raw/lyrics.html?v=20260630c",
    comments: "comments.html?v=20260630c",
  };

  let currentRoute = "player";

  function unlock() {
    isUnlocked = true;
    localStorage.setItem("daily-rhythm-unlocked", "1");
    phone?.classList.remove("is-locked");
    passwordInput?.blur();
  }

  function resetPassword() {
    if (!passwordInput || !passwordPanel) return;
    passwordInput.value = "";
    passwordPanel.classList.remove("is-error");
    void passwordPanel.offsetWidth;
    passwordPanel.classList.add("is-error");
    passwordInput.focus();
  }

  function setupPasswordGate() {
    if (!phone || !passwordInput) return;

    phone.classList.toggle("is-locked", !isUnlocked);
    if (isUnlocked) return;

    passwordInput.addEventListener("input", () => {
      passwordInput.value = passwordInput.value.replace(/\D/g, "").slice(0, 4);
      if (passwordInput.value.length !== 4) return;
      if (passwordInput.value === requiredPassword) {
        unlock();
      } else {
        resetPassword();
      }
    });

    passwordPanel?.addEventListener("click", () => passwordInput.focus());
    window.addEventListener("load", () => setTimeout(() => passwordInput.focus(), 150));
    setTimeout(() => passwordInput.focus(), 150);
  }

  function normalizeRoute(route) {
    return routes[route] ? route : "player";
  }

  function go(route) {
    const next = normalizeRoute(route);
    if (next === currentRoute && frame.getAttribute("src")) return;
    currentRoute = next;
    frame.setAttribute("src", routes[next]);
    if (location.hash.slice(1) !== next) {
      history.replaceState(null, "", `#${next}`);
    }
  }

  window.dailyGo = go;

  function addRouteClick(element, route, delay = 0) {
    if (!element || element.dataset.codexRouteBound === route) return;
    element.dataset.codexRouteBound = route;
    element.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        setTimeout(() => go(route), delay);
      },
      true
    );
  }

  function findButtonByImageAlt(doc, altText) {
    const img = Array.from(doc.querySelectorAll("img")).find(
      (node) => (node.getAttribute("alt") || "").trim().toLowerCase() === altText
    );
    return img ? img.closest("button, a") : null;
  }

  function wireBottomNav(doc) {
    Array.from(doc.querySelectorAll("nav button, nav a")).forEach((node) => {
      const label = node.textContent.trim().toLowerCase();
      if (label.includes("player")) addRouteClick(node, "player");
      if (label.includes("calendar")) addRouteClick(node, "calendar");
      if (label.includes("rewards")) addRouteClick(node, "rewards");
    });
  }

  function wirePlayer(doc) {
    addRouteClick(findButtonByImageAlt(doc, "lyrics"), "lyrics", 140);
    addRouteClick(findButtonByImageAlt(doc, "comments"), "comments", 140);
  }

  function wireClose(doc) {
    const close =
      doc.querySelector('[aria-label*="Close" i]') ||
      Array.from(doc.querySelectorAll("button, a")).find((node) =>
        node.textContent.trim().toLowerCase().includes("close")
      );
    addRouteClick(close, "player");
  }

  function patchScreen() {
    let doc;
    try {
      doc = frame.contentDocument;
    } catch (error) {
      return;
    }
    if (!doc) return;

    wireBottomNav(doc);
    if (currentRoute === "player") wirePlayer(doc);
    if (currentRoute === "lyrics" || currentRoute === "comments") wireClose(doc);

    if (currentRoute === "player" && new URLSearchParams(location.search).get("autoplay") === "1") {
      frame.contentWindow?.playDailyTrack?.();
    }
  }

  frame.addEventListener("load", () => {
    patchScreen();
    setTimeout(patchScreen, 250);
    setTimeout(patchScreen, 900);
  });

  window.addEventListener("hashchange", () => go(location.hash.slice(1)));
  setupPasswordGate();
  go(location.hash.slice(1));
})();
