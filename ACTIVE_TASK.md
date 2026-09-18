# ACTIVE TASK

**v0.1-C1 — Attachment Download UX**

Цель этапа — добавить в панель расширения ручную загрузку всех вложений текущего
вопроса одной кнопкой.

## UX

Если у вопроса есть вложения:

`Скачать вложения (N)`

Если вложений нет, кнопка скрыта.

По нажатию расширение последовательно запускает загрузку каждого файла через
`chrome.downloads.download()` и сохраняет исходное имя файла.

## Архитектура

- content script передаёт только whitelist attachment metadata;
- MV3 service worker `src/background.js` выполняет загрузки;
- разрешены только HTTP(S)-ссылки `pravoved.ru` и его поддоменов;
- используется `downloads` permission;
- `saveAs: false`, `conflictAction: "uniquify"`;
- backend и внешние API не используются.

## Acceptance target

Живой вопрос `5043426`:

- кнопка показывает `Скачать вложения (3)`;
- по одному нажатию запускаются три PDF;
- имена файлов сохраняются;
- существующие Copy / SKIP / ANSWER / LEAD продолжают работать;
- на вопросе без вложений кнопка отсутствует.

## Отложенный следующий этап

`v0.1-B2 — Regression coverage and DOM fallback hardening`
