/** URL normalization and dynamic segment detection */

// Patterns that look like dynamic IDs
const DYNAMIC_PATTERNS = [
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID
  /^[0-9a-f]{24}$/i, // MongoDB ObjectID
  /^[0-9a-f]{20,}$/i, // Firebase-style IDs
  /^\d{10,}$/, // Timestamps or long numeric IDs
  /^[A-Za-z0-9_-]{16,}$/, // Generic long alphanumeric (common in many systems)
];

/** Check if a path segment looks like a dynamic value */
export function isDynamicSegment(segment: string): boolean {
  return DYNAMIC_PATTERNS.some((p) => p.test(segment));
}

/** Normalize a URL path by replacing dynamic segments with [id] */
export function normalizeRoute(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      if (isDynamicSegment(segment)) return '[id]';
      return segment;
    })
    .join('/');
}

/** Create a deterministic screen ID from a route pattern */
export function routeToId(route: string): string {
  return route
    .replace(/^\//, '')
    .replace(/\[id\]/g, '_id_')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'root';
}

/** Normalize a full URL for dedup comparison */
export function normalizeUrl(url: string, baseUrl: string): string | null {
  try {
    const parsed = new URL(url, baseUrl);

    // Only follow same-origin links
    const base = new URL(baseUrl);
    if (parsed.origin !== base.origin) return null;

    // Strip hash, sort query params
    parsed.hash = '';
    parsed.searchParams.sort();

    return parsed.pathname + (parsed.search || '');
  } catch {
    return null;
  }
}

/**
 * Given a list of discovered pathnames, detect which path segments are dynamic
 * using frequency analysis: if a segment position has many unique values at that
 * depth, it's likely dynamic.
 */
export function detectDynamicSegments(pathnames: string[]): Map<string, string> {
  // Group by structure: segment count + static segment positions
  const segmentsByDepth = new Map<number, Map<number, Set<string>>>();

  for (const p of pathnames) {
    const parts = p.split('/').filter(Boolean);
    if (!segmentsByDepth.has(parts.length)) {
      segmentsByDepth.set(parts.length, new Map());
    }
    const depthMap = segmentsByDepth.get(parts.length)!;
    for (let i = 0; i < parts.length; i++) {
      if (!depthMap.has(i)) depthMap.set(i, new Set());
      depthMap.get(i)!.add(parts[i]);
    }
  }

  // If a position at a given depth has many unique values, those are dynamic
  const routeMap = new Map<string, string>();
  for (const p of pathnames) {
    const parts = p.split('/').filter(Boolean);
    const depthMap = segmentsByDepth.get(parts.length);
    if (!depthMap) continue;

    const normalized = parts.map((seg, i) => {
      if (isDynamicSegment(seg)) return '[id]';
      const uniqueCount = depthMap.get(i)?.size ?? 0;
      // If >3 unique values at this position, treat as dynamic
      if (uniqueCount > 3) return '[id]';
      return seg;
    });

    routeMap.set(p, '/' + normalized.join('/'));
  }

  return routeMap;
}
