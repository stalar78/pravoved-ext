(function initTextUtils(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const utils = root.utils = root.utils || {};

  function normalizeWhitespace(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).replace(/\s+/g, " ").trim();
    return normalized || null;
  }

  function normalizeMultiline(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value)
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/^[ \t]+/gm, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return normalized || null;
  }

  function htmlToPlainText(html) {
    if (html === null || html === undefined || html === "") {
      return null;
    }

    const source = String(html);

    if (typeof DOMParser === "undefined") {
      return normalizeMultiline(
        source
          .replace(/<br\s*\/?\s*>/gi, "\n")
          .replace(/<\/p\s*>/gi, "\n\n")
          .replace(/<[^>]*>/g, " ")
      );
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(source, "text/html");
    const body = doc.body;

    body.querySelectorAll("script, style, noscript").forEach((node) => node.remove());
    body.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
    body.querySelectorAll("p, div, li, blockquote, h1, h2, h3, h4, h5, h6").forEach((node) => {
      node.appendChild(doc.createTextNode("\n\n"));
    });

    return normalizeMultiline(body.textContent);
  }

  function displayValue(value) {
    if (value === null || value === undefined || value === "") {
      return "NOT_FOUND";
    }

    return String(value);
  }

  function displayList(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return "NOT_FOUND";
    }

    return values.map((value) => displayValue(value)).join(", ");
  }

  utils.normalizeWhitespace = normalizeWhitespace;
  utils.normalizeMultiline = normalizeMultiline;
  utils.htmlToPlainText = htmlToPlainText;
  utils.displayValue = displayValue;
  utils.displayList = displayList;
})(globalThis);
