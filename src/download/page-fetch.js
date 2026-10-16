(function initPravovedPageAttachmentFetchBridge() {
  const REQUEST_TYPE = "PRAVOVED_EXT_FETCH_ATTACHMENT";
  const RESPONSE_TYPE = "PRAVOVED_EXT_FETCH_ATTACHMENT_RESULT";
  const REQUEST_SOURCE = "pravoved-ext-isolated";
  const RESPONSE_SOURCE = "pravoved-ext-page";
  const UPLOAD_RE = /^\/upload\/(\d+)\/?$/;

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
    return fetch(url.href, {
      method: "GET",
      credentials: "include",
      redirect: "follow",
      cache: "no-store"
    });
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

    let lastResponse = null;

    for (const candidate of candidates) {
      const response = await fetchCandidate(candidate);
      lastResponse = response;

      if (response.ok) {
        const buffer = await response.arrayBuffer();

        return {
          buffer,
          status: response.status,
          finalUrl: response.url || candidate.href,
          contentType: response.headers.get("content-type") || null
        };
      }
    }

    const status = lastResponse ? lastResponse.status : 0;
    throw new Error(`ATTACHMENT_HTTP_${status || "NETWORK"}`);
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
      const result = await fetchAttachment(event.data.url);

      window.postMessage({
        source: RESPONSE_SOURCE,
        type: RESPONSE_TYPE,
        requestId,
        ok: true,
        status: result.status,
        finalUrl: result.finalUrl,
        contentType: result.contentType,
        buffer: result.buffer
      }, window.location.origin, [result.buffer]);
    } catch (error) {
      window.postMessage({
        source: RESPONSE_SOURCE,
        type: RESPONSE_TYPE,
        requestId,
        ok: false,
        error: error && error.message ? error.message : "ATTACHMENT_FETCH_FAILED"
      }, window.location.origin);
    }
  });
})();
