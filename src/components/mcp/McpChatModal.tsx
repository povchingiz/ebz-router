'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User as UserIcon,
  X,
  ExternalLink,
  Building2,
  BookOpen,
  Layers,
  ShieldCheck,
  Minimize2,
  Maximize2,
  RefreshCw,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolResults?: {
    routing?: {
      suggestedOrgId?: string;
      suggestedOrgName?: string;
      jurisdiction?: string;
      matchScore?: number;
      suggestedDepartments?: Array<{ id: string; name: string; responsible?: string }>;
      rationale?: string;
    };
    ebzArticles?: Array<{
      id: string;
      orgNameRu?: string;
      titleRu: string;
      summaryRu?: string;
      relatedNpaRu?: string;
    }>;
    departments?: Array<{ id: string; name: string; responsible?: string }>;
  };
}

interface McpChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrg: (orgId: string) => void;
}

const QUICK_PROMPTS = [
  'Жалоба на качество республиканской трассы Астана-Алматы',
  'Задержка авиарейса в аэропорту и отказ в гостинице',
  'Отказ в приеме документов в ЦОНе по регистрации ТОО',
  'Какие подразделения есть у Министерства транспорта?',
];

export const McpChatModal: React.FC<McpChatModalProps> = ({ isOpen, onClose, onSelectOrg }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Здравствуйте! Я ИИ-маршрутизатор на базе Model Context Protocol (MCP).\nОпишите обращение гражданина или задачу, и я обращусь к реестру госорганов, подразделениям и базе знаний ЕБЗ для определения точного маршрута.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const lower = query.toLowerCase();
      const isDeptQuery = lower.includes('подразделен') || lower.includes('департамент') || lower.includes('структур');

      let routingData: any = null;
      let ebzData: any[] = [];
      let deptData: any[] = [];

      // 1. Запрос к MCP: route_citizen_appeal
      const mcpRouteRes = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `mcp-${Date.now()}`,
          method: 'tools/call',
          params: {
            name: 'route_citizen_appeal',
            arguments: { appealText: query },
          },
        }),
      });

      if (mcpRouteRes.ok) {
        const json = await mcpRouteRes.json();
        const rawText = json?.result?.content?.[0]?.text;
        if (rawText) {
          try {
            routingData = JSON.parse(rawText);
          } catch (e) {
            console.error('Failed to parse MCP routing response:', e);
          }
        }
      }

      // 2. Запрос к MCP: search_ebz_articles
      const mcpEbzRes = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `mcp-ebz-${Date.now()}`,
          method: 'tools/call',
          params: {
            name: 'search_ebz_articles',
            arguments: { query, orgId: routingData?.suggestedOrgId },
          },
        }),
      });

      if (mcpEbzRes.ok) {
        const json = await mcpEbzRes.json();
        const rawText = json?.result?.content?.[0]?.text;
        if (rawText) {
          try {
            ebzData = JSON.parse(rawText);
          } catch (e) {
            console.error('Failed to parse MCP EBZ response:', e);
          }
        }
      }

      // 3. Если запрос о подразделениях — вызовем get_departments
      if (isDeptQuery && routingData?.suggestedOrgId) {
        const mcpDeptRes = await fetch('/api/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `mcp-dept-${Date.now()}`,
            method: 'tools/call',
            params: {
              name: 'get_departments',
              arguments: { orgId: routingData.suggestedOrgId },
            },
          }),
        });

        if (mcpDeptRes.ok) {
          const json = await mcpDeptRes.json();
          const rawText = json?.result?.content?.[0]?.text;
          if (rawText) {
            try {
              deptData = JSON.parse(rawText);
            } catch (e) {
              console.error('Failed to parse MCP Dept response:', e);
            }
          }
        }
      }

      // Формирование текстового ответа ассистента
      let responseText = '';
      if (routingData?.suggestedOrgName) {
        responseText = `На основе семантического анализа обращения по протоколу MCP определено профильное ведомство: **${routingData.suggestedOrgName}**.\n\n${routingData.rationale || ''}`;
      } else {
        responseText = 'Обращение обработано. Проверьте детали маршрутизации ниже:';
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolResults: {
          routing: routingData || undefined,
          ebzArticles: ebzData.length > 0 ? ebzData : undefined,
          departments: deptData.length > 0 ? deptData : undefined,
        },
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: 'assistant',
          content: `Ошибка связи с сервером MCP: ${err.message || 'Сбой протокола'}. Проверьте подключение к шлюзу.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`fixed z-50 transition-all duration-300 flex flex-col shadow-2xl rounded-3xl border-2 border-indigo-500/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl ${
        isExpanded
          ? 'inset-6 sm:inset-12'
          : 'bottom-5 right-5 w-[92vw] sm:w-[460px] h-[620px]'
      }`}
    >
      {/* Шапка чата */}
      <div className="p-4 border-b border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-slate-800/80 dark:to-indigo-950/60 rounded-t-3xl flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-slate-900 dark:text-white">
                ИИ-Маршрутизатор (MCP)
              </h3>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Superuser
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              Model Context Protocol • JSON-RPC 2.0
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800 transition-colors"
            title={isExpanded ? 'Свернуть' : 'Развернуть на весь экран'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800 transition-colors"
            title="Закрыть окно"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* История сообщений */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs overscroll-contain">
        {messages.map((msg) => {
          const isBot = msg.role === 'assistant';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}
            >
              {isBot && (
                <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 space-y-2.5 shadow-xs ${
                  isBot
                    ? 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                    : 'bg-indigo-600 text-white rounded-br-xs font-medium'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                {/* Результаты работы инструментов MCP */}
                {msg.toolResults && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/80">
                    {/* Рекомендованный госорган */}
                    {msg.toolResults.routing?.suggestedOrgName && (
                      <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-black text-indigo-950 dark:text-indigo-200">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Рекомендуемый орган:</span>
                          </div>
                          {msg.toolResults.routing.matchScore && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              Совпадение: {msg.toolResults.routing.matchScore} очков
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-black text-slate-900 dark:text-white">
                          {msg.toolResults.routing.suggestedOrgName}
                        </div>

                        {msg.toolResults.routing.suggestedOrgId && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectOrg(msg.toolResults!.routing!.suggestedOrgId!);
                              if (!isExpanded) onClose();
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline pt-0.5"
                          >
                            <span>Показать орган на графе</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Подразделения ведомства (если запрошены) */}
                    {msg.toolResults.departments && msg.toolResults.departments.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-900/50 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-purple-900 dark:text-purple-300">
                          <Layers className="w-3 h-3 text-purple-600" />
                          <span>Внутренние подразделения ({msg.toolResults.departments.length}):</span>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                          {msg.toolResults.departments.map((dept) => (
                            <div
                              key={dept.id}
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-900 text-[10px] border border-purple-100 dark:border-purple-900/40"
                            >
                              <div className="font-bold text-slate-900 dark:text-white">{dept.name}</div>
                              {dept.responsible && (
                                <div className="text-slate-500 line-clamp-1">{dept.responsible}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Связанные регламенты и статьи ЕБЗ */}
                    {msg.toolResults.ebzArticles && msg.toolResults.ebzArticles.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                          <BookOpen className="w-3 h-3 text-indigo-600" />
                          <span>Найдено в базе знаний ЕБЗ ({msg.toolResults.ebzArticles.length}):</span>
                        </div>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {msg.toolResults.ebzArticles.map((art) => (
                            <div
                              key={art.id}
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-[10px] border border-slate-200/70 dark:border-slate-700 space-y-0.5"
                            >
                              <div className="font-bold text-indigo-700 dark:text-indigo-400 line-clamp-1">
                                {art.titleRu}
                              </div>
                              {art.summaryRu && (
                                <p className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                                  {art.summaryRu}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={`text-[9px] ${
                    isBot ? 'text-slate-400 text-right' : 'text-indigo-200 text-right'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {!isBot && (
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs font-bold text-[10px]">
                  SU
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl w-fit">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>MCP выполняет вызов инструментов (route & search)...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Быстрые подсказки-промпты */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {QUICK_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(p)}
              className="px-2.5 py-1 text-[10px] font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-300 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 whitespace-nowrap transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Поле ввода */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 rounded-b-3xl shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Опишите вопрос гражданина или компетенцию..."
            disabled={isLoading}
            className="flex-1 px-3.5 py-2.5 text-xs rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-medium transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-all shadow-md active:scale-95 shrink-0"
            title="Отправить запрос"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
