import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface ScreenNodeData {
  label: string;
  route: string;
  group: string;
  groupColor: string;
  url: string;
  screenshotUrl?: string;
  iframeWidth: number;
  iframeHeight: number;
  iframeScale: number;
  onHide?: (id: string) => void;
}

// ─── Iframe load queue ─────────────────────────────────
const MAX_CONCURRENT = 3;
let activeLoads = 0;
const queue: Array<() => void> = [];

function enqueueLoad(start: () => void) {
  if (activeLoads < MAX_CONCURRENT) {
    activeLoads++;
    start();
  } else {
    queue.push(start);
  }
}

function onLoadComplete() {
  activeLoads--;
  if (queue.length > 0 && activeLoads < MAX_CONCURRENT) {
    activeLoads++;
    const next = queue.shift()!;
    next();
  }
}

// ─── Component ─────────────────────────────────────────
function ScreenNode({ id, data, selected }: NodeProps & { data: ScreenNodeData }) {
  const [loaded, setLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [inView, setInView] = useState(false);
  const [canLoad, setCanLoad] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const unmountedRef = useRef(false);

  const nodeW = Math.round(data.iframeWidth * data.iframeScale);
  const nodeH = Math.round(data.iframeHeight * data.iframeScale);

  // Observe visibility
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Join load queue when in view
  useEffect(() => {
    if (!inView || canLoad) return;
    unmountedRef.current = false;
    enqueueLoad(() => {
      if (!unmountedRef.current) setCanLoad(true);
    });
    return () => { unmountedRef.current = true; };
  }, [inView, canLoad]);

  const handleIframeLoad = useCallback(() => {
    setLoaded(true);
    onLoadComplete();
  }, []);

  const handleIframeError = useCallback(() => {
    setIframeFailed(true);
    setLoaded(true);
    onLoadComplete();
  }, []);

  useEffect(() => {
    return () => {
      if (canLoad && !loaded) onLoadComplete();
    };
  }, [canLoad, loaded]);

  const showIframe = inView && canLoad && !iframeFailed;
  const showScreenshot = iframeFailed && data.screenshotUrl;

  return (
    <div
      ref={containerRef}
      className="group/node relative"
      style={{
        width: nodeW + 16,
        cursor: 'grab',
        contentVisibility: 'auto',
        containIntrinsicSize: `${nodeW + 16}px ${nodeH + 80}px`,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-neutral-400 !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-neutral-400 !w-2 !h-2 !border-0" />
      <Handle type="target" position={Position.Left} className="!bg-neutral-400 !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-neutral-400 !w-2 !h-2 !border-0" />

      <div
        className={`rounded-xl overflow-hidden transition-shadow duration-200 ${
          selected
            ? 'ring-2 ring-blue-500 shadow-xl'
            : 'shadow-[0_0_0_1px_rgba(23,24,26,0.08),0_8px_24px_0_rgba(23,24,26,0.06)]'
        }`}
        style={{ background: '#fff' }}
      >
        {/* Label bar */}
        <div className="px-3 py-2 flex items-center gap-2 border-b border-neutral-100" style={{ background: '#fafafa' }}>
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: data.groupColor }} />
          <span className="text-[11px] font-medium text-neutral-700 truncate">{data.label}</span>
        </div>

        {/* Preview container */}
        <div
          className="relative overflow-hidden bg-neutral-50"
          style={{ width: nodeW + 16, height: nodeH, willChange: 'transform' }}
        >
          {(!showIframe || !loaded) && !showScreenshot && (
            <div className="absolute inset-0 flex items-center justify-center">
              {showIframe || (inView && !canLoad) ? (
                <div className="w-5 h-5 border-2 border-neutral-200 border-t-neutral-500 rounded-full animate-spin" />
              ) : (
                <span className="text-[10px] text-neutral-300">Scroll to load</span>
              )}
            </div>
          )}
          {showScreenshot && (
            <img
              src={data.screenshotUrl}
              alt={data.label}
              style={{
                width: data.iframeWidth,
                height: data.iframeHeight,
                transform: `scale(${data.iframeScale})`,
                transformOrigin: 'top left',
              }}
            />
          )}
          {showIframe && (
            <iframe
              key={data.url}
              src={data.url}
              title={data.label}
              loading="lazy"
              sandbox="allow-scripts allow-same-origin"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              style={{
                width: data.iframeWidth,
                height: data.iframeHeight,
                transform: `scale(${data.iframeScale})`,
                transformOrigin: 'top left',
                pointerEvents: 'none',
                border: 'none',
              }}
            />
          )}
        </div>

        {/* Route path */}
        <div className="px-3 py-1.5 border-t border-neutral-100" style={{ background: '#fafafa' }}>
          <span className="text-[10px] font-mono text-neutral-400">{data.route}</span>
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover/node:opacity-100 transition-opacity flex items-center gap-1 z-10">
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 text-[10px] font-medium text-neutral-600 hover:text-neutral-900 shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          Open
        </a>
        {data.onHide && (
          <button
            className="bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 text-[10px] font-medium text-neutral-400 hover:text-red-500 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              data.onHide!(id);
            }}
            title="Hide from map"
          >
            Hide
          </button>
        )}
      </div>
    </div>
  );
}

function arePropsEqual(
  prev: NodeProps & { data: ScreenNodeData },
  next: NodeProps & { data: ScreenNodeData }
) {
  if (prev.selected !== next.selected) return false;
  if (prev.id !== next.id) return false;
  const p = prev.data;
  const n = next.data;
  return (
    p.url === n.url &&
    p.label === n.label &&
    p.route === n.route &&
    p.groupColor === n.groupColor &&
    p.screenshotUrl === n.screenshotUrl
  );
}

export default memo(ScreenNode, arePropsEqual);
