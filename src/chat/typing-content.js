(function initChatTypingLifecycle(global) {
  const root = global.PravovedExt = global.PravovedExt || {};

  if (!root.chatTyping || !root.typingUi) {
    return;
  }

  const CHAT_PATH_RE = /\/private\/chat\/(\d+)(?:\/|$)/;
  const DEFAULT_DURATION_MS = 120000;

  let activeChatId = null;
  let ui = null;
  let lastHostPresent = false;
  let lifecycleStarted = false;

  function currentChatId() {
    const match = global.location.pathname.match(CHAT_PATH_RE);
    return match ? match[1] : null;
  }

  function ensureUi() {
    const chatId = currentChatId();

    if (!chatId) {
      if (root.typingUi && typeof root.typingUi.remove === "function") {
        root.typingUi.remove(document);
      }

      ui = null;
      activeChatId = null;
      return null;
    }

    if (activeChatId && activeChatId !== chatId) {
      root.chatTyping.stop().catch(() => {});
    }

    activeChatId = chatId;

    const mounted = root.typingUi.mount({
      document,
      onToggle: async ({ active }) => {
        if (active) {
          return root.chatTyping.stop();
        }

        return root.chatTyping.start(DEFAULT_DURATION_MS);
      }
    });

    if (mounted) {
      ui = mounted;
    }

    return ui;
  }

  async function syncStatus() {
    const control = ensureUi();

    if (!control) {
      return;
    }

    const result = await root.chatTyping.status();

    control.setState({
      active: Boolean(result && result.active),
      expiresAt: result && result.expiresAt ? result.expiresAt : null,
      pulseCount: result && Number.isFinite(result.pulseCount)
        ? result.pulseCount
        : 0,
      reason: result && result.ok === false ? result.reason : null
    });
  }

  root.chatTyping.subscribe((event) => {
    const control = ensureUi();

    if (!control || !event) {
      return;
    }

    if (
      event.chatId
      && activeChatId
      && String(event.chatId) !== String(activeChatId)
    ) {
      return;
    }

    const isStopped = event.kind === "stopped";

    control.setState({
      active: isStopped ? false : Boolean(event.active),
      expiresAt: event.expiresAt || null,
      pulseCount: Number.isFinite(event.pulseCount)
        ? event.pulseCount
        : 0,
      reason: isStopped
        ? event.reason || null
        : event.ok === false
          ? event.reason || null
          : null
    });
  });

  function startLifecycle() {
    if (lifecycleStarted) {
      return;
    }

    lifecycleStarted = true;

    syncStatus().catch((error) => {
      console.warn("Pravoved typing status initialization failed", error);
    });

    global.setInterval(() => {
      const chatId = currentChatId();
      const toolbarHost = document.getElementById("pravoved-ext-chat-files");
      const toolbarSlot = toolbarHost && toolbarHost.shadowRoot
        ? toolbarHost.shadowRoot.querySelector('[data-role="typing-slot"]')
        : null;
      const hostPresent = Boolean(
        (toolbarSlot && toolbarSlot.querySelector("#pravoved-ext-chat-typing"))
        || document.getElementById("pravoved-ext-chat-typing")
      );

      if (
        chatId !== activeChatId
        || hostPresent !== lastHostPresent
        || (chatId && !hostPresent)
      ) {
        lastHostPresent = hostPresent;
        syncStatus().catch((error) => {
          console.warn("Pravoved typing control refresh failed", error);
        });
        return;
      }

      ensureUi();
    }, 1000);
  }

  root.refreshTypingControl = syncStatus;

  startLifecycle();
})(globalThis);
