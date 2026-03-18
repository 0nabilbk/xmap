import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { XmapData, XmapWorkflow } from '../../shared/types';
import ScreenNode, { type ScreenNodeData } from './ScreenNode';
import GroupNode, { type GroupNodeData } from './GroupNode';
import XmapSidebar from './XmapSidebar';
import { buildGraph } from '../layout';

// ─── localStorage ────────────────────────────────────────
const HIDDEN_KEY = 'xmap-hidden-v1';
function loadHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveHidden(ids: Set<string>) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids]));
}

// ─── Node types ──────────────────────────────────────────
const nodeTypes: NodeTypes = {
  screen: ScreenNode as any,
  'group-bg': GroupNode as any,
};

interface XmapCanvasProps {
  data: XmapData;
}

function XmapCanvasInner({ data }: XmapCanvasProps) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => loadHidden());
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const reactFlow = useReactFlow();

  const activeWorkflow = useMemo(
    () => data.workflows.find((w) => w.id === activeWorkflowId) ?? null,
    [activeWorkflowId, data.workflows]
  );

  const handleHideRef = useRef((id: string) => {
    startTransition(() => {
      setHiddenIds((prev) => { const next = new Set(prev); next.add(id); saveHidden(next); return next; });
    });
  });
  const handleHide = handleHideRef.current;

  const handleToggleScreen = useCallback((id: string) => {
    startTransition(() => {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        saveHidden(next);
        return next;
      });
    });
  }, []);

  const handleShowAll = useCallback(() => {
    startTransition(() => { setHiddenIds(new Set()); saveHidden(new Set()); });
  }, []);

  const handleSectionSelect = useCallback((sectionId: string | null) => {
    if (activeWorkflowId) return;
    setActiveSection(sectionId);
    if (!sectionId) {
      requestAnimationFrame(() => reactFlow.fitView({ padding: 0.2, duration: 400 }));
      return;
    }
    requestAnimationFrame(() => {
      reactFlow.fitView({ nodes: [{ id: `group-${sectionId}` }], padding: 0.3, duration: 400 });
    });
  }, [reactFlow, activeWorkflowId]);

  const handleWorkflowSelect = useCallback((workflowId: string | null) => {
    setActiveWorkflowId(workflowId);
    setActiveSection(null);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      reactFlow.fitView({ padding: 0.3, duration: 400 });
    }, 50);
    return () => clearTimeout(timer);
  }, [activeWorkflowId, reactFlow]);

  const graph = useMemo(() => {
    return buildGraph(
      data.screens,
      data.sections,
      data.edges,
      hiddenIds,
      handleHide,
      data.config.iframe,
      data.config.url,
      activeWorkflow
    );
  }, [data, hiddenIds, handleHide, activeWorkflow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    startTransition(() => { setNodes(graph.nodes); setEdges(graph.edges); });
  }, [graph, setNodes, setEdges]);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    const d = node.data as ScreenNodeData;
    if (d?.url) window.open(d.url, '_blank');
  }, []);

  const sidebarScreens = useMemo(() =>
    data.screens.map((s) => ({ id: s.id, label: s.title || s.route })),
  [data.screens]);

  return (
    <div className="h-screen w-screen flex bg-[#f5f5f5] overflow-hidden">
      <div className="flex-shrink-0">
        <XmapSidebar
          sections={data.sections}
          screens={sidebarScreens}
          hiddenIds={hiddenIds}
          activeSection={activeSection}
          totalScreens={data.screens.length}
          onSectionSelect={handleSectionSelect}
          onToggleScreen={handleToggleScreen}
          onShowAll={handleShowAll}
          workflows={data.workflows}
          activeWorkflowId={activeWorkflowId}
          onWorkflowSelect={handleWorkflowSelect}
        />
      </div>

      <div className="flex-1 pt-[10px] pr-[10px] pb-[10px] h-screen overflow-hidden">
        <div
          className="h-full rounded-lg overflow-hidden relative bg-white"
          style={{ border: '1px solid rgba(0,0,0,0.1)' }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.05}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: 'smoothstep' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={30} size={5} color="#e5e5e5" />
            <Controls showInteractive={false} className="!bg-white !border-neutral-200 !shadow-sm !rounded-lg" />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === 'group-bg') return (n.data as GroupNodeData)?.color + '15';
                return (n.data as ScreenNodeData)?.groupColor ?? '#e5e5e5';
              }}
              maskColor="rgba(255,255,255,0.7)"
              className="!bg-white !border-neutral-200 !shadow-sm !rounded-lg"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function XmapCanvas({ data }: XmapCanvasProps) {
  return (
    <ReactFlowProvider>
      <XmapCanvasInner data={data} />
    </ReactFlowProvider>
  );
}
