# ACTIVE TASK

**v0.1-F4 — One-click Full Chat Copy**

Цель этапа — копировать всю доступную переписку Pravoved private chat одной кнопкой,
без ручного выделения текста и прокрутки истории.

Работает только на:

`https://pravoved.ru/private/chat/<chat_id>/`

## UX

В нижней панели чата рядом с файловым контролом:

`Скопировать чат`

Во время работы:

- `догружаю историю: N`;
- `готовлю текст…`;
- после успеха: `чат скопирован: N сообщений`.

Кнопка доступна независимо от наличия новых файлов.

## Loading older messages

Перед копированием extension пытается автоматически догрузить ранние сообщения:

1. находит scroll-container ленты `.dialog__items-inner`;
2. программно поднимается к началу;
3. ждёт появления дополнительных `.dialog-message`;
4. повторяет до стабилизации количества либо до bounded limit;
5. восстанавливает прежнюю позицию относительно низа чата.

Пользователю не нужно вручную прокручивать историю.

## What is copied

Только сообщения диалога из `.dialog__items-inner .dialog-message`.

Role:

- `.dialog-message--align-right` -> `ЮРИСТ`;
- остальные message bubbles -> `КЛИЕНТ`.

Для каждого сообщения сохраняются:

- порядковый номер;
- роль;
- время, если доступно;
- текст;
- вложения и их Pravoved upload URL.

Служебные notice/status blocks вне `.dialog-message` не копируются.

## Output

```
=== PRAVOVED CHAT ===

URL:
...

CHAT ID:
...

Количество сообщений:
...

ПЕРЕПИСКА:
--- Сообщение 1 · КЛИЕНТ ---
...

--- Сообщение 2 · ЮРИСТ ---
...

=== END CHAT ===
```

## Safety

- ничего не отправляется в чат;
- содержание сообщений не сохраняется в chrome.storage;
- копирование происходит только по явному нажатию;
- DOM сообщения не изменяется;
- после копирования текст находится только в clipboard пользователя.

## Acceptance target

На длинном реальном чате:

- кнопка видна рядом с download-control;
- ручная прокрутка/выделение не нужны;
- ранние и последние сообщения присутствуют в copied transcript;
- входящие сообщения имеют role `КЛИЕНТ`;
- наши сообщения имеют role `ЮРИСТ`;
- вложения указаны рядом с соответствующими сообщениями;
- служебная строка `Собеседник сейчас не в сети...` не попадает в transcript;
- после операции viewport возвращается примерно на прежнее место.


## Live bug: initial 50-message window

Observed in browser:
- chat contains 66 messages;
- initial Pravoved render exposes only 50;
- first F4 loader could still copy only those 50 unless the user manually scrolled to the very top first.

Fix in v0.1.13:
- no longer relies on a single guessed scroll container;
- drives all plausible chat/page scroll containers to the top;
- explicitly exposes the first message bubble with `scrollIntoView({block:"start"})`;
- waits for an actual history change instead of a fixed 450 ms;
- treats both message-count growth and change of the first visible message as progress;
- repeats until four consecutive top exposures produce no older history;
- restores the user's previous bottom-relative viewport after loading.

Acceptance target:
- on the known 66-message chat, clicking `Скопировать чат` from the initial 50-message state must automatically progress to 66 and copy all 66 without manual scrolling.
