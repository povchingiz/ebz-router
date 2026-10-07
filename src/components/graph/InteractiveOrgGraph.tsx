import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GovOrg } from '../../types';
import { OrgFlowCard } from './OrgFlowCard';
import { getDagreLayout } from './layout';
import {
  Minimize2,
  Maximize2,
  Eye,
  AlertTriangle,
  RotateCw,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';

const MAX_DEFAULT_CHILDREN = 6;

interface InteractiveOrgGraphProps {
  allOrgs: GovOrg[];
  onOpenDetails: (org: GovOrg) => void;
  selectedOrgId?: string | null;
  onSelectOrg?: (org: GovOrg) => void;
}

const nodeTypes = {
  orgCard: OrgFlowCard,
};

function GraphInner({
  allOrgs,
  onOpenDetails,
  selectedOrgId,
  onSelectOrg,
}: InteractiveOrgGraphProps) {
  const { setCenter, fitView } = useReactFlow();

  // Режим отображения: 'focus' (по умолчанию, легковесный) или 'full' (все 566 органов)
  const [isFullGraphMode, setIsFullGraphMode] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isRenderingFull, setIsRenderingFull] = useState(false);

  // Набор ID организаций, ветви которых раскрыты в режиме фокуса
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Выбранные в центр организации для родителей (parentId -> selectedChildId)
  const [featuredChildMap, setFeaturedChildMap] = useState<Map<string, string>>(new Map());

  // Целевой узел для камеры
  const lastTargetNodeId = useRef<string | null>(null);

  // Когда выбран узел через Поиск или после перепривязки:
  // Раскрываем полную цепочку предков до корня и центрируем
  useEffect(() => {
    if (selectedOrgId) {
      const orgMap = new Map<string, GovOrg>(allOrgs.map((o) => [o.id, o]));
      const nextExpanded = new Set<string>();
      const nextFeatured = new Map<string, string>();

      let curr = orgMap.get(selectedOrgId);
      lastTargetNodeId.current = selectedOrgId;

      while (curr && curr.parentId) {
        nextExpanded.add(curr.parentId);
        // Этот орган становится ключевым для своего родителя (в центре)
        nextFeatured.set(curr.parentId, curr.id);
        curr = orgMap.get(curr.parentId);
      }

      setExpandedIds(nextExpanded);
      setFeaturedChildMap(nextFeatured);
    }
  }, [selectedOrgId, allOrgs]);

  const handleToggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    lastTargetNodeId.current = id;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Выбор конкретного ребенка из выпадающего меню на карточке родителя
  const handleSelectChildFromDropdown = useCallback((parentId: string, child: GovOrg) => {
    setFeaturedChildMap((prev) => new Map(prev).set(parentId, child.id));
    lastTargetNodeId.current = child.id;
  }, []);

  // Формируем граф узлов и связей
  const { visibleNodesList, visibleEdgesList } = useMemo(() => {
    const orgMap = new Map<string, GovOrg>(allOrgs.map((o) => [o.id, o]));
    const childrenMap = new Map<string, GovOrg[]>();

    allOrgs.forEach((org) => {
      if (org.parentId) {
        const list = childrenMap.get(org.parentId) || [];
        list.push(org);
        childrenMap.set(org.parentId, list);
      }
    });

    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    // РЕЖИМ 1: ПОЛНАЯ СТРУКТУРА (ВСЕ 566 ОРГАНОВ)
    if (isFullGraphMode) {
      allOrgs.forEach((org) => {
        const children = childrenMap.get(org.id) || [];
        flowNodes.push({
          id: org.id,
          type: 'orgCard',
          position: { x: 0, y: 0 },
          selected: org.id === selectedOrgId,
          data: {
            org,
            isExpanded: true,
            hasChildren: children.length > 0,
            childrenCount: children.length,
            isSelected: org.id === selectedOrgId,
            hiddenCount: 0,
            hiddenChildren: [],
            onToggleExpand: () => {},
            onOpenDetails,
            onSelectChildFromDropdown: undefined,
          },
        });

        if (org.parentId && orgMap.has(org.parentId)) {
          flowEdges.push({
            id: `e-${org.parentId}-${org.id}`,
            source: org.parentId,
            target: org.id,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#3b82f6', strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 14,
              height: 14,
              color: '#3b82f6',
            },
          });
        }
      });

      return { visibleNodesList: flowNodes, visibleEdgesList: flowEdges };
    }

    // РЕЖИМ 2: РЕЖИМ ФОКУСА (ПО УМОЛЧАНИЮ — БЫСТРЫЙ И ПЛАВНЫЙ)
    const visibleNodeIds = new Set<string>();

    // Корневые органы (АП) всегда видимы
    const rootOrgs = allOrgs.filter((o) => !o.parentId);
    rootOrgs.forEach((r) => visibleNodeIds.add(r.id));

    // Для каждого раскрытого родителя определяем видимых детей
    const hiddenChildrenMap = new Map<string, GovOrg[]>();

    expandedIds.forEach((parentId) => {
      const allChildren = childrenMap.get(parentId) || [];
      if (allChildren.length === 0) return;

      const featuredChildId = featuredChildMap.get(parentId);

      if (featuredChildId) {
        visibleNodeIds.add(featuredChildId);
        const hidden = allChildren.filter((c) => c.id !== featuredChildId);
        hiddenChildrenMap.set(parentId, hidden);
      } else {
        const primary = allChildren.slice(0, MAX_DEFAULT_CHILDREN);
        primary.forEach((c) => visibleNodeIds.add(c.id));
        const hidden = allChildren.slice(MAX_DEFAULT_CHILDREN);
        if (hidden.length > 0) {
          hiddenChildrenMap.set(parentId, hidden);
        }
      }
    });

    visibleNodeIds.forEach((id) => {
      const org = orgMap.get(id);
      if (!org) return;

      const children = childrenMap.get(id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedIds.has(id);
      const hiddenChildren = hiddenChildrenMap.get(id) || [];

      flowNodes.push({
        id: org.id,
        type: 'orgCard',
        position: { x: 0, y: 0 },
        selected: org.id === selectedOrgId,
        data: {
          org,
          isExpanded,
          hasChildren,
          childrenCount: children.length,
          isSelected: org.id === selectedOrgId,
          hiddenCount: hiddenChildren.length,
          hiddenChildren,
          onToggleExpand: handleToggleExpand,
          onOpenDetails,
          onSelectChildFromDropdown: (child: GovOrg) =>
            handleSelectChildFromDropdown(org.id, child),
        },
      });

      if (org.parentId && visibleNodeIds.has(org.parentId)) {
        flowEdges.push({
          id: `e-${org.parentId}-${org.id}`,
          source: org.parentId,
          target: org.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#2563eb', strokeWidth: 2.5 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: '#2563eb',
          },
        });
      }
    });

    return { visibleNodesList: flowNodes, visibleEdgesList: flowEdges };
  }, [
    allOrgs,
    isFullGraphMode,
    expandedIds,
    featuredChildMap,
    selectedOrgId,
    handleToggleExpand,
    handleSelectChildFromDropdown,
    onOpenDetails,
  ]);

  const layouted = useMemo(() => {
    return getDagreLayout(visibleNodesList, visibleEdgesList, 'TB');
  }, [visibleNodesList, visibleEdgesList]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);

  useEffect(() => {
    setNodes(layouted.nodes);
    setEdges(layouted.edges);

    if (isFullGraphMode) {
      // При переходе в полный режим делаем общий обзор
      const t = setTimeout(() => {
        fitView({ padding: 0.15, duration: 500 });
        setIsRenderingFull(false);
      }, 50);
      return () => clearTimeout(t);
    }

    // В режиме фокуса плавно центрируем на целевом узле
    if (lastTargetNodeId.current) {
      const target = layouted.nodes.find((n) => n.id === lastTargetNodeId.current);
      if (target) {
        setCenter(target.position.x + 135, target.position.y + 65, {
          duration: 300,
          zoom: 0.95,
        });
      }
    }
  }, [layouted, setNodes, setEdges, setCenter, fitView, isFullGraphMode]);

  const handleCollapseAll = () => {
    setIsFullGraphMode(false);
    setExpandedIds(new Set());
    setFeaturedChildMap(new Map());
    lastTargetNodeId.current = 'ap';
  };

  const handleConfirmFullGraph = () => {
    setShowWarningModal(false);
    setIsRenderingFull(true);
    // Небольшая отсрочка для отображения спиннера
    setTimeout(() => {
      setIsFullGraphMode(true);
    }, 50);
  };

  return (
    <div className="relative w-full h-[calc(100vh-140px)] min-h-[580px] rounded-3xl overflow-hidden border-2 border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
      {/* Верхняя плавающая панель режимов отображения */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        {/* Переключатель режима: Фокус / Все 566 органов */}
        <div className="flex bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-md text-xs font-black">
          <button
            type="button"
            onClick={() => setIsFullGraphMode(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              !isFullGraphMode
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Фокус (быстрый)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isFullGraphMode) {
                setShowWarningModal(true);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              isFullGraphMode
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Вся структура (566)</span>
          </button>
        </div>

        {/* Кнопка сброса дерева в фокусе */}
        {!isFullGraphMode && expandedIds.size > 0 && (
          <button
            type="button"
            onClick={handleCollapseAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-black transition-all shadow-md border-2 border-slate-200 dark:border-slate-800"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Свернуть ветви
          </button>
        )}

        {/* Баннер активного полного режима */}
        {isFullGraphMode && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border-2 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-bold shadow-md">
            <span>⚡ Отображено: 566 органов</span>
            <button
              type="button"
              onClick={() => setIsFullGraphMode(false)}
              className="text-xs font-black underline hover:text-indigo-600"
            >
              Вернуться в фокус
            </button>
          </div>
        )}
      </div>

      {/* Индикатор рендеринга полного графа */}
      {isRenderingFull && (
        <div className="absolute inset-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
          <RotateCw className="w-8 h-8 animate-spin text-indigo-600" />
          <div className="text-sm font-black text-slate-900 dark:text-white">
            Построение связей 566 ведомств...
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Расчет графа связей Dagre
          </div>
        </div>
      )}

      {/* Модальное окно предупреждения перед включением 566 органов */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Отображение полной структуры (566 органов)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Вы собираетесь единовременно отобразить все 566 государственных органов РК и их взаимосвязи на одном экране.
              </p>
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
                Расчет расположения (Dagre Layout) и рендеринг такого графа может занять <strong>2–3 секунды</strong> и потребовать ресурсов вашего устройства. Режим «Фокус» рекомендуется для быстрой повседневной работы.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmFullGraph}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
              >
                <Layers className="w-4 h-4" />
                Да, отобразить всё дерево
              </button>
            </div>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        minZoom={0.08}
        maxZoom={2.5}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnScroll={false}
        zoomActivationKeyCode={null}
        elementsSelectable={true}
      >
        <Background color="#cbd5e1" gap={24} size={1.5} />
        <Controls className="!bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-800 !rounded-2xl !shadow-md" />
      </ReactFlow>
    </div>
  );
}

export const InteractiveOrgGraph: React.FC<InteractiveOrgGraphProps> = (props) => {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
};
