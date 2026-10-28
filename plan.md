# План E2E-пайплайна проверки мутаций (Фронт ➔ Бэк ➔ PostgreSQL)

## 1. Подключение к БД для мониторинга (DBeaver)
- Host: `localhost` | Port: `5432` | DB: `eotinish_ai_demo`
- User: `eotinish_platform` | Password: `BFhekbn2026`
- Контрольные таблицы:
  * `platform.gov_organizations_master`
  * `knowledge.org_details_extra`
  * `platform.org_audit_log`
  * `platform.gov_organization_faq`

## 2. Сквозной E2E-пайплайн проверки
- Фиксация состояния до мутации в PG.
- Выполнение мутации через API/UI (`/api/mutate`) с токеном `superadmin`.
- Фиксация состояния после мутации в PG.
- Проверка генерации записи в `platform.org_audit_log` (diff_payload, user_id, action).
- Проверка инкремента `version` в `platform.gov_organizations_master`.
