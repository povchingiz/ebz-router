import { NextRequest, NextResponse } from 'next/server';
import { orgStore } from '../../../lib/store';
import { routeAppeal } from '../../../lib/routing';
import fs from 'fs';
import path from 'path';
import { EbzArticle } from '../../../types';

const EBZ_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'ebz_articles.json');

function getArticles(): EbzArticle[] {
  try {
    if (fs.existsSync(EBZ_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(EBZ_FILE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('MCP getArticles error:', e);
  }
  return [];
}

const MCP_TOOLS = [
  {
    name: 'search_organizations',
    description: 'Поиск государственных органов Республики Казахстан по названию, сфере деятельности (scope) или юрисдикции.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Поисковый запрос (например: "транспорт", "акимат алматы", "лицензирование")' },
        jurisdiction: { type: 'string', enum: ['republican', 'regional', 'district', 'local'], description: 'Уровень юрисдикции' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_organization_details',
    description: 'Получить детальный паспорт государственного органа, включая внутренние департаменты, компетенции и вопросы.',
    inputSchema: {
      type: 'object',
      properties: {
        orgId: { type: 'string', description: 'Идентификатор органа (например: "org-15", "mintrans")' },
      },
      required: ['orgId'],
    },
  },
  {
    name: 'get_departments',
    description: 'Получить список внутренних управлений и департаментов конкретного министерства или ведомства.',
    inputSchema: {
      type: 'object',
      properties: {
        orgId: { type: 'string', description: 'Идентификатор органа' },
      },
      required: ['orgId'],
    },
  },
  {
    name: 'search_ebz_articles',
    description: 'Поиск статей и регламентов ответов гражданам в Единой базе знаний (ЕБЗ) по ключевым словам или тегам.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Текст ситуации гражданина' },
        orgId: { type: 'string', description: 'Опциональный фильтр по ID госоргана' },
      },
      required: ['query'],
    },
  },
  {
    name: 'route_citizen_appeal',
    description: 'Умная маршрутизация обращения гражданина: анализирует текст проблемы и определяет наиболее подходящий государственный орган и департамент.',
    inputSchema: {
      type: 'object',
      properties: {
        appealText: { type: 'string', description: 'Полный текст обращения гражданина' },
        katoCode: { type: 'string', description: 'Опциональный код КАТО региона заявителя' },
      },
      required: ['appealText'],
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jsonrpc, id, method, params } = body;

    if (jsonrpc !== '2.0') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: id || null,
        error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
      });
    }

    // 1. Инициализация протокола MCP
    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: 'eotinish-ebz-router-mcp',
            version: '1.2.0',
          },
        },
      });
    }

    // 2. Список доступных инструментов
    if (method === 'tools/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS,
        },
      });
    }

    // 3. Вызов конкретного инструмента
    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};
      const allOrgs = orgStore.getAll();

      // Tool 1: search_organizations
      if (toolName === 'search_organizations') {
        const q = String(args.query || '').toLowerCase();
        const results = allOrgs
          .filter((org) => {
            const matchName = org.name.toLowerCase().includes(q) || (org.fullName && org.fullName.toLowerCase().includes(q));
            const matchScope = org.scope && org.scope.toLowerCase().includes(q);
            const matchJurisdiction = !args.jurisdiction || org.jurisdiction === args.jurisdiction;
            return (matchName || matchScope) && matchJurisdiction;
          })
          .slice(0, 10)
          .map((o) => ({
            id: o.id,
            name: o.name,
            fullName: o.fullName,
            jurisdiction: o.jurisdiction,
            departmentsCount: o.departments ? o.departments.length : 0,
            scope: o.scope ? o.scope.slice(0, 150) + '...' : '',
          }));

        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
          },
        });
      }

      // Tool 2: get_organization_details
      if (toolName === 'get_organization_details') {
        const target = allOrgs.find((o) => o.id === args.orgId || o.name.toLowerCase().includes(String(args.orgId).toLowerCase()));
        if (!target) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify({ error: 'Организация не найдена' }) }],
            },
          });
        }
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(target, null, 2) }],
          },
        });
      }

      // Tool 3: get_departments
      if (toolName === 'get_departments') {
        const target = allOrgs.find((o) => o.id === args.orgId);
        const depts = target?.departments || [];
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(depts, null, 2) }],
          },
        });
      }

      // Tool 4: search_ebz_articles
      if (toolName === 'search_ebz_articles') {
        const articles = getArticles();
        const q = String(args.query || '').toLowerCase();
        const matched = articles
          .filter((a) => {
            const matchOrg = !args.orgId || a.orgId === args.orgId;
            const matchText = (a.titleRu + ' ' + (a.summaryRu || '') + ' ' + (a.fullResponseRu || '')).toLowerCase().includes(q);
            return matchOrg && matchText;
          })
          .slice(0, 5)
          .map((a) => ({
            id: a.id,
            orgNameRu: a.orgNameRu,
            titleRu: a.titleRu,
            summaryRu: a.summaryRu,
            relatedNpaRu: a.relatedNpaRu,
          }));

        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(matched, null, 2) }],
          },
        });
      }

      // Tool 5: route_citizen_appeal
      if (toolName === 'route_citizen_appeal') {
        const rawAppeal = String(args.appealText || '');
        if (rawAppeal.length > 15000) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Invalid params: appealText превышает допустимый лимит в 15 000 символов' },
          });
        }
        const outcome = await routeAppeal(rawAppeal, allOrgs, { katoCode: args.katoCode });

        const routingResult: Record<string, unknown> = outcome.best && outcome.org
          ? {
              suggestedOrgId: outcome.best.orgId,
              suggestedOrgName: outcome.best.name,
              jurisdiction: outcome.org.jurisdiction,
              matchScore: Math.round(outcome.best.score * 100) / 100,
              suggestedDepartments: outcome.org.departments || [],
              rationale:
                `Обращение относится к компетенции «${outcome.best.fullName}»` +
                (outcome.best.lineage.length ? ` (в системе: ${outcome.best.lineage.slice(0, 2).map((n) => `«${n}»`).join(' → ')})` : '') +
                (outcome.matchedTerms.length ? ` — совпали понятия: ${outcome.matchedTerms.map((t) => `«${t}»`).join(', ')}` : '') +
                (outcome.regionNote ? `; ${outcome.regionNote}` : '') +
                (outcome.org.id === 'akimat-astana' && !outcome.region
                  ? '. Вопрос местного значения (акимат); регион в обращении не указан — по умолчанию г. Астана, для точной маршрутизации передайте katoCode'
                  : '') +
                '.',
              matchedTerms: outcome.matchedTerms,
              basis: outcome.basis,
              confidence: outcome.confidence,
              suggestedDepartment: outcome.department || null,
              region: outcome.region ? { katoPrefix: outcome.region.prefix, name: outcome.region.name, source: outcome.region.source } : null,
              alternatives: outcome.alternatives.map((a) => ({
                orgId: a.orgId,
                name: a.name,
                fullName: a.fullName,
                matchScore: Math.round(a.score * 100) / 100,
                matchedTerms: a.matchedTerms,
              })),
            }
          : {
              suggestedOrgId: 'ap',
              suggestedOrgName: 'Администрация Президента РК',
              rationale: 'Не удалось однозначно классифицировать ведомство, направлено на общее рассмотрение.',
              matchScore: 0,
              confidence: 'low',
              matchedTerms: [],
              basis: [],
              region: outcome.region ? { katoPrefix: outcome.region.prefix, name: outcome.region.name, source: outcome.region.source } : null,
              alternatives: outcome.alternatives.map((a) => ({ orgId: a.orgId, name: a.name, fullName: a.fullName, matchScore: Math.round(a.score * 100) / 100, matchedTerms: a.matchedTerms })),
            };

        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(routingResult, null, 2) }],
          },
        });
      }

      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Tool "${toolName}" not found` },
      });
    }

    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method "${method}" not found` },
    });
  } catch (err: any) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: err.message || 'Internal error' },
    });
  }
}
