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
 * Получение всех ID потомков для заданного узла (рекурсивно)
 */
export function getDescendantIds(nodeId: string, allOrgs: GovOrg[]): Set<string> {
  const childrenMap = new Map<string, string[]>();
  allOrgs.forEach((o) => {
    if (o.parentId) {
      const list = childrenMap.get(o.parentId) || [];
      list.push(o.id);
      childrenMap.set(o.parentId, list);
    }
  });

  const descendants = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const children = childrenMap.get(curr) || [];
    children.forEach((c) => {
      descendants.add(c);
      queue.push(c);
    });
  }
  return descendants;
}

/**
 * Строгий древовидный расчет видимых узлов и связей графа (BFS от корня).
 * ГАРАНТИИ:
 * 1. Никаких «висячих» сирот — узел может быть видим ТОЛЬКО если его родитель видим и раскрыт.
 * 2. При смене выбранного ведомства неактивные ветви автоматически отсекаются.
 * 3. В DOM никогда не попадает мусор от прошлых переходов.
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
  const hiddenChildrenMap = new Map<string, GovOrg[]>();

  // 1. Корневые органы ВСЕГДА видимы (АП)
  const queue: string[] = allOrgs.filter((o) => !o.parentId).map((o) => o.id);
  queue.forEach((rId) => visibleNodeIds.add(rId));

  // 2. Рекурсивный обход сверху вниз: только подтвержденные потомки
  let head = 0;
  while (head < queue.length) {
    const parentId = queue[head++];

    if (expandedIds.has(parentId)) {
      const allChildren = childrenMap.get(parentId) || [];
      if (allChildren.length === 0) continue;

      const featuredChildId = featuredChildMap.get(parentId);

      if (featuredChildId && orgMap.has(featuredChildId)) {
        // Выбран конкретный ребенок в центр — показываем ТОЛЬКО его!
        visibleNodeIds.add(featuredChildId);
        queue.push(featuredChildId);

        const hidden = allChildren.filter((c) => c.id !== featuredChildId);
        hiddenChildrenMap.set(parentId, hidden);
      } else {
        // Показываем первые N детей
        const primary = allChildren.slice(0, maxDefaultChildren);
        primary.forEach((c) => {
          visibleNodeIds.add(c.id);
          queue.push(c.id);
        });

        const hidden = allChildren.slice(maxDefaultChildren);
        if (hidden.length > 0) {
          hiddenChildrenMap.set(parentId, hidden);
        }
      }
    }
  }

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
    return {
      ...currentState,
      focusedOrgId: 'ap',
      cameraTargetId: 'ap',
    };
  }

  // Строим чистый путь: разворачиваем исключительно родителей искомого ведомства
  const ancestry = getAncestryPath(targetOrgId, orgMap);
  const nextExpanded = new Set<string>();
  const nextFeatured = new Map<string, string>();

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
