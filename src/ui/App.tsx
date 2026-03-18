import { useEffect, useState } from 'react';
import type { XmapData } from '../shared/types';
import { loadXmapData } from './data-loader';
import XmapCanvas from './components/XmapCanvas';

export default function App() {
  const [data, setData] = useState<XmapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadXmapData()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  // WebSocket live reload
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/__xmap/ws`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'reload') {
        loadXmapData().then(setData).catch(() => {});
      }
    };
    return () => ws.close();
  }, []);

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="text-center">
          <p className="text-sm text-red-500 font-medium">Failed to load xmap data</p>
          <p className="text-xs text-neutral-400 mt-2">{error}</p>
          <p className="text-xs text-neutral-400 mt-1">Run <code className="bg-neutral-100 px-1 rounded">xmap crawl</code> first.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#767676]" style={{ fontWeight: 470 }}>Loading experience map...</p>
        </div>
      </div>
    );
  }

  return <XmapCanvas data={data} />;
}
