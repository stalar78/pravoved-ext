# ACTIVE TASK

**v0.1-D1 — Chat New Attachments**

Цель этапа — добавить отдельный режим расширения для страниц:

`https://pravoved.ru/private/chat/<chat_id>/`

В чате расширение работает только с файлами клиента и предлагает скачать только те
вложения, которые ещё не были скачаны.

## DOM contract

Подтверждено на реальном HTML Pravoved:

- текущий chat ID берётся из `/private/chat/<id>/`;
- поток сообщений находится в `.dialog__items-inner`;
- наши сообщения имеют класс `.dialog-message--align-right`;
- входящие файлы клиента находятся внутри остальных `.dialog-message`;
- attachment link: `a.files__link[href*="/upload/"]`;
- upload ID берётся из `/upload/<id>/`;
- имя файла берётся из `download` attribute;
- вкладка «Файлы» использует отдельные `.dialog-files__link` и не участвует в
  extraction, чтобы не получать дубли и не смешивать стороны.

## New-only semantics

Для каждого chat ID локально хранится набор уже скачанных upload ID:

`pravoved.chat.<chat_id>.downloadedUploads`

При открытии чата расширение:

1. извлекает только client attachments из message stream;
2. загружает сохранённую локальную историю;
3. для неизвестных ID best-effort проверяет Chrome download history;
4. completed downloads автоматически считаются уже скачанными;
5. кнопка работает только с оставшимися new attachments.

После успешного запуска загрузки/ZIP upload IDs сохраняются в локальную историю.

## UX

Контрол вставляется в свободную область:

`.dialog__input-buttons-right`

Поведение:

- 0 новых файлов -> `Новых файлов нет`;
- 1 новый файл -> `Скачать новый файл`;
- 2+ новых файлов -> `Скачать новые ZIP (N)`.

Single-file download:

`Downloads/Pravoved/chat-<chat_id>/<filename>`

Multi-file:

`Pravoved-chat-<chat_id>-YYYYMMDD-HHMM.zip`

## Safety

- сырой HTML клиента не коммитится;
- текст переписки не сохраняется расширением;
- имена клиентов не сохраняются;
- сохраняются только chat ID и upload ID;
- берутся только ссылки Pravoved;
- файлы не отправляются во внешние сервисы.

## Dependency

Этап основан на:

`v0.1-C2 — Adaptive ZIP Download`

D1 ведётся отдельным stacked PR и не должен сливаться раньше C2.

## Acceptance target

На чате `2022051`:

- собственные сообщения юриста не считаются источником файлов;
- вкладка «Файлы» не создаёт дублей;
- ранее скачанные upload ID не предлагаются повторно;
- несколько новых файлов скачиваются одним ZIP;
- после успешной загрузки кнопка меняется на `Новых файлов нет`;
- новый файл, появившийся позднее без reload, появляется в контроле в течение ~1 сек.
