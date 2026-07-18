---
type: ADR
title: "ADR-0013: actionable correlation для остатков в user Library"
description: Разделение cleanup-артефакта и приложения-владельца, authoritative owner binding и профиль безопасного quarantine v0.1.
tags: [adr, correlation, remnants, library, identity, safety]
status: approved
owner: Architect
date: 2026-07-18
---

# Контекст

ADR-0012 правильно запретил name/path-only resolution и потребовал доказуемую полноту negative evidence. Реализация CMC-21 выявила недостающую семантику: production collector считал самим correlation candidate приложение `.app`, хотя профиль `application_remnants` создаёт cleanup candidates только внутри разрешённых roots пользовательской `~/Library`.

Library-артефакт и приложение-владелец — разные объекты. У каталога cache/log обычно нет executable, signing identity или bundle metadata. Если требовать эти claims у самого артефакта, production flow остаётся навсегда `unknown`. Если считать его имя bundle ID либо без доказательства менять `partial_inventory` на `complete`, safety-инварианты нарушаются.

Дополнительно `targetExecutable` был связан с policy-входом `target_existence`: отсутствие executable удалённого приложения ошибочно означало отсутствие объекта, который пользователь собирается переместить в карантин. Канон также не отделял receipt как доказательство ownership от live receipt как counter-evidence и не определял, когда source неприменим к конкретному policy profile.

# Решение

## 1. Две server-only роли subject

* `LibraryArtifactSubject` — конкретный объект в allowlisted user Library root. Его identity основана на filesystem identity, parent/root containment, owner/type и Snapshot A/B. Именно этот объект является целью quarantine.
* `OwnerApplicationSubject` — приложение или package-owner, которому артефакт доказанно принадлежит. Его identity использует bundle/package/signing/executable claims и собственную provenance.

Роли могут использовать существующие schema kinds `filesystem_object`, `app_bundle` и `package`, но обязаны иметь явный `subjectRole`. Один subject не может одновременно быть cleanup artifact и owner application.

Связь оформляется edge `remnant_of` от `LibraryArtifactSubject` к `OwnerApplicationSubject`. Только `resolved` authoritative edge создаёт owner binding. `belongs_to`, `installed_as` и другие edges не подменяют `remnant_of` автоматически.

## 2. Authoritative owner binding

В v0.1 допустимы три источника:

1. exact package receipt payload mapping: валидный receipt связывает точный artifact identity с package owner;
2. OS-owned container metadata: macOS metadata идентифицирует индивидуальный container и согласуется с filesystem owner/type; shared/group container остаётся ambiguous или inspection-only;
3. installation-local historical binding: во время предыдущего аудита подписанный process/executable однозначно открыл объект внутри artifact; связь сохранена только installation-keyed digests и повторно совпала с owner/type/root claims.

Path, basename, display name, имя каталога, bundle ID по отдельности, похожий signer и user attestation остаются hints. Они могут объяснять finding, но не создают `remnant_of`, exclusion match или mutation authority.

Historical binding не переносится между установками, не содержит raw path/inventory и инвалидируется при rekey, owner/type/root mismatch, ambiguous executable или изменении binding schema.

## 3. Artifact existence отделён от owner executable

`artifactExistenceState` описывает существование и неизменность объекта quarantine. Он строится из Snapshot A/B artifact/parent identity и обязан быть `present` перед preview/move.

`ownerExecutableState` описывает executable приложения-владельца. `absent` здесь может поддерживать orphan classification, но не означает, что cleanup artifact исчез. Старый `targetExecutableState` читается только как legacy analysis-only до migration и не используется как `target_existence` action authority.

Policy input `target_existence` получает только `artifactExistenceState`; owner executable получает отдельный typed input. Token binding продолжает использовать artifact и parent Snapshot B fingerprints.

## 4. Receipt lifecycle

Receipt разделяется на:

* `live` — payload/executable owner всё ещё существует; positive counter-evidence блокирует quarantine;
* `stale` — exact payload mapping доказывает owner binding, но live payload/executable отсутствует; это identity evidence, не автоматическое разрешение;
* `absent` — полный query canonical package database не нашёл mapping;
* `unknown` — permission/capability/parse/coverage/identity gap; действие блокируется.

Сам факт receipt больше не означает одновременно ownership и установленность. `stale` не преобразуется в `absent`.

## 5. Requirement profile и `not_applicable`

Resolver выпускает versioned `CorrelationRequirementProfile`. Для v0.1 единственный actionable профиль — `private_regenerable_remnant_v1`.

Каждый fact имеет applicability `required | not_applicable | unsupported`. `not_applicable`:

* назначается только сервером по profile ID, artifact category и resolved owner binding;
* не является `absent` и не создаёт CoverageCertificate;
* не скрывает positive evidence из другого source;
* входит в immutable correlation revision и token binding;
* при unknown profile/version делает finding inspect-only.

Для `private_regenerable_remnant_v1` binary dependency graph неприменим только к неисполняемому private cache/log artifact с resolved unique owner. Shared/container/application-support/database/sync/VPN/personal artifacts не получают это исключение.

## 6. Узкий actionable scope v0.1

Quarantine одного Library artifact разрешим только одновременно при условиях:

* category равна `cache` или `log`;
* artifact находится в соответствующем allowlisted user Library root и не пересекает protected/sensitive/Git/project/plugin/Codex scopes;
* `remnant_of=resolved` из authoritative source;
* artifact и parent существуют и стабильны в Snapshot A/B;
* owner application и owner executable `absent` по полному canonical application inventory;
* process, open-file и startup facts `absent` с complete same-snapshot coverage;
* receipt lifecycle равен `absent` либо `stale`, но не `live|unknown`;
* official uninstaller `absent` по полному объявленному canonical uninstaller scope;
* dependency applicability равна строго profile-owned `not_applicable`; любой positive/unknown required dependency блокирует;
* data kind известен как regenerable, sensitivity flags пусты, classification `orphaned`, action только reversible `prepare_move` для одного объекта.

`Application Support`, Containers, Group Containers, Preferences, WebKit, HTTPStorages, Saved Application State, databases, sync/VPN и personal data остаются inspect-only в v0.1, даже если owner binding resolved. Их расширение требует отдельного ADR.

## 7. Canonical source scopes

Complete owner-app inventory перечисляет application bundles в `/Applications`, `/System/Applications` и `~/Applications`, а также package-registered application bundles. Spotlight может быть дополнительным source, но не единственным completeness proof.

Canonical uninstaller scope перечисляет app bundles из тех же roots и package-registered uninstallers, затем применяет owner bundle/package/signing rules. Неизвестный root, permission gap или неполная package database дают `unknown`.

Process/open-file/startup queries остаются отдельными. Dependency query для исполняемых/shared artifacts остаётся required; profile `private_regenerable_remnant_v1` не превращает его пустой output в `absent`, а фиксирует строго типизированную неприменимость binary graph к private non-executable artifact.

## 8. Safe view и UI

Safe view добавляет `ownerBindingState`, `ownerBindingSourceClass`, `artifactExistenceState`, `ownerExecutableState`, `receiptLifecycle`, `requirementProfileId` и safe applicability per fact. Raw path, bundle/package/signing identity, historical graph и receipt payload не выходят наружу.

UI показывает, почему artifact actionable или inspect-only. `not_applicable` отображается как «не требуется этим профилем», а не «не найдено». Модель и widget не выбирают profile и не повышают authority. Основная кнопка называется «Переместить в карантин», чтобы не смешивать обратимый move с отдельным необратимым «Удалить навсегда».

## 9. Migration и совместимость

ADR-0013 уточняет ADR-0012 и заменяет только ошибочную возможность считать cleanup candidate owner application.

* Raw/persisted/safe privacy boundaries ADR-0012 сохраняются.
* Старые correlation revisions и action handles инвалидируются.
* Legacy `targetExecutable → target_existence` остаётся read-only.
* Формулировка действия ADR-0011 уточняется с «Удалить» до «Переместить в карантин» без изменения one-object quarantine semantics.
* CMC-21 продолжает работу в существующих Issue #36, Worker, worktree, ветке и PR #38 после merge CMC-22/#39.
* CMC-09 остаётся в существующем PR #34 и возобновляется только после merge исправленного CMC-21.

# Последствия

* v0.1 получает реальный, но намеренно узкий безопасный quarantine flow для cache/log remnants.
* Большинство first-run name-only остатков будут inspect-only; продукт обязан честно объяснить недостающий owner binding.
* Historical binding улучшает coverage со временем без создания публичного inventory.
* Completeness не ослабляется: `not_applicable` является profile semantics, а не отрицательным доказательством.
* Реализация должна удалить synthetic private Info.plist key для uninstaller и доказать production Library candidate → orphaned → `prepare_move`.

# Связанные концепты

* [ADR-0012](ADR-0012-server-owned-correlation-identity.md)
* [Correlation identity](../contracts/correlation-identity.md)
* [Доменная модель](../contracts/domain-model.md)
* [Runtime flows](../architecture/runtime-flows.md)
* [Safety model](../safety/safety-model.md)
* [План CMC-21](../superpowers/plans/2026-07-18-core-correlation-evidence-resolver.md)
