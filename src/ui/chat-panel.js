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
          position: relative;
          margin-left: 8px;
          font: 12px/1.3 Arial, sans-serif;
        }
        .wrap {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .actions {
          display: inline-flex;
          align-items: stretch;
          gap: 0;
          border-radius: 8px;
          box-shadow: 0 0 0 1px rgba(78, 96, 122, .08);
        }
        .typing-slot {
          display: inline-flex;
          align-items: stretch;
          margin: 0;
          padding: 0;
        }
        .history {
          display: inline-flex;
          align-items: center;
          height: 28px;
          border: 1px solid #dce2eb;
          border-radius: 999px;
          padding: 0 4px 0 9px;
          background: #f8fafc;
          color: #7b8799;
          box-sizing: border-box;
          white-space: nowrap;
        }
        .history[hidden] {
          display: none !important;
        }
        .meta {
          font: 600 11px/1 Arial, sans-serif;
          white-space: nowrap;
        }
        .reset {
          width: 22px;
          height: 22px;
          min-width: 22px;
          margin-left: 4px;
          border: 0;
          border-radius: 50%;
          padding: 0;
          background: transparent;
          color: #8a96a8;
          cursor: pointer;
          font: 700 14px/1 Arial, sans-serif;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .reset:hover:not(:disabled) {
          background: #edf1f6;
          color: #526079;
        }
        .reset:disabled {
          cursor: wait;
          opacity: .55;
        }
        button {
          height: 34px;
          min-width: 94px;
          border: 1px solid #cbd4e1;
          border-radius: 0;
          margin-left: -1px;
          padding: 0 14px;
          background: #fff;
          color: #53627a;
          cursor: pointer;
          font: 600 12px/1 Arial, sans-serif;
          white-space: nowrap;
          box-sizing: border-box;
          transition: background .12s ease, color .12s ease, border-color .12s ease;
        }
        button.copy {
          min-width: 108px;
        }
        button.download {
          min-width: 86px;
          border-radius: 0 8px 8px 0;
        }
        button:hover:not(:disabled) {
          position: relative;
          z-index: 1;
          border-color: #8fa7c9;
          background: #f5f8fd;
          color: #2f5f9f;
        }
        button.download:not(:disabled) {
          background: #f3f7ff;
          color: #2f6feb;
          border-color: #9ab7e8;
        }
        button.download:not(:disabled):hover {
          background: #eaf2ff;
          border-color: #2f6feb;
          color: #245fc8;
        }
        button:disabled {
          cursor: default;
          background: #f7f8fa;
          color: #a0a8b5;
          border-color: #d9dee7;
          opacity: 1;
        }
        .message {
          position: absolute;
          right: 0;
          bottom: 42px;
          display: none;
          max-width: 340px;
          padding: 5px 8px;
          border: 1px solid #dce2eb;
          border-radius: 6px;
          background: rgba(255, 255, 255, .96);
          box-shadow: 0 3px 10px rgba(34, 48, 73, .08);
          color: #68768d;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          pointer-events: none;
        }
        .message:not(:empty) {
          display: block;
        }
      </style>
      <span class="wrap">
        <span class="actions" data-role="actions">
          <span class="typing-slot" data-role="typing-slot"></span>
          <button class="copy" type="button" data-role="copy" title="Скопировать всю переписку">Копировать</button>
          <button class="download" type="button" data-role="download" title="Новых файлов нет">Файлы</button>
        </span>
        <span class="history" data-role="history" hidden>
          <span class="meta" data-role="meta"></span>
          <button class="reset" type="button" data-role="reset" title="Сбросить отметки скачанных файлов" aria-label="Сбросить отметки скачанных файлов">↺</button>
        </span>
        <span class="message" data-role="message" aria-live="polite"></span>
      </span>
    `;

    target.appendChild(host);

    const history = shadow.querySelector('[data-role="history"]');
    const meta = shadow.querySelector('[data-role="meta"]');
    const copyButton = shadow.querySelector('[data-role="copy"]');
    const button = shadow.querySelector('[data-role="download"]');
    const resetButton = shadow.querySelector('[data-role="reset"]');
    const message = shadow.querySelector('[data-role="message"]');

    if (downloadedCount > 0) {
      history.hidden = false;
      meta.textContent = `✓ ${downloadedCount}`;
      history.title = `Отмечено скачанными: ${downloadedCount}`;
    } else {
      history.hidden = true;
      meta.textContent = "";
    }

    if (downloadedCount > 0 && typeof config.onReset === "function") {
      resetButton.title = "Сбросить отметки скачанных файлов этого чата";
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
      button.disabled = true;
      button.textContent = "Файлы";
      button.title = downloadedCount > 0
        ? `Новых файлов нет · ранее скачано: ${downloadedCount}`
        : "Новых файлов нет";

      if (root.refreshTypingControl) {
        global.queueMicrotask(() => {
          root.refreshTypingControl().catch(() => {});
        });
      }

      return host;
    }

    button.disabled = false;
    button.textContent = `Файлы (${newAttachments.length})`;
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
          if (result.mode === "zip") {
            const packed = Number(result.packed) || 0;
            const failed = Number(result.failed) || 0;

            message.textContent = failed > 0
              ? `ZIP: ${packed}/${result.requested || newAttachments.length}; пропущено: ${failed}`
              : `ZIP готов: ${packed} файлов`;
          } else {
            message.textContent = result.completed
              ? "файл скачан"
              : "загрузка запущена";
          }

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

    if (root.refreshTypingControl) {
      global.queueMicrotask(() => {
        root.refreshTypingControl().catch(() => {});
      });
    }

    return host;
  }

  chatUi.mount = mount;
  chatUi.remove = remove;
})(globalThis);
