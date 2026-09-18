(function initQuestionExtractor(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const extractor = root.extractor = root.extractor || {};
  const utils = root.utils;

  function extractQuestion() {
    return {
      title: null,
      questionText: null,
      diagnostics: [
        extractor.selectorNotFound("question.title"),
        extractor.selectorNotFound("question.text")
      ]
    };
  }

  extractor.extractQuestion = extractQuestion;
  extractor.normalizeQuestionText = utils.normalizeMultiline;
})(globalThis);
