import type { Browser, Page } from 'playwright-core';
import type { XmapConfig, XmapScreen, XmapEdge } from '../../shared/types.js';
import { normalizeUrl, normalizeRoute, routeToId, detectDynamicSegments } from './dedup.js';
import { minimatch } from '../utils/minimatch.js';
import { writeScreenshot } from './writer.js';
import pc from 'picocolors';

interface CrawlResult {
  screens: XmapScreen[];
  edges: XmapEdge[];
}

/** BFS crawl engine — discovers screens by following <a> links */
export async function spiderCrawl(
  browser: Browser,
  config: XmapConfig
): Promise<CrawlResult> {
  const baseUrl = config.url.replace(/\/$/, '');
  const maxPages = config.maxPages ?? 100;
  const startPath = config.startPath ?? '/';
  const ignore = config.ignore ?? [];

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // ── Auth phase ──────────────────────────────────────────
  if (config.auth?.loginPath) {
    const loginUrl = baseUrl + config.auth.loginPath;
    console.log(pc.cyan(`Navigate to ${loginUrl} and log in.`));
    await page.goto(loginUrl, { waitUntil: 'networkidle' });
    console.log(pc.yellow('Log in to your app, then press Enter to continue...'));
    await waitForEnter();
    console.log(pc.green('Continuing with crawl...'));
  }

  // ── BFS crawl ──────────────────────────────────────────
  const visited = new Map<string, { url: string; pathname: string; title: string; links: string[]; h1: string; description: string; linkCount: number }>();
  const queue: string[] = [startPath];
  const seen = new Set<string>([startPath]);

  while (queue.length > 0 && visited.size < maxPages) {
    const path = queue.shift()!;
    const fullUrl = baseUrl + path;

    // Check ignore patterns
    if (ignore.some((pattern) => minimatch(path, pattern))) {
      continue;
    }

    try {
      console.log(pc.dim(`  [${visited.size + 1}/${maxPages}] ${path}`));
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });

      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, { timeout: 5000 }).catch(() => {});
      }
      if (config.waitMs) {
        await page.waitForTimeout(config.waitMs);
      }

      // Extract page info
      const info = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'))
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => href.startsWith(window.location.origin));
        const h1 = document.querySelector('h1')?.textContent?.trim() ?? '';
        const description = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
        return {
          title: document.title,
          links: links.map((l) => new URL(l).pathname + new URL(l).search),
          h1,
          description,
          linkCount: links.length,
        };
      });

      visited.set(path, {
        url: fullUrl,
        pathname: path,
        ...info,
      });

      // Take screenshot
      const screenshotId = routeToId(path);
      const buffer = await page.screenshot({ type: 'png', fullPage: false });
      writeScreenshot(screenshotId, buffer);

      // Enqueue discovered links
      for (const link of info.links) {
        const normalized = normalizeUrl(link, baseUrl);
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          queue.push(normalized);
        }
      }
    } catch (err) {
      console.log(pc.red(`  Failed: ${path} — ${(err as Error).message}`));
    }
  }

  await context.close();

  // ── Build screens + edges from crawl results ───────────
  const pathnames = [...visited.keys()];
  const routeMap = detectDynamicSegments(pathnames);

  // Deduplicate by route pattern — keep first occurrence
  const routeSeen = new Map<string, string>(); // route → first pathname
  const screens: XmapScreen[] = [];
  const edgesRaw: XmapEdge[] = [];

  for (const [pathname, info] of visited) {
    const route = routeMap.get(pathname) ?? normalizeRoute(pathname);
    const id = routeToId(route);

    if (!routeSeen.has(route)) {
      routeSeen.set(route, pathname);

      // Apply screen overrides from config
      const overrides = config.screenOverrides?.[route] ?? {};

      screens.push({
        id,
        url: info.url,
        pathname,
        route,
        title: info.title,
        section: '', // filled by sections.ts
        screenshot: `.xmap/screenshots/${id}.png`,
        col: 0,
        row: 0,
        ...overrides,
        metadata: {
          h1: info.h1,
          description: info.description,
          linkCount: info.linkCount,
          ...overrides.metadata,
        },
      });
    }

    // Build edges from discovered links
    for (const link of info.links) {
      const targetRoute = routeMap.get(link) ?? normalizeRoute(link);
      const targetId = routeToId(targetRoute);
      const sourceId = routeToId(route);

      if (sourceId !== targetId && routeSeen.has(targetRoute)) {
        edgesRaw.push({ source: sourceId, target: targetId });
      }
    }
  }

  // Deduplicate edges
  const edgeSet = new Set<string>();
  const edges = edgesRaw.filter((e) => {
    const key = `${e.source}->${e.target}`;
    if (edgeSet.has(key)) return false;
    edgeSet.add(key);
    return true;
  });

  return { screens, edges };
}

/** Wait for the user to press Enter in the terminal */
function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    const onData = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.pause();
      resolve();
    };
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
  });
}
