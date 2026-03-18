import type { XmapScreen, XmapSection } from '../../shared/types.js';

const COLS_PER_SECTION = 4;

/** Assign grid positions to screens within their sections */
export function computeLayout(
  screens: XmapScreen[],
  sections: XmapSection[]
): void {
  let sectionRow = 0;

  for (const section of sections) {
    const sectionScreens = screens.filter((s) => section.screens.includes(s.id));
    if (sectionScreens.length === 0) continue;

    let col = 0;
    let row = sectionRow;

    for (const screen of sectionScreens) {
      screen.col = col;
      screen.row = row;
      col++;
      if (col >= COLS_PER_SECTION) {
        col = 0;
        row++;
      }
    }

    // Next section starts 2 rows below the last used row
    const maxRow = Math.max(...sectionScreens.map((s) => s.row));
    sectionRow = maxRow + 2;
  }
}
