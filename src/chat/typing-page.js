(function initPravovedTypingPulsePage() {
  const REQUEST_SOURCE = "pravoved-ext-isolated";
  const RESPONSE_SOURCE = "pravoved-ext-page";
  const COMMAND_TYPE = "PRAVOVED_EXT_TYPING_COMMAND";
  const RESPONSE_TYPE = "PRAVOVED_EXT_TYPING_RESPONSE";
  const EVENT_TYPE = "PRAVOVED_EXT_TYPING_EVENT";
  const CHAT_PATH_RE = /\/private\/chat\/(\d+)(?:\/|$)/;
  const MARKER = "\u200B";
  const DEFAULT_DURATION_MS = 120000;
  const MAX_DURATION_MS = 5 * 60 * 1000;
  const MIN_PULSE_DELAY_MS = 2400;
  const MAX_PULSE_DELAY_MS = 4200;
  const MARKER_HOLD_MS = 180;

  const state = {
    active: false,
    chatId: null,
    startedAt: 0,
    expiresAt: 0,
    pulseCount: 0,
    pulseTimer: null,
    expiryTimer: null,
    monitorTimer: null,
    mutating: false
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

  function postEvent(kind, reason) {
    window.postMessage({
      source: RESPONSE_SOURCE,
      type: EVENT_TYPE,
      kind,
      reason: reason || null,
      active: state.active,
      chatId: state.chatId,
      startedAt: state.startedAt || null,
      expiresAt: state.expiresAt || null,
      pulseCount: state.pulseCount
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

    const editor = findEditor();
    if (editor) {
      removeMarker(editor);
    }

    state.active = false;
    state.chatId = null;
    state.startedAt = 0;
    state.expiresAt = 0;
    state.pulseCount = 0;
    state.mutating = false;

    if (wasActive) {
      postEvent("stopped", reason || "STOPPED");
    }

    return {
      ok: true,
      active: false,
      reason: reason || "STOPPED"
    };
  }

  function dispatchKeyboard(editor, type) {
    const event = new KeyboardEvent(type, {
      key: ".",
      code: "Period",
      location: 0,
      bubbles: true,
      cancelable: true,
      composed: true
    });

    editor.dispatchEvent(event);
  }

  function placeCaretAtEnd(editor) {
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch (_) {
      return false;
    }
  }

  function findMarkerTextNode(editor) {
    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT
    );

    let node;
    while ((node = walker.nextNode())) {
      const index = String(node.nodeValue || "").indexOf(MARKER);
      if (index >= 0) {
        return { node, index };
      }
    }

    return null;
  }

  function fallbackTypingSignal(editor) {
    try {
      editor.dispatchEvent(new InputEvent("beforeinput", {
        data: MARKER,
        inputType: "insertText",
        bubbles: true,
        cancelable: true,
        composed: true
      }));

      editor.dispatchEvent(new InputEvent("input", {
        data: MARKER,
        inputType: "insertText",
        bubbles: true,
        composed: true
      }));
    } catch (_) {
      editor.dispatchEvent(new Event("input", {
        bubbles: true,
        composed: true
      }));
    }
  }

  function insertMarker(editor) {
    editor.focus({ preventScroll: true });
    placeCaretAtEnd(editor);
    dispatchKeyboard(editor, "keydown");
    dispatchKeyboard(editor, "keypress");

    state.mutating = true;

    try {
      const inserted = typeof document.execCommand === "function"
        ? document.execCommand("insertText", false, MARKER)
        : false;

      if (!inserted) {
        fallbackTypingSignal(editor);
      }

      return Boolean(inserted);
    } catch (_) {
      fallbackTypingSignal(editor);
      return false;
    } finally {
      state.mutating = false;
    }
  }

  function removeMarker(editor) {
    const marker = findMarkerTextNode(editor);

    if (!marker) {
      dispatchKeyboard(editor, "keyup");
      return;
    }

    state.mutating = true;

    try {
      const selection = window.getSelection();
      const range = document.createRange();

      range.setStart(marker.node, marker.index);
      range.setEnd(marker.node, marker.index + MARKER.length);
      selection.removeAllRanges();
      selection.addRange(range);

      const deleted = typeof document.execCommand === "function"
        ? document.execCommand("delete", false)
        : false;

      if (!deleted && marker.node.nodeValue) {
        marker.node.nodeValue = marker.node.nodeValue.replace(MARKER, "");
        fallbackTypingSignal(editor);
      }
    } catch (_) {
      if (marker.node && marker.node.nodeValue) {
        marker.node.nodeValue = marker.node.nodeValue.replace(MARKER, "");
      }
    } finally {
      state.mutating = false;
      dispatchKeyboard(editor, "keyup");
    }
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

    const markerInserted = insertMarker(editor);

    state.pulseCount += 1;
    postEvent("pulse", markerInserted ? "MARKER" : "EVENT_ONLY");

    await new Promise((resolve) => {
      window.setTimeout(resolve, MARKER_HOLD_MS);
    });

    if (!state.active) {
      return;
    }

    removeMarker(editor);

    if (meaningfulText(editor)) {
      stop("EDITOR_HAS_TEXT");
      return;
    }

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

    state.expiryTimer = window.setTimeout(() => {
      stop("TIMEOUT");
    }, normalizedDuration);

    scheduleMonitor();
    schedulePulse(250);
    postEvent("started", "USER_STARTED");

    return {
      ok: true,
      active: true,
      chatId,
      startedAt: state.startedAt,
      expiresAt: state.expiresAt,
      pulseCount: state.pulseCount
    };
  }

  function status() {
    return {
      ok: true,
      active: state.active,
      chatId: state.chatId,
      startedAt: state.startedAt || null,
      expiresAt: state.expiresAt || null,
      pulseCount: state.pulseCount
    };
  }

  document.addEventListener("keydown", (event) => {
    if (
      state.active
      && !state.mutating
      && event.isTrusted
      && isEditorTarget(event.target)
    ) {
      stop("USER_INPUT");
    }
  }, true);

  document.addEventListener("paste", (event) => {
    if (
      state.active
      && !state.mutating
      && event.isTrusted
      && isEditorTarget(event.target)
    ) {
      stop("USER_PASTE");
    }
  }, true);

  document.addEventListener("drop", (event) => {
    if (
      state.active
      && !state.mutating
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
