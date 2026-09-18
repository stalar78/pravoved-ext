(function initAttachmentDownloader() {
  const MESSAGE_TYPE = "PRAVOVED_DOWNLOAD_ATTACHMENTS";

  function isAllowedPravovedUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      return false;
    }

    try {
      const url = new URL(rawUrl);
      const hostname = url.hostname.toLowerCase();

      return (url.protocol === "https:" || url.protocol === "http:")
        && (hostname === "pravoved.ru" || hostname.endsWith(".pravoved.ru"));
    } catch (_) {
      return false;
    }
  }

  function sanitizeFilename(value, fallback) {
    const raw = typeof value === "string" ? value.trim() : "";
    const cleaned = raw
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
      .replace(/[. ]+$/g, "")
      .slice(0, 180);

    return cleaned || fallback;
  }

  function startDownload(attachment, index) {
    return new Promise((resolve) => {
      const fallbackName = `pravoved-attachment-${index + 1}`;
      const filename = sanitizeFilename(attachment && attachment.name, fallbackName);

      chrome.downloads.download({
        url: attachment.url,
        filename,
        conflictAction: "uniquify",
        saveAs: false
      }, (downloadId) => {
        const error = chrome.runtime.lastError;

        if (error) {
          resolve({
            ok: false,
            name: filename,
            error: error.message || "DOWNLOAD_FAILED"
          });
          return;
        }

        resolve({
          ok: true,
          name: filename,
          downloadId
        });
      });
    });
  }

  async function downloadAttachments(message) {
    const input = Array.isArray(message && message.attachments)
      ? message.attachments
      : [];

    const attachments = input.filter((item) => (
      item
      && typeof item === "object"
      && isAllowedPravovedUrl(item.url)
    ));

    if (attachments.length === 0) {
      return {
        ok: false,
        requested: input.length,
        started: 0,
        failed: input.length,
        results: [],
        reason: "NO_VALID_ATTACHMENTS"
      };
    }

    const results = [];

    for (let index = 0; index < attachments.length; index += 1) {
      const result = await startDownload(attachments[index], index);
      results.push(result);
    }

    const started = results.filter((item) => item.ok).length;
    const failed = input.length - started;

    return {
      ok: started > 0,
      requested: input.length,
      accepted: attachments.length,
      started,
      failed,
      results
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== MESSAGE_TYPE) {
      return false;
    }

    downloadAttachments(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          started: 0,
          failed: Array.isArray(message.attachments) ? message.attachments.length : 0,
          reason: error && error.message ? error.message : "UNEXPECTED_DOWNLOAD_ERROR"
        });
      });

    return true;
  });
})();
