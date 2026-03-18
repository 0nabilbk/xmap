#!/usr/bin/env node

import cac from 'cac';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'package.json'), 'utf8'));
const version = pkg.version as string;
import { init } from './commands/init.js';
import { dev } from './commands/dev.js';

const cli = cac('xmap');

cli
  .command('init', 'Create xmap.config.ts and add .xmap/ to .gitignore')
  .action(init);

cli
  .command('dev', 'Start the xmap editor')
  .alias('')
  .option('--port <port>', 'Dev server port', { default: 4200 })
  .option('--no-open', 'Don\'t auto-open browser')
  .action(dev);

cli.help();
cli.version(version);
cli.parse();
