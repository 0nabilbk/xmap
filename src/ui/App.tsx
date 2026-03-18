import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapState } from '../shared/types';
import { loadState, saveState, rediscover } from './data-loader';
import XmapCanvas from './components/XmapCanvas';

export default function App() {
  const [state, setState] = useState<MapState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadState()
      .then(setState)
      .catch((e) => setError(e.message));
  }, []);

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

  const handleStateChange = useCallback((newState: MapState) => {
    setState(newState);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveState({ ...newState, savedAt: new Date().toISOString() });
    }, 500);
  }, []);

  const handleRediscover = useCallback(async () => {
    try {
      const merged = await rediscover();
      setState(merged);
    } catch (err) {
      console.error('Re-discover failed:', err);
    }
  }, []);

  const center: React.CSSProperties = {
    height: '100vh', width: '100vw', display: 'flex',
    alignItems: 'center', justifyContent: 'center', background: '#f5f5f5',
  };

  if (error) {
    return (
      <div style={center}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#dc2626', fontWeight: 500 }}>Failed to load</p>
          <p style={{ fontSize: 12, color: '#a3a3a3', marginTop: 8 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div style={center}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 24, height: 24, border: '2px solid #262626', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'xmap-spin 1s linear infinite',
          }} />
          <p style={{ fontSize: 14, color: '#a3a3a3', fontWeight: 470 }}>Loading experience map...</p>
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
