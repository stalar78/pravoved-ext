# HANDOFF

## Этап

`v0.1-B1 — Structured Pravoved question extraction`

## Основное архитектурное решение

Primary source:

`#__NEXT_DATA__ -> props.pageProps.reduxState.page.question`

DOM остаётся fallback.

Structured data используется только после проверки, что `question.id` совпадает с ID
из текущего `location.pathname`.

Весь `__NEXT_DATA__` / Redux state не копируется, не логируется и не сохраняется.

## Что реализовано

- Новый модуль `src/extractor/next-data.js`.
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
  - raw platform state.
- Проверка `NEXT_DATA_ID_MATCH`.
- Диагностика `NEXT_DATA_STALE`.
- DOM fallback при отсутствии/ошибке/stale structured data.
- Lifecycle watcher для client-side navigation.
- Повторная extraction, пока `__NEXT_DATA__` остаётся stale.
- Сохранение существующих SKIP / ANSWER / LEAD и formatter contract.

## Attachments

На имеющемся реальном HTML вопроса `question.files.total === 0`.

Поэтому ненулевая схема `files.items` ещё не считается подтверждённой.

Если `files.total > 0`, extractor не падает, а возвращает пустой массив и diagnostic
`UNSUPPORTED`.

## Контрольный реальный кейс

Question ID:

`5043324`

Ожидаемые данные:

- город: Барнаул;
- категория: Автомобильное право;
- answersCount: 1;
- один ответ;
- автор ответа: Мирошкина Надежда;
- question attachments: 0.

## Что ещё требуется

1. Browser acceptance на живой странице Pravoved.
2. Проверить copy output.
3. Проверить сохранение статуса.
4. Проверить переход между двумя вопросами без reload.
5. Получить реальный вопрос с одним или несколькими вложениями.
6. После этого реализовать и проверить attachments schema.
7. Реализовать полноценный DOM fallback на подтверждённых селекторах.

## Scope вне этапа

Не добавлялись:

- Pravoved API;
- backend;
- OpenAI API;
- Telegram;
- pravovedLM integration;
- auto-posting;
- React/npm/build-chain.
