-- =====================================================================
-- ЕБЗ-роутер: инициализация production БД (идемпотентный скрипт для DBeaver)
--
-- Как запустить в DBeaver:
--   1. Подключитесь к целевой БД (Database Navigator -> двойной клик по подключению).
--   2. Откройте этот файл (File -> Open File...) или вставьте текст в SQL-редактор.
--   3. Выполните ВЕСЬ скрипт: Alt+X (Execute SQL Script), а не Ctrl+Enter.
--   4. Скрипт можно запускать повторно: CREATE ... IF NOT EXISTS, учётки ON CONFLICT DO NOTHING.
--
-- Пароли в формате scrypt:<salt hex>:<hash hex> (src/lib/auth.ts, scripts/hash_password.mjs).
-- После первого входа смените пароли учёток.
-- =====================================================================

-- 1. Схемы
CREATE SCHEMA IF NOT EXISTS ebz_book;
CREATE SCHEMA IF NOT EXISTS platform;

-- 2. Учётные записи ЕБЗ-роутера
CREATE TABLE IF NOT EXISTS ebz_book.users (
  id            VARCHAR(64) PRIMARY KEY,
  username      VARCHAR(64) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(32) NOT NULL CHECK (role IN ('GLOBAL_ADMIN', 'ORG_ADMIN', 'VIEWER')),
  full_name     TEXT NOT NULL,
  org_id        VARCHAR(64),
  org_name      TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- 3. Начальные пользователи (повторный запуск не перезаписывает существующие)
INSERT INTO ebz_book.users (id, username, password_hash, role, full_name, org_id, org_name) VALUES
  ('user-superadmin', 'superadmin', 'scrypt:bc40d976fbf5ce48f20226b19e197ace:dca45c99afb524f802f918512b3b2726bb97b4abb9bdad10205faa0e473d6115bb5f62dcfb34b610e0d5aae5834c57e5dfc8cdccd84797d4eaec3cf82d9074d6', 'GLOBAL_ADMIN', 'Супер-администратор (АП РК)', 'ap', 'Администрация Президента (Вся республика)'),
  ('user-admin-minenergo', 'admin_minenergo', 'scrypt:bca0f99e78db0204e7571e39f453d366:66656b1139bde23054f9e7b59bd0fba18d6713d60459ecd982a76f204e44ab8d06a3ab1cdcfad1bea4e57d8ca089aeae4780854e76a6a02826a3f1994041cbf9', 'ORG_ADMIN', 'Методолог Минэнерго РК (МЭ)', 'me', 'Минэнерго РК'),
  ('user-admin-miicr', 'admin_miicr', 'scrypt:8a82486206c35f6316f56e8c73acaac2:e186b41561e4f781f97a92104c728f3cbcd3e07e6e8f4e160c0ee674ddcd7986afcce5a2a98b34eea2ca766a9b7b5ba64f87d96d78c2c9b963b7a5a6b40142cc', 'ORG_ADMIN', 'Администратор МИИЦР', 'miicr', 'МИИЦР'),
  ('user-admin-mvd', 'admin_mvd', 'scrypt:051b291b25aad6ced9b09ec45e8130cf:0e405687148fcb34971a220e20c1510dbaa850a8eabde01d7c0bc87ec639e066135eca01c71b1c339fc61be2599395515bd0a8d8272cbfca31a81b969a145fd1', 'ORG_ADMIN', 'Методолог МВД РК', 'mvd', 'МВД РК'),
  ('user-admin-astana', 'admin_astana', 'scrypt:1dda71562de6077f6dca50e74bbac4b2:ebf8659b152504cd475118e0a980155d5fec36bc23d8dbf4989fd0728b24c81a8c055a4a0f800cb1c6b20a686509083f5c98657494e44001124e776e66faa659', 'ORG_ADMIN', 'Администратор Акимата г. Астаны', 'akimat-astana', 'Акимат Астана'),
  ('user-curator-apr', 'curator_apr', 'scrypt:8abfc1146e93c4cb4adb26db1f77a1c3:7fd1ea7ada24d8a02dabc8c962f174ab8c0b69714711d80e88fb55ed50ed0c2a04a2ac4b03db50fde388efe09975df8bbc291689d9820b2c3aac2cf3d38a5783', 'ORG_ADMIN', 'Инспектор Аппарата Правительства (АПр)', 'apr', 'Аппарат Правительства РК (АПр)'),
  ('user-viewer', 'viewer', 'scrypt:f03eeefee1ef398138eff3adabc19153:afdc63e357f3103acebe09f0fa3a4d6acfd4266c616a3f6afd9bcfea28aab5061d0e1ddd1abff1bef6af3887999f599401150eddfbc20217063c5ae332712291', 'VIEWER', 'Наблюдатель (Аналитик)', NULL, 'Режим чтения')
ON CONFLICT (username) DO NOTHING;

-- 4. Расширенные карточки организаций (контакты, компетенции, переадресация)
CREATE TABLE IF NOT EXISTS ebz_book.org_details_extra (
  org_id                BIGINT PRIMARY KEY,
  competencies_excluded TEXT,
  forward_to_guidance   TEXT,
  phone_hotline         TEXT,
  phone_chancellery     TEXT,
  email_official        TEXT,
  website_url           TEXT,
  physical_address      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Статус наполненности карточек
CREATE TABLE IF NOT EXISTS ebz_book.org_readiness_status (
  org_id             BIGINT PRIMARY KEY,
  status             VARCHAR(32) NOT NULL DEFAULT 'unfilled',
  has_human_touch    BOOLEAN NOT NULL DEFAULT FALSE,
  completeness_score INTEGER NOT NULL DEFAULT 0,
  last_touched_by    TEXT,
  last_touched_at    TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Журнал аудита всех мутаций
CREATE TABLE IF NOT EXISTS platform.org_audit_log (
  id           BIGSERIAL PRIMARY KEY,
  org_id       BIGINT,
  action       VARCHAR(64) NOT NULL,
  user_id      TEXT,
  user_name    TEXT,
  user_role    TEXT,
  diff_payload JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_audit_log_org_id ON platform.org_audit_log (org_id, created_at DESC);
