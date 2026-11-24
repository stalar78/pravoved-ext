(function initChatTranscript(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const chatTranscript = root.chatTranscript = root.chatTranscript || {};

  const MESSAGE_ROOT_SELECTOR = ".dialog__items-inner";
  const MESSAGE_SELECTOR = ".dialog-message";
  const OWN_MESSAGE_CLASS = "dialog-message--align-right";
  const MAX_LOAD_ROUNDS = 18;
  const LOAD_WAIT_MS = 450;

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

  function findScrollContainer(messageRoot, documentObject) {
    const explicit = documentObject.querySelector(".dialog__items");

    if (explicit && explicit.scrollHeight > explicit.clientHeight + 8) {
      return explicit;
    }

    let current = messageRoot ? messageRoot.parentElement : null;

    while (current && current !== documentObject.body) {
      if (isScrollable(current)) {
        return current;
      }

      current = current.parentElement;
    }

    const scrollingElement = documentObject.scrollingElement
      || documentObject.documentElement;

    return scrollingElement || null;
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

    if (!container) {
      return;
    }

    if (container === scrollingElement) {
      global.scrollTo(0, Math.max(0, value));
      return;
    }

    container.scrollTop = Math.max(0, value);
  }

  function dispatchScroll(container, documentObject) {
    const scrollingElement = documentObject.scrollingElement
      || documentObject.documentElement;

    if (!container) {
      return;
    }

    if (container === scrollingElement) {
      global.dispatchEvent(new Event("scroll"));
      return;
    }

    container.dispatchEvent(new Event("scroll", {
      bubbles: true
    }));
  }

  async function loadAllAvailableMessages(documentObject, onProgress) {
    const messageRoot = findMessageRoot(documentObject);

    if (!messageRoot) {
      return {
        ok: false,
        loaded: 0,
        reason: "CHAT_MESSAGE_ROOT_NOT_FOUND"
      };
    }

    const scrollContainer = findScrollContainer(messageRoot, documentObject);
    const initialCount = messageRoot.querySelectorAll(MESSAGE_SELECTOR).length;

    if (!scrollContainer) {
      return {
        ok: true,
        loaded: initialCount,
        rounds: 0
      };
    }

    const initialScrollTop = getScrollTop(scrollContainer, documentObject);
    const initialBottomDistance = Math.max(
      0,
      scrollContainer.scrollHeight
        - initialScrollTop
        - scrollContainer.clientHeight
    );

    let lastCount = initialCount;
    let stableRounds = 0;
    let rounds = 0;

    try {
      while (rounds < MAX_LOAD_ROUNDS && stableRounds < 3) {
        rounds += 1;

        setScrollTop(scrollContainer, 0, documentObject);
        dispatchScroll(scrollContainer, documentObject);

        if (typeof onProgress === "function") {
          onProgress({
            phase: "loading",
            round: rounds,
            messageCount: lastCount
          });
        }

        await wait(LOAD_WAIT_MS);

        const currentRoot = findMessageRoot(documentObject);
        if (!currentRoot) {
          break;
        }

        const currentCount = currentRoot.querySelectorAll(MESSAGE_SELECTOR).length;

        if (currentCount > lastCount) {
          lastCount = currentCount;
          stableRounds = 0;
        } else {
          stableRounds += 1;
        }
      }
    } finally {
      const currentRoot = findMessageRoot(documentObject);
      const currentContainer = currentRoot
        ? findScrollContainer(currentRoot, documentObject)
        : scrollContainer;

      if (currentContainer) {
        const restoredTop = currentContainer.scrollHeight
          - currentContainer.clientHeight
          - initialBottomDistance;

        setScrollTop(
          currentContainer,
          Number.isFinite(restoredTop) ? restoredTop : initialScrollTop,
          documentObject
        );
        dispatchScroll(currentContainer, documentObject);
      }
    }

    return {
      ok: true,
      loaded: lastCount,
      rounds
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
