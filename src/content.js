(function initContentScript(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const extractor = root.extractor;

  let mountedQuestionId = null;
  let lifecycleStarted = false;

  function mergeAttachments(primary, fallback) {
    const result = [];
    const seen = new Set();

    [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(fallback) ? fallback : [])]
      .forEach((item) => {
        if (!item) {
          return;
        }

        const key = item.url || item.name;
        if (!key || seen.has(key)) {
          return;
        }

        seen.add(key);
        result.push(item);
      });

    return result;
  }


  function extractFallbackCase(documentObject, locationObject) {
    const metadata = extractor.extractMetadata(locationObject);
    const question = extractor.extractQuestion(documentObject);
    const answers = extractor.extractAnswers(documentObject);
    const attachments = extractor.extractAttachments(documentObject);
    const urlQuestionId = extractor.extractQuestionIdFromLocation
      ? extractor.extractQuestionIdFromLocation(locationObject)
      : null;

    return {
      caseData: {
        id: metadata.id || urlQuestionId,
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
        {
          field: "source",
          status: "DOM_FALLBACK"
        },
        ...metadata.diagnostics,
        ...question.diagnostics,
        ...answers.diagnostics,
        ...attachments.diagnostics
      ]
    };
  }

  function extractCase(documentObject, locationObject) {
    if (extractor.extractNextDataCase) {
      const structured = extractor.extractNextDataCase(documentObject, locationObject);
      if (structured.matched && structured.caseData) {
        const domAttachments = extractor.extractAttachments(documentObject);
        structured.caseData.attachments = mergeAttachments(
          structured.caseData.attachments,
          domAttachments.attachments
        );

        return {
          caseData: structured.caseData,
          diagnostics: [
            {
              field: "source",
              status: "NEXT_DATA"
            },
            ...structured.diagnostics,
            ...domAttachments.diagnostics
          ]
        };
      }

      const fallback = extractFallbackCase(documentObject, locationObject);
      fallback.diagnostics = [
        ...structured.diagnostics,
        ...fallback.diagnostics
      ];
      return fallback;
    }

    return extractFallbackCase(documentObject, locationObject);
  }

  async function initializeForCurrentQuestion() {
    const currentQuestionId = extractor.extractQuestionIdFromLocation
      ? extractor.extractQuestionIdFromLocation(global.location)
      : null;

    if (!currentQuestionId) {
      mountedQuestionId = null;
      const existing = document.getElementById("pravoved-ext-panel");
      if (existing) {
        existing.remove();
      }
      return;
    }

    const targetQuestionId = currentQuestionId;
    const extracted = extractCase(document, global.location);
    const savedStatus = await root.storage.getStatus(extracted.caseData.id);

    const latestQuestionId = extractor.extractQuestionIdFromLocation(global.location);
    if (latestQuestionId !== targetQuestionId) {
      return;
    }

    extracted.caseData.status = savedStatus ? savedStatus.status : null;

    root.ui.mount({
      caseData: extracted.caseData,
      diagnostics: extracted.diagnostics,
      formatter: root.formatter.formatForChatGpt,
      onStatus: (status) => root.storage.setStatus(extracted.caseData.id, status),
      document
    });

    const structuredDataIsStale = extracted.diagnostics.some((item) => (
      item && item.field === "NEXT_DATA_STALE" && item.status === "TRUE"
    ));

    mountedQuestionId = structuredDataIsStale ? null : targetQuestionId;
  }

  function startLifecycleWatch() {
    if (lifecycleStarted) {
      return;
    }

    lifecycleStarted = true;

    setInterval(() => {
      const currentQuestionId = extractor.extractQuestionIdFromLocation(global.location);

      if (currentQuestionId !== mountedQuestionId) {
        initializeForCurrentQuestion().catch((error) => {
          console.error("Pravoved extension reinitialization failed", error);
        });
      }
    }, 750);
  }

  root.extractCase = extractCase;
  root.initializeForCurrentQuestion = initializeForCurrentQuestion;

  initializeForCurrentQuestion()
    .then(startLifecycleWatch)
    .catch((error) => {
      console.error("Pravoved extension initialization failed", error);
    });
})(globalThis);
