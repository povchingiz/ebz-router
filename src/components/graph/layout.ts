import { Node, Edge } from '@xyflow/react';
import dagre from 'dagre';

export const NODE_WIDTH = 290;
export const NODE_HEIGHT = 230;
export const DEPT_CLUSTER_WIDTH = 380;
export const DEPT_CLUSTER_HEIGHT = 440;

export function getDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 130,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    let width = NODE_WIDTH;
    let height = NODE_HEIGHT;

    if (node.type === 'deptCluster') {
      width = DEPT_CLUSTER_WIDTH;
      height = DEPT_CLUSTER_HEIGHT;
    } else if (node.type === 'moreChildren') {
      width = 280;
      height = 170;
    }

    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    // ВАЖНО: Ребра основной иерархии ведомств получают вес 100!
    // Благодаря этому Dagre выстраивает родительские и дочерние министерства
    // по строго прямой вертикальной оси без боковых смещений и «лесенок»!
    // Вспомогательные карточки («Еще организации», блок подразделений) имеют вес 1,
    // поэтому они отходят в сторону, не смещая центральный ствол дерева.
    const isMainSpine = !edge.id.includes('more-') && !edge.id.includes('dept-');
    dagreGraph.setEdge(edge.source, edge.target, {
      weight: isMainSpine ? 100 : 1,
    });
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    let width = NODE_WIDTH;
    let height = NODE_HEIGHT;

    if (node.type === 'deptCluster') {
      width = DEPT_CLUSTER_WIDTH;
      height = DEPT_CLUSTER_HEIGHT;
    } else if (node.type === 'moreChildren') {
      width = 280;
      height = 170;
    }

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
