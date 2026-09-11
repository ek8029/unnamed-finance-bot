// Squarified treemap, the pure part. Used by onboarding to draw the whole book
// as area, so a 9% name is visibly nine times a 1% one.
//
// Bruls, Huizing and van Wijk, "Squarified Treemaps" (2000): fill the shorter
// side first, and only close a row when adding the next item would make its
// worst aspect ratio worse.

export type Tile = { x: number; y: number; w: number; h: number; index: number };

type Item = { area: number; index: number };

const area = (row: Item[]) => row.reduce((n, d) => n + d.area, 0);

/** The worst aspect ratio in `row` if it were laid along a side of `side`. */
function worst(row: Item[], side: number): number {
  const a = area(row);
  if (a <= 0 || side <= 0) return Infinity;
  const thickness = a / side;
  let bad = 1;
  for (const d of row) {
    const len = d.area / thickness;
    if (len <= 0) return Infinity;
    bad = Math.max(bad, len / thickness, thickness / len);
  }
  return bad;
}

/** Lays `row` against the short edge of the free box and returns what is left. */
function place(row: Item[], x: number, y: number, w: number, h: number, out: Tile[]) {
  const a = area(row);
  if (w >= h) {
    const thickness = h > 0 ? a / h : 0;
    let cy = y;
    for (const d of row) {
      const len = thickness > 0 ? d.area / thickness : 0;
      out.push({ x, y: cy, w: thickness, h: len, index: d.index });
      cy += len;
    }
    return { x: x + thickness, y, w: w - thickness, h };
  }
  const thickness = w > 0 ? a / w : 0;
  let cx = x;
  for (const d of row) {
    const len = thickness > 0 ? d.area / thickness : 0;
    out.push({ x: cx, y, w: len, h: thickness, index: d.index });
    cx += len;
  }
  return { x, y: y + thickness, w, h: h - thickness };
}

/**
 * Tiles `width` x `height` in proportion to `values`. Tiles come back in
 * descending value order, each carrying the index of the value it came from;
 * zero and negative values get no tile.
 */
export function squarify(values: readonly number[], width: number, height: number): Tile[] {
  if (!(width > 0) || !(height > 0)) return [];
  const items: Item[] = values
    .map((v, index) => ({ area: Number.isFinite(v) && v > 0 ? v : 0, index }))
    .filter((d) => d.area > 0)
    .sort((a, b) => b.area - a.area);
  const total = area(items);
  if (total <= 0) return [];
  const scale = (width * height) / total;
  for (const d of items) d.area *= scale;

  const out: Tile[] = [];
  let box = { x: 0, y: 0, w: width, h: height };
  let row: Item[] = [];
  let i = 0;
  while (i < items.length) {
    const side = Math.min(box.w, box.h);
    const candidate = [...row, items[i]];
    if (row.length === 0 || worst(candidate, side) <= worst(row, side)) {
      row = candidate;
      i += 1;
      continue;
    }
    box = place(row, box.x, box.y, box.w, box.h, out);
    row = [];
  }
  if (row.length > 0) place(row, box.x, box.y, box.w, box.h, out);
  return out;
}
