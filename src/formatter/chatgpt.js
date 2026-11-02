(function initChatGptFormatter(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const formatter = root.formatter = root.formatter || {};
  const utils = root.utils;

  function formatCategory(category) {
    if (!category) {
      return "NOT_FOUND";
    }

    if (category.name) {
      return utils.displayValue(category.name);
    }

    if (Array.isArray(category.path) && category.path.length > 0) {
      return utils.displayValue(category.path.join(" > "));
    }

    return "NOT_FOUND";
  }

  function formatClientFollowUp(item, index) {
    const followUp = item || {};
    return [
      `--- Дополнение клиента ${index + 1} ---`,
      "Клиент:",
      utils.displayValue(followUp.author),
      "Дата/время:",
      utils.displayValue(followUp.publishedAt),
      "Текст:",
      utils.displayValue(followUp.text)
    ].join("\n");
  }

  function formatAnswer(answer, index) {
    const item = answer || {};
    const followUps = Array.isArray(item.clientFollowUps)
      ? item.clientFollowUps
      : [];
    const lines = [
      `--- Ответ ${index + 1} ---`,
      "Юрист:",
      utils.displayValue(item.author),
      "Дата/время:",
      utils.displayValue(item.publishedAt),
      "Текст:",
      utils.displayValue(item.text)
    ];

    if (followUps.length > 0) {
      lines.push(
        "",
        "ДОПОЛНЕНИЯ КЛИЕНТА К ЭТОМУ ОТВЕТУ:",
        followUps.map(formatClientFollowUp).join("\n\n")
      );
    }

    return lines.join("\n");
  }

  function formatAttachment(attachment, index) {
    const item = attachment || {};
    const name = utils.displayValue(item.name);
    const url = item.url ? ` — ${item.url}` : "";
    const type = item.type ? ` [${item.type}]` : "";
    return `${index + 1}. ${name}${type}${url}`;
  }

  function formatForChatGpt(caseData) {
    const data = caseData || {};
    const answers = Array.isArray(data.answers) ? data.answers : [];
    const attachments = Array.isArray(data.attachments) ? data.attachments : [];
    const answerBlock = answers.length > 0
      ? answers.map(formatAnswer).join("\n\n")
      : "NOT_FOUND";
    const attachmentBlock = attachments.length > 0
      ? attachments.map(formatAttachment).join("\n")
      : "NOT_FOUND";

    return [
      "=== PRAVOVED CASE ===",
      "",
      "URL:",
      utils.displayValue(data.url),
      "",
      "ID:",
      utils.displayValue(data.id),
      "",
      "Заголовок:",
      utils.displayValue(data.title),
      "",
      "Дата:",
      utils.displayValue(data.publishedAt),
      "",
      "Город:",
      utils.displayValue(data.city),
      "",
      "Категория:",
      formatCategory(data.category),
      "",
      "Количество ответов:",
      utils.displayValue(data.answersCount),
      "",
      "ВОПРОС КЛИЕНТА:",
      utils.displayValue(data.questionText),
      "",
      "ОТВЕТЫ ЮРИСТОВ:",
      answerBlock,
      "",
      "ВЛОЖЕНИЯ:",
      attachmentBlock,
      "",
      "=== END CASE ==="
    ].join("\n");
  }

  formatter.formatForChatGpt = formatForChatGpt;
})(globalThis);
