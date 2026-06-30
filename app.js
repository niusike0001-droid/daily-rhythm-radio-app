(function () {
  const appVersion = "20260630d";
  const frame = document.getElementById("screen-frame");
  const phone = document.querySelector(".phone");
  const passwordInput = document.getElementById("password-input");
  const passwordPanel = document.querySelector(".password-panel");
  const navButtons = Array.from(document.querySelectorAll(".app-nav-button"));
  const requiredPassword = "8268";
  const rewardKey = "daily-rhythm-rewards-v1";
  let isUnlocked = localStorage.getItem("daily-rhythm-unlocked") === "1";

  const routes = {
    player: `stitch-raw/player.html?v=${appVersion}`,
    calendar: `stitch-raw/calendar.html?v=${appVersion}`,
    rewards: `stitch-raw/rewards.html?v=${appVersion}`,
    lyrics: `stitch-raw/lyrics.html?v=${appVersion}`,
    comments: `comments.html?v=${appVersion}`,
  };

  let currentRoute = "player";

  const audio = new Audio("assets/audio/001.mp3");
  audio.preload = "auto";
  const audioListeners = new Set();

  function cleanNumber(value) {
    return Number.isFinite(value) ? value : 0;
  }

  function getAudioState() {
    return {
      currentTime: cleanNumber(audio.currentTime),
      duration: cleanNumber(audio.duration),
      paused: audio.paused,
      ended: audio.ended,
      readyState: audio.readyState,
    };
  }

  function notifyAudio() {
    const state = getAudioState();
    audioListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        audioListeners.delete(listener);
      }
    });
  }

  ["loadedmetadata", "durationchange", "timeupdate", "play", "pause", "ended", "seeked", "canplay"].forEach(
    (eventName) => audio.addEventListener(eventName, notifyAudio)
  );

  function playAudio() {
    if (audio.readyState === 0) audio.load();
    return audio
      .play()
      .then(() => {
        notifyAudio();
        return true;
      })
      .catch(() => {
        notifyAudio();
        return false;
      });
  }

  window.dailyPlayer = {
    play: playAudio,
    pause() {
      audio.pause();
      notifyAudio();
      return Promise.resolve(false);
    },
    toggle() {
      if (audio.paused) return playAudio();
      audio.pause();
      notifyAudio();
      return Promise.resolve(false);
    },
    seekRatio(ratio) {
      if (!audio.duration) return;
      const nextRatio = Math.min(Math.max(ratio, 0), 1);
      audio.currentTime = nextRatio * audio.duration;
      notifyAudio();
    },
    seekTo(seconds) {
      if (!audio.duration) return;
      audio.currentTime = Math.min(Math.max(seconds, 0), audio.duration);
      notifyAudio();
    },
    getState: getAudioState,
    addListener(listener) {
      if (typeof listener !== "function") return () => {};
      audioListeners.add(listener);
      listener(getAudioState());
      return () => audioListeners.delete(listener);
    },
  };

  function formatDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function readRewardState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(rewardKey) || "{}");
      return {
        tokens: Number(parsed.tokens) || 0,
        history: Number(parsed.history) || 0,
        checkins: parsed.checkins && typeof parsed.checkins === "object" ? parsed.checkins : {},
      };
    } catch (error) {
      return { tokens: 0, history: 0, checkins: {} };
    }
  }

  function countStreak(checkins, baseDate = new Date()) {
    let streak = 0;
    const cursor = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    while (checkins[formatDateKey(cursor)]) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function withDerivedRewards(state) {
    return {
      ...state,
      streak: countStreak(state.checkins),
      todayKey: formatDateKey(),
    };
  }

  function writeRewardState(state) {
    localStorage.setItem(rewardKey, JSON.stringify(state));
    return withDerivedRewards(state);
  }

  function notifyRewards() {
    const state = withDerivedRewards(readRewardState());
    try {
      frame.contentWindow?.dailyRenderRewards?.(state);
      frame.contentWindow?.dailyRenderCalendarRewards?.(state);
    } catch (error) {}
  }

  window.dailyRewardsState = () => withDerivedRewards(readRewardState());
  window.dailyIsCheckedIn = (dateKey = formatDateKey()) => Boolean(readRewardState().checkins[dateKey]);
  window.dailyCheckInComplete = (dateKey = formatDateKey()) => {
    const state = readRewardState();
    if (!state.checkins[dateKey]) {
      state.checkins[dateKey] = { completedAt: new Date().toISOString() };
      state.tokens += 1;
      state.history += 1;
    }
    const nextState = writeRewardState(state);
    notifyRewards();
    return nextState;
  };
  window.dailyDateState = () => {
    const date = new Date();
    const day = date.getDay();
    return {
      date,
      dateKey: formatDateKey(date),
      year: date.getFullYear(),
      month: date.toLocaleString("en-US", { month: "long" }).toUpperCase(),
      dateText: date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
      requiredClicks: day === 0 ? 7 : day,
    };
  };

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

  function activeNavRoute(route) {
    return route === "calendar" || route === "rewards" ? route : "player";
  }

  function updateShellNav(route) {
    const active = activeNavRoute(route);
    navButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.route === active);
    });
    if (phone) phone.dataset.route = route;
  }

  function go(route) {
    const next = normalizeRoute(route);
    if (next === currentRoute && frame.getAttribute("src")) {
      updateShellNav(next);
      return;
    }
    currentRoute = next;
    updateShellNav(next);
    frame.setAttribute("src", routes[next]);
    if (location.hash.slice(1) !== next) {
      history.replaceState(null, "", `#${next}`);
    }
  }

  window.dailyGo = go;

  navButtons.forEach((button) => {
    button.addEventListener("click", () => go(button.dataset.route));
  });

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
    addRouteClick(findButtonByImageAlt(doc, "lyrics"), "lyrics", 80);
    addRouteClick(findButtonByImageAlt(doc, "comments"), "comments", 80);
  }

  function wireClose(doc) {
    const close =
      doc.querySelector('[aria-label*="Close" i]') ||
      doc.querySelector('[aria-label*="lyrics" i]') ||
      Array.from(doc.querySelectorAll("button, a")).find((node) =>
        node.textContent.trim().toLowerCase().includes("close")
      );
    addRouteClick(close, "player");
  }

  function injectShellCss(doc) {
    let style = doc.getElementById("codex-mobile-shell-style");
    if (!style) {
      style = doc.createElement("style");
      style.id = "codex-mobile-shell-style";
      doc.head.appendChild(style);
    }
    style.textContent = `
      html, body {
        width: 100% !important;
        min-height: 100dvh !important;
        margin: 0 !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch;
      }
      body {
        height: auto !important;
        overflow-y: auto !important;
      }
      body > nav,
      body nav.fixed,
      body nav[class*="bottom"],
      .min-h-screen > nav {
        display: none !important;
      }
      .min-h-screen.overflow-hidden {
        overflow: visible !important;
      }
      img {
        image-rendering: auto;
      }
    `;
  }

  function hideInternalNavs(doc) {
    Array.from(doc.querySelectorAll("body > nav, body nav.fixed, body nav[class*='bottom'], .min-h-screen > nav")).forEach(
      (node) => {
        node.style.setProperty("display", "none", "important");
        node.setAttribute("aria-hidden", "true");
      }
    );
  }

  function patchScreen() {
    let doc;
    try {
      doc = frame.contentDocument;
    } catch (error) {
      return;
    }
    if (!doc) return;

    injectShellCss(doc);
    hideInternalNavs(doc);
    wireBottomNav(doc);
    if (currentRoute === "player") {
      wirePlayer(doc);
      frame.contentWindow?.dailyAttachParentPlayer?.();
    }
    if (currentRoute === "lyrics" || currentRoute === "comments") wireClose(doc);
    if (currentRoute === "rewards") frame.contentWindow?.dailyRenderRewards?.(window.dailyRewardsState());
    if (currentRoute === "calendar") frame.contentWindow?.dailyRenderCalendarRewards?.(window.dailyRewardsState());
  }

  frame.addEventListener("load", () => {
    patchScreen();
    setTimeout(patchScreen, 250);
    setTimeout(patchScreen, 900);
  });

  window.addEventListener("hashchange", () => go(location.hash.slice(1)));
  window.addEventListener("storage", notifyRewards);
  setupPasswordGate();
  updateShellNav(currentRoute);
  go(location.hash.slice(1));
})();
