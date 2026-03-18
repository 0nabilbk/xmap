// ─── Discovered Route (from code parsing) ───────────────
export interface DiscoveredRoute {
  route: string;
  filePath: string;
  label: string;
  section: string;
  isDynamic: boolean;
  params: string[];
}

// ─── Screen ─────────────────────────────────────────────
export interface XmapScreen {
  id: string;
  route: string;
  label: string;
  section: string;
  col: number;
  row: number;
  hidden?: boolean;
  /** For dynamic routes — param name to use for URL resolution */
  isDynamic?: boolean;
  params?: string[];
  /** Relative file path in the repo */
  filePath?: string;
}

// ─── Section ────────────────────────────────────────────
export interface XmapSection {
  id: string;
  label: string;
  color: string;
  screens: string[];
}

// ─── Workflow ───────────────────────────────────────────
export interface XmapWorkflow {
  id: string;
  label: string;
  description: string;
  screenIds: string[];
  edges: XmapEdge[];
}

export interface XmapEdge {
  source: string;
  target: string;
  label?: string;
}

// ─── Map State (persisted to .xmap/map.json) ────────────
export interface MapState {
  repoPath: string;
  appUrl: string;
  framework: string;
  screens: XmapScreen[];
  sections: XmapSection[];
  edges: XmapEdge[];
  workflows: XmapWorkflow[];
  hiddenScreens: string[];
  /** Per-screen param values for dynamic routes, e.g. { "dashboard-clients-_clientId_": { "clientId": "abc123" } } */
  paramValues: Record<string, Record<string, string>>;
  iframe: { width: number; height: number; scale: number };
  savedAt: string;
}

// ─── Default palette for auto-sections ──────────────────
export const SECTION_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#ec4899',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#64748b',
  '#a78bfa', '#171717',
];

// ─── Default iframe config ──────────────────────────────
export const DEFAULT_IFRAME = { width: 1440, height: 900, scale: 0.22 };
