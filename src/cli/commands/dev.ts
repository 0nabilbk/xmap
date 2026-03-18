import { createServer } from 'node:http';
import { existsSync, readFileSync, watch } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { exec } from 'node:child_process';
import pc from 'picocolors';
import sirv from 'sirv';
import { WebSocketServer } from 'ws';

interface DevOptions {
  port?: number;
  open?: boolean;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export async function dev(options: DevOptions) {
  const port = options.port ?? 4200;
  const shouldOpen = options.open !== false;
  const cwd = process.cwd();

  // Check .xmap/screens.json exists
  const dataPath = resolve(cwd, '.xmap', 'screens.json');
  if (!existsSync(dataPath)) {
    console.error(pc.red('No .xmap/screens.json found.'));
    console.error(pc.dim(`Run ${pc.cyan('xmap crawl')} first to discover screens.`));
    process.exit(1);
  }

  // Resolve the pre-built UI directory
  const uiDir = resolve(import.meta.dirname, '..', '..', 'ui');
  if (!existsSync(uiDir)) {
    console.error(pc.red('UI assets not found. The package may not be built correctly.'));
    process.exit(1);
  }

  // Static file handler for the pre-built UI
  const serveUi = sirv(uiDir, { single: true });

  // WebSocket for live reload
  const wss = new WebSocketServer({ noServer: true });

  function broadcast(msg: object) {
    const payload = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  }

  // HTTP server
  const server = createServer((req, res) => {
    const url = req.url ?? '/';

    // API: serve xmap data
    if (url === '/__xmap/data.json') {
      try {
        const data = readFileSync(dataPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(data);
      } catch {
        res.writeHead(500);
        res.end('Failed to read data');
      }
      return;
    }

    // API: serve screenshots
    if (url.startsWith('/__xmap/screenshots/')) {
      const filename = url.replace('/__xmap/screenshots/', '');
      const filePath = resolve(cwd, '.xmap', 'screenshots', filename);
      if (existsSync(filePath)) {
        const data = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(data);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
      return;
    }

    // Everything else: serve the pre-built UI
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

  // Watch for data changes
  const xmapDir = resolve(cwd, '.xmap');
  try {
    watch(xmapDir, { recursive: true }, (eventType, filename) => {
      if (filename?.endsWith('.json')) {
        console.log(pc.dim(`  Data changed: ${filename} — reloading`));
        broadcast({ type: 'reload' });
      }
    });
  } catch {
    // fs.watch may not be available everywhere
  }

  // Start listening
  server.listen(port, () => {
    console.log();
    console.log(pc.bold('  xmap dev server'));
    console.log();
    console.log(`  ${pc.dim('Local:')}   ${pc.cyan(`http://localhost:${port}`)}`);
    console.log();

    if (shouldOpen) {
      const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
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
