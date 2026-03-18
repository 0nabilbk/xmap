import type { XmapData } from '../shared/types';

/** Fetch xmap data from the dev server API */
export async function loadXmapData(): Promise<XmapData> {
  const res = await fetch('/__xmap/data.json');
  if (!res.ok) throw new Error(`Failed to load xmap data: ${res.status}`);
  return res.json();
}
