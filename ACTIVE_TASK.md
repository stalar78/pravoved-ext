# ACTIVE TASK

**v0.1-B1 — Structured Pravoved question extraction**

Цель этапа — извлекать кейс с индивидуальной страницы Pravoved через структурированные
данные Next.js и сохранять DOM parsing как fallback.

## Текущий подход

Primary source:

`#__NEXT_DATA__ -> props.pageProps.reduxState.page.question`

DOM parsing:

резервный путь на случай отсутствия, повреждения или устаревания structured data.

## Обязательные требования

- ID вопроса валидируется по `location.pathname`.
- Если ID в `__NEXT_DATA__` не совпадает с URL, structured data считается stale.
- Весь Redux state никогда не копируется и не сохраняется.
- В нормализованную модель попадают только whitelist-поля конкретного вопроса.
- HTML вопроса и ответов преобразуется в plain text.
- SPA-навигация не должна оставлять в панели данные предыдущего вопроса.
- Attachments извлекаются structured-first с DOM fallback; live acceptance на вопросе 5043426 с тремя PDF пройден.
