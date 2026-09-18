(function initContentScript(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const extractor = root.extractor;

  function extractCase(documentObject, locationObject) {
    const metadata = extractor.extractMetadata(locationObject);
    const question = extractor.extractQuestion(documentObject);
    const answers = extractor.extractAnswers(documentObject);
    const attachments = extractor.extractAttachments(documentObject);

    return {
      caseData: {
        id: metadata.id,
        url: metadata.url,
        title: question.title,
        questionText: question.questionText,
        publishedAt: metadata.publishedAt,
        city: metadata.city,
        category: metadata.category,
        answersCount: metadata.answersCount,
        answers: answers.answers,
        attachments: attachments.attachments,
        status: null
      },
      diagnostics: [
        ...metadata.diagnostics,
        ...question.diagnostics,
        ...answers.diagnostics,
        ...attachments.diagnostics
      ]
    };
  }

  async function initialize() {
    const extracted = extractCase(document, global.location);
    const savedStatus = await root.storage.getStatus(extracted.caseData.id);
    extracted.caseData.status = savedStatus ? savedStatus.status : null;

    root.ui.mount({
      caseData: extracted.caseData,
      diagnostics: extracted.diagnostics,
      formatter: root.formatter.formatForChatGpt,
      onStatus: (status) => root.storage.setStatus(extracted.caseData.id, status),
      document
    });
  }

  root.extractCase = extractCase;
  initialize().catch((error) => {
    console.error("Pravoved extension initialization failed", error);
  });
})(globalThis);
