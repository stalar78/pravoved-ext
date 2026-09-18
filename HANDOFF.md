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

После browser acceptance найден реальный вопрос `5043426` с тремя PDF-вложениями.

Добавлены два уровня извлечения:

1. whitelist normalization `question.files.items` из `__NEXT_DATA__`;
2. fallback по видимым attachment links внутри DOM question root.

Результаты объединяются с дедупликацией по URL/имени.

Схема считается реализованной как best-effort и требует повторного browser acceptance
на вопросе `5043426`.

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

## Browser acceptance

Вопрос `5043426` проверен на живом Pravoved.

Подтверждено:

- ID = `5043426`;
- title/date/city/category извлекаются корректно;
- answersCount = 3;
- три ответа извлекаются полностью;
- нумерация ответов начинается с 1;
- категория выводится без raw URL;
- три PDF-вложения извлекаются:
  - `Возражения_на_отзыв_.pdf`;
  - `Отзыв_на_исковое_заявление_обезличен~.pdf`;
  - `Исковое заявление_обезличенное.pdf`;
- attachment URLs ведут на `/upload/<id>/`.

## Что ещё требуется

1. Проверить сохранение статуса `SKIP / ANSWER / LEAD` после reload.
2. Проверить переход между двумя вопросами без reload.
3. Реализовать полноценный DOM fallback остальных полей на подтверждённых селекторах.

## Scope вне этапа

Не добавлялись:

- Pravoved API;
- backend;
- OpenAI API;
- Telegram;
- pravovedLM integration;
- auto-posting;
- React/npm/build-chain.


## UI acceptance finding

Панель перенесена из нижнего правого угла в верхний правый (`top: 96px`), чтобы не
мешать интерфейсу чата Pravoved.
