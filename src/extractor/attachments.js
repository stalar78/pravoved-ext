(function initAttachmentsExtractor(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const extractor = root.extractor = root.extractor || {};
  const utils = root.utils;

  const FILE_EXT_RE = /\.([a-z0-9]{1,10})(?:$|[?#\s])/i;
  const KNOWN_FILE_EXTENSIONS = new Set([
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "rtf", "odt", "ods", "jpg", "jpeg", "png",
    "webp", "zip", "rar", "7z"
  ]);

  function diagnostic(status, reason) {
    const item = {
      field: "attachments",
      status,
      source: "DOM_FALLBACK"
    };
    if (reason) {
      item.reason = reason;
    }
    return item;
  }

  function fileTypeFrom(value) {
    if (!value) {
      return null;
    }

    const match = String(value).match(FILE_EXT_RE);
    if (!match) {
      return null;
    }

    const ext = match[1].toLowerCase();
    return KNOWN_FILE_EXTENSIONS.has(ext) ? ext : null;
  }

  function filenameFromUrl(url) {
    if (!url) {
      return null;
    }

    try {
      const parsed = new URL(url, global.location && global.location.origin
        ? global.location.origin
        : "https://pravoved.ru");
      const last = parsed.pathname.split("/").filter(Boolean).pop();
      return last ? decodeURIComponent(last) : null;
    } catch (_) {
      return null;
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

  function extractAttachments(documentObject) {
    const rootNode = documentObject && documentObject.querySelector
      ? (
        documentObject.querySelector('main [class^="Question_root__"]')
        || documentObject.querySelector('main [class*=" Question_root__"]')
      )
      : null;

    if (!rootNode) {
      return {
        attachments: [],
        diagnostics: [diagnostic("NOT_FOUND", "Question root was not found")]
      };
    }

    const anchors = [...rootNode.querySelectorAll("a[href]")];
    const attachments = [];
    const seen = new Set();

    anchors.forEach((anchor) => {
      const rawHref = anchor.getAttribute("href");
      const url = normalizeUrl(rawHref);
      const visibleText = utils.normalizeWhitespace(anchor.textContent);
      const title = utils.normalizeWhitespace(anchor.getAttribute("title"));
      const downloadName = utils.normalizeWhitespace(anchor.getAttribute("download"));

      const type = fileTypeFrom(rawHref)
        || fileTypeFrom(visibleText)
        || fileTypeFrom(title)
        || fileTypeFrom(downloadName);

      const looksLikeFileUrl = rawHref
        && /(?:upload|download|userfiles|files?\/)/i.test(rawHref);

      if (!type && !looksLikeFileUrl) {
        return;
      }

      const name = downloadName
        || title
        || visibleText
        || filenameFromUrl(url);

      if (!name && !url) {
        return;
      }

      const key = url || name;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);

      attachments.push({
        name: name || filenameFromUrl(url),
        url,
        type: type || fileTypeFrom(name)
      });
    });

    return {
      attachments,
      diagnostics: [
        diagnostic(
          attachments.length > 0 ? "OK" : "NOT_FOUND",
          attachments.length > 0
            ? `Extracted ${attachments.length} visible attachment link(s)`
            : "No visible attachment links matched"
        )
      ]
    };
  }

  extractor.extractAttachments = extractAttachments;
})(globalThis);
