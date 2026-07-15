---
type: ADR
title: "ADR-0001: macOS 26 и Apple Silicon"
description: Фиксация минимальной версии macOS и единственной поддерживаемой архитектуры процессора.
tags: [adr, platform, macos, arm64]
status: approved
owner: Architect
date: 2026-07-15
---

# Контекст

Поддержка старых систем и двух архитектур увеличивает матрицу файловых особенностей, сборок и тестов. Для первого релиза важнее доказуемая безопасность на современном целевом окружении.

# Решение

Поддерживать macOS 26 и новее только на Apple Silicon `arm64`. Intel, Rosetta и старые версии macOS не входят в compatibility contract.

# Последствия

* CI, package metadata и runtime guard проверяют `darwin`, версию ОС и `arm64`.
* Release не публикует universal или x86_64 binaries.
* Smoke tests выполняются на реальном Apple Silicon Mac с macOS 26.
* Расширение платформ требует нового ADR и отдельного набора safety tests.
