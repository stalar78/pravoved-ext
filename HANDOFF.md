# HANDOFF

## Завершённый этап

`v0.1-B1 — Structured Pravoved question extraction`

## Архитектурное решение

Primary source:

`#__NEXT_DATA__ -> props.pageProps.reduxState.page.question`

DOM остаётся fallback.

Structured data используется только после проверки, что `question.id` совпадает с ID
из текущего `location.pathname`.

Весь `__NEXT_DATA__` / Redux state не копируется, не логируется и не сохраняется.

## Что реализовано

- `src/extractor/next-data.js` как primary extractor.
- Извлечение question ID из URL.
- Безопасный `JSON.parse` для `#__NEXT_DATA__`.
- Whitelist normalization вопроса.
- HTML -> plain text для вопроса и ответов.
- Нормализация:
  - ID;
  - URL;
  - title;
  - questionText;
  - publishedAt;
  - city;
  - category;
  - answersCount;
  - answers;
  - attachments;
  - raw platform state.
- Проверка `NEXT_DATA_ID_MATCH`.
- Диагностика `NEXT_DATA_STALE`.
- Lifecycle watcher для client-side navigation.
- Повторная extraction, пока `__NEXT_DATA__` остаётся stale.
- Сохранение существующих `SKIP / ANSWER / LEAD`.
- Formatter `=== PRAVOVED CASE ===`.
- Панель перенесена из нижнего правого угла в верхний правый.

## Attachments

Используются два уровня:

1. whitelist normalization `question.files.items` из `__NEXT_DATA__`;
2. fallback по видимым attachment links внутри DOM question root.

Результаты объединяются с дедупликацией по URL/имени.

## Live browser acceptance

Проверен вопрос `5043426`.

Подтверждено:

- ID/title/date/city/category;
- answersCount = 3;
- три полных ответа;
- one-based numbering;
- три PDF-вложения;
- attachment URLs вида `/upload/<id>/`;
- copy formatter output;
- статусы сохраняются после F5/reload;
- переход на другой вопрос без reload обновляет кейс;
- stale data предыдущего вопроса не остаётся;
- верхнее правое положение панели не мешает чату.

Дополнительно ранее использовался контрольный вопрос `5043324` без вложений.

## Следующий этап

`v0.1-B2 — Regression coverage and DOM fallback hardening`

Приоритет:

1. создать обезличенные минимальные fixtures без сырых данных авторизованного кабинета;
2. добавить regression tests для structured extraction;
3. закрепить кейсы: без файлов / несколько ответов / несколько файлов / stale ID;
4. усилить DOM fallback для основных полей;
5. не менять working contract formatter/status storage без необходимости.

## Scope вне проекта на текущем этапе

Не добавлены:

- Pravoved API;
- backend;
- OpenAI API;
- Telegram;
- pravovedLM integration;
- auto-posting;
- React/npm/build-chain.
