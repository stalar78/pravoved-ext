(function initPravovedTypingPulsePage() {
  const REQUEST_SOURCE = "pravoved-ext-isolated";
  const RESPONSE_SOURCE = "pravoved-ext-page";
  const COMMAND_TYPE = "PRAVOVED_EXT_TYPING_COMMAND";
  const RESPONSE_TYPE = "PRAVOVED_EXT_TYPING_RESPONSE";
  const EVENT_TYPE = "PRAVOVED_EXT_TYPING_EVENT";
  const CHAT_PATH_RE = /\/private\/chat\/(\d+)(?:\/|$)/;
  const DEFAULT_DURATION_MS = 120000;
  const MAX_DURATION_MS = 5 * 60 * 1000;
  const MIN_PULSE_DELAY_MS = 2800;
  const MAX_PULSE_DELAY_MS = 3800;
  const TYPING_ENDPOINT = "/rest/chatdialog/?method=typing";

  const state = {
    active: false,
    chatId: null,
    startedAt: 0,
    expiresAt: 0,
    pulseCount: 0,
    pulseTimer: null,
    expiryTimer: null,
    monitorTimer: null,
    lastSocketId: null
  };

  function currentChatId() {
    const match = window.location.pathname.match(CHAT_PATH_RE);
    return match ? match[1] : null;
  }

  function findEditor() {
    const selectors = [
      ".dialog-contentable .public-DraftEditor-content[contenteditable=\"true\"]",
      ".public-DraftEditor-content[contenteditable=\"true\"][role=\"combobox\"]",
      ".public-DraftEditor-content[contenteditable=\"true\"]",
      ".dialog__input [contenteditable=\"true\"]"
    ];

    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node) {
        return node;
      }
    }

    return null;
  }

  function meaningfulText(editor) {
    if (!editor) {
      return "";
    }

    return String(editor.textContent || "")
      .replace(/[\u200B\u200C\u200D\uFEFF\s]/g, "");
  }

  function isEditorTarget(target) {
    if (!(target instanceof Node)) {
      return false;
    }

    const editor = findEditor();
    return Boolean(editor && (target === editor || editor.contains(target)));
  }

  function postEvent(kind, reason, extra) {
    window.postMessage({
      source: RESPONSE_SOURCE,
      type: EVENT_TYPE,
      kind,
      reason: reason || null,
      active: state.active,
      chatId: state.chatId,
      startedAt: state.startedAt || null,
      expiresAt: state.expiresAt || null,
      pulseCount: state.pulseCount,
      ...(extra || {})
    }, window.location.origin);
  }

  function respond(requestId, payload) {
    window.postMessage({
      source: RESPONSE_SOURCE,
      type: RESPONSE_TYPE,
      requestId,
      ...payload
    }, window.location.origin);
  }

  function clearTimer(name) {
    if (state[name]) {
      window.clearTimeout(state[name]);
      state[name] = null;
    }
  }

  function clearAllTimers() {
    clearTimer("pulseTimer");
    clearTimer("expiryTimer");
    clearTimer("monitorTimer");
  }

  function stop(reason) {
    const wasActive = state.active;

    clearAllTimers();

    state.active = false;
    state.chatId = null;
    state.startedAt = 0;
    state.expiresAt = 0;
    state.pulseCount = 0;

    if (wasActive) {
      postEvent("stopped", reason || "STOPPED");
    }

    return {
      ok: true,
      active: false,
      reason: reason || "STOPPED"
    };
  }

  function isSocketIoResource(url) {
    if (!url) {
      return false;
    }

    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.pathname.includes("/socket.io/")
        && parsed.searchParams.has("sid");
    } catch (_) {
      return false;
    }
  }

  function socketIdFromPerformance() {
    if (!window.performance || typeof window.performance.getEntriesByType !== "function") {
      return null;
    }

    const resources = window.performance.getEntriesByType("resource");

    for (let index = resources.length - 1; index >= 0; index -= 1) {
      const entry = resources[index];

      if (!entry || !isSocketIoResource(entry.name)) {
        continue;
      }

      try {
        const parsed = new URL(entry.name);
        const sid = parsed.searchParams.get("sid");

        if (sid) {
          return sid;
        }
      } catch (_) {
        // Ignore malformed performance entries.
      }
    }

    return null;
  }

  function resolveSocketId() {
    const current = socketIdFromPerformance();

    if (current) {
      state.lastSocketId = current;
      return current;
    }

    return state.lastSocketId;
  }

  function sendTypingRequest(chatId, socketId) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const body = new URLSearchParams();

      body.set("socket", socketId || "");
      body.set("method", "");
      body.set("data[dialogId]", chatId);
      body.set("data[chatVersion]", "full");

      xhr.open("PUT", TYPING_ENDPOINT, true);
      xhr.withCredentials = true;
      xhr.timeout = 10000;
      xhr.setRequestHeader(
        "Content-Type",
        "application/x-www-form-urlencoded; charset=UTF-8"
      );
      xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");

      xhr.onload = () => {
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status
        });
      };

      xhr.onerror = () => {
        resolve({
          ok: false,
          status: 0,
          reason: "TYPING_REQUEST_NETWORK_ERROR"
        });
      };

      xhr.ontimeout = () => {
        resolve({
          ok: false,
          status: 0,
          reason: "TYPING_REQUEST_TIMEOUT"
        });
      };

      xhr.send(body.toString());
    });
  }

  function nextPulseDelay() {
    return Math.round(
      MIN_PULSE_DELAY_MS
      + Math.random() * (MAX_PULSE_DELAY_MS - MIN_PULSE_DELAY_MS)
    );
  }

  function schedulePulse(delayMs) {
    clearTimer("pulseTimer");

    state.pulseTimer = window.setTimeout(() => {
      runPulse();
    }, Math.max(100, delayMs));
  }

  async function runPulse() {
    if (!state.active) {
      return;
    }

    if (currentChatId() !== state.chatId) {
      stop("CHAT_CHANGED");
      return;
    }

    if (Date.now() >= state.expiresAt) {
      stop("TIMEOUT");
      return;
    }

    const editor = findEditor();

    if (!editor) {
      stop("EDITOR_NOT_FOUND");
      return;
    }

    if (meaningfulText(editor)) {
      stop("EDITOR_HAS_TEXT");
      return;
    }

    const socketId = resolveSocketId();

    if (!socketId) {
      postEvent("pulse-error", "SOCKET_ID_NOT_FOUND");
      schedulePulse(1500);
      return;
    }

    const result = await sendTypingRequest(state.chatId, socketId);

    if (!state.active) {
      return;
    }

    if (!result.ok) {
      postEvent(
        "pulse-error",
        result.reason || `TYPING_HTTP_${result.status || 0}`,
        { status: result.status || 0 }
      );
      schedulePulse(nextPulseDelay());
      return;
    }

    state.pulseCount += 1;
    postEvent("pulse", "NATIVE_TYPING_REQUEST", {
      status: result.status,
      socketIdFound: true
    });

    schedulePulse(nextPulseDelay());
  }

  function scheduleMonitor() {
    clearTimer("monitorTimer");

    const monitor = () => {
      if (!state.active) {
        return;
      }

      if (currentChatId() !== state.chatId) {
        stop("CHAT_CHANGED");
        return;
      }

      const editor = findEditor();

      if (!editor) {
        stop("EDITOR_NOT_FOUND");
        return;
      }

      if (meaningfulText(editor)) {
        stop("EDITOR_HAS_TEXT");
        return;
      }

      state.monitorTimer = window.setTimeout(monitor, 300);
    };

    state.monitorTimer = window.setTimeout(monitor, 300);
  }

  function start(durationMs) {
    const chatId = currentChatId();

    if (!chatId) {
      return {
        ok: false,
        active: false,
        reason: "NOT_CHAT_PAGE"
      };
    }

    const editor = findEditor();

    if (!editor) {
      return {
        ok: false,
        active: false,
        reason: "EDITOR_NOT_FOUND"
      };
    }

    if (meaningfulText(editor)) {
      return {
        ok: false,
        active: false,
        reason: "EDITOR_NOT_EMPTY"
      };
    }

    const socketId = resolveSocketId();

    if (!socketId) {
      return {
        ok: false,
        active: false,
        reason: "SOCKET_ID_NOT_FOUND"
      };
    }

    if (state.active) {
      stop("RESTART");
    }

    const normalizedDuration = Math.min(
      MAX_DURATION_MS,
      Math.max(15000, Number(durationMs) || DEFAULT_DURATION_MS)
    );

    state.active = true;
    state.chatId = chatId;
    state.startedAt = Date.now();
    state.expiresAt = state.startedAt + normalizedDuration;
    state.pulseCount = 0;
    state.lastSocketId = socketId;

    state.expiryTimer = window.setTimeout(() => {
      stop("TIMEOUT");
    }, normalizedDuration);

    scheduleMonitor();
    schedulePulse(150);
    postEvent("started", "USER_STARTED", {
      socketIdFound: true
    });

    return {
      ok: true,
      active: true,
      chatId,
      startedAt: state.startedAt,
      expiresAt: state.expiresAt,
      pulseCount: state.pulseCount,
      socketIdFound: true
    };
  }

  function status() {
    return {
      ok: true,
      active: state.active,
      chatId: state.chatId,
      startedAt: state.startedAt || null,
      expiresAt: state.expiresAt || null,
      pulseCount: state.pulseCount,
      socketIdFound: Boolean(resolveSocketId())
    };
  }

  document.addEventListener("keydown", (event) => {
    if (
      state.active
      && event.isTrusted
      && isEditorTarget(event.target)
    ) {
      stop("USER_INPUT");
    }
  }, true);

  document.addEventListener("paste", (event) => {
    if (
      state.active
      && event.isTrusted
      && isEditorTarget(event.target)
    ) {
      stop("USER_PASTE");
    }
  }, true);

  document.addEventListener("drop", (event) => {
    if (
      state.active
      && event.isTrusted
      && isEditorTarget(event.target)
    ) {
      stop("USER_DROP");
    }
  }, true);

  document.addEventListener("click", (event) => {
    if (
      state.active
      && event.isTrusted
      && event.target instanceof Element
      && event.target.closest(".dialog__input-send-button")
    ) {
      stop("MESSAGE_SENT");
    }
  }, true);

  window.addEventListener("message", (event) => {
    if (
      event.source !== window
      || event.origin !== window.location.origin
      || !event.data
      || event.data.source !== REQUEST_SOURCE
      || event.data.type !== COMMAND_TYPE
      || typeof event.data.requestId !== "string"
    ) {
      return;
    }

    const requestId = event.data.requestId;
    const action = String(event.data.action || "").toUpperCase();

    if (action === "START") {
      respond(requestId, start(event.data.durationMs));
      return;
    }

    if (action === "STOP") {
      respond(requestId, stop("USER_STOPPED"));
      return;
    }

    if (action === "STATUS") {
      respond(requestId, status());
      return;
    }

    respond(requestId, {
      ok: false,
      active: state.active,
      reason: "UNKNOWN_ACTION"
    });
  });
})();
