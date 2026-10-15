import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3050';
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const serverUrl = `${protocol}://${host}${basePath}`;

  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'eOtinish AI & EBZ Router API',
      version: '1.2.0',
      description:
        'Официальный API Единой базы знаний (ЕБЗ) и ИИ-маршрутизатора обращений граждан Республики Казахстан. Предоставляет доступ к иерархии госорганов (566 ключевых ведомств и реестру 26k учреждений), подразделениям, КАТО, регламентам ЕБЗ и протоколу MCP для интеграции с LLM.',
      contact: {
        name: 'eOtinish Platform Team',
        email: 'support@eotinish.gov.kz',
      },
    },
    servers: [
      {
        url: serverUrl,
        description: 'Current Environment Gateway',
      },
      {
        url: 'https://eotinish.gov.kz/ebz-router',
        description: 'Production Gateway',
      },
    ],
    tags: [
      { name: 'Organizations', description: 'Управление структурой и паспортами госорганов' },
      { name: 'EBZ Articles', description: 'Реестр статей и нормативно-правовых регламентов ЕБЗ' },
      { name: 'Router & Questions', description: 'Вопросы маршрутизатора и компетенции' },
      { name: 'Analytics', description: 'Дашборд заполненности и детекция конфликтов юрисдикций' },
      { name: 'MCP (AI Protocol)', description: 'Model Context Protocol для подключения LLM-агентов' },
    ],
    paths: {
      '/api/orgs': {
        get: {
          tags: ['Organizations'],
          summary: 'Получить список организаций и структуру',
          description: 'Возвращает список всех зарегистрированных госорганов с подразделениями и статусом заполненности.',
          parameters: [
            {
              name: 'parentId',
              in: 'query',
              description: 'Фильтр по родительской организации',
              schema: { type: 'string' },
            },
            {
              name: 'q',
              in: 'query',
              description: 'Полнотекстовый поиск по названию или сфере деятельности',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Успешный ответ со списком органов',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/GovOrg' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/mutate': {
        post: {
          tags: ['Organizations'],
          summary: 'Мутации: блокировка, сохранение паспорта, скрепление подотчетности',
          description: 'Изменение данных ведомства, подразделений, компетенций и подотчетности с контролем прав доступа.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['action'],
                  properties: {
                    action: {
                      type: 'string',
                      enum: ['lock', 'unlock', 'update_content', 'reparent', 'create_org', 'import_csv'],
                    },
                    orgId: { type: 'string' },
                    version: { type: 'integer' },
                    payload: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Операция успешно выполнена' },
            '401': { description: 'Требуется авторизация' },
            '403': { description: 'Недостаточно прав (например, чужая юрисдикция)' },
            '409': { description: 'Конфликт версий при параллельном редактировании' },
          },
        },
      },
      '/api/ebz': {
        get: {
          tags: ['EBZ Articles'],
          summary: 'Получить статьи Единой базы знаний',
          parameters: [
            { name: 'orgId', in: 'query', schema: { type: 'string' } },
            { name: 'tag', in: 'query', schema: { type: 'string' } },
            { name: 'q', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Список статей ЕБЗ',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      total: { type: 'integer' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/EbzArticle' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['EBZ Articles'],
          summary: 'Создать или обновить статью ЕБЗ',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    article: { $ref: '#/components/schemas/EbzArticle' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Статья сохранена' },
            '400': { description: 'Некорректные данные' },
          },
        },
        delete: {
          tags: ['EBZ Articles'],
          summary: 'Удалить статью ЕБЗ',
          parameters: [
            { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Статья удалена' },
            '404': { description: 'Статья не найдена' },
          },
        },
      },
      '/api/mcp': {
        post: {
          tags: ['MCP (AI Protocol)'],
          summary: 'Model Context Protocol (JSON-RPC 2.0)',
          description:
            'Точка подключения ИИ-маршрутизаторов и LLM-агентов. Поддерживает методы tools/list и tools/call для умного поиска ведомств, подразделений и маршрутизации обращений.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jsonrpc', 'method', 'id'],
                  properties: {
                    jsonrpc: { type: 'string', example: '2.0' },
                    method: { type: 'string', example: 'tools/call' },
                    id: { type: 'string', example: 'req-1' },
                    params: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Результат выполнения метода MCP JSON-RPC' },
          },
        },
      },
    },
    components: {
      schemas: {
        GovOrg: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            fullName: { type: 'string' },
            orgNameKk: { type: 'string' },
            parentId: { type: 'string', nullable: true },
            scope: { type: 'string' },
            theme: { type: 'string' },
            jurisdiction: { type: 'string', enum: ['republican', 'regional', 'district', 'local'] },
            showOnFrontend: { type: 'boolean' },
            version: { type: 'integer' },
            departments: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrgDepartment' },
            },
          },
        },
        OrgDepartment: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            responsible: { type: 'string' },
            scope: { type: 'string' },
            theme: { type: 'string' },
          },
        },
        EbzArticle: {
          type: 'object',
          required: ['id', 'titleRu'],
          properties: {
            id: { type: 'string' },
            orgId: { type: 'string' },
            orgNameRu: { type: 'string' },
            orgNameKk: { type: 'string' },
            titleRu: { type: 'string' },
            titleKk: { type: 'string' },
            summaryRu: { type: 'string' },
            summaryKk: { type: 'string' },
            fullResponseRu: { type: 'string' },
            fullResponseKk: { type: 'string' },
            relatedNpaRu: { type: 'string' },
            relatedNpaKk: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
