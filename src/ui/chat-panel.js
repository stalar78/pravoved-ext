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
          margin-left: 6px;
          font: 12px/1.3 Arial, sans-serif;
        }
        .wrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
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
          height: 32px;
          border: 1px solid #c9d2df;
          border-radius: 8px;
          padding: 0 12px;
          background: #fff;
          color: #4f5f77;
          cursor: pointer;
          font: 600 12px/1 Arial, sans-serif;
          white-space: nowrap;
          box-sizing: border-box;
          transition: border-color .12s ease, background .12s ease, color .12s ease;
        }
        button:hover:not(:disabled) {
          border-color: #8ea8cf;
          background: #f6f9ff;
          color: #2f5f9f;
        }
        button.copy {
          min-width: 116px;
        }
        button.download {
          border-color: #8eb2f4;
          background: #f4f8ff;
          color: #2f6feb;
        }
        button.download:hover:not(:disabled) {
          border-color: #2f6feb;
          background: #eaf2ff;
          color: #245fc8;
        }
        button:disabled {
          cursor: wait;
          opacity: .65;
        }
        button[hidden] {
          display: none !important;
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
        <button class="copy" type="button" data-role="copy" title="Скопировать всю переписку">Копировать чат</button>
        <button class="download" type="button" data-role="download"></button>
        <span class="message" data-role="message" aria-live="polite"></span>
      </span>
    `;

    target.appendChild(host);

    const meta = shadow.querySelector('[data-role="meta"]');
    const copyButton = shadow.querySelector('[data-role="copy"]');
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

    copyButton.addEventListener("click", async () => {
      if (typeof config.onCopyChat !== "function") {
        return;
      }

      copyButton.disabled = true;
      message.textContent = "собираю чат…";

      try {
        const result = await config.onCopyChat((progress) => {
          if (!progress) {
            return;
          }

          if (progress.phase === "loading") {
            const count = Number.isFinite(progress.messageCount)
              ? progress.messageCount
              : 0;
            message.textContent = count > 0
              ? `догружаю историю: ${count}`
              : "догружаю историю…";
          } else if (progress.phase === "formatting") {
            message.textContent = "готовлю текст…";
          }
        });

        if (result && result.ok) {
          message.textContent = `чат скопирован: ${result.messageCount || 0} сообщений`;
        } else {
          const reason = result && result.reason ? `: ${result.reason}` : "";
          message.textContent = `не удалось скопировать чат${reason}`;
        }
      } catch (error) {
        const reason = error && error.message ? `: ${error.message}` : "";
        message.textContent = `не удалось скопировать чат${reason}`;
      } finally {
        copyButton.disabled = false;
      }
    });

    if (newAttachments.length === 0) {
      button.hidden = true;
      return host;
    }

    button.hidden = false;
    button.textContent = newAttachments.length === 1
      ? "Скачать файл"
      : `Скачать (${newAttachments.length})`;
    button.title = newAttachments.length === 1
      ? "Скачать новый файл клиента"
      : `Скачать ${newAttachments.length} новых файлов одним ZIP`;

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
