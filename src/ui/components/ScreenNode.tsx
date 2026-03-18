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
  isDynamic?: boolean;
  params?: string[];
  paramValues?: Record<string, string>;
  onParamChange?: (screenId: string, param: string, value: string) => void;
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

function ScreenNode({ id, data, selected }: NodeProps & { data: ScreenNodeData }) {
  const [loaded, setLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [inView, setInView] = useState(false);
  const [canLoad, setCanLoad] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const unmountedRef = useRef(false);

  const nodeW = Math.round(data.iframeWidth * data.iframeScale);
  const nodeH = Math.round(data.iframeHeight * data.iframeScale);

  // Check if all dynamic params have values
  const hasMissingParams = data.isDynamic && data.params?.some(
    (p) => !data.paramValues?.[p]
  );

  // Build resolved URL — replace [param] with actual values
  let resolvedUrl = data.url;
  if (data.isDynamic && data.params && data.paramValues) {
    for (const p of data.params) {
      const val = data.paramValues[p];
      if (val) {
        resolvedUrl = resolvedUrl.replace(`[${p}]`, val);
        resolvedUrl = resolvedUrl.replace(`[...${p}]`, val);
        resolvedUrl = resolvedUrl.replace(`[[...${p}]]`, val);
      }
    }
  }

  const canShowIframe = !hasMissingParams;

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

  useEffect(() => {
    if (!inView || canLoad || !canShowIframe) return;
    unmountedRef.current = false;
    enqueueLoad(() => {
      if (!unmountedRef.current) setCanLoad(true);
    });
    return () => { unmountedRef.current = true; };
  }, [inView, canLoad, canShowIframe]);

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

  // Reset iframe state when URL changes
  useEffect(() => {
    setLoaded(false);
    setIframeFailed(false);
    setCanLoad(false);
  }, [resolvedUrl]);

  const showIframe = inView && canLoad && !iframeFailed && canShowIframe;
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
          {hasMissingParams && (
            <span style={{ fontSize: 9, color: '#f59e0b', marginLeft: 'auto', fontWeight: 500 }}>needs ID</span>
          )}
        </div>

        {/* Entity picker for dynamic params */}
        {data.isDynamic && data.params && data.params.length > 0 && (
          <div className="px-3 py-1.5 border-b border-neutral-100" style={{ background: '#f5f5f5' }}>
            {data.params.map((param) => (
              <input
                key={param}
                type="text"
                value={data.paramValues?.[param] ?? ''}
                onChange={(e) => {
                  e.stopPropagation();
                  data.onParamChange?.(id, param, e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder={param}
                style={{
                  width: '100%',
                  fontSize: 10,
                  padding: '3px 6px',
                  border: '1px solid #e5e5e5',
                  borderRadius: 4,
                  outline: 'none',
                  background: '#fff',
                  color: '#404040',
                  fontFamily: 'ui-monospace, monospace',
                  marginBottom: data.params!.indexOf(param) < data.params!.length - 1 ? 4 : 0,
                  pointerEvents: 'all',
                }}
              />
            ))}
          </div>
        )}

        {/* Preview container */}
        <div
          className="relative overflow-hidden bg-neutral-50"
          style={{ width: nodeW + 16, height: nodeH, willChange: 'transform' }}
        >
          {hasMissingParams && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: '#a3a3a3' }}>Enter ID above to preview</span>
              <span style={{ fontSize: 9, color: '#d4d4d4', fontFamily: 'monospace' }}>{data.route}</span>
            </div>
          )}
          {!hasMissingParams && (!showIframe || !loaded) && !showScreenshot && (
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
              key={resolvedUrl}
              src={resolvedUrl}
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
          href={resolvedUrl}
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
    p.screenshotUrl === n.screenshotUrl &&
    p.paramValues === n.paramValues
  );
}

export default memo(ScreenNode, arePropsEqual);
