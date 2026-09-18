(function initChatGptFormatter(global) {
  const root = global.PravovedExt = global.PravovedExt || {};
  const formatter = root.formatter = root.formatter || {};
  const utils = root.utils;

  function formatCategory(category) {
    if (!category) {
      return "NOT_FOUND";
    }

    const parts = [];
    if (category.name) {
      parts.push(String(category.name));
    }
    if (Array.isArray(category.path) && category.path.length > 0) {
      parts.push(category.path.join(" > "));
    }

    return utils.displayValue(parts.join(" / "));
  }

  function formatAnswer(answer, index) {
    const item = answer || {};
    return [
      `--- Ответ ${index} ---`,
      "Юрист:",
      utils.displayValue(item.author),
      "Дата/время:",
      utils.displayValue(item.publishedAt),
      "Текст:",
      utils.displayValue(item.text)
    ].join("\n");
  }

  function formatAttachment(attachment, index) {
    const item = attachment || {};
    const name = utils.displayValue(item.name);
    const url = item.url ? ` — ${item.url}` : "";
    const type = item.type ? ` [${item.type}]` : "";
    return `${index}. ${name}${type}${url}`;
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
