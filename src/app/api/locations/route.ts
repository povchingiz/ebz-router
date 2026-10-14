import { NextRequest, NextResponse } from 'next/server';
import locationsData from '@/data/locations_data.json';

export interface LocationItem {
  id: string;
  parentId: string;
  name: string;
  nameKk?: string;
  type: string;
  kato: string;
  breadcrumb: string;
}

const allLocations = locationsData as LocationItem[];
const locationById = new Map<string, LocationItem>();
const locationsByParent = new Map<string, LocationItem[]>();
const locationByKato = new Map<string, LocationItem>();

for (const loc of allLocations) {
  locationById.set(loc.id, loc);
  if (loc.kato) {
    locationByKato.set(loc.kato, loc);
  }
  const pid = loc.parentId || '00';
  if (!locationsByParent.has(pid)) {
    locationsByParent.set(pid, []);
  }
  locationsByParent.get(pid)!.push(loc);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const kato = searchParams.get('kato');
  const parentId = searchParams.get('parentId');
  const query = searchParams.get('query')?.trim().toLowerCase();

  // 1. Поиск по точному ID
  if (id) {
    const found = locationById.get(id);
    if (!found) {
      return NextResponse.json({ success: false, error: 'Локация не найдена' }, { status: 404 });
    }
    return NextResponse.json({ success: true, location: found });
  }

  // 2. Поиск по точному КАТО коду
  if (kato) {
    const found = locationByKato.get(kato);
    if (!found) {
      return NextResponse.json({ success: false, error: 'Код КАТО не найден' }, { status: 404 });
    }
    return NextResponse.json({ success: true, location: found });
  }

  // 3. Текстовый поиск с ранжированием
  if (query && query.length >= 2) {
    const scored: { item: LocationItem; score: number }[] = [];

    for (const item of allLocations) {
      const name = item.name.toLowerCase();
      const breadcrumb = item.breadcrumb.toLowerCase();

      if (!name.includes(query) && !breadcrumb.includes(query)) {
        continue;
      }

      let score = 10;
      if (name === query || name === `г.${query}` || name === `г. ${query}` || name === `район ${query}`) {
        score = 100;
      } else if (name.startsWith(query) || name.startsWith(`г.${query}`) || name.startsWith(`район ${query}`)) {
        score = 80;
      } else if (name.includes(query)) {
        score = 60;
      }

      // Приоритет городам, районам и областям над микро-точками
      if (['REPUBLIC_CITY', 'REGION', 'CITY', 'AREA', 'CITY_A'].includes(item.type)) {
        score += 25;
      }

      scored.push({ item, score });
    }

    scored.sort((a, b) => b.score - a.score);
    const topResults = scored.slice(0, 25).map((s) => s.item);

    return NextResponse.json({
      success: true,
      total: scored.length,
      locations: topResults,
    });
  }

  // 4. Иерархический запрос по родительскому ID
  if (parentId !== null) {
    const children = locationsByParent.get(parentId) || [];
    return NextResponse.json({
      success: true,
      parentId,
      locations: children,
    });
  }

  // По умолчанию возвращаем 20 регионов и городов респ. значения (корневой уровень)
  const roots = locationsByParent.get('00') || [];
  return NextResponse.json({
    success: true,
    locations: roots,
  });
}
