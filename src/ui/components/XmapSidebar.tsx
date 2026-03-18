import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { XmapSection, XmapWorkflow } from '../../shared/types';

interface ScreenInfo {
  id: string;
  label: string;
}

interface XmapSidebarProps {
  sections: XmapSection[];
  screens: ScreenInfo[];
  hiddenIds: Set<string>;
  activeSection: string | null;
  totalScreens: number;
  onSectionSelect: (id: string | null) => void;
  onToggleScreen: (id: string) => void;
  onShowAll: () => void;
  workflows: XmapWorkflow[];
  activeWorkflowId: string | null;
  onWorkflowSelect: (id: string | null) => void;
  repoPath: string;
  appUrl: string;
  onRediscover: () => void;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        borderRadius: 4,
        transition: 'transform 200ms, background 150ms',
        transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
        background: hovered ? 'rgba(0,0,0,0.06)' : 'transparent',
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M5.37624 7.00194C5.18184 6.66861 5.42224 6.25 5.80814 6.25H10.1921C10.578 6.25 10.8184 6.66861 10.624 7.00194L8.43203 10.7596C8.23909 11.0904 7.76119 11.0904 7.56825 10.7596L5.37624 7.00194Z" fill="#59595B"/>
      </svg>
    </span>
  );
}

export default function XmapSidebar({
  sections,
  screens,
  hiddenIds,
  activeSection,
  totalScreens,
  onSectionSelect,
  onToggleScreen,
  onShowAll,
  workflows,
  activeWorkflowId,
  onWorkflowSelect,
  repoPath,
  appUrl,
  onRediscover,
}: XmapSidebarProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null);
  const [hoveredScreenId, setHoveredScreenId] = useState<string | null>(null);
  const [hoveredWorkflowId, setHoveredWorkflowId] = useState<string | null>(null);
  const [showAllHovered, setShowAllHovered] = useState(false);
  const [rescanHovered, setRescanHovered] = useState(false);
  const [workflowCloseHovered, setWorkflowCloseHovered] = useState<string | null>(null);

  const visibleCount = totalScreens - hiddenIds.size;
  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);

  const repoName = repoPath.split('/').filter(Boolean).pop() || repoPath;

  return (
    <aside
      style={{
        width: 239,
        minWidth: 239,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f5f5f5',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header — repo info */}
      <div style={{ paddingTop: 24, paddingBottom: 12, paddingLeft: 14, paddingRight: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#292929' }}>xmap</span>
          <span style={{ fontSize: 10, color: '#a3a3a3', fontWeight: 500, background: '#e5e5e5', padding: '1px 6px', borderRadius: 4 }}>
            {repoName}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#a3a3a3', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>
          {appUrl}
        </div>
      </div>

      {/* Screen count + show all */}
      <div style={{ paddingLeft: 14, paddingRight: 14, paddingBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: '#a3a3a3', fontWeight: 500 }}>
          {activeWorkflow
            ? `${activeWorkflow.screenIds.length} screens`
            : `${visibleCount}/${totalScreens} screens`}
        </span>
        {!activeWorkflow && hiddenIds.size > 0 && (
          <button
            onClick={onShowAll}
            onMouseEnter={() => setShowAllHovered(true)}
            onMouseLeave={() => setShowAllHovered(false)}
            style={{
              fontSize: 13,
              color: showAllHovered ? '#292929' : '#767676',
              fontWeight: 470,
              transition: 'color 150ms',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
            }}
          >
            Show all
          </button>
        )}
      </div>

      {/* Scrollable nav area */}
      <div style={{ paddingTop: 4, paddingLeft: 8, paddingRight: 12, flex: 1, overflowY: 'auto' }}>
        {/* Sections nav */}
        <div
          style={{
            transition: 'opacity 150ms',
            opacity: activeWorkflowId ? 0.4 : 1,
            pointerEvents: activeWorkflowId ? 'none' : 'auto',
          }}
        >
          {sections.map((section, i) => {
            const sectionScreens = screens.filter((s) =>
              section.screens.includes(s.id)
            );
            const visibleInSection = sectionScreens.filter(
              (s) => !hiddenIds.has(s.id)
            ).length;
            const isActive = activeSection === section.id;
            const isExpanded = expandedSection === section.id;
            const isHovered = hoveredSectionId === section.id;

            return (
              <div key={section.id} style={i > 0 ? { marginTop: 2 } : undefined}>
                <button
                  onClick={() => onSectionSelect(isActive ? null : section.id)}
                  onMouseEnter={() => setHoveredSectionId(section.id)}
                  onMouseLeave={() => setHoveredSectionId(null)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: 6,
                    borderRadius: 8,
                    fontSize: 14,
                    lineHeight: '20px',
                    transition: 'background 150ms, color 150ms',
                    cursor: 'pointer',
                    background: isActive
                      ? 'rgba(229,229,229,0.5)'
                      : isHovered
                        ? 'rgba(229,229,229,0.3)'
                        : 'transparent',
                    color: isActive ? 'rgba(41,41,41,0.8)' : '#767676',
                    fontWeight: isActive ? 590 : 470,
                    border: 'none',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div
                      style={{ width: 8, height: 8, borderRadius: '50%', background: section.color }}
                    />
                  </div>
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{section.label}</span>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#a3a3a3',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 470,
                      opacity: isHovered ? 1 : 0,
                      transition: 'opacity 150ms',
                    }}
                  >
                    {visibleInSection}/{sectionScreens.length}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedSection(isExpanded ? null : section.id);
                    }}
                  >
                    <ChevronIcon expanded={isExpanded} />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {sectionScreens.map((screen) => {
                          const isVisible = !hiddenIds.has(screen.id);
                          const isScreenHovered = hoveredScreenId === screen.id;
                          return (
                            <button
                              key={screen.id}
                              onClick={() => onToggleScreen(screen.id)}
                              onMouseEnter={() => setHoveredScreenId(screen.id)}
                              onMouseLeave={() => setHoveredScreenId(null)}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                paddingLeft: 34,
                                paddingRight: 6,
                                paddingTop: 6,
                                paddingBottom: 6,
                                borderRadius: 8,
                                fontSize: 14,
                                lineHeight: '20px',
                                transition: 'background 150ms, color 150ms',
                                cursor: 'pointer',
                                color: isVisible
                                  ? 'rgba(41,41,41,0.8)'
                                  : isScreenHovered
                                    ? '#292929'
                                    : '#767676',
                                fontWeight: isVisible ? 590 : 470,
                                background: !isVisible && isScreenHovered ? 'rgba(229,229,229,0.2)' : 'transparent',
                                border: 'none',
                                textAlign: 'left',
                              }}
                            >
                              <div
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  flexShrink: 0,
                                  transition: 'background 150ms',
                                  background: isVisible ? '#171717' : '#d4d4d4',
                                }}
                              />
                              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{screen.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Workflows section */}
        {workflows.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ padding: '0 6px', marginBottom: 4, fontSize: 13, color: '#a3a3a3', fontWeight: 500 }}>
              Workflows
            </div>
            {workflows.map((workflow) => {
              const isActive = activeWorkflowId === workflow.id;
              const isHovered = hoveredWorkflowId === workflow.id;
              return (
                <button
                  key={workflow.id}
                  onClick={() => onWorkflowSelect(isActive ? null : workflow.id)}
                  onMouseEnter={() => setHoveredWorkflowId(workflow.id)}
                  onMouseLeave={() => setHoveredWorkflowId(null)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: 6,
                    borderRadius: 8,
                    fontSize: 14,
                    lineHeight: '20px',
                    transition: 'background 150ms, color 150ms',
                    cursor: 'pointer',
                    background: isActive
                      ? 'rgba(229,229,229,0.5)'
                      : isHovered
                        ? 'rgba(229,229,229,0.3)'
                        : 'transparent',
                    color: isActive ? 'rgba(41,41,41,0.8)' : '#767676',
                    fontWeight: isActive ? 590 : 470,
                    border: 'none',
                    textAlign: 'left',
                  }}
                  title={workflow.description}
                >
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workflow.label}</span>
                  {isActive && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onWorkflowSelect(null);
                      }}
                      onMouseEnter={() => setWorkflowCloseHovered(workflow.id)}
                      onMouseLeave={() => setWorkflowCloseHovered(null)}
                      style={{
                        fontSize: 12,
                        color: workflowCloseHovered === workflow.id ? '#292929' : '#a3a3a3',
                        fontWeight: 470,
                        transition: 'color 150ms',
                        flexShrink: 0,
                      }}
                    >
                      x
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ paddingBottom: 24, paddingLeft: 14, paddingRight: 14 }}>
        <div style={{ fontSize: 13, color: '#a3a3a3', lineHeight: 1.625, fontWeight: 470, marginBottom: 8 }}>
          Scroll to zoom &middot; Drag to pan
          <br />
          Double-click to open &middot; Drag handles to connect
        </div>
        <button
          onClick={onRediscover}
          onMouseEnter={() => setRescanHovered(true)}
          onMouseLeave={() => setRescanHovered(false)}
          style={{
            fontSize: 12,
            color: rescanHovered ? '#292929' : '#a3a3a3',
            fontWeight: 470,
            transition: 'color 150ms',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            padding: 0,
          }}
        >
          Re-scan routes
        </button>
      </div>
    </aside>
  );
}
