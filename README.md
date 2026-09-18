# Pravoved Case Assistant

Chrome Extension Manifest V3 для рабочего процесса на pravoved.ru.

Расширение извлекает данные конкретного вопроса, формирует структурированный блок для
ChatGPT и хранит локальный статус кейса `SKIP / ANSWER / LEAD`.

Расширение не отправляет данные наружу и не взаимодействует с API Pravoved, OpenAI,
Telegram или pravovedLM.

## Extraction strategy

Основной источник данных — структурированное состояние страницы Next.js:

`#__NEXT_DATA__ -> props.pageProps.reduxState.page.question`

Перед использованием structured data расширение сверяет `question.id` с ID текущего
URL `/question/<id>/`.

Если ID не совпадает, данные считаются stale. Расширение не должно сохранять или
показывать кейс предыдущего вопроса.

DOM parsing используется как fallback.

Важно: расширение никогда не копирует и не сохраняет весь `__NEXT_DATA__` или Redux
state. В нормализованную модель попадает только whitelist полей конкретного вопроса.

## Поддерживаемые данные

- ID и URL;
- заголовок и полный текст вопроса;
- дата;
- город;
- категория;
- количество ответов;
- полные ответы юристов с автором и датой;
- вложения вопроса;
- локальный статус `SKIP / ANSWER / LEAD`.

Вложения извлекаются structured-first из `question.files.items` и дополняются
видимыми attachment links из DOM с дедупликацией.

## Архитектура

- `src/extractor/next-data.js` — primary structured extraction;
- `src/extractor/metadata.js`, `question.js`, `answers.js`, `attachments.js` — fallback extraction;
- `src/extractor/selectors.js` — централизованные DOM-селекторы;
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

## Browser acceptance v0.1-B1

На живом Pravoved подтверждены:

- structured extraction вопроса;
- несколько ответов;
- три PDF-вложения на вопросе `5043426`;
- copy output;
- сохранение статуса после reload;
- переход между вопросами без reload;
- защита от stale structured data;
- панель в верхнем правом углу без перекрытия чата.

## Текущий этап

`v0.1-B2 — Regression coverage and DOM fallback hardening`

Следующая задача — закрепить рабочий parser обезличенными regression fixtures/tests и
усилить DOM fallback.

## Ограничения

- не хранить сырой HTML авторизованного Pravoved в репозитории;
- нет backend и внешних API;
- нет автоматической публикации ответов;
- нет интеграции с pravovedLM;
- нет React/npm/build-chain.
