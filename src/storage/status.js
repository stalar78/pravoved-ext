(function initStatusStorage(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const storage = root.storage = root.storage || {};

  const STATUS_VALUES = Object.freeze(["SKIP", "ANSWER", "LEAD"]);
  const KEY_PREFIX = "pravoved.status.";

  function getStorageArea() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      return null;
    }

    return chrome.storage.local;
  }

  function getKey(questionId) {
    return `${KEY_PREFIX}${String(questionId)}`;
  }

  function isValidStatus(status) {
    return STATUS_VALUES.includes(status);
  }

  async function getStatus(questionId) {
    if (!questionId) {
      return null;
    }

    const area = getStorageArea();
    if (!area) {
      return null;
    }

    const stored = await area.get(getKey(questionId));
    return stored[getKey(questionId)] || null;
  }

  async function setStatus(questionId, status) {
    if (!questionId || !isValidStatus(status)) {
      return {
        ok: false,
        reason: "INVALID_INPUT"
      };
    }

    const area = getStorageArea();
    if (!area) {
      return {
        ok: false,
        reason: "STORAGE_UNAVAILABLE"
      };
    }

    const value = {
      status,
      timestamp: new Date().toISOString()
    };
    await area.set({
      [getKey(questionId)]: value
    });

    return {
      ok: true,
      value
    };
  }

  storage.statusValues = STATUS_VALUES;
  storage.getStatus = getStatus;
  storage.setStatus = setStatus;
  storage.getKey = getKey;
})(globalThis);
