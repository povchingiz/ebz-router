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
import { Minimize2 } from 'lucide-react';

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
  // На старте НИ ОДНА ветка НЕ развернута
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleToggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

    // Корневые органы видны всегда
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

  const layouted = useMemo(() => {
    return getDagreLayout(visibleNodesList, visibleEdgesList, 'TB');
  }, [visibleNodesList, visibleEdgesList]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);

  useEffect(() => {
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [layouted, setNodes, setEdges]);

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  return (
    <div className="relative w-full h-[calc(100vh-140px)] min-h-[550px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shadow-inner">
      {/* Кнопка сброса веток */}
      {expandedIds.size > 0 && (
        <div className="absolute top-4 left-4 z-10">
          <button
            type="button"
            onClick={handleCollapseAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all shadow-md border border-slate-200 dark:border-slate-800"
          >
            <Minimize2 className="w-4 h-4" />
            Свернуть всё к началу
          </button>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.25, duration: 250 }}
        minZoom={0.15}
        maxZoom={2.0}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnScroll={false}
        zoomActivationKeyCode={null}
        elementsSelectable={true}
      >
        <Background color="#cbd5e1" gap={24} size={1.5} />
        <Controls className="!bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-800 !rounded-xl !shadow-md" />
      </ReactFlow>
    </div>
  );
};
