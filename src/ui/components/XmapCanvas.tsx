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
  type Connection,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { MapState } from '../../shared/types';
import ScreenNode, { type ScreenNodeData } from './ScreenNode';
import GroupNode, { type GroupNodeData } from './GroupNode';
import XmapSidebar from './XmapSidebar';
import { buildGraph } from '../layout';

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

const nodeTypes: NodeTypes = {
  screen: ScreenNode as any,
  'group-bg': GroupNode as any,
};

interface XmapCanvasProps {
  state: MapState;
  onStateChange: (state: MapState) => void;
  onRediscover: () => void;
}

function XmapCanvasInner({ state, onStateChange, onRediscover }: XmapCanvasProps) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    const saved = loadHidden();
    return new Set([...saved, ...state.hiddenScreens]);
  });
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const reactFlow = useReactFlow();
  const stateRef = useRef(state);
  stateRef.current = state;

  const activeWorkflow = useMemo(
    () => state.workflows.find((w) => w.id === activeWorkflowId) ?? null,
    [activeWorkflowId, state.workflows]
  );

  const handleHide = useCallback((id: string) => {
    startTransition(() => {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveHidden(next);
        return next;
      });
    });
  }, []);

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

  const handleParamChange = useCallback((screenId: string, param: string, value: string) => {
    const s = stateRef.current;
    const existing = s.paramValues[screenId] ?? {};
    onStateChange({
      ...s,
      paramValues: { ...s.paramValues, [screenId]: { ...existing, [param]: value } },
    });
  }, [onStateChange]);

  const graph = useMemo(() => {
    return buildGraph(
      state.screens, state.sections, state.edges,
      hiddenIds, handleHide, state.iframe, state.appUrl,
      state.paramValues, handleParamChange, activeWorkflow
    );
  }, [state, hiddenIds, handleHide, handleParamChange, activeWorkflow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    startTransition(() => { setNodes(graph.nodes); setEdges(graph.edges); });
  }, [graph, setNodes, setEdges]);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    const d = node.data as ScreenNodeData;
    if (d?.url) window.open(d.url, '_blank');
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    const label = window.prompt('Edge label (optional):') ?? undefined;
    setEdges((eds) => addEdge({
      ...connection, label, type: 'smoothstep',
      style: { stroke: '#d4d4d4', strokeWidth: 1.5 },
      labelStyle: { fontSize: 10, fill: '#a3a3a3', fontWeight: 500 },
      markerEnd: { type: 'arrowclosed' as any, color: '#d4d4d4', width: 14, height: 14 },
    }, eds));
    if (connection.source && connection.target) {
      const s = stateRef.current;
      if (!s.edges.some((e) => e.source === connection.source && e.target === connection.target)) {
        onStateChange({ ...s, edges: [...s.edges, { source: connection.source, target: connection.target, label }] });
      }
    }
  }, [onStateChange, setEdges]);

  useEffect(() => {
    const arr = [...hiddenIds];
    const current = [...stateRef.current.hiddenScreens].sort();
    if (JSON.stringify(arr.sort()) !== JSON.stringify(current)) {
      onStateChange({ ...stateRef.current, hiddenScreens: arr });
    }
  }, [hiddenIds, onStateChange]);

  const sidebarScreens = useMemo(() =>
    state.screens.map((s) => ({ id: s.id, label: s.label })),
  [state.screens]);

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', background: '#f5f5f5', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0 }}>
        <XmapSidebar
          sections={state.sections}
          screens={sidebarScreens}
          hiddenIds={hiddenIds}
          activeSection={activeSection}
          totalScreens={state.screens.length}
          onSectionSelect={handleSectionSelect}
          onToggleScreen={handleToggleScreen}
          onShowAll={handleShowAll}
          workflows={state.workflows}
          activeWorkflowId={activeWorkflowId}
          onWorkflowSelect={handleWorkflowSelect}
          repoPath={state.repoPath}
          appUrl={state.appUrl}
          onRediscover={onRediscover}
        />
      </div>

      <div style={{ flex: 1, padding: '10px 10px 10px 0', height: '100vh', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 8, overflow: 'hidden', position: 'relative',
          background: '#fff', border: '1px solid rgba(0,0,0,0.1)',
        }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDoubleClick={onNodeDoubleClick}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.05}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: 'smoothstep' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={30} size={5} color="#e5e5e5" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === 'group-bg') return (n.data as GroupNodeData)?.color + '15';
                return (n.data as ScreenNodeData)?.groupColor ?? '#e5e5e5';
              }}
              maskColor="rgba(255,255,255,0.7)"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function XmapCanvas(props: XmapCanvasProps) {
  return (
    <ReactFlowProvider>
      <XmapCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
