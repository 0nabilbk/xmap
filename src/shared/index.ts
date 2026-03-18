export * from './types.js';

import type { XmapConfig } from './types.js';

/** Helper for type-safe xmap.config.ts files */
export function defineConfig(config: XmapConfig): XmapConfig {
  return config;
}
