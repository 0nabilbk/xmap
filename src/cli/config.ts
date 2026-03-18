import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { XmapConfig } from '../shared/types.js';

const CONFIG_FILES = ['xmap.config.ts', 'xmap.config.js', 'xmap.config.mjs'];

/** Find and load the user's xmap config */
export async function loadConfig(cwd = process.cwd()): Promise<XmapConfig> {
  let configPath: string | null = null;

  for (const name of CONFIG_FILES) {
    const p = resolve(cwd, name);
    if (existsSync(p)) {
      configPath = p;
      break;
    }
  }

  if (!configPath) {
    throw new Error(
      'No xmap config found. Run `xmap init` to create one.'
    );
  }

  // For .js/.mjs files, import directly
  if (configPath.endsWith('.js') || configPath.endsWith('.mjs')) {
    const mod = await import(configPath);
    return mod.default ?? mod;
  }

  // For .ts files, bundle with esbuild to a temp file then import
  const outfile = resolve(tmpdir(), `xmap-config-${randomUUID()}.mjs`);
  await build({
    entryPoints: [configPath],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    write: true,
    external: ['xmap'],
  });

  try {
    const mod = await import(outfile);
    return mod.default ?? mod;
  } finally {
    // Best-effort cleanup
    const { unlink } = await import('node:fs/promises');
    unlink(outfile).catch(() => {});
  }
}
