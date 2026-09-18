(function initPanelUi(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const ui = root.ui = root.ui || {};

  const HOST_ID = "pravoved-ext-panel";

  function createStyles() {
    return `
      :host { all: initial; }
      .panel {
        position: fixed;
        z-index: 2147483647;
        right: 16px;
        bottom: 16px;
        width: 300px;
        color: #172033;
        background: #ffffff;
        border: 1px solid #cfd6e4;
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(15, 23, 42, .18);
        font: 13px/1.4 Arial, sans-serif;
      }
      .header { padding: 10px 12px 6px; font-weight: 700; }
      .case-status { padding: 0 12px 10px; color: #526079; word-break: break-word; }
      .actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; padding: 0 12px 10px; }
      button { border: 1px solid #b8c2d4; border-radius: 6px; padding: 7px 5px; background: #f8fafc; color: #172033; cursor: pointer; font: inherit; }
      button:hover:not(:disabled) { background: #eef2ff; }
      button.primary { grid-column: 1 / -1; background: #2563eb; border-color: #2563eb; color: #fff; }
      button:disabled { cursor: not-allowed; opacity: .55; }
      .message { min-height: 18px; padding: 0 12px 8px; color: #2563eb; }
      details { border-top: 1px solid #e5e7eb; padding: 8px 12px 10px; }
      summary { cursor: pointer; color: #526079; }
      pre { max-height: 180px; overflow: auto; white-space: pre-wrap; word-break: break-word; color: #6b7280; }
    `;
  }

  function mount(options) {
    const config = options || {};
    const documentObject = config.document || document;
    const existing = documentObject.getElementById(HOST_ID);
    if (existing) {
      existing.remove();
    }

    const host = documentObject.createElement("div");
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>${createStyles()}</style>
      <section class="panel" aria-label="Pravoved Case Assistant">
        <div class="header">Pravoved Case Assistant</div>
        <div class="case-status" data-role="case-status">Проверка кейса…</div>
        <div class="actions">
          <button class="primary" data-action="copy">Скопировать для ChatGPT</button>
          <button data-action="SKIP">SKIP</button>
          <button data-action="ANSWER">ANSWER</button>
          <button data-action="LEAD">LEAD</button>
        </div>
        <div class="message" data-role="message" aria-live="polite"></div>
        <details>
          <summary>Диагностика парсера</summary>
          <pre data-role="diagnostics"></pre>
        </details>
      </section>
    `;
    documentObject.documentElement.appendChild(host);

    const caseStatus = shadow.querySelector('[data-role="case-status"]');
    const message = shadow.querySelector('[data-role="message"]');
    const diagnostics = shadow.querySelector('[data-role="diagnostics"]');
    const copyButton = shadow.querySelector('[data-action="copy"]');
    const statusButtons = [...shadow.querySelectorAll("button[data-action]:not([data-action=copy])")];
    const caseData = config.caseData || {};

    const idLabel = caseData.id ? `ID: ${caseData.id}` : "ID: NOT_FOUND";
    caseStatus.textContent = `${idLabel} · статус: ${caseData.status || "не установлен"}`;
    diagnostics.textContent = JSON.stringify(config.diagnostics || [], null, 2);

    if (!caseData.id) {
      statusButtons.forEach((button) => {
        button.disabled = true;
        button.title = "Статус сохраняется только при найденном question_id";
      });
    }

    copyButton.addEventListener("click", async () => {
      const text = config.formatter(caseData);
      try {
        await copyText(text, documentObject);
        message.textContent = "Скопировано";
      } catch (error) {
        message.textContent = "Не удалось скопировать";
        console.warn("Pravoved extension clipboard error", error);
      }
    });

    statusButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const result = await config.onStatus(button.dataset.action);
        if (result && result.ok) {
          caseData.status = result.value.status;
          caseStatus.textContent = `${idLabel} · статус: ${caseData.status}`;
          message.textContent = `Статус ${caseData.status} сохранён`;
        } else {
          message.textContent = "Статус не сохранён: ID вопроса не найден";
        }
      });
    });

    return host;
  }

  async function copyText(text, documentObject) {
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      await global.navigator.clipboard.writeText(text);
      return;
    }

    const textarea = documentObject.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    documentObject.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = documentObject.execCommand("copy");
    textarea.remove();
    if (!copied) {
      throw new Error("Clipboard API is unavailable");
    }
  }

  ui.mount = mount;
})(globalThis);
