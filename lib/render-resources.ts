/**
 * Shared resource-field renderer used by both Canvas2D and the Pixi
 * resource sprite (which renders to an off-screen Canvas2D).
 *
 * Each cell with stock ≥ half its capacity gets a small coloured dot
 * whose alpha tracks how stocked it is. Sugar and spice are nudged in
 * opposite directions inside the cell so they sit side by side rather
 * than overlapping when both are present.
 */
export function drawResourceField(
  ctx: CanvasRenderingContext2D,
  field: Float32Array,
  maxField: Float32Array,
  rgb: readonly [number, number, number],
  nudge: -1 | 1,
  cellW: number,
  cellH: number,
  dotSize: number,
  width: number,
  height: number,
): void {
  const off = nudge * dotSize * 0.45;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const v = field[idx];
      const max = maxField[idx];
      if (max <= 0 || v < max * 0.5) continue;
      const intensity = Math.min(1, v / 4);
      const alpha = 0.18 + intensity * 0.35;
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
      const dx = x * cellW + cellW / 2 - dotSize / 2 + off;
      const dy = y * cellH + cellH / 2 - dotSize / 2 + off;
      ctx.fillRect(dx, dy, dotSize, dotSize);
    }
  }
}

/** Standard sugar tint — slightly desaturated green. */
export const SUGAR_RGB: readonly [number, number, number] = [120, 200, 130];

/** Standard spice tint — warm amber. */
export const SPICE_RGB: readonly [number, number, number] = [214, 158, 90];
