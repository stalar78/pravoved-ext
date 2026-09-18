# ACTIVE TASK

**v0.1-B2 — Regression coverage and DOM fallback hardening**

Этапы `v0.1-B1 — Structured Pravoved question extraction` и
`v0.1-C1 — Attachment Download UX` завершены и прошли browser acceptance.

## Цель следующего этапа

Закрепить рабочий parser автоматическими regression fixtures/tests и усилить DOM fallback,
не добавляя внешние API или автоматическую отправку данных.

## Acceptance v0.1-C1

Подтверждено:

- кнопка `Скачать вложения (N)` появляется только при наличии файлов;
- одно нажатие запускает загрузку всех вложений;
- файлы сохраняются с исходными именами;
- файлы группируются в `Downloads/Pravoved/<question_id>/`;
- загрузка не требует Save As;
- Copy / SKIP / ANSWER / LEAD продолжают работать;
- на вопросах без вложений download-кнопка скрыта.

## Ограничения для v0.1-B2

- не коммитить сырой HTML авторизованного Pravoved;
- fixtures должны быть обезличенными/минимальными;
- не добавлять Pravoved API, backend, OpenAI API, Telegram или pravovedLM integration;
- не менять рабочую semantics статусов, formatter и downloads без отдельной причины.
