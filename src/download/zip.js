(function initZipDownloads(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const downloads = root.downloads = root.downloads || {};

  const UTF8_FLAG = 0x0800;
  const STORE_METHOD = 0;
  const MAX_UINT32 = 0xffffffff;
  const encoder = new TextEncoder();

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);

    for (let index = 0; index < 256; index += 1) {
      let value = index;

      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1)
          ? (0xedb88320 ^ (value >>> 1))
          : (value >>> 1);
      }

      table[index] = value >>> 0;
    }

    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;

    for (let index = 0; index < bytes.length; index += 1) {
      crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

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

  function makeUniqueFilename(name, usedNames) {
    if (!usedNames.has(name.toLowerCase())) {
      usedNames.add(name.toLowerCase());
      return name;
    }

    const lastDot = name.lastIndexOf(".");
    const hasExtension = lastDot > 0 && lastDot < name.length - 1;
    const stem = hasExtension ? name.slice(0, lastDot) : name;
    const extension = hasExtension ? name.slice(lastDot) : "";

    let counter = 2;
    let candidate;

    do {
      candidate = `${stem} (${counter})${extension}`;
      counter += 1;
    } while (usedNames.has(candidate.toLowerCase()));

    usedNames.add(candidate.toLowerCase());
    return candidate;
  }

  function writeUint16(view, offset, value) {
    view.setUint16(offset, value, true);
  }

  function writeUint32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }

  function toDosDateTime(dateObject) {
    const date = dateObject instanceof Date ? dateObject : new Date();
    const year = Math.min(2107, Math.max(1980, date.getFullYear()));

    const dosTime = ((date.getHours() & 0x1f) << 11)
      | ((date.getMinutes() & 0x3f) << 5)
      | ((Math.floor(date.getSeconds() / 2)) & 0x1f);

    const dosDate = (((year - 1980) & 0x7f) << 9)
      | (((date.getMonth() + 1) & 0x0f) << 5)
      | (date.getDate() & 0x1f);

    return { dosTime, dosDate };
  }

  function createLocalHeader(file) {
    const header = new Uint8Array(30 + file.nameBytes.length);
    const view = new DataView(header.buffer);
    const { dosTime, dosDate } = file.dos;

    writeUint32(view, 0, 0x04034b50);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, UTF8_FLAG);
    writeUint16(view, 8, STORE_METHOD);
    writeUint16(view, 10, dosTime);
    writeUint16(view, 12, dosDate);
    writeUint32(view, 14, file.crc);
    writeUint32(view, 18, file.size);
    writeUint32(view, 22, file.size);
    writeUint16(view, 26, file.nameBytes.length);
    writeUint16(view, 28, 0);
    header.set(file.nameBytes, 30);

    return header;
  }

  function createCentralHeader(file, localOffset) {
    const header = new Uint8Array(46 + file.nameBytes.length);
    const view = new DataView(header.buffer);
    const { dosTime, dosDate } = file.dos;

    writeUint32(view, 0, 0x02014b50);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, 20);
    writeUint16(view, 8, UTF8_FLAG);
    writeUint16(view, 10, STORE_METHOD);
    writeUint16(view, 12, dosTime);
    writeUint16(view, 14, dosDate);
    writeUint32(view, 16, file.crc);
    writeUint32(view, 20, file.size);
    writeUint32(view, 24, file.size);
    writeUint16(view, 28, file.nameBytes.length);
    writeUint16(view, 30, 0);
    writeUint16(view, 32, 0);
    writeUint16(view, 34, 0);
    writeUint16(view, 36, 0);
    writeUint32(view, 38, 0);
    writeUint32(view, 42, localOffset);
    header.set(file.nameBytes, 46);

    return header;
  }

  function createEndRecord(fileCount, centralSize, centralOffset) {
    const record = new Uint8Array(22);
    const view = new DataView(record.buffer);

    writeUint32(view, 0, 0x06054b50);
    writeUint16(view, 4, 0);
    writeUint16(view, 6, 0);
    writeUint16(view, 8, fileCount);
    writeUint16(view, 10, fileCount);
    writeUint32(view, 12, centralSize);
    writeUint32(view, 16, centralOffset);
    writeUint16(view, 20, 0);

    return record;
  }

  function createStoredZip(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error("ZIP_NO_FILES");
    }

    if (files.length > 0xffff) {
      throw new Error("ZIP_TOO_MANY_FILES");
    }

    const parts = [];
    const centralParts = [];
    let localOffset = 0;

    files.forEach((file) => {
      if (file.size > MAX_UINT32) {
        throw new Error("ZIP64_FILE_NOT_SUPPORTED");
      }

      const localHeader = createLocalHeader(file);
      parts.push(localHeader, file.bytes);
      centralParts.push(createCentralHeader(file, localOffset));

      localOffset += localHeader.byteLength + file.bytes.byteLength;

      if (localOffset > MAX_UINT32) {
        throw new Error("ZIP64_ARCHIVE_NOT_SUPPORTED");
      }
    });

    const centralOffset = localOffset;
    let centralSize = 0;

    centralParts.forEach((part) => {
      centralSize += part.byteLength;
      if (centralSize > MAX_UINT32) {
        throw new Error("ZIP64_ARCHIVE_NOT_SUPPORTED");
      }
    });

    const endRecord = createEndRecord(files.length, centralSize, centralOffset);

    return new Blob(
      [...parts, ...centralParts, endRecord],
      { type: "application/zip" }
    );
  }

  function createRequestId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function fetchViaPageContext(rawUrl) {
    return new Promise((resolve, reject) => {
      if (!global.location || !global.postMessage || !global.addEventListener) {
        reject(new Error("PAGE_FETCH_BRIDGE_UNAVAILABLE"));
        return;
      }

      const requestId = createRequestId();
      let settled = false;

      const cleanup = () => {
        global.removeEventListener("message", onMessage);
        global.clearTimeout(timeoutId);
      };

      const finish = (callback) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        callback();
      };

      const onMessage = (event) => {
        if (
          event.source !== global
          || event.origin !== global.location.origin
          || !event.data
          || event.data.source !== "pravoved-ext-page"
          || event.data.type !== "PRAVOVED_EXT_FETCH_ATTACHMENT_RESULT"
          || event.data.requestId !== requestId
        ) {
          return;
        }

        if (!event.data.ok) {
          finish(() => {
            reject(new Error(event.data.error || "ATTACHMENT_FETCH_FAILED"));
          });
          return;
        }

        if (!(event.data.buffer instanceof ArrayBuffer)) {
          finish(() => {
            reject(new Error("ATTACHMENT_FETCH_INVALID_BUFFER"));
          });
          return;
        }

        finish(() => {
          resolve({
            buffer: event.data.buffer,
            status: event.data.status || 200,
            finalUrl: event.data.finalUrl || rawUrl,
            contentType: event.data.contentType || null
          });
        });
      };

      global.addEventListener("message", onMessage);

      const timeoutId = global.setTimeout(() => {
        finish(() => {
          reject(new Error("ATTACHMENT_FETCH_TIMEOUT"));
        });
      }, 120000);

      global.postMessage({
        source: "pravoved-ext-isolated",
        type: "PRAVOVED_EXT_FETCH_ATTACHMENT",
        requestId,
        url: rawUrl
      }, global.location.origin);
    });
  }

  async function fetchDirect(rawUrl) {
    const response = await fetch(rawUrl, {
      method: "GET",
      credentials: "include",
      redirect: "follow",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`ATTACHMENT_HTTP_${response.status}`);
    }

    return {
      buffer: await response.arrayBuffer(),
      status: response.status,
      finalUrl: response.url || rawUrl,
      contentType: response.headers.get("content-type") || null
    };
  }

  async function fetchAttachmentBytes(rawUrl) {
    try {
      return await fetchViaPageContext(rawUrl);
    } catch (pageError) {
      if (
        pageError
        && typeof pageError.message === "string"
        && !pageError.message.startsWith("PAGE_FETCH_BRIDGE_")
        && pageError.message !== "ATTACHMENT_FETCH_TIMEOUT"
      ) {
        throw pageError;
      }

      return fetchDirect(rawUrl);
    }
  }

  async function fetchAttachment(attachment, index, usedNames) {
    if (!attachment || !isAllowedPravovedUrl(attachment.url)) {
      throw new Error(`INVALID_ATTACHMENT_URL_${index + 1}`);
    }

    let fetched;

    try {
      fetched = await fetchAttachmentBytes(attachment.url);
    } catch (error) {
      const reason = error && error.message
        ? error.message
        : "ATTACHMENT_FETCH_FAILED";

      throw new Error(`${reason}_${index + 1}`);
    }

    const bytes = new Uint8Array(fetched.buffer);

    if (bytes.byteLength > MAX_UINT32) {
      throw new Error("ZIP64_FILE_NOT_SUPPORTED");
    }

    const fallback = `pravoved-attachment-${index + 1}`;
    const sanitized = sanitizeFilename(attachment.name, fallback);
    const name = makeUniqueFilename(sanitized, usedNames);

    return {
      name,
      nameBytes: encoder.encode(name),
      bytes,
      size: bytes.byteLength,
      crc: crc32(bytes),
      dos: toDosDateTime(new Date())
    };
  }

  function sanitizeQuestionId(value) {
    const raw = value === null || value === undefined ? "" : String(value);
    const digits = raw.replace(/[^0-9]/g, "");
    return digits || "question";
  }

  function triggerBlobDownload(blob, filename, documentObject) {
    const documentRef = documentObject || document;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = documentRef.createElement("a");

    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    documentRef.documentElement.appendChild(anchor);
    anchor.click();
    anchor.remove();

    global.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60000);
  }

  async function downloadZip(attachments, contextId, documentObject, options) {
    const items = Array.isArray(attachments) ? attachments : [];

    if (items.length < 2) {
      return {
        ok: false,
        mode: "zip",
        requested: items.length,
        reason: "ZIP_REQUIRES_MULTIPLE_ATTACHMENTS"
      };
    }

    const usedNames = new Set();
    const files = [];

    for (let index = 0; index < items.length; index += 1) {
      const file = await fetchAttachment(items[index], index, usedNames);
      files.push(file);
    }

    const blob = createStoredZip(files);
    const config = options || {};
    const defaultFilename = `Pravoved-${sanitizeQuestionId(contextId)}.zip`;
    const requestedFilename = sanitizeFilename(config.filename, defaultFilename);
    const filename = /\.zip$/i.test(requestedFilename)
      ? requestedFilename
      : `${requestedFilename}.zip`;

    triggerBlobDownload(blob, filename, documentObject);

    return {
      ok: true,
      mode: "zip",
      requested: items.length,
      packed: files.length,
      started: 1,
      filename,
      size: blob.size
    };
  }

  downloads.downloadZip = downloadZip;
  downloads.createStoredZip = createStoredZip;
})(globalThis);
