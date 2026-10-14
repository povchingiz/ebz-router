'use client';

import React, { useMemo, useEffect, useState } from 'react';
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
import { useNavigation } from '../../lib/NavigationContext';
import { RotateCcw, ArrowDownUp, ArrowLeftRight } from 'lucide-react';
import { dropdownCoordinator } from './dropdownCoordinator';

interface InteractiveOrgGraphProps {
  allOrgs: GovOrg[];
}

const nodeTypes = {
  orgCard: OrgFlowCard,
  moreChildren: MoreChildrenCard,
};

function GraphInner({ allOrgs }: InteractiveOrgGraphProps) {
  const { fitView } = useReactFlow();
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB');

  const {
    navState,
    visibleNodeIds,
    hiddenChildrenMap,
    toggleExpandParent,
    selectChildInCenter,
    openInspector,
    collapseAll,
  } = useNavigation();

  // Построение графа узлов и связей на основе детерминированного состояния
  const { flowNodes, flowEdges } = useMemo(() => {
    const orgMap = new Map<string, GovOrg>(allOrgs.map((o) => [o.id, o]));
    const childrenMap = new Map<string, GovOrg[]>();

    allOrgs.forEach((org) => {
      if (org.parentId) {
        const list = childrenMap.get(org.parentId) || [];
        list.push(org);
        childrenMap.set(org.parentId, list);
      }
    });

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    visibleNodeIds.forEach((id) => {
      const org = orgMap.get(id);
      if (!org) return;

      const children = childrenMap.get(id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = navState.expandedIds.has(id);
      const isFocused = navState.focusedOrgId === id;

      nodes.push({
        id: org.id,
        type: 'orgCard',
        position: { x: 0, y: 0 },
        selected: isFocused,
        data: {
          org,
          isExpanded,
          hasChildren,
          childrenCount: children.length,
          isSelected: isFocused,
          layoutDirection,
          onToggleExpand: () => {
            dropdownCoordinator.close();
            toggleExpandParent(org.id);
          },
          onOpenDetails: () => {
            dropdownCoordinator.close();
            openInspector(org.id);
          },
        },
      });

      if (org.parentId && visibleNodeIds.has(org.parentId)) {
        edges.push({
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

    // Добавляем «полупрозрачную» карточку-компаньон для остальных подотчетных (только на нижнем активном уровне)
    hiddenChildrenMap.forEach((hiddenChildren, parentId) => {
      if (hiddenChildren.length === 0 || !navState.expandedIds.has(parentId)) return;

      // Проверяем, является ли parentId промежуточным вышестоящим уровнем:
      // 1. Если выбран конкретный потомок в центр (транзитный проход к целевому органу)
      const isTransitAncestor = navState.featuredChildMap.has(parentId);

      // 2. Если в ветке ниже уже раскрыты другие дочерние узлы
      const hasDeeperExpansion = Array.from(navState.expandedIds).some((expId) => {
        if (expId === parentId) return false;
        let cur = orgMap.get(expId);
        while (cur && cur.parentId) {
          if (cur.parentId === parentId) return true;
          cur = orgMap.get(cur.parentId);
        }
        return false;
      });

      // Не показываем карточку "ЕЩЕ" на вышестоящих уровнях (АП, КПМ),
      // она должна появляться только на самом нижнем активном уровне просмотра (например, МИИЦР)
      if (isTransitAncestor || hasDeeperExpansion) {
        return;
      }

      const parentOrg = orgMap.get(parentId);
      const moreNodeId = `more-${parentId}`;

      nodes.push({
        id: moreNodeId,
        type: 'moreChildren',
        position: { x: 0, y: 0 },
        data: {
          parentId,
          parentName: parentOrg?.name || 'ведомства',
          hiddenChildren,
          layoutDirection,
          onSelectChild: (child: GovOrg) => {
            selectChildInCenter(parentId, child.id);
          },
        },
      });

      edges.push({
        id: `e-${parentId}-${moreNodeId}`,
        source: parentId,
        target: moreNodeId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#60a5fa', strokeWidth: 2, strokeDasharray: '4 4' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: '#60a5fa',
        },
      });
    });

    return { flowNodes: nodes, flowEdges: edges };
  }, [
    allOrgs,
    visibleNodeIds,
    hiddenChildrenMap,
    navState.expandedIds,
    navState.focusedOrgId,
    layoutDirection,
    toggleExpandParent,
    openInspector,
    selectChildInCenter,
  ]);

  const layouted = useMemo(() => {
    return getDagreLayout(flowNodes, flowEdges, layoutDirection);
  }, [flowNodes, flowEdges, layoutDirection]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);

  useEffect(() => {
    setNodes(layouted.nodes);
    setEdges(layouted.edges);

    const timer = setTimeout(() => {
      fitView({
        padding: {
          top: 0.15,
          bottom: 0.15,
          left: 0.1,
          right: navState.inspector.isOpen ? 0.45 : 0.1,
        },
        duration: 350,
        maxZoom: 1.0,
      });
    }, 40);

    return () => clearTimeout(timer);
  }, [layouted, navState.inspector.isOpen, fitView, setNodes, setEdges]);

  return (
    <div className="relative w-full h-[calc(100vh-140px)] min-h-[580px] rounded-3xl overflow-hidden border-2 border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
      {/* Верхняя панель управления графом: очистка доски + переключатель ориентации */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {/* Кнопка сброса дерева / очистки доски на графе */}
        {(navState.expandedIds.size > 0 || navState.focusedOrgId !== 'ap' || navState.inspector.isOpen) && (
          <button
            type="button"
            onClick={collapseAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-black transition-all shadow-md border-2 border-slate-200 dark:border-slate-800"
            title="Очистить доску и свернуть все открытые карточки к корню (АП)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
            <span>Очистить доску</span>
          </button>
        )}

        {/* Переключатель ориентации: По вертикали (TB) ⇄ По горизонтали (LR) */}
        <button
          type="button"
          onClick={() => setLayoutDirection((prev) => (prev === 'TB' ? 'LR' : 'TB'))}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-black transition-all shadow-md border-2 border-slate-200 dark:border-slate-800"
          title="Сменить ориентацию раскладки графа"
        >
          {layoutDirection === 'TB' ? (
            <>
              <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
              <span>Вид: В горизонталь</span>
            </>
          ) : (
            <>
              <ArrowDownUp className="w-3.5 h-3.5 text-blue-600" />
              <span>Вид: В вертикаль</span>
            </>
          )}
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={() => dropdownCoordinator.close()}
        minZoom={0.15}
        maxZoom={2.5}
        panOnScroll={true}
        zoomOnScroll={false}
        zoomActivationKeyCode="Control"
        zoomOnPinch={true}
        panOnDrag={true}
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
