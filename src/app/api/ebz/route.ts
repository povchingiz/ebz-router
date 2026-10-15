import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { EbzArticle } from '../../../types';
import { authService } from '../../../lib/auth';

const EBZ_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'ebz_articles.json');

// Кэш в памяти процесса
let articlesCache: EbzArticle[] | null = null;

function loadArticles(): EbzArticle[] {
  if (articlesCache) return articlesCache;
  try {
    if (fs.existsSync(EBZ_FILE_PATH)) {
      const raw = fs.readFileSync(EBZ_FILE_PATH, 'utf-8');
      articlesCache = JSON.parse(raw);
      return articlesCache!;
    }
  } catch (err) {
    console.error('Failed to read ebz_articles.json:', err);
  }
  return [];
}

function saveArticles(articles: EbzArticle[]): boolean {
  articlesCache = articles;
  try {
    const tempPath = `${EBZ_FILE_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(articles, null, 2), 'utf-8');
    fs.renameSync(tempPath, EBZ_FILE_PATH);
    return true;
  } catch (err) {
    console.error('Failed to write ebz_articles.json atomically:', err);
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    const tag = searchParams.get('tag');
    const q = searchParams.get('q')?.toLowerCase();

    let list = loadArticles();

    if (orgId && orgId !== 'all') {
      list = list.filter((a) => a.orgId === orgId);
    }

    if (tag && tag !== 'all') {
      list = list.filter((a) => a.tags && a.tags.includes(tag));
    }

    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      list = list.filter((a) => {
        const textTarget = [
          a.titleRu,
          a.titleKk,
          a.summaryRu,
          a.summaryKk,
          a.fullResponseRu,
          a.fullResponseKk,
          a.relatedNpaRu,
          a.relatedNpaKk,
          a.orgNameRu,
          a.orgNameKk,
          ...(a.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return tokens.every((token) => textTarget.includes(token));
      });
    }

    return NextResponse.json({
      success: true,
      total: list.length,
      data: list,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Ошибка загрузки базы знаний' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // 12-Factor & Security: Аутентификация
    const token = req.cookies.get(authService.COOKIE_NAME)?.value;
    const sessionUser = token ? authService.verifySessionToken(token) : null;

    if (!sessionUser && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация для изменения базы знаний' },
        { status: 401 }
      );
    }

    if (sessionUser && sessionUser.role === 'VIEWER') {
      return NextResponse.json(
        { success: false, error: 'У вас нет прав на редактирование статей ЕБЗ' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const article: EbzArticle = body.article || body;

    if (!article.id) {
      article.id = `ebz-${Date.now()}`;
    }

    if (!article.titleRu && !article.titleKk) {
      return NextResponse.json(
        { success: false, error: 'Заголовок статьи обязателен к заполнению' },
        { status: 400 }
      );
    }

    const currentList = loadArticles();
    const existingIndex = currentList.findIndex((a) => a.id === article.id);

    if (existingIndex >= 0) {
      currentList[existingIndex] = {
        ...currentList[existingIndex],
        ...article,
        updatedAt: new Date().toISOString(),
      };
    } else {
      currentList.unshift({
        ...article,
        createdAt: article.createdAt || new Date().toISOString().split('T')[0],
      });
    }

    const saved = saveArticles(currentList);
    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'Не удалось сохранить данные на диске' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      article,
      message: 'Статья ЕБЗ успешно сохранена',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Ошибка сохранения статьи' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(authService.COOKIE_NAME)?.value;
    const sessionUser = token ? authService.verifySessionToken(token) : null;

    if (!sessionUser && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация для удаления статей ЕБЗ' },
        { status: 401 }
      );
    }

    if (sessionUser && sessionUser.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Только Супер-администратор имеет право удалять статьи из ЕБЗ' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID статьи не указан' },
        { status: 400 }
      );
    }

    const currentList = loadArticles();
    const nextList = currentList.filter((a) => a.id !== id);

    if (nextList.length === currentList.length) {
      return NextResponse.json(
        { success: false, error: 'Статья не найдена' },
        { status: 404 }
      );
    }

    const saved = saveArticles(nextList);
    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'Не удалось обновить файл хранилища' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id,
      message: 'Статья ЕБЗ удалена',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Ошибка удаления статьи' },
      { status: 500 }
    );
  }
}
