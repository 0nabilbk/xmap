import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { XmapScreen, XmapSection, XmapWorkflow, XmapEdge } from '../shared/types';
import type { GroupNodeData } from './components/GroupNode';
import type { ScreenNodeData } from './components/ScreenNode';

// ─── Grid constants ────────────────────────────────────
const CW = 480;
const RH = 420;
const PAD = 48;

export function buildGraph(
  screens: XmapScreen[],
  sections: XmapSection[],
  allEdges: XmapEdge[],
  hiddenIds: Set<string>,
  onHide: (id: string) => void,
  iframeConfig: { width: number; height: number; scale: number },
  appUrl: string,
  activeWorkflow?: XmapWorkflow | null
) {
  const NODE_W = Math.round(iframeConfig.width * iframeConfig.scale) + 16;
  const NODE_H = Math.round(iframeConfig.height * iframeConfig.scale) + 80; // label + route bars

  // Filter visible screens
  const visibleScreens = activeWorkflow
    ? screens.filter((s) => activeWorkflow.screenIds.includes(s.id))
    : screens.filter((s) => !hiddenIds.has(s.id));
  const visibleIds = new Set(visibleScreens.map((s) => s.id));

  // Section origins
  const sectionOrigins: Record<string, { x: number; y: number }> = {};
  for (const section of sections) {
    const children = visibleScreens.filter((s) => section.screens.includes(s.id));
    if (children.length === 0) continue;
    const minCol = Math.min(...children.map((s) => s.col));
    const minRow = Math.min(...children.map((s) => s.row));
    sectionOrigins[section.id] = {
      x: minCol * CW - PAD,
      y: minRow * RH - PAD - 24,
    };
  }

  // Group background nodes
  const groupNodes: Node[] = [];
  for (const section of sections) {
    const children = visibleScreens.filter((s) => section.screens.includes(s.id));
    if (children.length === 0) continue;

    const minCol = Math.min(...children.map((s) => s.col));
    const maxCol = Math.max(...children.map((s) => s.col));
    const minRow = Math.min(...children.map((s) => s.row));
    const maxRow = Math.max(...children.map((s) => s.row));

    groupNodes.push({
      id: `group-${section.id}`,
      type: 'group-bg',
      position: {
        x: minCol * CW - PAD,
        y: minRow * RH - PAD - 24,
      },
      zIndex: -1,
      style: { width: (maxCol - minCol) * CW + NODE_W + PAD * 2, height: (maxRow - minRow) * RH + NODE_H + PAD * 2 + 24 },
      data: {
        label: section.label,
        color: section.color,
        width: (maxCol - minCol) * CW + NODE_W + PAD * 2,
        height: (maxRow - minRow) * RH + NODE_H + PAD * 2 + 24,
      } satisfies GroupNodeData,
    });
  }

  // Screen nodes
  const sectionColorMap = new Map(sections.map((s) => [s.id, s.color]));

  const screenNodes: Node[] = visibleScreens.map((s) => {
    const groupOrigin = sectionOrigins[s.section];
    const parentId = groupOrigin ? `group-${s.section}` : undefined;
    const position = groupOrigin
      ? { x: s.col * CW - groupOrigin.x, y: s.row * RH - groupOrigin.y }
      : { x: s.col * CW, y: s.row * RH };

    return {
      id: s.id,
      type: 'screen',
      position,
      parentId,
      expandParent: true,
      zIndex: 2,
      data: {
        label: s.title || s.route,
        route: s.route,
        url: s.url,
        group: s.section,
        groupColor: sectionColorMap.get(s.section) ?? '#999',
        screenshotUrl: s.screenshot ? `/__xmap/screenshots/${s.id}.png` : undefined,
        iframeWidth: iframeConfig.width,
        iframeHeight: iframeConfig.height,
        iframeScale: iframeConfig.scale,
        onHide,
      } satisfies ScreenNodeData,
    };
  });

  // Edges
  const edgeDefs = activeWorkflow ? activeWorkflow.edges : allEdges;
  const edges: Edge[] = edgeDefs
    .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
    .map((e) => ({
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label: e.label,
      type: 'smoothstep',
      style: { stroke: '#d4d4d4', strokeWidth: 1.5 },
      labelStyle: { fontSize: 10, fill: '#a3a3a3', fontWeight: 500 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#d4d4d4', width: 14, height: 14 },
    }));

  return { nodes: [...groupNodes, ...screenNodes], edges };
}
