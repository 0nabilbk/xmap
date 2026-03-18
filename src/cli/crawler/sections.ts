import type { XmapScreen, XmapSection, XmapConfig } from '../../shared/types.js';
import { SECTION_COLORS } from '../../shared/types.js';
import { minimatch } from '../utils/minimatch.js';

/** Auto-group screens into sections by first path segment */
export function groupIntoSections(
  screens: XmapScreen[],
  config: XmapConfig
): XmapSection[] {
  // If user defined sections in config, use those
  if (config.sections && Object.keys(config.sections).length > 0) {
    return buildConfigSections(screens, config);
  }

  // Auto-group by first path segment
  const groups = new Map<string, string[]>();

  for (const screen of screens) {
    const segments = screen.route.split('/').filter(Boolean);
    const groupKey = segments[0] || 'root';

    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(screen.id);
  }

  let colorIndex = 0;
  const sections: XmapSection[] = [];

  for (const [key, screenIds] of groups) {
    sections.push({
      id: key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' '),
      color: SECTION_COLORS[colorIndex % SECTION_COLORS.length],
      screens: screenIds,
    });
    colorIndex++;
  }

  // Assign sections back to screens
  for (const section of sections) {
    for (const screenId of section.screens) {
      const screen = screens.find((s) => s.id === screenId);
      if (screen) screen.section = section.id;
    }
  }

  return sections;
}

function buildConfigSections(
  screens: XmapScreen[],
  config: XmapConfig
): XmapSection[] {
  const sections: XmapSection[] = [];
  const assigned = new Set<string>();
  let colorIndex = 0;

  for (const [id, def] of Object.entries(config.sections!)) {
    const matchingScreens = screens.filter((s) =>
      def.routes.some((pattern) => minimatch(s.route, pattern))
    );

    const screenIds = matchingScreens.map((s) => s.id);
    screenIds.forEach((id) => assigned.add(id));

    // Assign section to screens
    for (const screen of matchingScreens) {
      screen.section = id;
    }

    sections.push({
      id,
      label: def.label,
      color: def.color || SECTION_COLORS[colorIndex % SECTION_COLORS.length],
      screens: screenIds,
    });
    colorIndex++;
  }

  // Unassigned screens go into "other"
  const unassigned = screens.filter((s) => !assigned.has(s.id));
  if (unassigned.length > 0) {
    for (const s of unassigned) s.section = 'other';
    sections.push({
      id: 'other',
      label: 'Other',
      color: SECTION_COLORS[colorIndex % SECTION_COLORS.length],
      screens: unassigned.map((s) => s.id),
    });
  }

  return sections;
}
