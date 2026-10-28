# План аудита и укрепления надежности (Claude Opus Deep Audit)

## 1. Архитектура настроек и данных
- Перенос настроек шлюза и окружения в `platform.settings` (с обратной совместимостью с .env).
- Аудит тяжелых статических данных (locations_data.json 5.4MB, ebz_articles.json 1.9MB) и стратегия их выноса в PostgreSQL с ленивой подгрузкой.

## 2. Отказоустойчивость и безопасность
- Валидация пула соединений PostgreSQL (timeouts, pool exhaustion, retry logic).
- Защита от DoS, брутфорса и перегрузки (Rate limiting на /api/gate, /api/auth/login, /api/mutate).
- Проверка параметризации всех SQL-запросов (SQL Injection immunity).
- Безопасное логирование ошибок без утечки внутренних стеков в production.

## 3. Производительность на 27k записях
- Наличие и покрытие B-Tree и GIN индексов (path, parent_id, org_id, deleted, search trigrams).
- Проверка потребления RAM и сборки мусора Node.js при частых мутациях.
