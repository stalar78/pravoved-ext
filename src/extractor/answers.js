(function initAnswersExtractor(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const extractor = root.extractor = root.extractor || {};

  function extractAnswers() {
    return {
      answers: [],
      diagnostics: [
        extractor.selectorNotFound("answers.item")
      ]
    };
  }

  extractor.extractAnswers = extractAnswers;
})(globalThis);
