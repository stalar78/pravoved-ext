(function initChatTypingUi(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const typingUi = root.typingUi = root.typingUi || {};

  const HOST_ID = "pravoved-ext-chat-typing";

  function formatRemaining(expiresAt) {
    const remaining = Math.max(0, Number(expiresAt || 0) - Date.now());
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");

    return `${minutes}:${seconds}`;
  }

  function reasonLabel(reason) {
    const labels = {
      EDITOR_NOT_EMPTY: "поле не пустое",
      EDITOR_NOT_FOUND: "поле ввода не найдено",
      NOT_CHAT_PAGE: "не страница чата",
      TYPING_BRIDGE_TIMEOUT: "нет связи с редактором",
      USER_INPUT: "остановлено: ручной ввод",
      USER_PASTE: "остановлено: вставлен текст",
      USER_DROP: "остановлено: добавлен текст",
      MESSAGE_SENT: "остановлено: сообщение отправлено",
      CHAT_CHANGED: "остановлено: другой чат",
      TIMEOUT: "имитация завершена",
      USER_STOPPED: "остановлено",
      EDITOR_HAS_TEXT: "остановлено: в поле появился текст",
      SOCKET_ID_NOT_FOUND: "не найдено соединение чата",
      TYPING_REQUEST_NETWORK_ERROR: "ошибка связи с Pravoved",
      TYPING_REQUEST_TIMEOUT: "Pravoved не ответил",
      TYPING_BRIDGE_TIMEOUT: "нет связи с движком"
    };

    return labels[reason] || "";
  }

  function mount(options) {
    const config = options || {};
    const documentObject = config.document || document;
    const target = documentObject.querySelector(".dialog__input-buttons-right");

    if (!target) {
      return null;
    }

    let host = documentObject.getElementById(HOST_ID);

    if (host && host.__pravovedTypingApi) {
      return host.__pravovedTypingApi;
    }

    if (host) {
      host.remove();
    }

    host = documentObject.createElement("span");
    host.id = HOST_ID;

    const shadow = host.attachShadow({ mode: "open" });

    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          display: inline-flex;
          align-items: center;
          margin-left: 8px;
          font: 12px/1.3 Arial, sans-serif;
        }
        .wrap {
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }
        button {
          border: 1px solid #7d8da8;
          border-radius: 5px;
          padding: 6px 10px;
          background: #fff;
          color: #526079;
          cursor: pointer;
          font: 600 12px/1.2 Arial, sans-serif;
          white-space: nowrap;
        }
        button:hover:not(:disabled) {
          border-color: #2f6feb;
          color: #2f6feb;
        }
        button.active {
          border-color: #e09b32;
          background: #fff8ec;
          color: #9a5b00;
        }
        button:disabled {
          cursor: wait;
          opacity: .65;
        }
        .status {
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #7a8496;
          white-space: nowrap;
        }
      </style>
      <span class="wrap">
        <button type="button" data-role="toggle">Имитировать набор</button>
        <span class="status" data-role="status" aria-live="polite"></span>
      </span>
    `;

    target.appendChild(host);

    const button = shadow.querySelector('[data-role="toggle"]');
    const status = shadow.querySelector('[data-role="status"]');

    const state = {
      active: false,
      expiresAt: null,
      busy: false,
      reason: null,
      pulseCount: 0
    };

    let countdownTimer = null;
    let clearStatusTimer = null;

    function clearTimer(name) {
      if (name === "countdown" && countdownTimer) {
        global.clearInterval(countdownTimer);
        countdownTimer = null;
      }

      if (name === "status" && clearStatusTimer) {
        global.clearTimeout(clearStatusTimer);
        clearStatusTimer = null;
      }
    }

    function render() {
      button.disabled = Boolean(state.busy);
      button.classList.toggle("active", Boolean(state.active));

      if (state.active) {
        const remaining = state.expiresAt
          ? formatRemaining(state.expiresAt)
          : "";

        button.textContent = remaining
          ? `● Печатаю ${remaining} · Стоп`
          : "● Печатаю · Стоп";

        button.title = "Нажмите, чтобы остановить имитацию набора";
      } else {
        button.textContent = state.busy
          ? "Запускаю…"
          : "Имитировать набор";
        button.title = "Имитировать набор текста около 2 минут";
      }

      const label = reasonLabel(state.reason);
      status.textContent = label;
    }

    function startCountdown() {
      clearTimer("countdown");

      countdownTimer = global.setInterval(() => {
        if (!state.active) {
          clearTimer("countdown");
          return;
        }

        if (state.expiresAt && Date.now() >= state.expiresAt) {
          state.active = false;
          state.reason = "TIMEOUT";
          clearTimer("countdown");
        }

        render();
      }, 1000);
    }

    function setState(nextState) {
      const next = nextState || {};

      if (typeof next.active === "boolean") {
        state.active = next.active;
      }

      if (next.expiresAt !== undefined) {
        state.expiresAt = next.expiresAt;
      }

      if (typeof next.busy === "boolean") {
        state.busy = next.busy;
      }

      if (next.reason !== undefined) {
        state.reason = next.reason;
      }

      if (Number.isFinite(next.pulseCount)) {
        state.pulseCount = next.pulseCount;
      }

      if (state.active) {
        startCountdown();
      } else {
        clearTimer("countdown");
      }

      render();

      if (!state.active && state.reason) {
        clearTimer("status");
        clearStatusTimer = global.setTimeout(() => {
          state.reason = null;
          render();
        }, 4000);
      }
    }

    button.addEventListener("click", async () => {
      if (state.busy || typeof config.onToggle !== "function") {
        return;
      }

      state.busy = true;
      state.reason = null;
      render();

      try {
        const result = await config.onToggle({
          active: state.active
        });

        setState({
          active: Boolean(result && result.active),
          expiresAt: result && result.expiresAt ? result.expiresAt : null,
          pulseCount: result && Number.isFinite(result.pulseCount)
            ? result.pulseCount
            : state.pulseCount,
          reason: result && result.ok === false
            ? result.reason || "UNKNOWN_ERROR"
            : result && result.active === false
              ? result.reason || null
              : null
        });
      } catch (error) {
        setState({
          active: false,
          expiresAt: null,
          reason: error && error.message
            ? error.message
            : "UNKNOWN_ERROR"
        });
      } finally {
        state.busy = false;
        render();
      }
    });

    const api = {
      setState,
      remove() {
        clearTimer("countdown");
        clearTimer("status");
        host.remove();
      }
    };

    host.__pravovedTypingApi = api;
    render();

    return api;
  }

  typingUi.mount = mount;
})(globalThis);
