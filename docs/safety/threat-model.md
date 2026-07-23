---
type: Threat Model
title: Модель угроз v0.1
description: Активы, доверенные границы, основные угрозы и меры защиты локального очистителя.
tags: [safety, threat-model, privacy, supply-chain]
status: approved
owner: Architect
date: 2026-07-19
---

# Контекст

Продукт запускается с правами текущего пользователя, читает разрешённые области домашней библиотеки и может перемещать отдельно подтверждённые объекты в собственный карантин. Full Disk Access необязателен. `sudo`, privileged helper, LaunchDaemon и system extension отсутствуют.

# Защищаемые активы

1. Пользовательские и прикладные данные на исходных путях.
2. Payload и manifests карантина, необходимые для восстановления.
3. Целостность системных настроек и объектов автозапуска.
4. Приватность локальных путей, имён и evidence.
5. Целостность опубликованных сборок и зависимостей.
6. Целостность пользовательских exclusions и schedule state.
7. Отсутствие персональных данных разработчика в публичном bundle.
8. Конфиденциальность local correlation graph, installation key, bundle/package/signing claims и destructive tokens.
9. Целостность coverage certificates и immutable correlation revision.
10. Целостность authoritative owner bindings и server-owned requirement profiles.

# Не рассматриваемый основной противник

Процесс с тем же UID и полным доступом к файлам пользователя может изменить локальные данные независимо от очистителя. Полная защита от такого malware не заявляется. При этом продукт обязан безопасно обрабатывать созданные им ловушки: ссылки, mount points, гонки, необычные имена и повреждённые manifests.

# Угрозы и меры

| Угроза | Риск | Обязательная мера |
|---|---|---|
| TOCTOU между аудитом и действием | Перемещение заменённого объекта | Два snapshot при аудите, повторная проверка fingerprint непосредственно перед rename |
| Симлинк, hardlink или path traversal | Выход за allowlist | Компонентная нормализация, `lstat`, запрет follow-links, проверка ancestry и inode |
| Mount point или другой том | Частичный copy-delete вместо rename | Проверка mount ID и device; только same-volume atomic rename |
| Поддельный plist, receipt или bundle ID | Ошибочная принадлежность | Источники считаются недоверенными; несколько независимых evidence и named rules |
| Вредоносное имя файла или вывод процесса | Command injection и утечка | Никакого shell interpolation; аргументы передаются массивом; вывод парсится и редактируется |
| Повторный или параллельный tool call | Двойное действие | `operationId`, одноразовый token, блокировка объекта и идемпотентный replay |
| Prompt injection в имени или содержимом | Обход политики через модель | Содержимое не читается как инструкции; модель не получает mutation-tools и пути |
| Widget подменяет safe facts или action handle | UI становится источником identity/policy | Widget получает только safe view; token/graph остаются server-side и revalidate по revision |
| Совпадение имени с удалённым приложением | Личные или shared-данные приняты за остаток | Owner, installed state, process, receipt, dependency, temporal и data-kind evidence проверяются раздельно |
| Library artifact принят за app bundle | Artifact existence ошибочно используется как owner executable/installed state | Разные `library_artifact`/`owner_application` subjects и отдельные fact states; legacy target-executable analysis-only |
| Эвристика выдаёт owner binding | Чужой cache/log получает mutation authority | Только authoritative `remnant_of` из exact receipt payload, OS-owned metadata или validated signed process/open-file history |
| Historical binding устарел или перенесён | Новый объект наследует authority старого владельца | Installation-keyed digests; invalidation при rekey, version/root/type/artifact/owner mismatch и strong counter-evidence |
| Клиент выбирает удобный policy profile | UI/модель пропускает обязательную проверку | Profile и applicability только server-owned, versioned и привязаны к correlation revision/token |
| `not_applicable` подменяет `absent`/`unknown` | Failed query или dependency исчезают из policy | Типизированная applicability не выпускает certificate, не заменяет query и не подавляет positive evidence |
| Рискованная Library category получила карантин | Потеря настроек, sync state, saves или базы | v0.1 actionable только для private regenerable cache/log; остальные categories принудительно inspect-only |
| Независимые opaque refs ошибочно объединены | Чужой installed/process/receipt evidence применён к candidate | Server-only subjects/edges, typed claims, versioned rules; `targetRef` не является identity |
| Пустой или частичный source output принят за отсутствие | Candidate получает ложное negative evidence | `absent` только с completeness certificate полного same-snapshot query; иначе `unknown` |
| Долгий аудит удерживает локальные ресурсы | Большой набор кандидатов проверяется дольше ожидаемого | Bounded concurrency восемь, живой progress, явный `audit_cancel` и таймауты отдельных subprocess; общего автоматического deadline нет, частичная revision не публикуется |
| Path/display name/bundle/package/signer field выбран как единственное совпадение | Name-only resolution разрешает mutation | Claims дают candidate sets; resolved edge требует authoritative или независимые corroborated claims |
| Несколько совместимых identities | Resolver произвольно выбирает владельца | `ambiguous` без scoring fallback; mutation блокируется |
| Snapshot source изменился во время query | Positive counter-evidence исчезает между аудитом и действием | Snapshot A/B, source-query fingerprints, `staleDuringAudit`, immutable correlation revision |
| Пароль, token или subscription URL в конфигурации | Утечка в модель, лог, fixture или PR | Safe Metadata Filter редактирует до persistence; raw keys/values не сохраняются |
| Forged finding для credential/browser-profile/personal/project/plugin/Codex scope | Обход UI-исключения | Неизменяемый универсальный Protected Scope Registry до кандидата и перед mutation |
| Path-only exclusion скрывает новый объект | Опасный finding не показывается после замены файла | Stable identity match по rule/type/owner/bundle-package/signing/normalized target; mismatch снова показывает finding |
| Plain hash/salt exclusion раскрывает локальный inventory | Bundle/package/path восстанавливаются словарным перебором | Installation-local HMAC key, domain separation и отсутствие plaintext claims в store |
| Legacy exclusion мигрирует неоднозначно | Старое правило скрывает другой объект | Atomic validated migration; `migration_required` оставляет finding видимым и блокирует tokens |
| Excluded finding получает preview | Mutation объекта вопреки решению пользователя | Exclusion проверяется до дорогого анализа и перед token issuance; preview запрещён |
| Повреждённая или новая schema exclusions | Тихая потеря правил либо скрытие findings | Versioned migrations; неизвестная schema не скрывает findings и блокирует destructive-token issuance |
| Forged schedule request или lifecycle click в v0.1 | Скрытая automation или ложный release claim | Инертный contract skeleton, disabled UI, fail-closed lifecycle outcome и отсутствие opaque automation ID |
| Отсутствующая host capability | Скрытый cron/LaunchAgent fallback | Disabled/manual-run state; никаких альтернативных scheduler-компонентов |
| Будущий scheduled run запускает mutation | Фоновое удаление без решения пользователя | Post-v0.1 owner decision, фиксированный read-only prompt, пустые mutation credentials/tokens и отдельные CMC-13 tests |
| Персональные данные разработчика попали в public package | Утечка путей, app inventory или решений владельца | Synthetic-only fixtures, package allowlist и privacy scan docs/snapshots/logs/PR evidence |
| Raw correlation input попал в test snapshot или PR evidence | Публичная утечка app inventory/signing/package claims или token | Seeded runtime fixture builder; checked-in golden содержит только safe view/digests; privacy canary scan |
| Официальный uninstaller проигнорирован | Неполное или небезопасное ручное удаление | Uninstaller evidence становится recommended method и блокирует manual quarantine, когда применим |
| Системная находка вне v0.1 | Опасная инструкция с `sudo` или mutation `/Library` | Только `unsupported_manual`, без mutation actions и готовой команды |
| APFS accounting интерпретирован как результат purge | Ложное обещание освобождённого места | StorageSummary и DiskObservation разделены; причинный delta не вычисляется |
| Повреждение журнала или manifest | Потеря возможности восстановить | Atomic write, fsync до rename, schema validation, fail-closed recovery |
| Подмена destination | Перемещение вне карантина | Путь payload вычисляет сервер; карантин имеет фиксированный root и строгие права |
| Перезапись при restore | Потеря нового объекта | Restore только в исходный свободный путь; конфликт блокирует действие |
| Очистка через ссылку внутри payload | Удаление вне карантина | Purge не следует ссылкам и проверяет containment каждого удаляемого объекта |
| Злонамеренная или подменённая сборка | Выполнение чужого кода | Checksums, SBOM, provenance, фиксированные зависимости и воспроизводимый release flow |

# Trust boundaries

* Диалог → model-visible MCP tool: все inputs проходят schema validation.
* Widget → app-visible mutation-tool: UI-сессия и preview token не заменяют серверную политику.
* Adapters → Correlation Resolver: raw local claims существуют только в памяти сервера; adapters и OS output недоверенны.
* Correlation Resolver → Policy Engine: только immutable revision, typed facts и coverage certificates; safe view не является authority.
* Widget → schedule skeleton: в v0.1 MCP App не создаёт host action и показывает только disabled/manual-run fallback; post-v0.1 bridge остаётся отдельной boundary.
* Сервер → ОС и файловая система: все ответы ОС и пути считаются изменяемыми.
* Release pipeline → пользователь: артефакт должен быть связан с исходным коммитом и checksum.

# Остаточные риски

* Без Full Disk Access аудит может быть неполным; продукт показывает coverage gap, а не делает вывод об отсутствии остатков.
* Размер каталога может измениться после аудита; действие разрешается только при совпавшем fingerprint, но размер в отчёте остаётся оценкой ревизии.
* Компрометация процесса с тем же UID после подтверждения может нарушить локальное состояние; recovery должен остановиться на противоречии.
* Анализ владельца артефакта не может быть абсолютно точным; поэтому risk-категории остаются analysis-only.
* `DiskObservation` может изменяться из-за APFS snapshots, compression и других процессов; продукт показывает время наблюдения и не приписывает delta себе.
* Codex automation capability может отсутствовать или изменить контракт; v0.1 вообще не обещает расписание, а post-v0.1 capability нельзя заявить без отдельного owner decision и подтверждённого host result.
* Stable identity может быть неполной для необычного объекта; в этом случае exclusion не совпадает, finding остаётся видимым, а mutation работает fail closed.
* macOS sources не дают общей транзакционной snapshot API; logical Snapshot A/B и fingerprints обнаруживают известные изменения, но неопределённость остаётся `unknown`.
* Installation key в файле `0600` не защищает от уже скомпрометированного процесса того же UID; продукт ограничивает переносимость и dictionary attack, но не заявляет защиту от такого malware.
* Rekey делает старые digests несопоставимыми; recovery требует поддержанной migration либо явного пересоздания exclusions и до этого блокирует token issuance.
* На первом аудите authoritative owner binding может отсутствовать; продукт сознательно оставляет такой finding inspect-only и может накопить безопасную historical relation только из будущего наблюдения.
* Полный аудит большого числа кандидатов может выполняться долго и потреблять
  локальные CPU/IO до завершения или явной отмены. Concurrency и subprocess
  ограничены, progress остаётся видимым, но продукт не обещает верхнюю границу
  времени и не запускает такой аудит автоматически в v0.1.

# Проверка мер

Каждая мера из таблицы должна иметь автоматический test case или явно отмеченный real-Mac smoke gate. Релиз блокируется, если для destructive-flow отсутствует проверка гонки, восстановления после сбоя или защиты пути.

# Связанные концепты

* [Стратегия тестирования](../quality/test-strategy.md)
* [Критерии приёмки](../quality/acceptance-gates.md)
