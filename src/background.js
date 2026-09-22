(function initAttachmentDownloader() {
  const DOWNLOAD_MESSAGE_TYPE = "PRAVOVED_DOWNLOAD_ATTACHMENTS";
  const HISTORY_MESSAGE_TYPE = "PRAVOVED_FIND_COMPLETED_UPLOADS";

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
      .replace(/[<>:"\/\\|?*\u0000-\u001f]/g, "_")
      .replace(/[. ]+$/g, "")
      .slice(0, 180);

    return cleaned || fallback;
  }

  function sanitizePathSegment(value, fallback) {
    const raw = value === null || value === undefined ? "" : String(value).trim();
    const cleaned = raw
      .replace(/[<>:"\/\\|?*\u0000-\u001f]/g, "_")
      .replace(/[. ]+$/g, "")
      .slice(0, 80);

    return cleaned || fallback;
  }

  function startDownload(attachment, index, targetFolder) {
    return new Promise((resolve) => {
      const fallbackName = `pravoved-attachment-${index + 1}`;
      const filename = sanitizeFilename(attachment && attachment.name, fallbackName);
      const relativePath = `Pravoved/${targetFolder}/${filename}`;

      chrome.downloads.download({
        url: attachment.url,
        filename: relativePath,
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
          path: relativePath,
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

    const folderSource = message && message.folder
      ? message.folder
      : message && message.questionId;
    const targetFolder = sanitizePathSegment(folderSource, "unknown-question");
    const results = [];

    for (let index = 0; index < attachments.length; index += 1) {
      const result = await startDownload(attachments[index], index, targetFolder);
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
      folder: `Pravoved/${targetFolder}`,
      results
    };
  }

  function searchCompletedUpload(uploadId) {
    return new Promise((resolve) => {
      const id = String(uploadId || "").replace(/[^0-9]/g, "");

      if (!id) {
        resolve(false);
        return;
      }

      const urlRegex = `https://pravoved\\.ru/upload/${id}/.*`;

      chrome.downloads.search({
        urlRegex,
        state: "complete",
        limit: 1
      }, (items) => {
        const error = chrome.runtime.lastError;

        if (error) {
          resolve(false);
          return;
        }

        resolve(Array.isArray(items) && items.length > 0);
      });
    });
  }

  async function findCompletedUploads(message) {
    const input = Array.isArray(message && message.uploadIds)
      ? message.uploadIds
      : [];
    const uploadIds = [...new Set(
      input
        .map((value) => String(value || "").replace(/[^0-9]/g, ""))
        .filter(Boolean)
    )];
    const completedIds = [];

    for (const uploadId of uploadIds) {
      if (await searchCompletedUpload(uploadId)) {
        completedIds.push(uploadId);
      }
    }

    return {
      ok: true,
      requested: uploadIds.length,
      completedIds
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== "string") {
      return false;
    }

    if (message.type === DOWNLOAD_MESSAGE_TYPE) {
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
    }

    if (message.type === HISTORY_MESSAGE_TYPE) {
      findCompletedUploads(message)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            ok: false,
            completedIds: [],
            reason: error && error.message ? error.message : "DOWNLOAD_HISTORY_ERROR"
          });
        });

      return true;
    }

    return false;
  });
})();
