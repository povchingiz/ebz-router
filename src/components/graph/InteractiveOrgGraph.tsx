import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GovOrg } from '../../types';
import { OrgFlowCard } from './OrgFlowCard';
import { getDagreLayout } from './layout';
import { Minimize2, Plus, Sparkles } from 'lucide-react';

interface InteractiveOrgGraphProps {
  allOrgs: GovOrg[];
  onOpenDetails: (org: GovOrg) => void;
  selectedOrgId?: string | null;
  onSelectOrg?: (org: GovOrg) => void;
}

const nodeTypes = {
  orgCard: OrgFlowCard,
};

export const InteractiveOrgGraph: React.FC<InteractiveOrgGraphProps> = ({
  allOrgs,
  onOpenDetails,
  selectedOrgId,
  onSelectOrg,
}) => {
  // На старте НИ ОДНА ветка НЕ развернута (пустой Set)!
  // Отображается ТОЛЬКО главный узел (АП), сохраняя идеальный масштаб 100%!
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleToggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Разворачиваем только этот узел
        next.add(id);
      }
      return next;
    });
  }, []);

  // Вычисляем видимые узлы и связи строго по expandedIds
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

    // Корневые органы видны всегда (по умолчанию АП)
    allOrgs.filter((o) => !o.parentId).forEach((r) => visibleNodeIds.add(r.id));

    // Добавляем детей раскрытых веток
    expandedIds.forEach((parentId) => {
      const children = childrenMap.get(parentId) || [];
      children.forEach((c) => visibleNodeIds.add(c.id));
    });

    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

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
  }, [allOrgs, expandedIds, selectedOrgId, handleToggleExpand, onOpenDetails]);

  // Вычисляем DAG layout через Dagre
  const layouted = useMemo(() => {
    return getDagreLayout(visibleNodesList, visibleEdgesList, 'TB');
  }, [visibleNodesList, visibleEdgesList]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);

  useEffect(() => {
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [layouted, setNodes, setEdges]);

  // Свернуть все к корню
  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  return (
    <div className="relative w-full h-[calc(100vh-140px)] min-h-[550px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shadow-inner">
      {/* Подсказка для пользователя вверху */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          На экране: {nodes.length} ведомств
        </span>

        {expandedIds.size > 0 && (
          <button
            type="button"
            onClick={handleCollapseAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition-all shadow-xs"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Свернуть всё к началу
          </button>
        )}

        <span className="text-[11px] text-slate-400 pl-2 border-l border-slate-200 dark:border-slate-700 hidden sm:inline">
          💡 Кликните по карточке, чтобы открыть меню сведений
        </span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.25, duration: 500 }}
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background color="#cbd5e1" gap={24} size={1.5} />
        <Controls className="!bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-800 !rounded-xl !shadow-md" />
      </ReactFlow>
    </div>
  );
};
