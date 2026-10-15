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
import { DepartmentNode } from './DepartmentNode';
import { getDagreLayout, NODE_WIDTH, NODE_HEIGHT } from './layout';
import { useNavigation } from '../../lib/NavigationContext';
import { RotateCcw, ArrowDownUp, ArrowLeftRight } from 'lucide-react';
import { dropdownCoordinator } from './dropdownCoordinator';

interface InteractiveOrgGraphProps {
  allOrgs: GovOrg[];
  layoutDirection?: 'TB' | 'LR';
}

const nodeTypes = {
  orgCard: OrgFlowCard,
  moreChildren: MoreChildrenCard,
  departmentCard: DepartmentNode,
};

function GraphInner({ allOrgs, layoutDirection: propLayoutDirection }: InteractiveOrgGraphProps) {
  const { fitView } = useReactFlow();
  const [innerLayoutDirection, setInnerLayoutDirection] = useState<'TB' | 'LR'>('TB');
  const layoutDirection = propLayoutDirection || innerLayoutDirection;
  const [expandedDeptOrgIds, setExpandedDeptOrgIds] = useState<Set<string>>(new Set());

  const {
    navState,
    visibleNodeIds,
    hiddenChildrenMap,
    toggleExpandParent,
    selectChildInCenter,
    showAllChildren,
    openInspector,
    collapseAll,
  } = useNavigation();

  // Автоматически раскрываем подразделения, когда фокус падает на ведомство с подразделениями
  useEffect(() => {
    if (navState.focusedOrgId) {
      const org = allOrgs.find((o) => o.id === navState.focusedOrgId);
      if (org?.departments && org.departments.length > 0) {
        setExpandedDeptOrgIds((prev) => {
          const next = new Set(prev);
          next.add(org.id);
          return next;
        });
      }
    }
  }, [navState.focusedOrgId, allOrgs]);

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

      const parentOrg = org.parentId ? orgMap.get(org.parentId) : null;
      const parentName = parentOrg ? (parentOrg.name || parentOrg.fullName) : undefined;

      const children = childrenMap.get(id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = navState.expandedIds.has(id);
      const isFocused = navState.focusedOrgId === id;
      const showDepartments = expandedDeptOrgIds.has(org.id);

      nodes.push({
        id: org.id,
        type: 'orgCard',
        position: { x: 0, y: 0 },
        selected: isFocused,
        data: {
          org,
          parentName,
          isExpanded,
          hasChildren,
          childrenCount: children.length,
          isSelected: isFocused,
          layoutDirection,
          showDepartments,
          onToggleExpand: () => {
            dropdownCoordinator.close();
            toggleExpandParent(org.id);
          },
          onOpenDetails: () => {
            dropdownCoordinator.close();
            openInspector(org.id);
          },
          onToggleDepartments: () => {
            setExpandedDeptOrgIds((prev) => {
              const next = new Set(prev);
              if (next.has(org.id)) next.delete(org.id);
              else next.add(org.id);
              return next;
            });
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

    // Добавляем карточку «Еще организации» для остальных подчиненных ведомств
    hiddenChildrenMap.forEach((hiddenChildren, parentId) => {
      if (hiddenChildren.length === 0 || !navState.expandedIds.has(parentId)) return;

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
          onShowAll: () => {
            showAllChildren(parentId);
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
    expandedDeptOrgIds,
    layoutDirection,
    toggleExpandParent,
    openInspector,
    selectChildInCenter,
    showAllChildren,
  ]);

  const layouted = useMemo(() => {
    const base = getDagreLayout(flowNodes, flowEdges, layoutDirection);
    const posMap = new Map(base.nodes.map((n) => [n.id, n.position]));

    const deptNodes: Node[] = [];
    const deptEdges: Edge[] = [];

    const DEPT_WIDTH = 260;
    const DEPT_HEIGHT = 100;
    const GAP_X = 20;
    const GAP_Y = 16;

    expandedDeptOrgIds.forEach((orgId) => {
      if (!visibleNodeIds.has(orgId)) return;
      const org = allOrgs.find((o) => o.id === orgId);
      if (!org?.departments || org.departments.length === 0) return;

      const parentPos = posMap.get(orgId);
      if (!parentPos) return;

      // Если основной граф расположен вертикально (TB):
      // Подразделения выходят перпендикулярно — по горизонтали вправо!
      // Формируем аккуратную сетку из 2 колонок вправо
      if (layoutDirection === 'TB') {
        const cols = 2;
        org.departments.forEach((dept, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const x = parentPos.x + NODE_WIDTH + 70 + col * (DEPT_WIDTH + GAP_X);
          const y = parentPos.y + row * (DEPT_HEIGHT + GAP_Y);

          deptNodes.push({
            id: `dept-${dept.id}`,
            type: 'departmentCard',
            position: { x, y },
            data: {
              department: dept,
              parentOrgName: org.name,
              layoutDirection,
              onSelect: () => {
                openInspector(org.id);
              },
            },
          });

          // Соединяем только первое подразделение каждого ряда или общее звено,
          // чтобы избежать паутины из 57 стрелок:
          // стрелка идет от dept-source к каждому подразделению в первой колонке
          if (col === 0) {
            deptEdges.push({
              id: `e-dept-${org.id}-${dept.id}`,
              source: org.id,
              sourceHandle: 'dept-source',
              target: `dept-${dept.id}`,
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '3 3' },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 10,
                height: 10,
                color: '#6366f1',
              },
            });
          }
        });
      } else {
        // Если основной граф расположен горизонтально (LR):
        // Подразделения выходят перпендикулярно — по вертикали вниз!
        // Формируем аккуратную сетку из 2 рядов вниз
        const rows = 2;
        org.departments.forEach((dept, idx) => {
          const row = idx % rows;
          const col = Math.floor(idx / rows);
          const x = parentPos.x + col * (DEPT_WIDTH + GAP_X);
          const y = parentPos.y + NODE_HEIGHT + 70 + row * (DEPT_HEIGHT + GAP_Y);

          deptNodes.push({
            id: `dept-${dept.id}`,
            type: 'departmentCard',
            position: { x, y },
            data: {
              department: dept,
              parentOrgName: org.name,
              layoutDirection,
              onSelect: () => {
                openInspector(org.id);
              },
            },
          });

          if (row === 0) {
            deptEdges.push({
              id: `e-dept-${org.id}-${dept.id}`,
              source: org.id,
              sourceHandle: 'dept-source',
              target: `dept-${dept.id}`,
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '3 3' },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 10,
                height: 10,
                color: '#6366f1',
              },
            });
          }
        });
      }
    });

    return {
      nodes: [...base.nodes, ...deptNodes],
      edges: [...base.edges, ...deptEdges],
    };
  }, [flowNodes, flowEdges, layoutDirection, expandedDeptOrgIds, visibleNodeIds, allOrgs, openInspector]);

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
