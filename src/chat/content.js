(function initChatNewAttachments(global) {
  const root = global.PravovedExt = global.PravovedExt || {};

  if (!root.chat || !root.chatStorage || !root.chatUi) {
    return;
  }

  let activeChatId = null;
  let downloadedIds = new Set();
  let historyCheckedIds = new Set();
  let lastSignature = null;
  let refreshInFlight = false;
  let lifecycleStarted = false;

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      if (!global.chrome || !global.chrome.runtime || !global.chrome.runtime.sendMessage) {
        resolve({
          ok: false,
          reason: "RUNTIME_UNAVAILABLE"
        });
        return;
      }

      global.chrome.runtime.sendMessage(message, (response) => {
        const error = global.chrome.runtime.lastError;

        if (error) {
          resolve({
            ok: false,
            reason: error.message || "RUNTIME_MESSAGE_FAILED"
          });
          return;
        }

        resolve(response || {
          ok: false,
          reason: "EMPTY_RUNTIME_RESPONSE"
        });
      });
    });
  }

  async function findCompletedUploads(uploadIds) {
    if (!Array.isArray(uploadIds) || uploadIds.length === 0) {
      return [];
    }

    const result = await sendRuntimeMessage({
      type: "PRAVOVED_FIND_COMPLETED_UPLOADS",
      uploadIds
    });

    return result && Array.isArray(result.completedIds)
      ? result.completedIds.map(String)
      : [];
  }

  function zipTimestamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");

    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate())
    ].join("")
      + "-"
      + [
        pad(now.getHours()),
        pad(now.getMinutes())
      ].join("");
  }

  async function downloadNewBatch(chatId, attachments) {
    const items = Array.isArray(attachments) ? attachments : [];

    if (items.length === 0) {
      return {
        ok: false,
        mode: "none",
        reason: "NO_NEW_ATTACHMENTS"
      };
    }

    if (items.length === 1) {
      const attachment = items[0];
      const result = await sendRuntimeMessage({
        type: "PRAVOVED_DOWNLOAD_ATTACHMENTS",
        folder: `chat-${chatId}`,
        waitForCompletion: true,
        attachments: [{
          name: attachment.name || null,
          url: attachment.url || null,
          type: attachment.type || null
        }]
      });

      return {
        ...result,
        mode: "single",
        requested: 1
      };
    }

    if (!root.downloads || typeof root.downloads.downloadZip !== "function") {
      return {
        ok: false,
        mode: "zip",
        requested: items.length,
        reason: "ZIP_MODULE_UNAVAILABLE"
      };
    }

    const filename = `Pravoved-chat-${chatId}-${zipTimestamp()}.zip`;

    try {
      return await root.downloads.downloadZip(
        items,
        chatId,
        document,
        { filename }
      );
    } catch (error) {
      return {
        ok: false,
        mode: "zip",
        requested: items.length,
        reason: error && error.message ? error.message : "ZIP_DOWNLOAD_FAILED"
      };
    }
  }

  async function loadChatState(chatId) {
    const ids = await root.chatStorage.getDownloadedIds(chatId);

    activeChatId = chatId;
    downloadedIds = new Set(ids.map(String));
    historyCheckedIds = new Set();
    lastSignature = null;
  }

  async function reconcileDownloadHistory(attachments) {
    const candidates = attachments
      .map((item) => String(item.id))
      .filter((id) => !downloadedIds.has(id) && !historyCheckedIds.has(id));

    if (candidates.length === 0) {
      return;
    }

    candidates.forEach((id) => historyCheckedIds.add(id));

    const completedIds = await findCompletedUploads(candidates);
    if (completedIds.length === 0) {
      return;
    }

    completedIds.forEach((id) => downloadedIds.add(String(id)));
    await root.chatStorage.markDownloaded(activeChatId, completedIds);
  }

  function panelSignature(chatId, attachments, newAttachments) {
    const targetExists = Boolean(document.querySelector(".dialog__input-buttons-right"));
    const hostExists = Boolean(document.getElementById("pravoved-ext-chat-files"));

    return JSON.stringify({
      chatId,
      attachmentIds: attachments.map((item) => item.id),
      newIds: newAttachments.map((item) => item.id),
      downloadedCount: downloadedIds.size,
      targetExists,
      hostExists
    });
  }

  async function refresh() {
    if (refreshInFlight) {
      return;
    }

    refreshInFlight = true;

    try {
      const chatId = root.chat.extractChatId(global.location);

      if (!chatId) {
        activeChatId = null;
        downloadedIds = new Set();
        historyCheckedIds = new Set();
        lastSignature = null;
        root.chatUi.remove(document);
        return;
      }

      if (activeChatId !== chatId) {
        await loadChatState(chatId);
      }

      const attachments = root.chat.extractClientAttachments(document);
      await reconcileDownloadHistory(attachments);

      const newAttachments = attachments.filter((item) => (
        !downloadedIds.has(String(item.id))
      ));

      const signature = panelSignature(chatId, attachments, newAttachments);
      if (signature === lastSignature) {
        return;
      }

      lastSignature = signature;

      root.chatUi.mount({
        document,
        chatId,
        newAttachments,
        downloadedCount: downloadedIds.size,
        onDownload: (batch) => downloadNewBatch(chatId, batch),
        onDownloaded: async (batch) => {
          const ids = batch.map((item) => String(item.id));
          const result = await root.chatStorage.markDownloaded(chatId, ids);

          if (result && result.ok) {
            ids.forEach((id) => downloadedIds.add(id));
          }

          lastSignature = null;
          await refresh();
        },
        onReset: async () => {
          const result = await root.chatStorage.clearDownloaded(chatId);

          if (result && result.ok) {
            downloadedIds = new Set();
            historyCheckedIds = new Set();
            lastSignature = null;
            await refresh();
          }

          return result;
        }
      });
    } finally {
      refreshInFlight = false;
    }
  }

  function startLifecycle() {
    if (lifecycleStarted) {
      return;
    }

    lifecycleStarted = true;

    refresh().catch((error) => {
      console.warn("Pravoved chat files initialization failed", error);
    });

    global.setInterval(() => {
      refresh().catch((error) => {
        console.warn("Pravoved chat files refresh failed", error);
      });
    }, 1000);
  }

  root.chatDownloadNewBatch = downloadNewBatch;
  root.refreshChatFiles = refresh;

  startLifecycle();
})(globalThis);
