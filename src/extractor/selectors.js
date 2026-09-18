(function initSelectors(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const extractor = root.extractor = root.extractor || {};

  // Заполняется только после предоставления подтверждённых DOM-фрагментов Pravoved.
  // Пустые значения здесь намеренны: расширение не угадывает селекторы.
  const selectors = Object.freeze({
    question: Object.freeze({
      id: [],
      title: [],
      text: []
    }),
    metadata: Object.freeze({
      publishedAt: [],
      city: [],
      categoryName: [],
      categoryPath: [],
      answersCount: []
    }),
    answers: Object.freeze({
      item: [],
      author: [],
      publishedAt: [],
      text: []
    }),
    attachments: Object.freeze({
      item: [],
      name: [],
      url: [],
      type: []
    })
  });

  function notFound(field) {
    return {
      field,
      status: "NOT_FOUND",
      reason: "DOM selector is not configured"
    };
  }

  extractor.selectors = selectors;
  extractor.selectorNotFound = notFound;
})(globalThis);
