// ─── Screen ─────────────────────────────────────────────
export interface XmapScreen {
  id: string;
  url: string;
  pathname: string;
  route: string;
  title: string;
  section: string;
  screenshot?: string;
  col: number;
  row: number;
  hidden?: boolean;
  metadata?: {
    description?: string;
    h1?: string;
    linkCount?: number;
  };
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

// ─── Config ─────────────────────────────────────────────
export interface XmapConfig {
  /** Target app URL, e.g. "http://localhost:3000" */
  url: string;
  /** Path to start crawling from. Default "/" */
  startPath?: string;
  /** Max pages to discover. Default 100 */
  maxPages?: number;
  /** Wait for this selector before capturing each page */
  waitForSelector?: string;
  /** Extra wait in ms after page load */
  waitMs?: number;
  /** Route patterns to skip (glob-style) */
  ignore?: string[];
  /** Manual section definitions — overrides auto-grouping */
  sections?: Record<string, {
    label: string;
    color?: string;
    routes: string[];
  }>;
  /** Manual workflow definitions */
  workflows?: XmapWorkflow[];
  /** Iframe dimensions in the UI */
  iframe?: {
    width?: number;
    height?: number;
    scale?: number;
  };
  /** Auth configuration for crawling */
  auth?: {
    loginPath?: string;
    sessionStorageKey?: string;
    cookieName?: string;
  };
  /** Per-screen overrides keyed by route pattern */
  screenOverrides?: Record<string, Partial<XmapScreen>>;
}

// ─── Crawl output ───────────────────────────────────────
export interface XmapData {
  screens: XmapScreen[];
  sections: XmapSection[];
  edges: XmapEdge[];
  workflows: XmapWorkflow[];
  config: {
    url: string;
    iframe: { width: number; height: number; scale: number };
  };
  crawledAt: string;
}

// ─── Default palette for auto-sections ──────────────────
export const SECTION_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#ec4899',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#64748b',
  '#a78bfa', '#171717',
];
