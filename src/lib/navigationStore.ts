import { GovOrg } from '../types';

/**
 * Непотопляемое состояние навигации приложения
 */
export interface NavigationState {
  // Текущий орган в фокусе (целевой орган)
  focusedOrgId: string;
  // Раскрытые родительские узлы (цепочка предков до корня + выбранные ветви)
  expandedIds: Set<string>;
  // Ключевой выбранный потомок для каждого родителя (parentId -> featuredChildId)
  featuredChildMap: Map<string, string>;
  // Боковая панель инспектора
  inspector: {
    isOpen: boolean;
    orgId: string | null;
  };
  // Целевой узел для камеры (сбрасывается после центрирования)
  cameraTargetId: string | null;
}

/**
 * Детерминированный расчет пути от любого органа до корня (АП)
 */
export function getAncestryPath(orgId: string, orgMap: Map<string, GovOrg>): string[] {
  const path: string[] = [];
  const visited = new Set<string>();
  let current: GovOrg | undefined = orgMap.get(orgId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current.id); // добавляем в начало, чтобы корень был первым
    if (!current.parentId) break;
    current = orgMap.get(current.parentId);
  }

  return path;
}

/**
 * Детерминированный расчет видимых узлов и связей графа
 * Гарантирует:
 * - Всегда виден корень (АП)
 * - Всегда видна вся цепочка предков выбранного органа
 * - Выбранный орган стоит ровно по центру под родителем
 * - Общее число активных карточек в DOM строго ограничено (макс. 15-20)
 */
export function computeVisibleGraph(
  allOrgs: GovOrg[],
  expandedIds: Set<string>,
  featuredChildMap: Map<string, string>,
  maxDefaultChildren = 6
): {
  visibleNodeIds: Set<string>;
  hiddenChildrenMap: Map<string, GovOrg[]>;
} {
  const orgMap = new Map<string, GovOrg>(allOrgs.map((o) => [o.id, o]));
  const childrenMap = new Map<string, GovOrg[]>();

  allOrgs.forEach((org) => {
    if (org.parentId) {
      const list = childrenMap.get(org.parentId) || [];
      list.push(org);
      childrenMap.set(org.parentId, list);
    }
  });

  const visibleNodeIds = new Set<string>();

  // 1. Корневые органы всегда видимы
  const roots = allOrgs.filter((o) => !o.parentId);
  roots.forEach((r) => visibleNodeIds.add(r.id));

  // 2. Раскрытые родители
  const hiddenChildrenMap = new Map<string, GovOrg[]>();

  expandedIds.forEach((parentId) => {
    const allChildren = childrenMap.get(parentId) || [];
    if (allChildren.length === 0) return;

    const featuredChildId = featuredChildMap.get(parentId);

    if (featuredChildId) {
      // Если есть выбранный орган — показываем его в центре
      visibleNodeIds.add(featuredChildId);
      const hidden = allChildren.filter((c) => c.id !== featuredChildId);
      hiddenChildrenMap.set(parentId, hidden);
    } else {
      // Иначе показываем первые N
      const primary = allChildren.slice(0, maxDefaultChildren);
      primary.forEach((c) => visibleNodeIds.add(c.id));
      const hidden = allChildren.slice(maxDefaultChildren);
      if (hidden.length > 0) {
        hiddenChildrenMap.set(parentId, hidden);
      }
    }
  });

  return { visibleNodeIds, hiddenChildrenMap };
}

/**
 * Чистый генератор состояния при переходе к любому органу
 */
export function navigateToOrgAction(
  targetOrgId: string,
  allOrgs: GovOrg[],
  currentState: NavigationState,
  openInspector = false
): NavigationState {
  const orgMap = new Map<string, GovOrg>(allOrgs.map((o) => [o.id, o]));
  const targetOrg = orgMap.get(targetOrgId);

  if (!targetOrg) {
    // Безопасный фоллбэк: если орган не найден, центрируем на АП
    return {
      ...currentState,
      focusedOrgId: 'ap',
      cameraTargetId: 'ap',
    };
  }

  // Строим цепочку родителей
  const ancestry = getAncestryPath(targetOrgId, orgMap);
  const nextExpanded = new Set(currentState.expandedIds);
  const nextFeatured = new Map(currentState.featuredChildMap);

  for (let i = 0; i < ancestry.length - 1; i++) {
    const parentId = ancestry[i];
    const childId = ancestry[i + 1];
    nextExpanded.add(parentId);
    nextFeatured.set(parentId, childId);
  }

  return {
    focusedOrgId: targetOrgId,
    expandedIds: nextExpanded,
    featuredChildMap: nextFeatured,
    inspector: openInspector
      ? { isOpen: true, orgId: targetOrgId }
      : currentState.inspector,
    cameraTargetId: targetOrgId,
  };
}

/**
 * Чистый генератор состояния при полном сбросе к корню
 */
export function collapseToRootAction(): NavigationState {
  return {
    focusedOrgId: 'ap',
    expandedIds: new Set<string>(),
    featuredChildMap: new Map<string, string>(),
    inspector: {
      isOpen: false,
      orgId: null,
    },
    cameraTargetId: 'ap',
  };
}
