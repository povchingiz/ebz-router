# ЕБЗ Роутер — Единая база знаний и маршрутизация госорганов (Standalone)

Автономный, легковесный сервис классификации госаппарата и умной маршрутизации обращений граждан.

## Ключевые возможности

1. **Иерархия без перегрузки (2 уровня):**
   - На экране строго отображаются только 2 уровня: *Текущий родительский орган* $\rightarrow$ *Прямые подчиненные ведомства*.
   - Плавная навигация вверх и вниз по иерархии с помощью хлебных крошек.
   - Цветовая дифференциация по рангу власти:
     - 🔵 **Высшие органы (АП / Аппарат Правительства)**
     - 🟢 **Министерства и Агентства**
     - 🟡 **Комитеты и Департаменты**
     - 🟣 **Районные и территориальные подразделения**

2. **Два режима отображения:**
   - **Дерево:** Просторный структурный вид с фокусом на подчиненности.
   - **Список:** Иерархический аккордеон с мгновенным сквозным поиском по названиям, компетенциям и ключевым словам.

3. **Разграничение прав (RBAC):**
   - **Суперадминистратор (`superadmin`):** Управление подчинением (смена родителя), добавление/удаление веток, импорт структуры CSV, редактирование компетенций.
   - **Методолог (`methodologist`):** Наполнение базы знаний (сфера ведения, регламенты, вопросы/FAQ). **Запрещено изменять структуру подчинения.**
   - **Оператор (`operator` / `viewer`):** Поиск, навигация, тестирование маршрутизатора обращений.

4. **Защита данных от одновременных правок и перегрузки базы:**
   - **Optimistic Locking (`version`):** Предотвращает перезапись чужих изменений при одновременной работе нескольких специалистов.
   - **Soft Lock:** Подсвечивает карточку организации, если коллега прямо сейчас редактирует её.
   - **Защита от циклов:** Автоматический запрет циклических ссылок при переподчинении ведомств.
   - **Бэкенд-буфер:** Изолированный слой API скрывает базу данных и защищает от спайков нагрузки.
   - Подробнее — в разделе «Архитектура production».

5. **Умный маршрутизатор обращений:**
   - Встроенный инструмент подбора целевого ведомства по произвольному тексту жалобы или обращения с объяснением основания переадресации.

6. **Импорт структуры CSV:**
   - Возможность пакетного обновления справочника госорганов без персональных данных.
   - Скачиваемый эталонный шаблон.

## Локальный запуск

```bash
cd ebz-router
npm install
npm run dev # или npm run build && npm start
```
Dev-сервер: `http://localhost:3005` (порт задан в `package.json`). Для работы нужна PostgreSQL (`DATABASE_URL` в `.env.local`).

### Конфигурация и секреты

Для `npm run dev` создайте `.env.local` (в git не попадает):

```bash
SESSION_SECRET=<openssl rand -hex 32>
SITE_GATE_PASSWORD=<пароль экрана входа>
EBZ_PRESET_USERS='[{"login":"superadmin","role":"GLOBAL_ADMIN","passwordHash":"<вывод scripts/hash_password.mjs>","fullName":"Супер-администратор","orgId":"ap"}]'
# необязательно: ALLOWED_ORIGINS=http://localhost:3000  TRUST_PROXY=true
```

- Хеш пароля: `node scripts/hash_password.mjs` (scrypt, без зависимостей). Роли: `GLOBAL_ADMIN`, `ORG_ADMIN`, `VIEWER`.
- В production `SESSION_SECRET`, `SITE_GATE_PASSWORD` и `EBZ_PRESET_USERS` обязательны — без них вход/запуск завершится ошибкой. Cookie выставляются с флагом `Secure`, нужен HTTPS.
- Ротация: новый хеш → обновить переменную → перезапуск. Деплой в закрытом контуре: `CLOSED_NETWORK_DEPLOYMENT.md`.

## Развертывание в закрытом контуре (Docker Compose)

Production-стенд — `docker-compose.prod.yml`: PostgreSQL 16 (`ebz-db`, данные загружаются из `initdb/01_eotinish_master_27k.sql.gz`) + Next.js (`ebz-web`, порт `APP_PORT`, по умолчанию 3050).

```bash
cp .env.production.example .env
# заполнить в .env: DB_PASSWORD, SITE_GATE_PASSWORD, SESSION_SECRET, EBZ_PRESET_USERS
docker compose -f docker-compose.prod.yml up -d --build
```

- Без `DB_PASSWORD`, `SITE_GATE_PASSWORD`, `SESSION_SECRET`, `EBZ_PRESET_USERS` compose откажется стартовать.
- Проверка: `curl http://localhost:3050/api/health` → `"status":"pass"`.
- Offline-поставка и пакет для air-gap: `CLOSED_NETWORK_DEPLOYMENT.md`, `scripts/pack_airgap_bundle.sh`, `scripts/deploy_closed_network.sh`.

### Усиление БД (least privilege)

После первого запуска выполните под владельцем БД:

```bash
psql -d eotinish_ai_demo -f scripts/setup_least_privilege_user.sql
```

Скрипт создаёт роль `eotinish_app_user` только с `SELECT/INSERT/UPDATE/DELETE` на схемы `platform` и `ebz_book`, без доступа к `public`. Перед применением **замените пароль роли** в скрипте и переключите `DATABASE_URL` приложения на эту роль.

## Архитектура production

**Хранилище — PostgreSQL:**
- `platform.gov_organizations_master` — мастер-таблица, ~27 тыс. государственных организаций.
- `ebz_book.org_details_extra` — расширенные карточки: компетенции, регламенты, FAQ.
- `platform.org_audit_log` — журнал аудита всех мутаций.

**Единое подчинение и интерактивное переподчинение:** у каждой организации один родитель; `superadmin` меняет его через интерфейс (`/api/mutate`), циклические ссылки отклоняются.

**Двухуровневая защита от гонок:**
1. *Soft lock* — карточка помечается как редактируемая коллегой.
2. *Optimistic versioning* — поле `version`; устаревшая запись получает `409 Conflict`, чужие правки не перезаписываются.

## Тесты

```bash
# API e2e (vitest) — нужен запущенный сервер
TEST_BASE_URL=http://localhost:3050 TEST_GATE_PASSWORD=<пароль gate> npx vitest run tests/e2e/api

# Нагрузочный стресс /api/mutate (k6): ожидаются только 200 и 409
k6 run -e BASE_URL=http://localhost:3050 -e SITE_GATE_PASSWORD=<пароль gate> tests/load/k6_mutate_stress.js
```

`tests/e2e/api/` покрывает RBAC, конкурентные блокировки, аудит, массовый импорт, поиск, безопасность и матрицу маршрутов.

## Публикация в GitLab

```bash
git add -A && git commit -m "..." && git push origin <ветка>
```

`.env`, `.env.local` и `node_modules` в git не попадают (`.gitignore`).
