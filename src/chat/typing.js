(function initChatTypingBridge(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const chatTyping = root.chatTyping = root.chatTyping || {};

  const REQUEST_SOURCE = "pravoved-ext-isolated";
  const RESPONSE_SOURCE = "pravoved-ext-page";
  const COMMAND_TYPE = "PRAVOVED_EXT_TYPING_COMMAND";
  const RESPONSE_TYPE = "PRAVOVED_EXT_TYPING_RESPONSE";
  const EVENT_TYPE = "PRAVOVED_EXT_TYPING_EVENT";
  const pending = new Map();
  const listeners = new Set();

  function createRequestId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function notify(payload) {
    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.warn("Pravoved typing listener failed", error);
      }
    });
  }

  function send(action, options) {
    const config = options || {};
    const requestId = createRequestId();

    return new Promise((resolve) => {
      const timeoutId = global.setTimeout(() => {
        pending.delete(requestId);
        resolve({
          ok: false,
          active: false,
          reason: "TYPING_BRIDGE_TIMEOUT"
        });
      }, 5000);

      pending.set(requestId, {
        resolve,
        timeoutId
      });

      global.postMessage({
        source: REQUEST_SOURCE,
        type: COMMAND_TYPE,
        requestId,
        action,
        durationMs: config.durationMs
      }, global.location.origin);
    });
  }

  global.addEventListener("message", (event) => {
    if (
      event.source !== global
      || event.origin !== global.location.origin
      || !event.data
      || event.data.source !== RESPONSE_SOURCE
    ) {
      return;
    }

    if (event.data.type === RESPONSE_TYPE) {
      const item = pending.get(event.data.requestId);

      if (!item) {
        return;
      }

      global.clearTimeout(item.timeoutId);
      pending.delete(event.data.requestId);
      item.resolve(event.data);
      notify(event.data);
      return;
    }

    if (event.data.type === EVENT_TYPE) {
      notify(event.data);
    }
  });

  chatTyping.start = (durationMs) => send("START", { durationMs });
  chatTyping.stop = () => send("STOP");
  chatTyping.status = () => send("STATUS");
  chatTyping.subscribe = (listener) => {
    if (typeof listener !== "function") {
      return () => {};
    }

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };
})(globalThis);
