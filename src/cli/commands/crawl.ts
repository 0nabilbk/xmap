import pc from 'picocolors';
import { loadConfig } from '../config.js';
import { spiderCrawl } from '../crawler/spider.js';
import { groupIntoSections } from '../crawler/sections.js';
import { computeLayout } from '../crawler/layout.js';
import { writeOutput } from '../crawler/writer.js';
import type { XmapData } from '../../shared/types.js';

interface CrawlOptions {
  url?: string;
  max?: number;
}

export async function crawl(options: CrawlOptions) {
  console.log(pc.bold('xmap crawl'));
  console.log();

  // Load config
  const config = await loadConfig();
  if (options.url) config.url = options.url;
  if (options.max && options.max > 0) config.maxPages = options.max;

  console.log(pc.dim(`Target: ${config.url}`));
  console.log(pc.dim(`Max pages: ${config.maxPages ?? 100}`));
  console.log();

  // Load playwright-core
  let playwright;
  try {
    playwright = await import('playwright-core');
  } catch {
    console.error(pc.red('playwright-core is required for crawling.'));
    console.error(pc.dim('Install it: pnpm add -D playwright-core'));
    console.error(pc.dim('Then install browsers: npx playwright install chromium'));
    process.exit(1);
  }

  // Launch browser
  console.log(pc.dim('Launching browser...'));
  const browser = await playwright.chromium.launch({
    headless: false, // User needs to log in
  });

  try {
    const startTime = Date.now();
    const { screens, edges } = await spiderCrawl(browser, config);

    console.log();
    console.log(pc.green(`Discovered ${screens.length} unique screens`));

    // Group into sections
    const sections = groupIntoSections(screens, config);
    console.log(pc.dim(`Organized into ${sections.length} sections`));

    // Compute layout
    computeLayout(screens, sections);

    // Build output
    const data: XmapData = {
      screens,
      sections,
      edges,
      workflows: config.workflows ?? [],
      config: {
        url: config.url,
        iframe: {
          width: config.iframe?.width ?? 1440,
          height: config.iframe?.height ?? 900,
          scale: config.iframe?.scale ?? 0.22,
        },
      },
      crawledAt: new Date().toISOString(),
    };

    const outDir = writeOutput(data);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log();
    console.log(pc.green(`Written to ${outDir} in ${elapsed}s`));
    console.log(pc.dim(`Run ${pc.cyan('xmap dev')} to view the map.`));
  } finally {
    await browser.close();
  }
}
