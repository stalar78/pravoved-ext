(function initChatAttachmentExtractor(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const chat = root.chat = root.chat || {};

  const CHAT_PATH_RE = /\/private\/chat\/(\d+)(?:\/|$)/;
  const UPLOAD_RE = /\/upload\/(\d+)(?:\/|$)/;

  function extractChatId(locationObject) {
    const pathname = locationObject && typeof locationObject.pathname === "string"
      ? locationObject.pathname
      : "";
    const match = pathname.match(CHAT_PATH_RE);
    return match ? match[1] : null;
  }

  function extractUploadId(rawUrl) {
    if (typeof rawUrl !== "string") {
      return null;
    }

    try {
      const url = new URL(rawUrl, global.location && global.location.origin
        ? global.location.origin
        : "https://pravoved.ru");
      const match = url.pathname.match(UPLOAD_RE);
      return match ? match[1] : null;
    } catch (_) {
      const match = rawUrl.match(UPLOAD_RE);
      return match ? match[1] : null;
    }
  }

  function normalizeUrl(rawUrl) {
    if (!rawUrl) {
      return null;
    }

    try {
      return new URL(
        rawUrl,
        global.location && global.location.origin
          ? global.location.origin
          : "https://pravoved.ru"
      ).href;
    } catch (_) {
      return rawUrl;
    }
  }

  function inferName(link, messageNode, uploadId) {
    const downloadName = link.getAttribute("download");
    if (downloadName && downloadName.trim()) {
      return downloadName.trim();
    }

    const fileItem = link.closest(".files__item") || messageNode;
    const nameText = fileItem && fileItem.querySelector
      ? fileItem.querySelector(".files__name-text")
      : null;
    const extension = fileItem && fileItem.querySelector
      ? fileItem.querySelector(".files__extension")
      : null;

    const base = nameText && nameText.textContent ? nameText.textContent.trim() : "";
    const ext = extension && extension.textContent ? extension.textContent.trim() : "";

    if (base || ext) {
      const normalizedBase = base.endsWith(".") ? base : (base ? `${base}.` : "");
      return `${normalizedBase}${ext}` || null;
    }

    return uploadId ? `pravoved-upload-${uploadId}` : null;
  }

  function inferType(name) {
    if (!name) {
      return null;
    }

    const match = String(name).match(/\.([a-z0-9]{1,10})$/i);
    return match ? match[1].toLowerCase() : null;
  }

  function extractClientAttachments(documentObject) {
    if (!documentObject || !documentObject.querySelectorAll) {
      return [];
    }

    const messageRoot = documentObject.querySelector(".dialog__items-inner");
    if (!messageRoot) {
      return [];
    }

    const messages = [...messageRoot.querySelectorAll(".dialog-message")];
    const attachments = [];
    const seen = new Set();

    messages.forEach((messageNode) => {
      if (messageNode.classList.contains("dialog-message--align-right")) {
        return;
      }

      const links = [
        ...messageNode.querySelectorAll('a.files__link[href*="/upload/"]')
      ];

      links.forEach((link) => {
        const rawUrl = link.getAttribute("href");
        const uploadId = extractUploadId(rawUrl);

        if (!uploadId || seen.has(uploadId)) {
          return;
        }

        const name = inferName(link, messageNode, uploadId);
        const url = normalizeUrl(rawUrl);

        if (!url) {
          return;
        }

        seen.add(uploadId);
        attachments.push({
          id: uploadId,
          name,
          url,
          type: inferType(name)
        });
      });
    });

    return attachments;
  }

  chat.extractChatId = extractChatId;
  chat.extractUploadId = extractUploadId;
  chat.extractClientAttachments = extractClientAttachments;
})(globalThis);
