(function initChatFilesPanel(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const chatUi = root.chatUi = root.chatUi || {};

  const HOST_ID = "pravoved-ext-chat-files";

  function remove(documentObject) {
    const documentRef = documentObject || document;
    const existing = documentRef.getElementById(HOST_ID);
    if (existing) {
      existing.remove();
    }
  }

  function mount(options) {
    const config = options || {};
    const documentObject = config.document || document;
    const target = documentObject.querySelector(".dialog__input-buttons-right");

    if (!target) {
      remove(documentObject);
      return null;
    }

    remove(documentObject);

    const host = documentObject.createElement("span");
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: "open" });
    const newAttachments = Array.isArray(config.newAttachments)
      ? config.newAttachments
      : [];
    const downloadedCount = Number.isFinite(config.downloadedCount)
      ? config.downloadedCount
      : 0;

    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          display: inline-flex;
          align-items: center;
          margin-left: 10px;
          font: 12px/1.3 Arial, sans-serif;
        }
        .wrap {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .meta {
          color: #7a8496;
          white-space: nowrap;
        }
        .reset {
          border: 0;
          padding: 0;
          background: transparent;
          color: #8a94a6;
          cursor: pointer;
          font: 11px/1.2 Arial, sans-serif;
          text-decoration: underline;
        }
        .reset:hover:not(:disabled) {
          background: transparent;
          color: #526079;
        }
        button {
          border: 1px solid #2f6feb;
          border-radius: 5px;
          padding: 6px 10px;
          background: #2f6feb;
          color: #fff;
          cursor: pointer;
          font: 600 12px/1.2 Arial, sans-serif;
          white-space: nowrap;
        }
        button:hover:not(:disabled) {
          background: #245fc8;
        }
        button:disabled {
          cursor: wait;
          opacity: .65;
        }
        button.empty {
          border-color: #cfd6e4;
          background: #f6f8fb;
          color: #7a8496;
          cursor: default;
        }
        .message {
          color: #526079;
          white-space: nowrap;
          max-width: 260px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      </style>
      <span class="wrap">
        <span class="meta" data-role="meta"></span>
        <button class="reset" type="button" data-role="reset" hidden>сбросить</button>
        <button type="button" data-role="download"></button>
        <span class="message" data-role="message" aria-live="polite"></span>
      </span>
    `;

    target.appendChild(host);

    const meta = shadow.querySelector('[data-role="meta"]');
    const button = shadow.querySelector('[data-role="download"]');
    const resetButton = shadow.querySelector('[data-role="reset"]');
    const message = shadow.querySelector('[data-role="message"]');

    meta.textContent = downloadedCount > 0
      ? `скачано: ${downloadedCount}`
      : "";

    if (downloadedCount > 0 && typeof config.onReset === "function") {
      resetButton.hidden = false;
      resetButton.title = "Сбросить локальные отметки скачанных файлов этого чата";
      resetButton.addEventListener("click", async () => {
        resetButton.disabled = true;
        message.textContent = "сбрасываю…";

        try {
          const result = await config.onReset();
          message.textContent = result && result.ok
            ? "история сброшена"
            : "не удалось сбросить";
        } catch (_) {
          message.textContent = "не удалось сбросить";
        } finally {
          resetButton.disabled = false;
        }
      });
    }

    if (newAttachments.length === 0) {
      button.classList.add("empty");
      button.disabled = true;
      button.textContent = "Новых файлов нет";
      return host;
    }

    button.textContent = newAttachments.length === 1
      ? "Скачать новый файл"
      : `Скачать новые ZIP (${newAttachments.length})`;

    button.addEventListener("click", async () => {
      if (typeof config.onDownload !== "function") {
        return;
      }

      button.disabled = true;
      message.textContent = newAttachments.length === 1
        ? "скачиваю…"
        : "собираю ZIP…";

      try {
        const result = await config.onDownload(
          newAttachments,
          (progress) => {
            const completed = progress && Number.isFinite(progress.completed)
              ? progress.completed
              : 0;
            const total = progress && Number.isFinite(progress.total)
              ? progress.total
              : newAttachments.length;

            message.textContent = `ZIP ${completed}/${total}…`;
          }
        );

        if (result && result.ok) {
          message.textContent = result.mode === "zip"
            ? `готово: ${result.filename || "ZIP"}`
            : (result.completed ? "файл скачан" : "загрузка запущена");

          if (typeof config.onDownloaded === "function") {
            await config.onDownloaded(newAttachments, result);
          }
        } else {
          const reason = result && result.reason ? `: ${result.reason}` : "";
          message.textContent = `ошибка${reason}`;
        }
      } catch (error) {
        message.textContent = error && error.message
          ? `ошибка: ${error.message}`
          : "ошибка";
      } finally {
        button.disabled = false;
      }
    });

    return host;
  }

  chatUi.mount = mount;
  chatUi.remove = remove;
})(globalThis);
