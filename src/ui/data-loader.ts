import type { MapState, DiscoveredRoute } from '../shared/types';

const API = '/__xmap/api';

export async function discoverRoutes(repoPath: string): Promise<{
  framework: string;
  routes: DiscoveredRoute[];
}> {
  const res = await fetch(`${API}/discover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Discovery failed: ${res.status}`);
  }
  return res.json();
}

export async function loadMapState(repoPath: string): Promise<MapState | null> {
  const res = await fetch(`${API}/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data;
}

export async function saveMapState(repoPath: string, state: MapState): Promise<void> {
  await fetch(`${API}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath, state }),
  });
}
