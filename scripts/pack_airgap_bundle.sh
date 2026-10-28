#!/usr/bin/env bash
# ==============================================================================
# E-OTINISH / EBZ ROUTER — AIR-GAP PACKAGING SCRIPT (ЗАКРЫТЫЙ КОНТУР)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$PROJECT_ROOT/dist_airgap"
BUNDLE_NAME="eotinish_ebz_bundle_$(date +%Y%m%d).tar.gz"

echo "=== 1. Starting Packaging for Closed Network (Air-Gapped) ==="
mkdir -p "$DIST_DIR"

# 1. Export database if not exists or update
echo "--- Exporting 27,164 master organizations and taxonomy to initdb/ ---"
python3 "$PROJECT_ROOT/scripts/export_production_db.py"

# 2. Check if Docker is available to save container image
if command -v docker &> /dev/null && docker info &> /dev/null; then
    echo "--- Building Docker image ebz-router:latest ---"
    docker build -t ebz-router:latest "$PROJECT_ROOT"
    
    echo "--- Saving Docker image to $DIST_DIR/ebz-router-image.tar.gz ---"
    docker save ebz-router:latest | gzip > "$DIST_DIR/ebz-router-image.tar.gz"
    
    echo "--- Pulling and saving postgres:16-alpine image ---"
    docker pull postgres:16-alpine
    docker save postgres:16-alpine | gzip > "$DIST_DIR/postgres-16-alpine.tar.gz"
else
    echo "[!] Docker daemon not accessible directly without sudo. Packaging standalone code bundle."
fi

# 3. Create deployment payload structure
PAYLOAD_DIR="$DIST_DIR/ebz_payload"
rm -rf "$PAYLOAD_DIR"
mkdir -p "$PAYLOAD_DIR/initdb" "$PAYLOAD_DIR/scripts"

# Copy essential runtime files
cp "$PROJECT_ROOT/docker-compose.prod.yml" "$PAYLOAD_DIR/docker-compose.yml"
cp "$PROJECT_ROOT/.env.production.example" "$PAYLOAD_DIR/.env"
cp "$PROJECT_ROOT/initdb/01_eotinish_master_27k.sql.gz" "$PAYLOAD_DIR/initdb/"
cp "$PROJECT_ROOT/scripts/deploy_closed_network.sh" "$PAYLOAD_DIR/deploy.sh"
chmod +x "$PAYLOAD_DIR/deploy.sh"

# If standalone build exists, package it as backup runner
if [ -d "$PROJECT_ROOT/.next/standalone" ]; then
    echo "--- Packaging prebuilt standalone Next.js application ---"
    mkdir -p "$PAYLOAD_DIR/standalone"
    cp -r "$PROJECT_ROOT/.next/standalone"/* "$PAYLOAD_DIR/standalone/"
    mkdir -p "$PAYLOAD_DIR/standalone/.next/static"
    cp -r "$PROJECT_ROOT/.next/static"/* "$PAYLOAD_DIR/standalone/.next/static/"
    if [ -d "$PROJECT_ROOT/public" ]; then
        cp -r "$PROJECT_ROOT/public" "$PAYLOAD_DIR/standalone/"
    else
        mkdir -p "$PAYLOAD_DIR/standalone/public"
    fi
fi

# If images were saved, move them into payload
if [ -f "$DIST_DIR/ebz-router-image.tar.gz" ]; then
    mv "$DIST_DIR/ebz-router-image.tar.gz" "$PAYLOAD_DIR/"
fi
if [ -f "$DIST_DIR/postgres-16-alpine.tar.gz" ]; then
    mv "$DIST_DIR/postgres-16-alpine.tar.gz" "$PAYLOAD_DIR/"
fi

# Copy quick start instructions
cat << 'EOF' > "$PAYLOAD_DIR/README_DEPLOY.md"
# Инструкция по развертыванию в закрытом контуре (ЕТС ГО / АО "НИТ")

1. Распакуйте архив:
   tar -xzf eotinish_ebz_bundle_*.tar.gz
   cd ebz_payload

2. Заполните секреты в .env (значения CHANGE_ME обязательно заменить):
   - SESSION_SECRET      : openssl rand -hex 32
   - SITE_GATE_PASSWORD  : пароль экрана входа
   - DB_PASSWORD         : пароль PostgreSQL
   - EBZ_PRESET_USERS    : учётные записи; хеш пароля: node scripts/hash_password.mjs
   - ALLOWED_ORIGINS     : CORS-источники через запятую (пусто = только same-origin)
   - TRUST_PROXY         : true только за доверенным reverse proxy
   nano .env

3. Запустите одной командой:
   chmod +x deploy.sh
   ./deploy.sh

4. Проверьте статус:
   curl http://localhost:3050/api/health
   # Ожидаемый ответ: {"status":"pass", "database":{"totalOrganizations":27164}}

Платформа доступна по адресу: http://<IP_СЕРВЕРА>:3050
Пароли не входят в поставку: SITE_GATE_PASSWORD и хеши учётных записей задаёт администратор в .env.
Публиковать сервис нужно по HTTPS (reverse proxy): cookie сессии выставляются с флагом Secure,
по обычному HTTP вход работать не будет. Ротация паролей: сгенерировать новый хеш
(node scripts/hash_password.mjs), обновить .env и перезапустить контейнер (docker compose up -d).
EOF

echo "--- Compressing complete delivery package to $DIST_DIR/$BUNDLE_NAME ---"
tar -czf "$DIST_DIR/$BUNDLE_NAME" -C "$DIST_DIR" ebz_payload

echo "=== PACKAGE READY ==="
echo "Bundle file: $DIST_DIR/$BUNDLE_NAME"
ls -lh "$DIST_DIR/$BUNDLE_NAME"
