export const TILE_W = 48;
export const TILE_H = 48;

export function toScreen(x: number, y: number): { sx: number; sy: number } {
  return { sx: x * TILE_W, sy: y * TILE_H };
}

export function toTile(sx: number, sy: number): { x: number; y: number } {
  return { x: sx / TILE_W, y: sy / TILE_H };
}
