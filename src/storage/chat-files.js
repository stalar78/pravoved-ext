(function initChatFilesStorage(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const chatStorage = root.chatStorage = root.chatStorage || {};

  function storageKey(chatId) {
    return `pravoved.chat.${chatId}.downloadedUploads`;
  }

  function getDownloadedIds(chatId) {
    if (!chatId) {
      return Promise.resolve([]);
    }

    const key = storageKey(chatId);

    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        const error = chrome.runtime.lastError;
        if (error) {
          resolve([]);
          return;
        }

        const value = result && result[key];
        const ids = value && Array.isArray(value.ids) ? value.ids : [];
        resolve(ids.map(String));
      });
    });
  }

  function markDownloaded(chatId, ids) {
    if (!chatId || !Array.isArray(ids) || ids.length === 0) {
      return Promise.resolve({ ok: false, ids: [] });
    }

    const key = storageKey(chatId);

    return getDownloadedIds(chatId).then((currentIds) => {
      const merged = [...new Set([...currentIds, ...ids.map(String)])];

      return new Promise((resolve) => {
        chrome.storage.local.set({
          [key]: {
            ids: merged,
            updatedAt: new Date().toISOString()
          }
        }, () => {
          const error = chrome.runtime.lastError;
          resolve({
            ok: !error,
            ids: merged,
            error: error ? error.message : null
          });
        });
      });
    });
  }

  function clearDownloaded(chatId) {
    if (!chatId) {
      return Promise.resolve({ ok: false });
    }

    const key = storageKey(chatId);

    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => {
        const error = chrome.runtime.lastError;
        resolve({
          ok: !error,
          error: error ? error.message : null
        });
      });
    });
  }

  chatStorage.getDownloadedIds = getDownloadedIds;
  chatStorage.markDownloaded = markDownloaded;
  chatStorage.clearDownloaded = clearDownloaded;
})(globalThis);
