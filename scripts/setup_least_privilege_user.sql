-- Least-privilege application role for eotinish_ai_demo.
-- Run as a superuser / DB owner: psql -d eotinish_ai_demo -f scripts/setup_least_privilege_user.sql

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eotinish_app_user') THEN
        CREATE ROLE eotinish_app_user LOGIN PASSWORD 'AppSecurePass2026!';
    ELSE
        ALTER ROLE eotinish_app_user LOGIN PASSWORD 'AppSecurePass2026!';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE eotinish_ai_demo TO eotinish_app_user;

GRANT USAGE ON SCHEMA platform, knowledge TO eotinish_app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform, knowledge TO eotinish_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform, knowledge TO eotinish_app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA platform, knowledge
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eotinish_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform, knowledge
    GRANT USAGE, SELECT ON SEQUENCES TO eotinish_app_user;

-- Учётные записи ЕБЗ-роутера (scripts/migrations/02_create_ebz_users.sql)
GRANT USAGE ON SCHEMA ebz_book TO eotinish_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ebz_book.users TO eotinish_app_user;

REVOKE ALL ON SCHEMA public FROM eotinish_app_user;
