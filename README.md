# Pravoved Case Assistant

Chrome Extension Manifest V3 для рабочего процесса на pravoved.ru.

Расширение извлекает данные конкретного вопроса, формирует структурированный блок для
ChatGPT и хранит локальный статус кейса `SKIP / ANSWER / LEAD`.

Расширение не отправляет данные наружу и не взаимодействует с API Pravoved, OpenAI,
Telegram или pravovedLM.

## Extraction strategy

Основной источник данных — структурированное состояние страницы Next.js:

`#__NEXT_DATA__ -> props.pageProps.reduxState.page.question`

Это устойчивее, чем хэшированные CSS-классы frontend.

Перед использованием structured data расширение сверяет:

`question.id`

с ID текущего URL:

`/question/<id>/`

Если ID не совпадает, данные считаются stale и используется DOM fallback с повторной
проверкой после client-side navigation.

DOM parsing остаётся резервным механизмом.

Важно: расширение никогда не копирует и не сохраняет весь `__NEXT_DATA__` или Redux
state. В нормализованную модель попадает только whitelist полей конкретного вопроса.

## Архитектура

- `src/extractor/next-data.js` — primary structured extraction;
- `src/extractor/metadata.js`, `question.js`, `answers.js`, `attachments.js` — DOM fallback;
- `src/extractor/selectors.js` — централизованные подтверждённые DOM-селекторы;
- `src/formatter/` — преобразование внутренней модели кейса в текст;
- `src/ui/` — Shadow DOM-панель;
- `src/storage/` — `chrome.storage.local`;
- `src/utils/` — нормализация текста и HTML -> plain text;
- `src/content.js` — orchestration и lifecycle SPA-навигации.

Файлы подключаются напрямую через `content_scripts` без npm и build-chain.

## Установка

1. Откройте `chrome://extensions`.
2. Включите Developer mode.
3. Нажмите Load unpacked.
4. Выберите каталог `pravoved-ext`.
5. Откройте страницу вида `https://pravoved.ru/question/<id>/`.

## Текущий этап

`v0.1-B1 — Structured Pravoved question extraction`

Поддерживается извлечение structured question data, ответов и базовых metadata.
Схема вложений ещё не подтверждена на реальном вопросе с файлами, поэтому ненулевые
attachments пока помечаются диагностикой как unsupported.

## Ограничения

- DOM fallback пока неполный;
- реальная схема вложений ещё не validated;
- нет backend и внешних API;
- нет автоматической публикации ответов;
- нет интеграции с pravovedLM.
