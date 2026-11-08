/**
 * Label packing: each star's label is a horizontal box; boxes go in the lowest row where they don't overlap.
 * Used for both sides of the timeline and for each lane.
 */
export interface Box { x0: number; x1: number }
export interface Placement { row: number; anchor: 'start' | 'end' }

export function labelBox(x: number, r: number, w: number, anchor: 'start' | 'end'): Box {
  return anchor === 'start' ? { x0: x - r - 4, x1: x + r + 8 + w } : { x0: x - r - 8 - w, x1: x + r + 4 };
}

export function place(rows: Box[][], x: number, r: number, w: number, maxX: number, maxRows = 60): Placement {
  const anchor: 'start' | 'end' = x + r + 8 + w > maxX ? 'end' : 'start';
  const b = labelBox(x, r, w, anchor);
  let row = 0;
  for (; row < maxRows; row++) {
    const used = rows[row] ?? (rows[row] = []);
    if (!used.some((u) => b.x0 < u.x1 + 6 && b.x1 > u.x0 - 6)) break;
  }
  (rows[row] ?? (rows[row] = [])).push(b);
  return { row, anchor };
}
