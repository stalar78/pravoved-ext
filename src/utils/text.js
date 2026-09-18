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
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return normalized || null;
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
  utils.displayValue = displayValue;
  utils.displayList = displayList;
})(globalThis);
