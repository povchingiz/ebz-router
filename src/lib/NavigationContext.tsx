'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { GovOrg } from '../types';
import {
  NavigationState,
  navigateToOrgAction,
  collapseToRootAction,
  computeVisibleGraph,
  getDescendantIds,
} from './navigationStore';
import { dropdownCoordinator } from '../components/graph/dropdownCoordinator';

interface NavigationContextType {
  navState: NavigationState;
  activeOrg: GovOrg | null;
  inspectorOrg: GovOrg | null;
  visibleNodeIds: Set<string>;
  hiddenChildrenMap: Map<string, GovOrg[]>;
  navigateToOrg: (orgId: string, openInspector?: boolean) => void;
  toggleExpandParent: (parentId: string) => void;
  selectChildInCenter: (parentId: string, childId: string) => void;
  openInspector: (orgId: string) => void;
  closeInspector: () => void;
  collapseAll: () => void;
  consumeCameraTarget: () => string | null;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export const NavigationProvider: React.FC<{
  allOrgs: GovOrg[];
  children: React.ReactNode;
}> = ({ allOrgs, children }) => {
  const [navState, setNavState] = useState<NavigationState>(() => ({
    focusedOrgId: 'ap',
    expandedIds: new Set<string>(),
    featuredChildMap: new Map<string, string>(),
    inspector: {
      isOpen: false,
      orgId: null,
    },
    cameraTargetId: 'ap',
  }));

  // Читаем начальный URL параметр ?org=... при монтировании
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const initialOrgId = params.get('org');
    if (initialOrgId && allOrgs.some((o) => o.id === initialOrgId)) {
      setNavState((prev) => navigateToOrgAction(initialOrgId, allOrgs, prev, false));
    }
  }, [allOrgs]);

  // Синхронизация URL без перезагрузки страницы
  const updateUrl = useCallback((orgId: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (orgId === 'ap') {
      url.searchParams.delete('org');
    } else {
      url.searchParams.set('org', orgId);
    }
    window.history.replaceState({}, '', url.toString());
  }, []);

  // 1. Атомарная навигация к любому органу
  const navigateToOrg = useCallback(
    (orgId: string, openInspector = false) => {
      setNavState((prev) => {
        const next = navigateToOrgAction(orgId, allOrgs, prev, openInspector);
        updateUrl(next.focusedOrgId);
        return next;
      });
    },
    [allOrgs, updateUrl]
  );

  // 2. Раскрыть/свернуть родителя с автоматической очисткой старых потомков
  const toggleExpandParent = useCallback((parentId: string) => {
    setNavState((prev) => {
      const nextExpanded = new Set(prev.expandedIds);
      const nextFeatured = new Map(prev.featuredChildMap);
      let nextFocused = prev.focusedOrgId;

      if (nextExpanded.has(parentId)) {
        // Сворачиваем родителя: удаляем его и ВСЕХ его потомков из expandedIds и featuredChildMap!
        nextExpanded.delete(parentId);
        nextFeatured.delete(parentId);

        const descendants = getDescendantIds(parentId, allOrgs);
        descendants.forEach((dId) => {
          nextExpanded.delete(dId);
          nextFeatured.delete(dId);
        });

        // Если фокус был внутри свернутой ветки — возвращаем фокус на свернутого родителя!
        if (descendants.has(prev.focusedOrgId) || prev.focusedOrgId === parentId) {
          nextFocused = parentId;
          updateUrl(parentId);
        }
      } else {
        // Раскрываем родителя
        nextExpanded.add(parentId);
        nextFocused = parentId;
        updateUrl(parentId);
      }

      return {
        ...prev,
        focusedOrgId: nextFocused,
        expandedIds: nextExpanded,
        featuredChildMap: nextFeatured,
        cameraTargetId: parentId,
      };
    });
  }, [allOrgs, updateUrl]);

  // 3. Выбор ребенка из дропдауна в центр: старая ветка мгновенно очищается!
  const selectChildInCenter = useCallback((parentId: string, childId: string) => {
    setNavState((prev) => {
      const nextFeatured = new Map(prev.featuredChildMap);
      const nextExpanded = new Set(prev.expandedIds);

      // Если ранее у этого родителя был выбран ДРУГОЙ ребенок — отсекаем его и всех его потомков!
      const oldFeaturedId = prev.featuredChildMap.get(parentId);
      if (oldFeaturedId && oldFeaturedId !== childId) {
        nextExpanded.delete(oldFeaturedId);
        nextFeatured.delete(oldFeaturedId);
        const oldDescendants = getDescendantIds(oldFeaturedId, allOrgs);
        oldDescendants.forEach((dId) => {
          nextExpanded.delete(dId);
          nextFeatured.delete(dId);
        });
      }

      // Родитель гарантированно открыт
      nextExpanded.add(parentId);
      // Устанавливаем нового ребенка в центр
      nextFeatured.set(parentId, childId);

      updateUrl(childId);

      return {
        ...prev,
        focusedOrgId: childId,
        expandedIds: nextExpanded,
        featuredChildMap: nextFeatured,
        cameraTargetId: childId,
      };
    });
  }, [allOrgs, updateUrl]);

  // 4. Открыть инспектор (Сведения)
  const openInspector = useCallback((orgId: string) => {
    setNavState((prev) => ({
      ...prev,
      inspector: {
        isOpen: true,
        orgId,
      },
    }));
  }, []);

  // 5. Закрыть инспектор
  const closeInspector = useCallback(() => {
    setNavState((prev) => ({
      ...prev,
      inspector: {
        isOpen: false,
        orgId: null,
      },
    }));
  }, []);

  // 6. Свернуть все к корню (АП)
  const collapseAll = useCallback(() => {
    dropdownCoordinator.close();
    setNavState(collapseToRootAction());
    updateUrl('ap');
  }, [updateUrl]);

  // Потребление цели камеры (одноразово)
  const consumeCameraTarget = useCallback(() => {
    let target: string | null = null;
    setNavState((prev) => {
      target = prev.cameraTargetId;
      if (!target) return prev;
      return {
        ...prev,
        cameraTargetId: null,
      };
    });
    return target;
  }, []);

  // Расчет видимых узлов: строго по дереву BFS
  const { visibleNodeIds, hiddenChildrenMap } = useMemo(() => {
    return computeVisibleGraph(allOrgs, navState.expandedIds, navState.featuredChildMap);
  }, [allOrgs, navState.expandedIds, navState.featuredChildMap]);

  // Гарантия: фокус ТОЛЬКО на видимом органе
  const activeOrg = useMemo(() => {
    if (visibleNodeIds.has(navState.focusedOrgId)) {
      return allOrgs.find((o) => o.id === navState.focusedOrgId) || null;
    }
    return allOrgs.find((o) => !o.parentId) || null;
  }, [allOrgs, navState.focusedOrgId, visibleNodeIds]);

  const inspectorOrg = useMemo(() => {
    if (!navState.inspector.isOpen || !navState.inspector.orgId) return null;
    return allOrgs.find((o) => o.id === navState.inspector.orgId) || null;
  }, [allOrgs, navState.inspector.isOpen, navState.inspector.orgId]);

  const value = useMemo(
    () => ({
      navState,
      activeOrg,
      inspectorOrg,
      visibleNodeIds,
      hiddenChildrenMap,
      navigateToOrg,
      toggleExpandParent,
      selectChildInCenter,
      openInspector,
      closeInspector,
      collapseAll,
      consumeCameraTarget,
    }),
    [
      navState,
      activeOrg,
      inspectorOrg,
      visibleNodeIds,
      hiddenChildrenMap,
      navigateToOrg,
      toggleExpandParent,
      selectChildInCenter,
      openInspector,
      closeInspector,
      collapseAll,
      consumeCameraTarget,
    ]
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
