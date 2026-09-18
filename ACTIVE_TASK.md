# ACTIVE TASK

**v0.1-B2 — Regression coverage and DOM fallback hardening**

Этап `v0.1-B1 — Structured Pravoved question extraction` завершён и прошёл
browser acceptance на живом Pravoved.

## Цель следующего этапа

Закрепить рабочий parser автоматическими regression fixtures/tests и усилить DOM fallback,
не добавляя внешние API или автоматическую отправку данных.

## Исходная рабочая архитектура

Primary source:

`#__NEXT_DATA__ -> props.pageProps.reduxState.page.question`

Fallback:

подтверждённые DOM-структуры страницы вопроса.

## Acceptance v0.1-B1

Подтверждено:

- structured extraction вопроса;
- ответы юристов;
- HTML -> plain text;
- три PDF-вложения на вопросе `5043426`;
- статусы `SKIP / ANSWER / LEAD` сохраняются после reload;
- переход между вопросами без reload обновляет кейс и не оставляет stale data;
- панель перенесена в верхний правый угол и не мешает чату.

## Ограничения для v0.1-B2

- не коммитить сырой HTML авторизованного Pravoved;
- fixtures должны быть обезличенными/минимальными;
- не добавлять Pravoved API, backend, OpenAI API, Telegram или pravovedLM integration;
- не менять рабочую semantics статусов и formatter без отдельной причины.
