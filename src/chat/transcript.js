(function initChatTranscript(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const chatTranscript = root.chatTranscript = root.chatTranscript || {};

  const MESSAGE_ROOT_SELECTOR = ".dialog__items-inner";
  const MESSAGE_SELECTOR = ".dialog-message";
  const OWN_MESSAGE_CLASS = "dialog-message--align-right";
  const MAX_LOAD_ROUNDS = 30;
  const LOAD_POLL_MS = 120;
  const LOAD_ROUND_TIMEOUT_MS = 1800;
  const STABLE_ROUNDS_REQUIRED = 4;

  function normalizeWhitespace(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function wait(ms) {
    return new Promise((resolve) => {
      global.setTimeout(resolve, ms);
    });
  }

  function findMessageRoot(documentObject) {
    return documentObject && documentObject.querySelector
      ? documentObject.querySelector(MESSAGE_ROOT_SELECTOR)
      : null;
  }

  function isScrollable(node) {
    if (!node || !(node instanceof Element)) {
      return false;
    }

    const style = global.getComputedStyle
      ? global.getComputedStyle(node)
      : null;
    const overflowY = style ? style.overflowY : "";

    return /(auto|scroll)/i.test(overflowY)
      && node.scrollHeight > node.clientHeight + 8;
  }

  function collectScrollContainers(messageRoot, documentObject) {
    const result = [];
    const seen = new Set();

    function add(node) {
      if (!node || seen.has(node)) {
        return;
      }

      seen.add(node);
      result.push(node);
    }

    const explicitSelectors = [
      ".dialog__items",
      ".dialog__items-inner",
      ".dialog",
      ".content",
      "main"
    ];

    explicitSelectors.forEach((selector) => {
      const node = documentObject.querySelector(selector);

      if (
        node
        && (
          isScrollable(node)
          || node === messageRoot
          || selector === ".dialog__items"
        )
      ) {
        add(node);
      }
    });

    let current = messageRoot ? messageRoot.parentElement : null;

    while (current && current !== documentObject.body) {
      if (isScrollable(current)) {
        add(current);
      }

      current = current.parentElement;
    }

    add(documentObject.scrollingElement || documentObject.documentElement);

    return result;
  }

  function getScrollTop(container, documentObject) {
    const scrollingElement = documentObject.scrollingElement
      || documentObject.documentElement;

    if (container === scrollingElement) {
      return global.scrollY || scrollingElement.scrollTop || 0;
    }

    return container ? container.scrollTop : 0;
  }

  function setScrollTop(container, value, documentObject) {
    const scrollingElement = documentObject.scrollingElement
      || documentObject.documentElement;
    const top = Math.max(0, Number(value) || 0);

    if (!container) {
      return;
    }

    if (container === scrollingElement) {
      global.scrollTo(0, top);
      scrollingElement.scrollTop = top;
      return;
    }

    if (typeof container.scrollTo === "function") {
      container.scrollTo({
        top,
        behavior: "auto"
      });
    }

    container.scrollTop = top;
  }

  function dispatchScroll(container, documentObject) {
    const scrollingElement = documentObject.scrollingElement
      || documentObject.documentElement;

    if (!container) {
      return;
    }

    const event = new Event("scroll", {
      bubbles: true
    });

    if (container === scrollingElement) {
      global.dispatchEvent(new Event("scroll"));
      documentObject.dispatchEvent(new Event("scroll", {
        bubbles: true
      }));
      scrollingElement.dispatchEvent(event);
      return;
    }

    container.dispatchEvent(event);
  }

  function messageSignature(messageRoot) {
    if (!messageRoot) {
      return {
        count: 0,
        first: null
      };
    }

    const messages = [...messageRoot.querySelectorAll(MESSAGE_SELECTOR)];
    const first = messages[0] || null;

    if (!first) {
      return {
        count: 0,
        first: null
      };
    }

    const rawId = first.getAttribute("data-id")
      || first.getAttribute("data-message-id")
      || first.id
      || "";
    const text = normalizeWhitespace(first.textContent).slice(0, 180);

    return {
      count: messages.length,
      first: rawId || text || null
    };
  }

  function snapshotScrollState(containers, documentObject) {
    return containers.map((container) => {
      const top = getScrollTop(container, documentObject);
      const height = Number(container.scrollHeight) || 0;
      const clientHeight = Number(container.clientHeight) || 0;

      return {
        container,
        top,
        bottomDistance: Math.max(0, height - top - clientHeight)
      };
    });
  }

  function restoreScrollState(snapshot, documentObject) {
    snapshot.forEach((item) => {
      const container = item.container;

      if (!container || !container.isConnected) {
        return;
      }

      const height = Number(container.scrollHeight) || 0;
      const clientHeight = Number(container.clientHeight) || 0;
      const restoredTop = height - clientHeight - item.bottomDistance;

      setScrollTop(
        container,
        Number.isFinite(restoredTop) ? restoredTop : item.top,
        documentObject
      );
      dispatchScroll(container, documentObject);
    });
  }

  function forceTopExposure(messageRoot, documentObject) {
    const containers = collectScrollContainers(messageRoot, documentObject);

    containers.forEach((container) => {
      setScrollTop(container, 0, documentObject);
      dispatchScroll(container, documentObject);
    });

    const firstMessage = messageRoot.querySelector(MESSAGE_SELECTOR);

    if (firstMessage && typeof firstMessage.scrollIntoView === "function") {
      try {
        firstMessage.scrollIntoView({
          block: "start",
          inline: "nearest",
          behavior: "auto"
        });
      } catch (_) {
        firstMessage.scrollIntoView(true);
      }
    }

    containers.forEach((container) => {
      setScrollTop(container, 0, documentObject);
      dispatchScroll(container, documentObject);
    });

    return containers;
  }

  async function waitForHistoryChange(documentObject, previousSignature) {
    const deadline = Date.now() + LOAD_ROUND_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await wait(LOAD_POLL_MS);

      const currentRoot = findMessageRoot(documentObject);
      const currentSignature = messageSignature(currentRoot);

      if (
        currentSignature.count > previousSignature.count
        || (
          currentSignature.first
          && previousSignature.first
          && currentSignature.first !== previousSignature.first
        )
      ) {
        return {
          changed: true,
          signature: currentSignature
        };
      }
    }

    return {
      changed: false,
      signature: messageSignature(findMessageRoot(documentObject))
    };
  }

  async function loadAllAvailableMessages(documentObject, onProgress) {
    let messageRoot = findMessageRoot(documentObject);

    if (!messageRoot) {
      return {
        ok: false,
        loaded: 0,
        reason: "CHAT_MESSAGE_ROOT_NOT_FOUND"
      };
    }

    const initialContainers = collectScrollContainers(
      messageRoot,
      documentObject
    );
    const scrollSnapshot = snapshotScrollState(
      initialContainers,
      documentObject
    );

    let signature = messageSignature(messageRoot);
    let stableRounds = 0;
    let rounds = 0;

    try {
      while (
        rounds < MAX_LOAD_ROUNDS
        && stableRounds < STABLE_ROUNDS_REQUIRED
      ) {
        rounds += 1;
        messageRoot = findMessageRoot(documentObject);

        if (!messageRoot) {
          break;
        }

        const before = messageSignature(messageRoot);
        forceTopExposure(messageRoot, documentObject);

        if (typeof onProgress === "function") {
          onProgress({
            phase: "loading",
            round: rounds,
            messageCount: before.count
          });
        }

        const result = await waitForHistoryChange(
          documentObject,
          before
        );

        signature = result.signature;

        if (result.changed) {
          stableRounds = 0;

          if (typeof onProgress === "function") {
            onProgress({
              phase: "loading",
              round: rounds,
              messageCount: signature.count
            });
          }

          await wait(180);
        } else {
          stableRounds += 1;
        }
      }
    } finally {
      restoreScrollState(scrollSnapshot, documentObject);
    }

    return {
      ok: true,
      loaded: signature.count,
      rounds,
      stableRounds
    };
  }

  function attachmentName(link, messageNode, uploadId) {
    const direct = normalizeWhitespace(link.getAttribute("download"));
    if (direct) {
      return direct;
    }

    const fileItem = link.closest(".files__item") || messageNode;
    const nameNode = fileItem && fileItem.querySelector
      ? fileItem.querySelector(".files__name-text")
      : null;
    const extensionNode = fileItem && fileItem.querySelector
      ? fileItem.querySelector(".files__extension")
      : null;

    const base = normalizeWhitespace(nameNode && nameNode.textContent);
    const extension = normalizeWhitespace(extensionNode && extensionNode.textContent);

    if (base || extension) {
      if (!extension) {
        return base;
      }

      return base.endsWith(".")
        ? `${base}${extension}`
        : `${base}.${extension}`;
    }

    const visible = normalizeWhitespace(link.textContent);
    return visible || (uploadId ? `pravoved-upload-${uploadId}` : "вложение");
  }

  function extractAttachments(messageNode) {
    if (!messageNode || !messageNode.querySelectorAll) {
      return [];
    }

    const links = [
      ...messageNode.querySelectorAll('a.files__link[href*="/upload/"]')
    ];
    const seen = new Set();
    const attachments = [];

    links.forEach((link) => {
      const rawUrl = link.getAttribute("href");
      const uploadId = root.chat && typeof root.chat.extractUploadId === "function"
        ? root.chat.extractUploadId(rawUrl)
        : null;

      let url = rawUrl || null;

      if (rawUrl) {
        try {
          url = new URL(rawUrl, global.location.origin).href;
        } catch (_) {
          url = rawUrl;
        }
      }

      const key = uploadId || url || attachmentName(link, messageNode, null);

      if (!key || seen.has(key)) {
        return;
      }

      seen.add(key);
      attachments.push({
        id: uploadId,
        name: attachmentName(link, messageNode, uploadId),
        url
      });
    });

    return attachments;
  }

  function textCandidate(messageNode) {
    const selectors = [
      ".dialog-message__text",
      ".dialog-message__message",
      ".dialog-message__body",
      ".dialog-message__content",
      '[class*="dialog-message__text"]',
      '[class*="dialog-message__body"]'
    ];

    for (const selector of selectors) {
      const candidate = messageNode.querySelector(selector);

      if (candidate) {
        return candidate;
      }
    }

    return messageNode;
  }

  function extractMessageText(messageNode) {
    const candidate = textCandidate(messageNode);

    if (!candidate) {
      return null;
    }

    const clone = candidate.cloneNode(true);

    [
      ".files",
      ".files__item",
      '[class*="files__"]',
      "button",
      "svg",
      "img",
      "time",
      '[class*="avatar"]',
      '[class*="time"]',
      '[class*="date"]',
      '[class*="action"]',
      '[class*="status"]',
      'a[href*="/upload/"]'
    ].forEach((selector) => {
      clone.querySelectorAll(selector).forEach((node) => node.remove());
    });

    if (root.utils && typeof root.utils.htmlToPlainText === "function") {
      return normalizeWhitespace(root.utils.htmlToPlainText(clone.innerHTML));
    }

    return normalizeWhitespace(clone.textContent);
  }

  function extractMessageTime(messageNode) {
    if (!messageNode || !messageNode.querySelector) {
      return null;
    }

    const timeNode = messageNode.querySelector("time");

    if (timeNode) {
      const datetime = normalizeWhitespace(timeNode.getAttribute("datetime"));
      if (datetime) {
        return datetime;
      }

      const visible = normalizeWhitespace(timeNode.textContent);
      if (visible) {
        return visible;
      }
    }

    const selectors = [
      ".dialog-message__time",
      '[class*="dialog-message__time"]',
      '[class*="message__time"]'
    ];

    for (const selector of selectors) {
      const node = messageNode.querySelector(selector);
      const value = normalizeWhitespace(node && node.textContent);

      if (value) {
        return value;
      }
    }

    return null;
  }

  function messageIdentity(messageNode, fallbackIndex) {
    const raw = messageNode.getAttribute("data-id")
      || messageNode.getAttribute("data-message-id")
      || messageNode.id
      || "";

    return raw || `dom-${fallbackIndex + 1}`;
  }

  function extractMessages(documentObject) {
    const messageRoot = findMessageRoot(documentObject);

    if (!messageRoot) {
      return [];
    }

    const nodes = [...messageRoot.querySelectorAll(MESSAGE_SELECTOR)];
    const messages = [];
    const seen = new Set();

    nodes.forEach((messageNode, index) => {
      const role = messageNode.classList.contains(OWN_MESSAGE_CLASS)
        ? "ЮРИСТ"
        : "КЛИЕНТ";
      const text = extractMessageText(messageNode);
      const attachments = extractAttachments(messageNode);

      if (!text && attachments.length === 0) {
        return;
      }

      const time = extractMessageTime(messageNode);
      const identity = messageIdentity(messageNode, index);
      const dedupeKey = [
        identity,
        role,
        time || "",
        text || "",
        attachments.map((item) => item.id || item.url || item.name).join("|")
      ].join("::");

      if (seen.has(dedupeKey)) {
        return;
      }

      seen.add(dedupeKey);
      messages.push({
        id: identity,
        role,
        time,
        text,
        attachments
      });
    });

    return messages;
  }

  function formatAttachment(item, index) {
    const attachment = item || {};
    const name = normalizeWhitespace(attachment.name) || "вложение";
    const url = attachment.url ? ` — ${attachment.url}` : "";

    return `${index + 1}. ${name}${url}`;
  }

  function formatMessage(message, index) {
    const item = message || {};
    const lines = [
      `--- Сообщение ${index + 1} · ${item.role || "НЕ ОПРЕДЕЛЕНО"} ---`
    ];

    if (item.time) {
      lines.push(
        "Время:",
        item.time
      );
    }

    lines.push(
      "Текст:",
      item.text || "—"
    );

    if (Array.isArray(item.attachments) && item.attachments.length > 0) {
      lines.push(
        "Вложения:",
        item.attachments.map(formatAttachment).join("\n")
      );
    }

    return lines.join("\n");
  }

  function formatTranscript(chatId, locationObject, messages) {
    const list = Array.isArray(messages) ? messages : [];

    return [
      "=== PRAVOVED CHAT ===",
      "",
      "URL:",
      locationObject && locationObject.href ? locationObject.href : "NOT_FOUND",
      "",
      "CHAT ID:",
      chatId || "NOT_FOUND",
      "",
      "Количество сообщений:",
      String(list.length),
      "",
      "ПЕРЕПИСКА:",
      list.length > 0
        ? list.map(formatMessage).join("\n\n")
        : "NOT_FOUND",
      "",
      "=== END CHAT ==="
    ].join("\n");
  }

  async function writeClipboard(text, documentObject) {
    if (
      global.navigator
      && global.navigator.clipboard
      && typeof global.navigator.clipboard.writeText === "function"
    ) {
      await global.navigator.clipboard.writeText(text);
      return;
    }

    const textarea = documentObject.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.setAttribute("aria-hidden", "true");
    documentObject.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const copied = documentObject.execCommand("copy");
    textarea.remove();

    if (!copied) {
      throw new Error("CLIPBOARD_UNAVAILABLE");
    }
  }

  async function copyFullChat(documentObject, locationObject, onProgress) {
    const documentRef = documentObject || document;
    const locationRef = locationObject || global.location;
    const chatId = root.chat && typeof root.chat.extractChatId === "function"
      ? root.chat.extractChatId(locationRef)
      : null;

    if (!chatId) {
      return {
        ok: false,
        reason: "CHAT_ID_NOT_FOUND",
        messageCount: 0
      };
    }

    const loading = await loadAllAvailableMessages(
      documentRef,
      onProgress
    );

    if (!loading.ok) {
      return {
        ok: false,
        reason: loading.reason || "CHAT_LOAD_FAILED",
        messageCount: 0
      };
    }

    if (typeof onProgress === "function") {
      onProgress({
        phase: "formatting",
        messageCount: loading.loaded
      });
    }

    const messages = extractMessages(documentRef);
    const text = formatTranscript(chatId, locationRef, messages);

    await writeClipboard(text, documentRef);

    return {
      ok: true,
      chatId,
      messageCount: messages.length,
      textLength: text.length,
      rounds: loading.rounds
    };
  }

  chatTranscript.loadAllAvailableMessages = loadAllAvailableMessages;
  chatTranscript.extractMessages = extractMessages;
  chatTranscript.formatTranscript = formatTranscript;
  chatTranscript.copyFullChat = copyFullChat;
})(globalThis);
