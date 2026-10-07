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
import { MoreChildrenCard } from './MoreChildrenCard';
import { getDagreLayout } from './layout';
import { Minimize2 } from 'lucide-react';

const MAX_VISIBLE_CHILDREN = 6;

interface InteractiveOrgGraphProps {
  allOrgs: GovOrg[];
  onOpenDetails: (org: GovOrg) => void;
  selectedOrgId?: string | null;
  onSelectOrg?: (org: GovOrg) => void;
}

const nodeTypes = {
  orgCard: OrgFlowCard,
  moreChildrenCard: MoreChildrenCard,
};

function GraphInner({
  allOrgs,
  onOpenDetails,
  selectedOrgId,
  onSelectOrg,
}: InteractiveOrgGraphProps) {
  const { setCenter, getNode } = useReactFlow();

  // Набор ID организаций, ветви которых раскрыты
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Индивидуально добавленные дети из выпадающего списка "Еще N"
  const [explicitlyAddedChildIds, setExplicitlyAddedChildIds] = useState<Set<string>>(new Set());

  // Запоминаем последний кликнутый узел для плавного фокуса камеры без улетания
  const lastTargetNodeId = useRef<string | null>(null);

  // Когда выбран узел через поиск в шапке:
  // Раскрываем ТОЛЬКО цепочку предков от корня до этого узла
  useEffect(() => {
    if (selectedOrgId) {
      const orgMap = new Map<string, GovOrg>(allOrgs.map((o) => [o.id, o]));
      const nextExpanded = new Set<string>();
      const nextExplicit = new Set(explicitlyAddedChildIds);

      let curr = orgMap.get(selectedOrgId);
      // Добавляем выбранный узел как явно отображаемый
      nextExplicit.add(selectedOrgId);

      while (curr && curr.parentId) {
        nextExpanded.add(curr.parentId);
        curr = orgMap.get(curr.parentId);
      }

      setExpandedIds(nextExpanded);
      setExplicitlyAddedChildIds(nextExplicit);
      lastTargetNodeId.current = selectedOrgId;
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

  const handleSelectChildFromMore = useCallback((child: GovOrg) => {
    setExplicitlyAddedChildIds((prev) => new Set(prev).add(child.id));
    lastTargetNodeId.current = child.id;
  }, []);

  // Формируем ограниченный набор видимых узлов и связей
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

    // 1. Корневые узлы (АП)
    const rootOrgs = allOrgs.filter((o) => !o.parentId);
    const visibleNodeIds = new Set<string>(rootOrgs.map((r) => r.id));

    // 2. Для каждого раскрытого узла берем первые MAX_VISIBLE_CHILDREN + явные
    expandedIds.forEach((parentId) => {
      const allChildren = childrenMap.get(parentId) || [];
      if (allChildren.length === 0) return;

      const parentOrg = orgMap.get(parentId);

      // Первые N детей
      const primaryChildren = allChildren.slice(0, MAX_VISIBLE_CHILDREN);
      primaryChildren.forEach((c) => visibleNodeIds.add(c.id));

      // Явно добавленные из дропдауна
      allChildren.forEach((c) => {
        if (explicitlyAddedChildIds.has(c.id)) {
          visibleNodeIds.add(c.id);
        }
      });

      // Если детей больше, чем MAX_VISIBLE_CHILDREN — создаем карточку "Еще N"
      const hiddenChildren = allChildren.filter((c) => !visibleNodeIds.has(c.id));
      if (hiddenChildren.length > 0 && parentOrg) {
        const moreNodeId = `more-${parentId}`;
        flowNodes.push({
          id: moreNodeId,
          type: 'moreChildrenCard',
          position: { x: 0, y: 0 },
          data: {
            parentId,
            parentName: parentOrg.name,
            hiddenChildren,
            onSelectChild: handleSelectChildFromMore,
          },
        });

        flowEdges.push({
          id: `e-${parentId}-${moreNodeId}`,
          source: parentId,
          target: moreNodeId,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 4' },
        });
      }
    });

    // Создаем карточки реальных узлов
    visibleNodeIds.forEach((id) => {
      const org = orgMap.get(id);
      if (!org) return;

      const children = childrenMap.get(id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedIds.has(id);

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
          onToggleExpand: handleToggleExpand,
          onOpenDetails,
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
    explicitlyAddedChildIds,
    selectedOrgId,
    handleToggleExpand,
    handleSelectChildFromMore,
    onOpenDetails,
  ]);

  // Вычисляем стабильный Dagre layout
  const layouted = useMemo(() => {
    return getDagreLayout(visibleNodesList, visibleEdgesList, 'TB');
  }, [visibleNodesList, visibleEdgesList]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);

  useEffect(() => {
    setNodes(layouted.nodes);
    setEdges(layouted.edges);

    // Плавное мягкое центрирование на целевом узле без улетания в угол
    if (lastTargetNodeId.current) {
      const target = layouted.nodes.find((n) => n.id === lastTargetNodeId.current);
      if (target) {
        // Плавно сдвигаем камеру к целевой организации
        setCenter(target.position.x + 155, target.position.y + 75, {
          duration: 350,
          zoom: 0.95,
        });
      }
    }
  }, [layouted, setNodes, setEdges, setCenter]);

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
    setExplicitlyAddedChildIds(new Set());
    lastTargetNodeId.current = 'ap';
  };

  return (
    <div className="relative w-full h-[calc(100vh-140px)] min-h-[580px] rounded-3xl overflow-hidden border-2 border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
      {/* Кнопка сброса веток */}
      {expandedIds.size > 0 && (
        <div className="absolute top-4 left-4 z-10">
          <button
            type="button"
            onClick={handleCollapseAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-black transition-all shadow-md border-2 border-slate-200 dark:border-slate-800"
          >
            <Minimize2 className="w-4 h-4" />
            Свернуть дерево к началу
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
