---
type: Release Checklist
title: Обезличенная сводка security scan CMC-10
description: Публичная release-evidence сводка канонического standard scan без локальных путей и inventory.
tags: [release, security, evidence, cmc-10]
status: generated
owner: Security Worker
date: 2026-07-20
---

# Граница evidence

Сводка относится к каноническому standard scan
`215f5b2e-2cbd-4802-a744-4bedaf70867b` на базовой ревизии
`c28fc90a88276860cb3944a2942cdd3a5440202b`.

В release evidence не включены raw scan artifacts, абсолютные локальные пути,
имя пользователя, сведения о домашнем каталоге, inventory приложений и
содержимое синтетических secret-like fixtures.

# Покрытие

* Worklist: 144 из 144 элементов.
* Итог покрытия: complete.
* Reported findings: 3.
* Severity/confidence: три `Low / P3`, high confidence.

# Подтверждённые findings и remediation

| Finding | Подтверждённая граница | Состояние remediation |
| --- | --- | --- |
| `A017-C03` | Raw Library basename мог пройти model-safe границу | Public displayName формируется из закрытой метки категории и opaque suffix; raw basename остаётся server-only |
| `A003-C03` | Category/profile могли ошибочно считаться доказательством regenerability | Только versioned candidate-specific `EMPTY_CACHE_LOG_ARTIFACT_V1`, связанный с fingerprint и correlation revision, разрешает `data_kind=known` |
| `A003-C04` | Production runtime не передавал полную universal protected-scope оценку в policy | Введён server-owned `ProtectedScopeEvaluation`; incomplete evaluation и mutation revalidation блокируются fail closed |

# Отклонённые кандидаты

После централизованной validation и attack-path analysis не стали findings
кандидаты в границах MCP authorization, cancellation/state races, path guard,
quarantine/restore/purge, manifest/storage, preview handles, correlation,
production adapters, exclusions, schedule compatibility, widget и package
supply chain. Network/SSRF и query/template/eval sinks в полном проходе не
обнаружены.

Отклонение кандидата не ослабляет safety obligations: соответствующие
regression, race, fault, privacy и supply-chain gates остаются обязательными на
финальном SHA Pull Request.

# Незавершённые owner gates

* Real-Mac smoke не выполнялся.
* Независимое review не выполнялось этой задачей.
* Tag, GitHub Release, publication и deploy не выполнялись.
* Merge требует отдельного решения владельца.
