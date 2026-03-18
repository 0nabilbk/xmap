#!/usr/bin/env node

import cac from 'cac';
import { version } from '../../package.json' with { type: 'json' };
import { init } from './commands/init.js';
import { crawl } from './commands/crawl.js';
import { dev } from './commands/dev.js';

const cli = cac('xmap');

cli
  .command('init', 'Create xmap.config.ts and add .xmap/ to .gitignore')
  .action(init);

cli
  .command('crawl', 'Discover screens by crawling your running app')
  .option('--url <url>', 'Override target URL')
  .option('--max <n>', 'Override max pages', { default: 0 })
  .action(crawl);

cli
  .command('dev', 'Start the xmap viewer')
  .alias('')
  .option('--port <port>', 'Dev server port', { default: 4200 })
  .option('--no-open', 'Don\'t auto-open browser')
  .action(dev);

cli.help();
cli.version(version);
cli.parse();
