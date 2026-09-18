(function initMetadataExtractor(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const extractor = root.extractor = root.extractor || {};

  function extractMetadata(locationObject) {
    const url = locationObject && typeof locationObject.href === "string"
      ? locationObject.href
      : null;

    return {
      id: null,
      url,
      publishedAt: null,
      city: null,
      category: {
        name: null,
        path: []
      },
      answersCount: null,
      diagnostics: [
        extractor.selectorNotFound("question.id"),
        extractor.selectorNotFound("metadata.publishedAt"),
        extractor.selectorNotFound("metadata.city"),
        extractor.selectorNotFound("metadata.category"),
        extractor.selectorNotFound("metadata.answersCount")
      ]
    };
  }

  extractor.extractMetadata = extractMetadata;
})(globalThis);
