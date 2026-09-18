(function initNextDataExtractor(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const extractor = root.extractor = root.extractor || {};
  const utils = root.utils;

  const QUESTION_PATH_RE = /\/question\/(\d+)(?:\/|$)/;

  function diag(field, status, reason) {
    const item = { field, status, source: "NEXT_DATA" };
    if (reason) {
      item.reason = reason;
    }
    return item;
  }

  function extractQuestionIdFromLocation(locationObject) {
    const pathname = locationObject && typeof locationObject.pathname === "string"
      ? locationObject.pathname
      : "";
    const match = pathname.match(QUESTION_PATH_RE);
    return match ? Number(match[1]) : null;
  }

  function unixSecondsToIso(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return null;
    }

    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function normalizeAuthor(user) {
    if (!user || typeof user !== "object") {
      return null;
    }

    const surname = utils.normalizeWhitespace(user.surname);
    const name = utils.normalizeWhitespace(user.name);

    if (surname && name) {
      return `${surname} ${name}`;
    }

    return name || surname || null;
  }

  function normalizeQuestionUrl(question, locationObject) {
    const rawUrl = question && typeof question.url === "string" ? question.url : null;
    const base = locationObject && typeof locationObject.origin === "string"
      ? locationObject.origin
      : "https://pravoved.ru";

    if (rawUrl) {
      try {
        return new URL(rawUrl, base).href;
      } catch (_) {
        // Fall through to the current page URL.
      }
    }

    if (locationObject && typeof locationObject.href === "string") {
      try {
        const current = new URL(locationObject.href);
        current.hash = "";
        current.search = "";
        return current.href;
      } catch (_) {
        return locationObject.href;
      }
    }

    return null;
  }

  function normalizeFiles(files, diagnostics, field) {
    if (!files || typeof files !== "object") {
      diagnostics.push(diag(field, "OK", "No files container"));
      return [];
    }

    const total = Number(files.total || 0);
    if (total === 0) {
      diagnostics.push(diag(field, "OK"));
      return [];
    }

    diagnostics.push(diag(
      field,
      "UNSUPPORTED",
      "Attachment item schema has not yet been validated on a real question with files"
    ));
    return [];
  }

  function normalizeAnswers(question, diagnostics) {
    const answersContainer = question && question.answers && typeof question.answers === "object"
      ? question.answers
      : {};
    const items = answersContainer.items && typeof answersContainer.items === "object"
      ? Object.values(answersContainer.items)
      : [];

    const answers = items.map((answer) => {
      const answerDiagnostics = [];
      const attachments = normalizeFiles(
        answer && answer.files,
        answerDiagnostics,
        `answer.${answer && answer.id ? answer.id : "unknown"}.attachments`
      );
      diagnostics.push(...answerDiagnostics);

      return {
        id: answer && answer.id != null ? answer.id : null,
        author: normalizeAuthor(answer && answer.user),
        publishedAt: unixSecondsToIso(answer && answer.dateCreate),
        text: utils.htmlToPlainText(answer && answer.text),
        attachments
      };
    });

    const declaredTotal = Number(answersContainer.total);
    const total = Number.isFinite(declaredTotal) ? declaredTotal : answers.length;

    diagnostics.push(diag(
      "answers",
      total === answers.length ? "OK" : "MISMATCH",
      total === answers.length ? null : `Declared ${total}, extracted ${answers.length}`
    ));

    return {
      answers,
      answersCount: total
    };
  }

  function extractNextDataCase(documentObject, locationObject) {
    const diagnostics = [];
    const urlQuestionId = extractQuestionIdFromLocation(locationObject);

    diagnostics.push(diag(
      "question.id.url",
      urlQuestionId ? "OK" : "NOT_FOUND",
      urlQuestionId ? null : "Current pathname is not a Pravoved question URL"
    ));

    const script = documentObject && documentObject.getElementById
      ? documentObject.getElementById("__NEXT_DATA__")
      : null;

    if (!script) {
      diagnostics.push(diag("__NEXT_DATA__", "NOT_FOUND"));
      return { matched: false, caseData: null, diagnostics };
    }

    let payload;
    try {
      payload = JSON.parse(script.textContent || "");
    } catch (_) {
      diagnostics.push(diag("__NEXT_DATA__", "INVALID_JSON"));
      return { matched: false, caseData: null, diagnostics };
    }

    const question = payload
      && payload.props
      && payload.props.pageProps
      && payload.props.pageProps.reduxState
      && payload.props.pageProps.reduxState.page
      && payload.props.pageProps.reduxState.page.question;

    if (!question || typeof question !== "object") {
      diagnostics.push(diag("page.question", "NOT_FOUND"));
      return { matched: false, caseData: null, diagnostics };
    }

    const nextQuestionId = Number(question.id);
    const idMatches = Boolean(urlQuestionId)
      && Number.isFinite(nextQuestionId)
      && nextQuestionId === urlQuestionId;

    diagnostics.push(diag(
      "NEXT_DATA_ID_MATCH",
      idMatches ? "OK" : "FAIL",
      idMatches ? null : "Question id in __NEXT_DATA__ does not match current URL"
    ));

    if (!idMatches) {
      diagnostics.push(diag("NEXT_DATA_STALE", "TRUE"));
      return { matched: false, caseData: null, diagnostics };
    }

    const normalizedAnswers = normalizeAnswers(question, diagnostics);
    const attachments = normalizeFiles(question.files, diagnostics, "attachments");
    const publishedAt = unixSecondsToIso(question.datePublish)
      || unixSecondsToIso(question.dateCreate);

    const caseData = {
      id: nextQuestionId,
      url: normalizeQuestionUrl(question, locationObject),
      title: utils.normalizeWhitespace(question.title),
      questionText: utils.htmlToPlainText(question.text),
      publishedAt,
      city: utils.normalizeWhitespace(question.city && question.city.name),
      category: {
        name: utils.normalizeWhitespace(question.category && question.category.name),
        path: question.category && typeof question.category.url === "string"
          ? question.category.url
          : null
      },
      answersCount: normalizedAnswers.answersCount,
      answers: normalizedAnswers.answers,
      attachments,
      status: null,
      platformState: {
        answered: Boolean(question.answered),
        canIChat: question.canIChat == null ? null : Boolean(question.canIChat),
        isPaid: Boolean(question.labels && question.labels.isPaid),
        isClosed: Boolean(question.labels && question.labels.isClosed),
        isCanceled: Boolean(question.labels && question.labels.isCanceled),
        isPrivate: question.labels && question.labels.isPrivate != null
          ? question.labels.isPrivate
          : null,
        isUrgent: Boolean(question.labels && question.labels.isUrgent)
      }
    };

    [
      ["title", caseData.title],
      ["questionText", caseData.questionText],
      ["publishedAt", caseData.publishedAt],
      ["city", caseData.city],
      ["category", caseData.category.name]
    ].forEach(([field, value]) => {
      diagnostics.push(diag(field, value ? "OK" : "NOT_FOUND"));
    });

    return {
      matched: true,
      caseData,
      diagnostics
    };
  }

  extractor.extractQuestionIdFromLocation = extractQuestionIdFromLocation;
  extractor.extractNextDataCase = extractNextDataCase;
})(globalThis);
