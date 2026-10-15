'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Layers, Terminal, ExternalLink } from 'lucide-react';

export default function ApiDocsPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const openApiUrl = `${basePath}/api/openapi`;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Шапка документации */}
      <header className="border-b border-slate-800 bg-slate-950/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Назад на платформу</span>
          </Link>
          <div className="h-4 w-px bg-slate-800 mx-1" />
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-sm font-black text-white">eOtinish AI & EBZ Router API v1.2.0</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={openApiUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md"
          >
            <span>Спецификация OpenAPI 3.0 (JSON)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Быстрый обзор основных эндпоинтов */}
      <main className="max-w-5xl mx-auto w-full p-6 space-y-6">
        <div className="p-6 rounded-3xl bg-slate-800/60 border border-slate-700/80 space-y-3">
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>Интеграционный шлюз eOtinish Platform</span>
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Платформа предоставляет полный программный интерфейс (REST API + MCP) для синхронизации структуры государственных органов (566 органов и 26k учреждений), внутренних подразделений, компетенций и регламентов Единой базы знаний (ЕБЗ).
          </p>
        </div>

        {/* Список эндпоинтов */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Основные маршруты шлюза:
          </h3>

          <div className="grid grid-cols-1 gap-3">
            {/* GET /api/orgs */}
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    GET
                  </span>
                  <code className="text-xs font-mono font-bold text-white">/api/orgs</code>
                </div>
                <p className="text-xs text-slate-400">
                  Реестр всех госорганов, их иерархии, КАТО и внутренних подразделений.
                </p>
              </div>
              <a
                href={`${basePath}/api/orgs`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:underline font-bold shrink-0"
              >
                Тестировать ➔
              </a>
            </div>

            {/* GET /api/ebz */}
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    GET
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    POST
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    DELETE
                  </span>
                  <code className="text-xs font-mono font-bold text-white">/api/ebz</code>
                </div>
                <p className="text-xs text-slate-400">
                  CRUD операции со статьями Единой базы знаний (ЕБЗ) и привязкой ответственных госорганов.
                </p>
              </div>
              <a
                href={`${basePath}/api/ebz`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:underline font-bold shrink-0"
              >
                Тестировать ➔
              </a>
            </div>

            {/* POST /api/mcp */}
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    JSON-RPC
                  </span>
                  <code className="text-xs font-mono font-bold text-white">/api/mcp</code>
                </div>
                <p className="text-xs text-slate-400">
                  Протокол Model Context Protocol (MCP) для вызова инструментов LLM: поиск ведомств, регламентов и ИИ-маршрутизация обращений.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-500 shrink-0">tools/call, tools/list</span>
            </div>

            {/* POST /api/mutate */}
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    POST
                  </span>
                  <code className="text-xs font-mono font-bold text-white">/api/mutate</code>
                </div>
                <p className="text-xs text-slate-400">
                  Сохранение карточек ведомств, добавление подразделений, блокировка (soft lock) и смена подотчетности.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-500 shrink-0">RBAC Protected</span>
            </div>

            {/* GET /api/openapi */}
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    GET
                  </span>
                  <code className="text-xs font-mono font-bold text-white">/api/openapi</code>
                </div>
                <p className="text-xs text-slate-400">
                  Полная спецификация OpenAPI 3.0.3 в формате JSON для интеграции со шлюзами (Kong, KrakenD, Envoy).
                </p>
              </div>
              <a
                href={openApiUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:underline font-bold shrink-0"
              >
                Открыть JSON ➔
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
