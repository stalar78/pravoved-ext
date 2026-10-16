(function initPravovedPageZipBridge() {
  const REQUEST_TYPE = "PRAVOVED_EXT_BUILD_ZIP";
  const RESPONSE_TYPE = "PRAVOVED_EXT_BUILD_ZIP_RESULT";
  const PROGRESS_TYPE = "PRAVOVED_EXT_BUILD_ZIP_PROGRESS";
  const REQUEST_SOURCE = "pravoved-ext-isolated";
  const RESPONSE_SOURCE = "pravoved-ext-page";
  const UPLOAD_RE = /^\/upload\/(\d+)\/?$/;
  const UTF8_FLAG = 0x0800;
  const STORE_METHOD = 0;
  const MAX_UINT32 = 0xffffffff;
  const MAX_FILES = 200;
  const FETCH_TIMEOUT_MS = 45000;
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

  function validateUploadUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      return null;
    }

    try {
      const url = new URL(rawUrl, window.location.origin);
      const hostname = url.hostname.toLowerCase();

      if (
        url.protocol !== "https:"
        || !(hostname === "pravoved.ru" || hostname.endsWith(".pravoved.ru"))
        || !UPLOAD_RE.test(url.pathname)
      ) {
        return null;
      }

      return url;
    } catch (_) {
      return null;
    }
  }

  function canonicalUploadUrl(url) {
    const match = url.pathname.match(UPLOAD_RE);
    if (!match) {
      return null;
    }

    return new URL(`/upload/${match[1]}/`, url.origin);
  }

  async function fetchCandidate(url) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url.href, {
        method: "GET",
        credentials: "include",
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        return {
          ok: false,
          status: response.status
        };
      }

      const buffer = await response.arrayBuffer();

      return {
        ok: true,
        status: response.status,
        buffer,
        finalUrl: response.url || url.href,
        contentType: response.headers.get("content-type") || null
      };
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("ATTACHMENT_TIMEOUT");
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function fetchAttachment(rawUrl) {
    const requested = validateUploadUrl(rawUrl);

    if (!requested) {
      throw new Error("INVALID_ATTACHMENT_URL");
    }

    const candidates = [requested];
    const canonical = canonicalUploadUrl(requested);

    if (canonical && canonical.href !== requested.href) {
      candidates.push(canonical);
    }

    let lastStatus = 0;

    for (const candidate of candidates) {
      const result = await fetchCandidate(candidate);

      if (result.ok) {
        return result;
      }

      lastStatus = result.status || lastStatus;
    }

    throw new Error(`ATTACHMENT_HTTP_${lastStatus || "NETWORK"}`);
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

    return {
      dosTime: ((date.getHours() & 0x1f) << 11)
        | ((date.getMinutes() & 0x3f) << 5)
        | ((Math.floor(date.getSeconds() / 2)) & 0x1f),
      dosDate: (((year - 1980) & 0x7f) << 9)
        | (((date.getMonth() + 1) & 0x0f) << 5)
        | (date.getDate() & 0x1f)
    };
  }

  function createLocalHeader(file) {
    const header = new Uint8Array(30 + file.nameBytes.length);
    const view = new DataView(header.buffer);

    writeUint32(view, 0, 0x04034b50);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, UTF8_FLAG);
    writeUint16(view, 8, STORE_METHOD);
    writeUint16(view, 10, file.dos.dosTime);
    writeUint16(view, 12, file.dos.dosDate);
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

    writeUint32(view, 0, 0x02014b50);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, 20);
    writeUint16(view, 8, UTF8_FLAG);
    writeUint16(view, 10, STORE_METHOD);
    writeUint16(view, 12, file.dos.dosTime);
    writeUint16(view, 14, file.dos.dosDate);
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
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    files.forEach((file) => {
      if (file.size > MAX_UINT32) {
        throw new Error("ZIP64_FILE_NOT_SUPPORTED");
      }

      const localHeader = createLocalHeader(file);
      localParts.push(localHeader, file.bytes);
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
      [...localParts, ...centralParts, endRecord],
      { type: "application/zip" }
    );
  }

  function triggerDownload(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.documentElement.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60000);
  }

  function postProgress(requestId, completed, total, name) {
    window.postMessage({
      source: RESPONSE_SOURCE,
      type: PROGRESS_TYPE,
      requestId,
      completed,
      total,
      name
    }, window.location.origin);
  }

  async function buildAndDownloadZip(message) {
    const input = Array.isArray(message.attachments)
      ? message.attachments
      : [];

    if (input.length < 2 || input.length > MAX_FILES) {
      throw new Error("ZIP_INVALID_FILE_COUNT");
    }

    const filename = sanitizeFilename(
      message.filename,
      "Pravoved-files.zip"
    );
    const zipFilename = /\.zip$/i.test(filename)
      ? filename
      : `${filename}.zip`;

    const usedNames = new Set();
    const files = [];

    for (let index = 0; index < input.length; index += 1) {
      const attachment = input[index] || {};
      const fetched = await fetchAttachment(attachment.url);
      const bytes = new Uint8Array(fetched.buffer);

      if (bytes.byteLength > MAX_UINT32) {
        throw new Error(`ZIP64_FILE_NOT_SUPPORTED_${index + 1}`);
      }

      const fallback = `pravoved-attachment-${index + 1}`;
      const name = makeUniqueFilename(
        sanitizeFilename(attachment.name, fallback),
        usedNames
      );

      files.push({
        name,
        nameBytes: encoder.encode(name),
        bytes,
        size: bytes.byteLength,
        crc: crc32(bytes),
        dos: toDosDateTime(new Date())
      });

      postProgress(
        message.requestId,
        index + 1,
        input.length,
        name
      );
    }

    const blob = createStoredZip(files);
    triggerDownload(blob, zipFilename);

    return {
      filename: zipFilename,
      size: blob.size,
      packed: files.length
    };
  }

  window.addEventListener("message", async (event) => {
    if (
      event.source !== window
      || event.origin !== window.location.origin
      || !event.data
      || event.data.source !== REQUEST_SOURCE
      || event.data.type !== REQUEST_TYPE
      || typeof event.data.requestId !== "string"
    ) {
      return;
    }

    const requestId = event.data.requestId;

    try {
      const result = await buildAndDownloadZip(event.data);

      window.postMessage({
        source: RESPONSE_SOURCE,
        type: RESPONSE_TYPE,
        requestId,
        ok: true,
        filename: result.filename,
        size: result.size,
        packed: result.packed
      }, window.location.origin);
    } catch (error) {
      window.postMessage({
        source: RESPONSE_SOURCE,
        type: RESPONSE_TYPE,
        requestId,
        ok: false,
        error: error && error.message ? error.message : "ZIP_BUILD_FAILED"
      }, window.location.origin);
    }
  });
})();
