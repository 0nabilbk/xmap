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
  return (
    <span
      className={`flex items-center justify-center w-5 h-5 rounded transition-transform duration-200 hover:bg-[rgba(0,0,0,0.06)] ${expanded ? '' : '-rotate-90'}`}
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
  const visibleCount = totalScreens - hiddenIds.size;
  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);

  // Short repo name for display
  const repoName = repoPath.split('/').filter(Boolean).pop() || repoPath;

  return (
    <aside className="w-[239px] h-screen flex flex-col bg-[#f5f5f5] relative overflow-hidden" style={{ minWidth: '239px' }}>
      {/* Header — repo info */}
      <div className="pt-6 pb-3 px-3.5">
        <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
          <span className="text-[15px] font-semibold text-[#292929]">xmap</span>
          <span style={{ fontSize: 10, color: '#a3a3a3', fontWeight: 500, background: '#e5e5e5', padding: '1px 6px', borderRadius: 4 }}>
            {repoName}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#a3a3a3', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>
          {appUrl}
        </div>
      </div>

      {/* Screen count + show all */}
      <div className="px-3.5 pb-2 flex items-center justify-between">
        <span className="text-[13px] text-[#a3a3a3]" style={{ fontWeight: 500 }}>
          {activeWorkflow
            ? `${activeWorkflow.screenIds.length} screens`
            : `${visibleCount}/${totalScreens} screens`}
        </span>
        {!activeWorkflow && hiddenIds.size > 0 && (
          <button
            onClick={onShowAll}
            className="text-[13px] text-[#767676] hover:text-[#292929] transition-colors cursor-pointer"
            style={{ fontWeight: 470 }}
          >
            Show all
          </button>
        )}
      </div>

      {/* Scrollable nav area */}
      <div className="pt-1 pl-2 pr-3 flex-1 overflow-y-auto">
        {/* Sections nav */}
        <div className={`transition-opacity ${activeWorkflowId ? 'opacity-40 pointer-events-none' : ''}`}>
          {sections.map((section, i) => {
            const sectionScreens = screens.filter((s) =>
              section.screens.includes(s.id)
            );
            const visibleInSection = sectionScreens.filter(
              (s) => !hiddenIds.has(s.id)
            ).length;
            const isActive = activeSection === section.id;
            const isExpanded = expandedSection === section.id;

            return (
              <div key={section.id} className={i > 0 ? 'mt-0.5' : ''}>
                <button
                  onClick={() => onSectionSelect(isActive ? null : section.id)}
                  className={`w-full flex items-center gap-[8px] p-[6px] rounded-[8px] text-[14px] leading-[20px] transition-colors cursor-pointer group ${
                    isActive
                      ? 'bg-[rgba(229,229,229,0.5)] text-[rgba(41,41,41,0.8)]'
                      : 'text-[#767676] hover:bg-[rgba(229,229,229,0.3)]'
                  }`}
                  style={{ fontWeight: isActive ? 590 : 470 }}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <div
                      className="w-[8px] h-[8px] rounded-full"
                      style={{ background: section.color }}
                    />
                  </div>
                  <span className="flex-1 text-left truncate">{section.label}</span>
                  <span className="text-[12px] text-[#a3a3a3] tabular-nums opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontWeight: 470 }}>
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
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col">
                        {sectionScreens.map((screen) => {
                          const isVisible = !hiddenIds.has(screen.id);
                          return (
                            <button
                              key={screen.id}
                              onClick={() => onToggleScreen(screen.id)}
                              className={`w-full flex items-center gap-[8px] pl-[34px] pr-[6px] py-[6px] rounded-[8px] text-[14px] leading-[20px] transition-colors cursor-pointer ${
                                isVisible
                                  ? 'text-[rgba(41,41,41,0.8)]'
                                  : 'text-[#767676] hover:text-[#292929] hover:bg-[rgba(229,229,229,0.2)]'
                              }`}
                              style={{ fontWeight: isVisible ? 590 : 470 }}
                            >
                              <div className={`w-[6px] h-[6px] rounded-full shrink-0 transition-colors ${
                                isVisible ? 'bg-[#171717]' : 'bg-[#d4d4d4]'
                              }`} />
                              <span className="flex-1 text-left truncate">{screen.label}</span>
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
          <div className="mt-5">
            <div className="px-[6px] mb-1 text-[13px] text-[#a3a3a3]" style={{ fontWeight: 500 }}>
              Workflows
            </div>
            {workflows.map((workflow) => {
              const isActive = activeWorkflowId === workflow.id;
              return (
                <button
                  key={workflow.id}
                  onClick={() => onWorkflowSelect(isActive ? null : workflow.id)}
                  className={`w-full flex items-center gap-[8px] p-[6px] rounded-[8px] text-[14px] leading-[20px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[rgba(229,229,229,0.5)] text-[rgba(41,41,41,0.8)]'
                      : 'text-[#767676] hover:bg-[rgba(229,229,229,0.3)]'
                  }`}
                  style={{ fontWeight: isActive ? 590 : 470 }}
                  title={workflow.description}
                >
                  <span className="flex-1 text-left truncate">{workflow.label}</span>
                  {isActive && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onWorkflowSelect(null);
                      }}
                      className="text-[12px] text-[#a3a3a3] hover:text-[#292929] transition-colors shrink-0"
                      style={{ fontWeight: 470 }}
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
      <div className="pb-6 px-3.5">
        <div className="text-[13px] text-[#a3a3a3] leading-relaxed" style={{ fontWeight: 470, marginBottom: 8 }}>
          Scroll to zoom &middot; Drag to pan
          <br />
          Double-click to open &middot; Drag handles to connect
        </div>
        <button
          onClick={onRediscover}
          className="text-[12px] text-[#a3a3a3] hover:text-[#292929] transition-colors cursor-pointer"
          style={{ fontWeight: 470 }}
        >
          Re-scan routes
        </button>
      </div>
    </aside>
  );
}
