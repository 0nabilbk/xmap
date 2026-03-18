import type { MapState } from '../shared/types';

/** Load map state from the dev server (server already knows the repo) */
export async function loadState(): Promise<MapState> {
  const res = await fetch('/__xmap/api/state');
  if (!res.ok) throw new Error(`Failed to load state: ${res.status}`);
  return res.json();
}

/** Save map state */
export async function saveState(state: MapState): Promise<void> {
  await fetch('/__xmap/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
}

/** Re-discover routes (server merges with existing state) */
export async function rediscover(): Promise<MapState> {
  const res = await fetch('/__xmap/api/rediscover', { method: 'POST' });
  if (!res.ok) throw new Error(`Re-discover failed: ${res.status}`);
  return res.json();
}
