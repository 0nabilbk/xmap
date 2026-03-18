import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapState } from '../shared/types';
import { loadState, saveState, rediscover } from './data-loader';
import XmapCanvas from './components/XmapCanvas';

export default function App() {
  const [state, setState] = useState<MapState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Load state from server on mount
  useEffect(() => {
    loadState()
      .then(setState)
      .catch((e) => setError(e.message));
  }, []);

  // WebSocket live reload
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/__xmap/ws`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'reload') {
        loadState().then(setState).catch(() => {});
      }
    };
    return () => ws.close();
  }, []);

  // Auto-save on state changes (debounced)
  const handleStateChange = useCallback((newState: MapState) => {
    setState(newState);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveState({ ...newState, savedAt: new Date().toISOString() });
    }, 500);
  }, []);

  // Re-discover routes from codebase
  const handleRediscover = useCallback(async () => {
    try {
      const merged = await rediscover();
      setState(merged);
    } catch (err) {
      console.error('Re-discover failed:', err);
    }
  }, []);

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="text-center">
          <p className="text-sm" style={{ color: '#dc2626', fontWeight: 500 }}>Failed to load</p>
          <p className="text-xs text-neutral-400 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-neutral-400" style={{ fontWeight: 470 }}>Loading experience map...</p>
        </div>
      </div>
    );
  }

  return (
    <XmapCanvas
      state={state}
      onStateChange={handleStateChange}
      onRediscover={handleRediscover}
    />
  );
}
