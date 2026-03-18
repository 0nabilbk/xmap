import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { XmapData } from '../../shared/types.js';

/** Write crawl results to .xmap/ directory */
export function writeOutput(data: XmapData, cwd = process.cwd()): string {
  const outDir = resolve(cwd, '.xmap');
  const screenshotsDir = resolve(outDir, 'screenshots');

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  if (!existsSync(screenshotsDir)) mkdirSync(screenshotsDir, { recursive: true });

  // Write main data file
  const dataPath = resolve(outDir, 'screens.json');
  writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');

  return outDir;
}

/** Write a screenshot buffer to .xmap/screenshots/ */
export function writeScreenshot(id: string, buffer: Buffer, cwd = process.cwd()): string {
  const screenshotsDir = resolve(cwd, '.xmap', 'screenshots');
  if (!existsSync(screenshotsDir)) mkdirSync(screenshotsDir, { recursive: true });

  const filePath = resolve(screenshotsDir, `${id}.png`);
  writeFileSync(filePath, buffer);
  return filePath;
}
