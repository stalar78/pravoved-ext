(function initAttachmentsExtractor(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const extractor = root.extractor = root.extractor || {};

  function extractAttachments() {
    return {
      attachments: [],
      diagnostics: [
        extractor.selectorNotFound("attachments.item")
      ]
    };
  }

  extractor.extractAttachments = extractAttachments;
})(globalThis);
