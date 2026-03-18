import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, writeFileSync, mkdirSync, watch } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import pc from 'picocolors';
import sirv from 'sirv';
import { WebSocketServer } from 'ws';
import { discoverRoutes } from '../discovery/index.js';
import type { MapState, DiscoveredRoute, XmapScreen, XmapSection } from '../../shared/types.js';
import { SECTION_COLORS, DEFAULT_IFRAME } from '../../shared/types.js';

export interface DevOptions {
  repoPath: string;
  appUrl: string;
  port?: number;
  open?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders() });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

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

function buildState(
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
      id, route: r.route, label: r.label, section, col: 0, row: 0,
      isDynamic: r.isDynamic, params: r.params, filePath: r.filePath,
    });
  }

  const sections: XmapSection[] = [];
  let colorIdx = 0;
  for (const [id, screenIds] of sectionMap) {
    sections.push({
      id, label: sectionLabel(id),
      color: SECTION_COLORS[colorIdx % SECTION_COLORS.length],
      screens: screenIds,
    });
    colorIdx++;
  }

  let sectionRow = 0;
  const COLS = 4;
  for (const section of sections) {
    const ss = screens.filter((s) => section.screens.includes(s.id));
    let col = 0, row = sectionRow;
    for (const screen of ss) {
      screen.col = col; screen.row = row;
      col++; if (col >= COLS) { col = 0; row++; }
    }
    sectionRow = (ss.length > 0 ? Math.max(...ss.map(s => s.row)) : sectionRow) + 2;
  }

  return {
    repoPath, appUrl, framework, screens, sections,
    edges: [], workflows: [], hiddenScreens: [], paramValues: {},
    iframe: { ...DEFAULT_IFRAME }, savedAt: new Date().toISOString(),
  };
}

function loadState(repoPath: string, appUrl: string): MapState | null {
  const mapFile = resolve(repoPath, '.xmap', 'map.json');
  if (existsSync(mapFile)) {
    try {
      const state = JSON.parse(readFileSync(mapFile, 'utf8')) as MapState;
      state.appUrl = appUrl;
      if (!state.paramValues) state.paramValues = {};
      return state;
    } catch { /* fall through */ }
  }
  return null;
}

function saveState(state: MapState) {
  const dir = resolve(state.repoPath, '.xmap');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'map.json'), JSON.stringify(state, null, 2), 'utf8');
}

// ─── Dev server ───────────────────────────────────────────

export async function dev(options: DevOptions) {
  const { repoPath, appUrl } = options;
  const port = options.port ?? 4200;
  const shouldOpen = options.open !== false;

  console.log();
  console.log(pc.bold('  xmap'));
  console.log();
  console.log(`  ${pc.dim('Project:')} ${repoPath}`);
  console.log(`  ${pc.dim('App URL:')} ${appUrl}`);
  console.log();

  // Load or discover
  let state = loadState(repoPath, appUrl);

  if (!state) {
    console.log(pc.dim('  Discovering routes...'));
    const { framework, routes } = await discoverRoutes(repoPath);
    if (routes.length === 0) {
      console.error(pc.red('  No routes found. Is this a Next.js project?'));
      process.exit(1);
    }
    console.log(pc.green(`  Found ${routes.length} routes`));
    state = buildState(repoPath, appUrl, framework, routes);
    saveState(state);
    console.log(pc.dim(`  Saved to .xmap/map.json`));
  } else {
    console.log(pc.dim(`  Loaded ${state.screens.length} screens from .xmap/map.json`));
  }

  console.log();

  // UI assets
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const uiDir = resolve(__dirname, '..', 'ui');
  if (!existsSync(uiDir)) {
    console.error(pc.red('  UI assets not found.'));
    process.exit(1);
  }

  const serveUi = sirv(uiDir, { single: true });
  const wss = new WebSocketServer({ noServer: true });

  function broadcast(msg: object) {
    const payload = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  }

  // Watch .xmap/
  const xmapDir = resolve(repoPath, '.xmap');
  if (existsSync(xmapDir)) {
    try {
      watch(xmapDir, { recursive: true }, (_evt, filename) => {
        if (filename?.endsWith('.json')) broadcast({ type: 'reload' });
      });
    } catch { /* ok */ }
  }

  // HTTP
  const server = createServer(async (req, res) => {
    const url = req.url ?? '/';

    if (req.method === 'OPTIONS' && url.startsWith('/__xmap/')) {
      res.writeHead(204, corsHeaders()); res.end(); return;
    }

    // State — UI loads this on mount
    if (url === '/__xmap/api/state' && req.method === 'GET') {
      const fresh = loadState(repoPath, appUrl);
      jsonResponse(res, 200, fresh ?? state);
      return;
    }

    // Save — UI auto-saves
    if (url === '/__xmap/api/save' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as MapState;
        body.repoPath = repoPath;
        saveState(body);
        state = body;
        jsonResponse(res, 200, { ok: true });
      } catch {
        jsonResponse(res, 500, { error: 'Failed to save' });
      }
      return;
    }

    // Re-discover — re-scan and merge
    if (url === '/__xmap/api/rediscover' && req.method === 'POST') {
      try {
        const { framework, routes } = await discoverRoutes(repoPath);
        if (routes.length === 0) { jsonResponse(res, 200, state); return; }

        const fresh = buildState(repoPath, appUrl, framework, routes);
        const merged: MapState = {
          ...fresh,
          edges: state!.edges,
          workflows: state!.workflows,
          hiddenScreens: state!.hiddenScreens,
          paramValues: state!.paramValues,
        };
        for (const screen of merged.screens) {
          const old = state!.screens.find((s) => s.id === screen.id);
          if (old) { screen.col = old.col; screen.row = old.row; }
        }

        saveState(merged);
        state = merged;
        console.log(pc.green(`  Re-discovered ${routes.length} routes`));
        jsonResponse(res, 200, merged);
      } catch (err) {
        jsonResponse(res, 500, { error: (err as Error).message });
      }
      return;
    }

    // Screenshots
    if (url.startsWith('/__xmap/screenshots/')) {
      const id = url.replace('/__xmap/screenshots/', '');
      const filePath = resolve(repoPath, '.xmap', 'screenshots', id);
      if (!filePath.startsWith(resolve(repoPath, '.xmap', 'screenshots'))) {
        res.writeHead(403); res.end(); return;
      }
      if (existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'image/png', ...corsHeaders() });
        res.end(readFileSync(filePath));
      } else {
        res.writeHead(404); res.end();
      }
      return;
    }

    // UI
    serveUi(req, res);
  });

  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/__xmap/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else { socket.destroy(); }
  });

  server.listen(port, () => {
    console.log(`  ${pc.dim('Local:')}   ${pc.cyan(`http://localhost:${port}`)}`);
    console.log();
    if (shouldOpen) {
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${cmd} http://localhost:${port}`);
    }
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(pc.yellow(`  Port ${port} in use, trying ${port + 1}...`));
      server.listen(port + 1);
    } else { throw err; }
  });
}
