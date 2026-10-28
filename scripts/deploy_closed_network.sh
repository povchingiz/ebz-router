#!/usr/bin/env bash
# ==============================================================================
# E-OTINISH / EBZ ROUTER — DEPLOYMENT IN CLOSED NETWORK (ОДНОКНОПОЧНЫЙ ЗАПУСК)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================================="
echo "  РАЗВЕРТЫВАНИЕ ЕОТИНІШ / ЕБЗ ПЛАТФОРМЫ В ЗАКРЫТОМ КОНТУРЕ"
echo "=========================================================="

# 1. Загрузка Docker-образов при наличии офлайн-архивов
if [ -f "postgres-16-alpine.tar.gz" ]; then
    echo "--- Импорт базового образа PostgreSQL ---"
    docker load < postgres-16-alpine.tar.gz
fi

if [ -f "ebz-router-image.tar.gz" ]; then
    echo "--- Импорт образа приложения ebz-router ---"
    docker load < ebz-router-image.tar.gz
fi

# 2. Проверка конфигурации .env
if [ ! -f ".env" ]; then
    if [ -f ".env.production.example" ]; then
        echo "--- Создание .env из шаблона .env.production.example ---"
        cp .env.production.example .env
        chmod 600 .env
        echo "[!] Создан .env из шаблона. Заполните секреты (SESSION_SECRET, SITE_GATE_PASSWORD,"
        echo "    DB_PASSWORD, EBZ_PRESET_USERS) и запустите скрипт повторно."
        echo "    Хеши паролей: node scripts/hash_password.mjs ; SESSION_SECRET: openssl rand -hex 32"
        exit 1
    else
        echo "[!] Ошибка: отсутствует файл .env"
        exit 1
    fi
fi

if grep -q "CHANGE_ME" .env; then
    echo "[!] В .env остались значения CHANGE_ME — замените их на реальные секреты."
    exit 1
fi

# 3. Запуск контейнеров через Docker Compose
echo "--- Запуск контейнеров (БД PostgreSQL 27k + Next.js App) ---"
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    docker compose up -d
elif command -v docker-compose &> /dev/null; then
    docker-compose up -d
else
    echo "[!] Docker / docker-compose не обнаружен. Запуск в режиме прямого Node.js процесса..."
    if [ -d "standalone" ]; then
        set -a; . ./.env; set +a
        cd standalone
        PORT=${APP_PORT:-3050} node server.js &
        echo "Приложение запущено в фоновом режиме на порту ${APP_PORT:-3050}"
        exit 0
    else
        echo "Ошибка: не найден каталог standalone"
        exit 1
    fi
fi

# 4. Проверка готовности (Readiness Probe)
echo "--- Ожидание инициализации базы данных и старта веб-приложения (до 30 сек) ---"
READY=0
for i in {1..30}; do
    STATUS=$(curl -s http://localhost:3050/api/health || echo "connecting")
    if echo "$STATUS" | grep -q '"status":"pass"'; then
        READY=1
        echo ""
        echo "=== СЕРВИС УСПЕШНО ЗАПУЩЕН И ГОТОВ К РАБОТЕ! ==="
        echo "$STATUS" | grep -o '"totalOrganizations":[0-9]*' || true
        break
    fi
    echo -n "."
    sleep 1
done

if [ "$READY" -eq 1 ]; then
    echo ""
    echo "=========================================================="
    echo "  Веб-интерфейс:   http://localhost:3050"
    echo "  Документация:    http://localhost:3050/docs"
    echo "  Healthcheck:     http://localhost:3050/api/health"
    echo "  Пароль доступа к контуру и учётные записи задаются в .env (SITE_GATE_PASSWORD, EBZ_PRESET_USERS)"
    echo "  Доступ только по HTTPS (за reverse proxy): cookie сессии помечены Secure"
    echo "=========================================================="
else
    echo ""
    echo "[!] Предупреждение: Сервис запускается дольше обычного. Проверьте логи командой:"
    echo "    docker compose logs -f"
fi
