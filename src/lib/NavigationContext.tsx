'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { GovOrg } from '../types';
import {
  NavigationState,
  navigateToOrgAction,
  collapseToRootAction,
  computeVisibleGraph,
} from './navigationStore';

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

  // 2. Раскрыть/свернуть родителя
  const toggleExpandParent = useCallback((parentId: string) => {
    setNavState((prev) => {
      const nextExpanded = new Set(prev.expandedIds);
      if (nextExpanded.has(parentId)) {
        nextExpanded.delete(parentId);
      } else {
        nextExpanded.add(parentId);
      }
      return {
        ...prev,
        expandedIds: nextExpanded,
        cameraTargetId: parentId,
      };
    });
  }, []);

  // 3. Выбор ребенка из дропдауна в центр
  const selectChildInCenter = useCallback((parentId: string, childId: string) => {
    setNavState((prev) => {
      const nextFeatured = new Map(prev.featuredChildMap);
      nextFeatured.set(parentId, childId);
      return {
        ...prev,
        focusedOrgId: childId,
        featuredChildMap: nextFeatured,
        cameraTargetId: childId,
      };
    });
  }, []);

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

  // Расчет видимых узлов
  const { visibleNodeIds, hiddenChildrenMap } = useMemo(() => {
    return computeVisibleGraph(allOrgs, navState.expandedIds, navState.featuredChildMap);
  }, [allOrgs, navState.expandedIds, navState.featuredChildMap]);

  const activeOrg = useMemo(() => {
    return allOrgs.find((o) => o.id === navState.focusedOrgId) || null;
  }, [allOrgs, navState.focusedOrgId]);

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
