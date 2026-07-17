## Связанная Issue

Укажите `Closes #...` и ID `CMC-...`.

## Что изменено

* <!-- Кратко перечислите изменения. -->

## Safety-инварианты

* [ ] Scope Issue не расширен и архитектурный канон не ослаблен.
* [ ] Нет secrets, telemetry, реальных домашних путей, app inventory и персональных данных.
* [ ] Mutation, release и owner-only действия не выполнены без отдельного разрешения.

## Проверки

* [ ] `python3 .github/scripts/validate_repository.py` завершился успешно.
* [ ] `python3 -m unittest discover -s tests -p 'test_repository_policy.py' -v` завершился успешно.
* [ ] `git diff --check` завершился успешно.
* [ ] Root `pnpm check` выполнен, если runtime workspace уже существует.
* [ ] Focused, contract, policy и security tests выполнены для затронутого scope.
* [ ] Документация, Issue-спека и evidence соответствуют финальному head SHA.

## Риски и действия владельца

Перечислите открытые риски, ручные gates и owner-only действия. Не отмечайте
merge, release, publication или real-Mac smoke выполненными заранее.
