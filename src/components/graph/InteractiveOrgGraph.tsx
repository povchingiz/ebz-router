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
import { Minimize2 } from 'lucide-react';

const MAX_DEFAULT_CHILDREN = 6;

interface InteractiveOrgGraphProps {
  allOrgs: GovOrg[];
  onOpenDetails: (org: GovOrg) => void;
  selectedOrgId?: string | null;
  onSelectOrg?: (org: GovOrg) => void;
  onClearSelection?: () => void;
}

const nodeTypes = {
  orgCard: OrgFlowCard,
};

function GraphInner({
  allOrgs,
  onOpenDetails,
  selectedOrgId,
  onSelectOrg,
  onClearSelection,
}: InteractiveOrgGraphProps) {
  const { setCenter } = useReactFlow();

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

  // Формируем граф узлов и связей в режиме фокуса
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

    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

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

    // В режиме фокуса плавно центрируем на целевом узле (один раз)
    if (lastTargetNodeId.current) {
      const targetId = lastTargetNodeId.current;
      lastTargetNodeId.current = null;
      const target = layouted.nodes.find((n) => n.id === targetId);
      if (target && target.position && !isNaN(target.position.x)) {
        setCenter(target.position.x + 135, target.position.y + 65, {
          duration: 300,
          zoom: 0.95,
        });
      }
    }
  }, [layouted, setNodes, setEdges, setCenter]);

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
    setFeaturedChildMap(new Map());
    lastTargetNodeId.current = 'ap';
    onClearSelection?.();
  };

  return (
    <div className="relative w-full h-[calc(100vh-140px)] min-h-[580px] rounded-3xl overflow-hidden border-2 border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
      {/* Кнопка сброса дерева в фокусе */}
      {expandedIds.size > 0 && (
        <div className="absolute top-4 left-4 z-10">
          <button
            type="button"
            onClick={handleCollapseAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-black transition-all shadow-md border-2 border-slate-200 dark:border-slate-800"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Свернуть ветви</span>
          </button>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        minZoom={0.15}
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
