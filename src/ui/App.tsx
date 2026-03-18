import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapState, XmapScreen, XmapSection, DiscoveredRoute } from '../shared/types';
import { SECTION_COLORS, DEFAULT_IFRAME } from '../shared/types';
import { discoverRoutes, loadMapState, saveMapState } from './data-loader';
import SetupScreen from './components/SetupScreen';
import XmapCanvas from './components/XmapCanvas';

function routeToId(route: string): string {
  return route
    .replace(/^\//, '')
    .replace(/\[([^\]]+)\]/g, '_$1_')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'root';
}

function sectionLabel(id: string): string {
  if (!id || id === 'root') return 'Root';
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, ' ');
}

function buildInitialState(
  repoPath: string,
  appUrl: string,
  framework: string,
  routes: DiscoveredRoute[]
): MapState {
  const sectionMap = new Map<string, string[]>();
  const screens: XmapScreen[] = [];

  for (const r of routes) {
    const id = routeToId(r.route);
    const section = r.section || 'root';

    if (!sectionMap.has(section)) sectionMap.set(section, []);
    sectionMap.get(section)!.push(id);

    screens.push({
      id,
      route: r.route,
      label: r.label,
      section,
      col: 0,
      row: 0,
      isDynamic: r.isDynamic,
      params: r.params,
      filePath: r.filePath,
    });
  }

  const sections: XmapSection[] = [];
  let colorIdx = 0;
  for (const [id, screenIds] of sectionMap) {
    sections.push({
      id,
      label: sectionLabel(id),
      color: SECTION_COLORS[colorIdx % SECTION_COLORS.length],
      screens: screenIds,
    });
    colorIdx++;
  }

  // Auto-layout: grid within each section
  let sectionRow = 0;
  const COLS = 4;
  for (const section of sections) {
    const sectionScreens = screens.filter((s) => section.screens.includes(s.id));
    let col = 0;
    let row = sectionRow;
    for (const screen of sectionScreens) {
      screen.col = col;
      screen.row = row;
      col++;
      if (col >= COLS) { col = 0; row++; }
    }
    sectionRow = (sectionScreens.length > 0 ? Math.max(...sectionScreens.map(s => s.row)) : sectionRow) + 2;
  }

  return {
    repoPath,
    appUrl,
    framework,
    screens,
    sections,
    edges: [],
    workflows: [],
    hiddenScreens: [],
    paramValues: {},
    iframe: { ...DEFAULT_IFRAME },
    savedAt: new Date().toISOString(),
  };
}

export default function App() {
  const [mapState, setMapState] = useState<MapState | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const lastRepo = localStorage.getItem('xmap-last-repo');
    if (lastRepo) {
      loadMapState(lastRepo)
        .then((state) => {
          if (state) {
            // Ensure paramValues exists (might be missing in older saves)
            if (!state.paramValues) state.paramValues = {};
            setMapState(state);
          }
          setChecking(false);
        })
        .catch(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  const handleConnect = useCallback(async (repoPath: string, appUrl: string) => {
    setSetupLoading(true);
    setSetupError(null);

    try {
      const existing = await loadMapState(repoPath);
      if (existing) {
        existing.appUrl = appUrl;
        if (!existing.paramValues) existing.paramValues = {};
        setMapState(existing);
        localStorage.setItem('xmap-last-repo', repoPath);
        setSetupLoading(false);
        return;
      }

      const { framework, routes } = await discoverRoutes(repoPath);

      if (routes.length === 0) {
        setSetupError('No routes found. Make sure the path points to a Next.js project with an app/ or pages/ directory.');
        setSetupLoading(false);
        return;
      }

      const state = buildInitialState(repoPath, appUrl, framework, routes);
      setMapState(state);
      localStorage.setItem('xmap-last-repo', repoPath);
      await saveMapState(repoPath, state);
    } catch (err) {
      setSetupError((err as Error).message);
    }

    setSetupLoading(false);
  }, []);

  const handleStateChange = useCallback((newState: MapState) => {
    setMapState(newState);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMapState(newState.repoPath, { ...newState, savedAt: new Date().toISOString() });
    }, 500);
  }, []);

  const handleDisconnect = useCallback(() => {
    setMapState(null);
    localStorage.removeItem('xmap-last-repo');
  }, []);

  // Re-discover: re-scan routes, merge with existing state (keep edges, workflows, paramValues, hidden)
  const handleRediscover = useCallback(async () => {
    if (!mapState) return;
    try {
      const { framework, routes } = await discoverRoutes(mapState.repoPath);
      if (routes.length === 0) return;

      const fresh = buildInitialState(mapState.repoPath, mapState.appUrl, framework, routes);

      // Merge: keep user's edges, workflows, paramValues, hidden screens
      const merged: MapState = {
        ...fresh,
        edges: mapState.edges,
        workflows: mapState.workflows,
        hiddenScreens: mapState.hiddenScreens,
        paramValues: mapState.paramValues,
      };

      // Preserve positions for screens that still exist
      for (const screen of merged.screens) {
        const old = mapState.screens.find((s) => s.id === screen.id);
        if (old) {
          screen.col = old.col;
          screen.row = old.row;
        }
      }

      setMapState(merged);
      await saveMapState(merged.repoPath, { ...merged, savedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Re-discover failed:', err);
    }
  }, [mapState]);

  if (checking) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!mapState) {
    return (
      <SetupScreen
        onConnect={handleConnect}
        loading={setupLoading}
        error={setupError}
      />
    );
  }

  return (
    <XmapCanvas
      state={mapState}
      onStateChange={handleStateChange}
      onDisconnect={handleDisconnect}
      onRediscover={handleRediscover}
    />
  );
}
