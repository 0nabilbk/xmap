import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, writeFileSync, mkdirSync, watch } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import pc from 'picocolors';
import sirv from 'sirv';
import { WebSocketServer } from 'ws';
import { discoverRoutes } from '../discovery/index.js';
import type { MapState } from '../../shared/types.js';

interface DevOptions {
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
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...corsHeaders(),
  });
  res.end(payload);
}

function errorResponse(res: ServerResponse, status: number, message: string) {
  jsonResponse(res, status, { error: message });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseJsonBody<T = unknown>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Resolve and validate a repo path from the client. */
function resolveRepoPath(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const resolved = resolve(raw);
  if (!existsSync(resolved)) return null;
  return resolved;
}

// ─── API handlers ─────────────────────────────────────────

async function handleDiscover(req: IncomingMessage, res: ServerResponse) {
  const raw = await readBody(req);
  const body = parseJsonBody<{ repoPath?: string }>(raw);
  if (!body) return errorResponse(res, 400, 'Invalid JSON body');

  const repoPath = resolveRepoPath(body.repoPath);
  if (!repoPath) return errorResponse(res, 400, 'Invalid or missing repoPath');

  try {
    const result = await discoverRoutes(repoPath);
    jsonResponse(res, 200, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Discovery failed';
    errorResponse(res, 500, message);
  }
}

async function handleSave(req: IncomingMessage, res: ServerResponse) {
  const raw = await readBody(req);
  const body = parseJsonBody<{ repoPath?: string; state?: MapState }>(raw);
  if (!body) return errorResponse(res, 400, 'Invalid JSON body');

  const repoPath = resolveRepoPath(body.repoPath);
  if (!repoPath) return errorResponse(res, 400, 'Invalid or missing repoPath');
  if (!body.state) return errorResponse(res, 400, 'Missing state');

  try {
    const xmapDir = resolve(repoPath, '.xmap');
    if (!existsSync(xmapDir)) mkdirSync(xmapDir, { recursive: true });

    const mapFile = resolve(xmapDir, 'map.json');
    writeFileSync(mapFile, JSON.stringify(body.state, null, 2), 'utf8');
    jsonResponse(res, 200, { ok: true });
  } catch {
    errorResponse(res, 500, 'Failed to write map.json');
  }
}

function handleScreenshot(url: string, res: ServerResponse) {
  // The screenshot path encodes repoPath as a query param: /__xmap/screenshots/:id?repo=/path
  const parsed = new URL(url, 'http://localhost');
  const repoPath = parsed.searchParams.get('repo');
  const id = parsed.pathname.replace('/__xmap/screenshots/', '');

  if (!repoPath || !id) {
    res.writeHead(400);
    res.end('Missing repo or screenshot id');
    return;
  }

  const resolved = resolve(repoPath);
  const filePath = resolve(resolved, '.xmap', 'screenshots', id);

  // Prevent path traversal
  if (!filePath.startsWith(resolve(resolved, '.xmap', 'screenshots'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (existsSync(filePath)) {
    const data = readFileSync(filePath);
    const ext = id.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, ...corsHeaders() });
    res.end(data);
  } else {
    res.writeHead(404, corsHeaders());
    res.end('Not found');
  }
}

// ─── Dev server ───────────────────────────────────────────

export async function dev(options: DevOptions) {
  const port = options.port ?? 4200;
  const shouldOpen = options.open !== false;

  // Resolve the pre-built UI directory
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const uiDir = resolve(__dirname, '..', 'ui');
  if (!existsSync(uiDir)) {
    console.error(pc.red('UI assets not found. The package may not be built correctly.'));
    process.exit(1);
  }

  const serveUi = sirv(uiDir, { single: true });

  // WebSocket for live reload
  const wss = new WebSocketServer({ noServer: true });

  function broadcast(msg: object) {
    const payload = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  }

  // Track watched directories so we can watch when repo changes
  let currentWatcher: ReturnType<typeof watch> | null = null;

  function watchRepo(repoPath: string) {
    const xmapDir = resolve(repoPath, '.xmap');
    if (!existsSync(xmapDir)) return;

    // Close previous watcher if repo changed
    if (currentWatcher) {
      currentWatcher.close();
      currentWatcher = null;
    }

    try {
      currentWatcher = watch(xmapDir, { recursive: true }, (_eventType, filename) => {
        if (filename?.endsWith('.json')) {
          console.log(pc.dim(`  Data changed: ${filename} — reloading`));
          broadcast({ type: 'reload' });
        }
      });
    } catch {
      // fs.watch may not be available everywhere
    }
  }

  // HTTP server
  const server = createServer(async (req, res) => {
    const url = req.url ?? '/';

    // Handle CORS preflight
    if (req.method === 'OPTIONS' && url.startsWith('/__xmap/')) {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    // ── API routes ──────────────────────────────────────

    if (url === '/__xmap/api/discover' && req.method === 'POST') {
      await handleDiscover(req, res);
      return;
    }

    if (url === '/__xmap/api/load' && req.method === 'POST') {
      const raw = await readBody(req);
      const body = parseJsonBody<{ repoPath?: string }>(raw);
      if (!body) return errorResponse(res, 400, 'Invalid JSON body');
      const repoPath = resolveRepoPath(body.repoPath);
      if (!repoPath) return errorResponse(res, 400, 'Invalid or missing repoPath');

      // Start watching this repo
      watchRepo(repoPath);

      const mapFile = resolve(repoPath, '.xmap', 'map.json');
      if (!existsSync(mapFile)) {
        return jsonResponse(res, 200, null);
      }
      try {
        const data = readFileSync(mapFile, 'utf8');
        const state = JSON.parse(data) as MapState;
        jsonResponse(res, 200, state);
      } catch {
        errorResponse(res, 500, 'Failed to read map.json');
      }
      return;
    }

    if (url === '/__xmap/api/save' && req.method === 'POST') {
      await handleSave(req, res);
      return;
    }

    // ── Screenshots ─────────────────────────────────────

    if (url.startsWith('/__xmap/screenshots/')) {
      handleScreenshot(url, res);
      return;
    }

    // ── UI (catch-all, single-page app) ─────────────────

    serveUi(req, res);
  });

  // Handle WebSocket upgrade
  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/__xmap/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  // Start listening
  server.listen(port, () => {
    console.log();
    console.log(pc.bold('  xmap'));
    console.log();
    console.log(`  ${pc.dim('Local:')}   ${pc.cyan(`http://localhost:${port}`)}`);
    console.log();

    if (shouldOpen) {
      const openCmd =
        process.platform === 'darwin' ? 'open' :
        process.platform === 'win32' ? 'start' :
        'xdg-open';
      exec(`${openCmd} http://localhost:${port}`);
    }
  });

  // Handle port in use
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(pc.yellow(`Port ${port} is in use, trying ${port + 1}...`));
      server.listen(port + 1);
    } else {
      throw err;
    }
  });
}
