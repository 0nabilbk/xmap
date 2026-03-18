#!/usr/bin/env node

import cac from 'cac';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'package.json'), 'utf8'));
const version = pkg.version as string;
import { dev } from './commands/dev.js';

const cli = cac('xmap');

cli
  .command('[app-url]', 'Start the xmap editor')
  .option('--port <port>', 'Dev server port', { default: 4200 })
  .option('--no-open', 'Don\'t auto-open browser')
  .action((appUrl: string | undefined, options: any) => {
    dev({
      repoPath: process.cwd(),
      appUrl: appUrl || 'http://localhost:3000',
      port: options.port,
      open: options.open,
    });
  });

cli.help();
cli.version(version);
cli.parse();
