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

// Inject spinner keyframe once
const SPIN_STYLE_ID = 'xmap-spin-keyframe';
if (typeof document !== 'undefined' && !document.getElementById(SPIN_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = SPIN_STYLE_ID;
  style.textContent = `@keyframes xmap-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

const handleStyle: React.CSSProperties = {
  background: '#a3a3a3',
  width: 8,
  height: 8,
  border: 0,
};

function ScreenNode({ id, data, selected }: NodeProps & { data: ScreenNodeData }) {
  const [loaded, setLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [inView, setInView] = useState(false);
  const [canLoad, setCanLoad] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [openHovered, setOpenHovered] = useState(false);
  const [hideHovered, setHideHovered] = useState(false);
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

  const cardShadow = selected
    ? '0 0 0 2px #3b82f6, 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)'
    : '0 0 0 1px rgba(23,24,26,0.08), 0 8px 24px 0 rgba(23,24,26,0.06)';

  const actionBtnBase: React.CSSProperties = {
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
    lineHeight: 1.4,
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: nodeW + 16,
        cursor: 'grab',
        contentVisibility: 'auto',
        containIntrinsicSize: `${nodeW + 16}px ${nodeH + 80}px`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />

      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: cardShadow,
          transition: 'box-shadow 200ms',
        }}
      >
        {/* Label bar */}
        <div
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid #f5f5f5',
            background: '#fafafa',
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              flexShrink: 0,
              background: data.groupColor,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: '#404040',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {data.label}
          </span>
          {hasMissingParams && (
            <span style={{ fontSize: 9, color: '#f59e0b', marginLeft: 'auto', fontWeight: 500 }}>
              needs ID
            </span>
          )}
        </div>

        {/* Entity picker for dynamic params */}
        {data.isDynamic && data.params && data.params.length > 0 && (
          <div
            style={{
              padding: '6px 12px',
              borderBottom: '1px solid #f5f5f5',
              background: '#f5f5f5',
            }}
          >
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
                  boxSizing: 'border-box',
                }}
              />
            ))}
          </div>
        )}

        {/* Preview container */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: '#fafafa',
            width: nodeW + 16,
            height: nodeH,
            willChange: 'transform',
          }}
        >
          {hasMissingParams && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 10, color: '#a3a3a3' }}>Enter ID above to preview</span>
              <span style={{ fontSize: 9, color: '#d4d4d4', fontFamily: 'monospace' }}>
                {data.route}
              </span>
            </div>
          )}
          {!hasMissingParams && (!showIframe || !loaded) && !showScreenshot && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showIframe || (inView && !canLoad) ? (
                <div
                  style={{
                    width: 20,
                    height: 20,
                    border: '2px solid #e5e5e5',
                    borderTopColor: '#737373',
                    borderRadius: '50%',
                    animation: 'xmap-spin 1s linear infinite',
                  }}
                />
              ) : (
                <span style={{ fontSize: 10, color: '#d4d4d4' }}>Scroll to load</span>
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
        <div
          style={{
            padding: '6px 12px',
            borderTop: '1px solid #f5f5f5',
            background: '#fafafa',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontFamily: 'ui-monospace, monospace',
              color: '#a3a3a3',
            }}
          >
            {data.route}
          </span>
        </div>
      </div>

      {/* Hover actions */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 150ms',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          zIndex: 10,
        }}
      >
        <a
          href={resolvedUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...actionBtnBase,
            color: openHovered ? '#171717' : '#525252',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setOpenHovered(true)}
          onMouseLeave={() => setOpenHovered(false)}
        >
          Open
        </a>
        {data.onHide && (
          <button
            style={{
              ...actionBtnBase,
              color: hideHovered ? '#ef4444' : '#a3a3a3',
            }}
            onClick={(e) => {
              e.stopPropagation();
              data.onHide!(id);
            }}
            title="Hide from map"
            onMouseEnter={() => setHideHovered(true)}
            onMouseLeave={() => setHideHovered(false)}
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
