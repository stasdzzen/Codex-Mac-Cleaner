---
type: Implementation Plan
title: Delta-план CMC-21 — actionable Library remnants
description: TDD-продолжение существующего CMC-21 PR после merge ADR-0013.
tags: [plan, correlation, library, remnants, tdd]
status: approved
owner: Architect
date: 2026-07-18
---

# Граница

План выполняется только существующим CMC-21/#36 Worker в worktree, ветке `codex/issue-36-core-correlation-resolver` и PR #38 после merge CMC-22/#39. Допустимые runtime paths остаются путями CMC-21. CMC-09/PR #34 не меняется.

# Task 1 — schema v2 и migration boundary

**RED**

* cleanup artifact и owner application нельзя представить одним actionable subject;
* legacy `targetExecutable` ошибочно проходит как `target_existence`;
* unknown profile/applicability либо `not_applicable` без server profile создаёт action.

**GREEN**

* добавить explicit subject roles, `remnant_of`, `OwnerBinding`, `CorrelationRequirementProfile`, fact applicability, artifact/owner executable states и receipt lifecycle;
* legacy revisions оставить analysis-only; invalid/unknown schema fail closed.

# Task 2 — authoritative owner bindings

**RED**

* path/basename/display/bundle-only/user-attestation создаёт resolved binding;
* raw binding или path сериализуется либо сохраняется;
* historical binding переживает owner/type/root mismatch или rekey.

**GREEN**

* реализовать exact receipt payload, OS-owned container metadata и keyed historical signed process/open-file binding;
* persisted history хранит только installation-keyed digests, provenance class и versions.

# Task 3 — production scopes

**RED**

* Spotlight-only app inventory выпускает complete certificate;
* private Info.plist key считается official-uninstaller source;
* empty receipt/uninstaller output становится absent без canonical scope.

**GREEN**

* перечислить canonical app roots и package-registered bundles;
* uninstaller query применяет owner identity rules к canonical app/package inventory;
* receipt query выдаёт `live|stale|absent|unknown`;
* любое permission/parse/truncation/capability отклонение даёт unknown.

# Task 4 — profile policy

**RED**

* Application Support/container/WebKit/HTTPStorages/saved-state/personal/shared artifact получает action;
* dependency `not_applicable` используется для executable/shared artifact;
* positive fact теряется из-за profile applicability.

**GREEN**

* `private_regenerable_remnant_v1` применяется только к cache/log;
* `target_existence` строится из artifact Snapshot B;
* owner executable, live receipt, activity/open/startup/uninstaller и required dependency остаются отдельными blockers;
* разрешён только `prepare_move` одного объекта.

# Task 5 — production integration

**RED**

* тестовый candidate `.app` выдаётся за v0.1 success;
* Library candidate с name-only relation получает orphaned/action;
* Library candidate с валидным history binding не может пройти полный flow.

**GREEN**

* synthetic signed owner process создаёт binding для cache/log в revision N;
* revision N+1 доказывает owner app absent и полный profile coverage;
* safe core возвращает `orphaned` и `prepare_move`;
* positive/partial/sensitive/race/mismatch cases action не получают;
* output/privacy scans не находят raw path, identity или inventory.

# Финальные gates

На одном final SHA повторить все исходные gates CMC-21 плюс schema migration, profile matrix, Library production integration и public privacy canaries. Обновить только PR #38, вернуть #36 в `cto:review` и остановиться без merge.
