(function initChatFilesStorage(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const chatStorage = root.chatStorage = root.chatStorage || {};

  function storageKey(chatId) {
    return `pravoved.chat.${chatId}.downloadedUploads`;
  }

  function emptyState() {
    return {
      ids: [],
      historyAfter: null,
      updatedAt: null
    };
  }

  function getState(chatId) {
    if (!chatId) {
      return Promise.resolve(emptyState());
    }

    const key = storageKey(chatId);

    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        const error = chrome.runtime.lastError;
        if (error) {
          resolve(emptyState());
          return;
        }

        const value = result && result[key];
        const ids = value && Array.isArray(value.ids)
          ? value.ids.map(String)
          : [];
        const historyAfter = value && typeof value.historyAfter === "string"
          ? value.historyAfter
          : null;
        const updatedAt = value && typeof value.updatedAt === "string"
          ? value.updatedAt
          : null;

        resolve({
          ids,
          historyAfter,
          updatedAt
        });
      });
    });
  }

  async function getDownloadedIds(chatId) {
    const state = await getState(chatId);
    return state.ids;
  }

  async function getHistoryAfter(chatId) {
    const state = await getState(chatId);
    return state.historyAfter;
  }

  async function markDownloaded(chatId, ids) {
    if (!chatId || !Array.isArray(ids) || ids.length === 0) {
      return { ok: false, ids: [] };
    }

    const key = storageKey(chatId);
    const state = await getState(chatId);
    const merged = [...new Set([...state.ids, ...ids.map(String)])];

    return new Promise((resolve) => {
      chrome.storage.local.set({
        [key]: {
          ids: merged,
          historyAfter: state.historyAfter,
          updatedAt: new Date().toISOString()
        }
      }, () => {
        const error = chrome.runtime.lastError;
        resolve({
          ok: !error,
          ids: merged,
          historyAfter: state.historyAfter,
          error: error ? error.message : null
        });
      });
    });
  }

  function clearDownloaded(chatId) {
    if (!chatId) {
      return Promise.resolve({ ok: false });
    }

    const key = storageKey(chatId);
    const historyAfter = new Date().toISOString();

    return new Promise((resolve) => {
      chrome.storage.local.set({
        [key]: {
          ids: [],
          historyAfter,
          updatedAt: historyAfter
        }
      }, () => {
        const error = chrome.runtime.lastError;
        resolve({
          ok: !error,
          ids: [],
          historyAfter,
          error: error ? error.message : null
        });
      });
    });
  }

  chatStorage.getState = getState;
  chatStorage.getDownloadedIds = getDownloadedIds;
  chatStorage.getHistoryAfter = getHistoryAfter;
  chatStorage.markDownloaded = markDownloaded;
  chatStorage.clearDownloaded = clearDownloaded;
})(globalThis);
