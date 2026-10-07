'use client';

import React, { useMemo, useEffect } from 'react';
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
import { useNavigation } from '../../lib/NavigationContext';
import { Minimize2 } from 'lucide-react';
import { dropdownCoordinator } from './dropdownCoordinator';

interface InteractiveOrgGraphProps {
  allOrgs: GovOrg[];
}

const nodeTypes = {
  orgCard: OrgFlowCard,
};

function GraphInner({ allOrgs }: InteractiveOrgGraphProps) {
  const { fitView } = useReactFlow();
  const {
    navState,
    visibleNodeIds,
    hiddenChildrenMap,
    toggleExpandParent,
    selectChildInCenter,
    openInspector,
    collapseAll,
    consumeCameraTarget,
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
      const hiddenChildren = hiddenChildrenMap.get(id) || [];
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
          hiddenCount: hiddenChildren.length,
          hiddenChildren,
          onToggleExpand: () => {
            dropdownCoordinator.close();
            toggleExpandParent(org.id);
          },
          onOpenDetails: () => {
            dropdownCoordinator.close();
            openInspector(org.id);
          },
          onSelectChildFromDropdown: (child: GovOrg) => {
            dropdownCoordinator.close();
            selectChildInCenter(org.id, child.id);
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

    return { flowNodes: nodes, flowEdges: edges };
  }, [
    allOrgs,
    visibleNodeIds,
    hiddenChildrenMap,
    navState.expandedIds,
    navState.focusedOrgId,
    toggleExpandParent,
    openInspector,
    selectChildInCenter,
  ]);

  const layouted = useMemo(() => {
    return getDagreLayout(flowNodes, flowEdges, 'TB');
  }, [flowNodes, flowEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);

  useEffect(() => {
    setNodes(layouted.nodes);
    setEdges(layouted.edges);

    // Плавное адаптивное центрирование графа в видимой области:
    // Если открыт инспектор сведений справа — центрируем в левой рабочей области, чтобы карточки не перекрывались
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
      {/* Кнопка сброса дерева */}
      {navState.expandedIds.size > 0 && (
        <div className="absolute top-4 left-4 z-10">
          <button
            type="button"
            onClick={collapseAll}
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
        onPaneClick={() => dropdownCoordinator.close()}
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
