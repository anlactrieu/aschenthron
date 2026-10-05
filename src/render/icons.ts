import type { Item } from '../sim/items';
import { templateById } from '../sim/items';
import type { SkillDef } from '../sim/data';

/** Prozedurale Item- und Skill-Icons (16×16 logisch, mit Umriss, ×3 hochskaliert) als Data-URLs. */

const TIER_COL = [0x8a6a42, 0x9a9da8, 0x7aa0c8, 0xe0d8b8, 0x8a5aa8, 0xe8762a];

function tierOf(minLevel: number): number {
  return minLevel >= 26 ? 5 : minLevel >= 21 ? 4 : minLevel >= 16 ? 3 : minLevel >= 11 ? 2 : minLevel >= 6 ? 1 : 0;
}

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
function shade(n: number, f: number): number {
  const c = (s: number) => Math.min(255, Math.max(0, Math.round(((n >> s) & 255) * f)));
  return (c(16) << 16) | (c(8) << 8) | c(0);
}

function make(draw: (c: CanvasRenderingContext2D) => void, scale = 3): string {
  const base = document.createElement('canvas');
  base.width = 16;
  base.height = 16;
  const x = base.getContext('2d')!;
  draw(x);
  // Umriss
  const d = x.getImageData(0, 0, 16, 16).data;
  const out = document.createElement('canvas');
  out.width = 16 * scale;
  out.height = 16 * scale;
  const oc = out.getContext('2d')!;
  oc.imageSmoothingEnabled = false;
  const o2 = document.createElement('canvas');
  o2.width = 16;
  o2.height = 16;
  const o2c = o2.getContext('2d')!;
  const a = (px: number, py: number) => (px < 0 || py < 0 || px > 15 || py > 15 ? 0 : d[(py * 16 + px) * 4 + 3]!);
  o2c.fillStyle = '#120e12';
  for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) if (!a(px, py) && (a(px - 1, py) || a(px + 1, py) || a(px, py - 1) || a(px, py + 1))) o2c.fillRect(px, py, 1, 1);
  o2c.drawImage(base, 0, 0);
  oc.drawImage(o2, 0, 0, out.width, out.height);
  return out.toDataURL();
}

const r = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: number | string) => {
  c.fillStyle = typeof col === 'number' ? css(col) : col;
  c.fillRect(x, y, w, h);
};

function diag(c: CanvasRenderingContext2D, x0: number, y0: number, len: number, col: number, thick = 2): void {
  for (let i = 0; i < len; i++) r(c, x0 + i, y0 - i, thick, thick, col);
}

const cache = new Map<string, string>();

export function itemIcon(it: Item): string {
  const key = `${it.templateId}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = templateById(it.templateId);
  const tier = tierOf(t.minLevel);
  const col = TIER_COL[tier]!;
  let url: string;
  if (it.slot === 'potion') {
    const liquid = it.heal ? 0xd83a4a : 0x3a6ae0;
    const big = (it.heal ?? it.mana ?? 0) >= 250 ? 2 : (it.heal ?? it.mana ?? 0) >= 100 ? 1 : 0;
    url = make((c) => {
      r(c, 6, 1, 4, 2, 0x8a6a42);
      r(c, 7, 3, 2, 2, 0xcfe8f0);
      const w = 6 + big * 2;
      const x0 = 8 - w / 2;
      r(c, x0, 6, w, 9, 0xcfe8f0);
      r(c, x0 + 1, 8, w - 2, 6, liquid);
      r(c, x0 + 1, 8, w - 2, 1, shade(liquid, 1.5));
      r(c, x0 + 1, 7, 1, 7, 0xffffff);
    });
  } else if (it.slot === 'amulet') {
    url = make((c) => {
      for (let i = 0; i < 5; i++) { r(c, 3 + i, 1 + i, 1, 1, 0xb0a890); r(c, 12 - i, 1 + i, 1, 1, 0xb0a890); }
      r(c, 6, 6, 4, 1, 0xb0a890);
      r(c, 6, 7, 4, 5, shade(col, 0.7));
      r(c, 7, 8, 2, 3, col);
      r(c, 7, 8, 1, 1, 0xffffff);
      r(c, 7, 12, 2, 1, shade(col, 0.7));
    });
  } else if (it.slot === 'quiver') {
    url = make((c) => {
      r(c, 5, 4, 6, 11, 0x7a5230);
      r(c, 5, 4, 6, 1, 0x4a3018);
      r(c, 4, 6, 1, 8, shade(0x7a5230, 0.7));
      r(c, 6, 1, 1, 4, 0xe8e0d0);
      r(c, 8, 0, 1, 5, 0xd8c890);
      r(c, 10, 2, 1, 3, 0xe8e0d0);
      r(c, 6, 9, 4, 1, col);
    });
  } else if (it.slot === 'ammo') {
    url = make((c) => {
      for (let i = 0; i < 3; i++) {
        r(c, 3 + i * 3, 3, 1, 11, 0x8a6a42);
        r(c, 2 + i * 3, 1, 3, 3, col);
        r(c, 2 + i * 3, 12, 3, 2, 0xe8e0d0);
      }
      r(c, 2, 8, 11, 1, 0x4a3018);
    });
  } else if (it.slot === 'weapon' && t.kind === 'bow') {
    url = make((c) => {
      for (let i = 0; i < 12; i++) r(c, 3 + Math.round(Math.sin((i / 11) * Math.PI) * 3), 2 + i, 2, 1, shade(col, 1.1));
      r(c, 3, 2, 1, 12, 0xe8e0d0);
      r(c, 4, 8, 10, 1, 0xd8c890);
      r(c, 12, 6, 3, 5, 0xe8e0d0);
    });
  } else if (it.slot === 'weapon' && t.kind === 'staff') {
    const orb = [0x90c0ff, 0x80d0ff, 0xb090ff, 0x70e0e0, 0xff9a40, 0xc060ff][tier]!;
    url = make((c) => {
      for (let i = 0; i < 12; i++) r(c, 8 - Math.round(i * 0.15), 5 + i, 2, 1, 0x6a4a2a);
      r(c, 5, 1, 6, 6, orb);
      r(c, 6, 2, 2, 2, 0xffffff);
      r(c, 4, 6, 8, 1, 0x6a4a2a);
    });
  } else if (it.slot === 'weapon') {
    const id = it.templateId;
    url = make((c) => {
      if (id === 'cinder_axe') {
        r(c, 7, 3, 2, 12, 0x6a4a2a);
        r(c, 3, 2, 6, 6, col);
        r(c, 3, 3, 2, 4, shade(col, 1.3));
      } else if (id === 'doom_hammer' || id === 'bone_club') {
        r(c, 7, 6, 2, 9, 0x6a4a2a);
        r(c, 3, 2, 10, 5, id === 'bone_club' ? 0xd8d0b8 : col);
        r(c, 3, 2, 10, 1, shade(col, 1.4));
      } else {
        diag(c, 2, 14, 10, shade(col, 1.2), 2);
        diag(c, 3, 14, 10, shade(col, 0.8), 1);
        r(c, 3, 11, 5, 2, 0x6a4a2a);
        r(c, 1, 13, 3, 2, 0x4a3020);
        if (tier >= 3) r(c, 11, 2, 3, 3, 0xffffff);
      }
    });
  } else if (it.slot === 'head') {
    url = make((c) => {
      r(c, 3, 4, 10, 8, col);
      r(c, 4, 2, 8, 3, shade(col, 1.25));
      r(c, 3, 8, 10, 2, shade(col, 0.6));
      r(c, 6, 9, 4, 4, 0x1a1418);
      if (tier >= 2) r(c, 7, 0, 2, 3, 0xe8c040);
    });
  } else if (it.slot === 'chest' && it.templateId.includes('robe')) {
    url = make((c) => {
      r(c, 5, 2, 6, 5, col);
      r(c, 3, 6, 10, 9, shade(col, 0.9));
      r(c, 1, 5, 3, 7, shade(col, 1.1));
      r(c, 12, 5, 3, 7, shade(col, 1.1));
      r(c, 6, 2, 4, 2, shade(col, 0.5));
      r(c, 7, 7, 2, 8, shade(col, 1.4));
    });
  } else if (it.slot === 'chest') {
    url = make((c) => {
      r(c, 4, 3, 8, 11, col);
      r(c, 1, 3, 4, 4, shade(col, 1.2));
      r(c, 11, 3, 4, 4, shade(col, 1.2));
      r(c, 6, 3, 4, 2, shade(col, 0.5));
      r(c, 4, 10, 8, 1, shade(col, 0.6));
      r(c, 5, 5, 1, 5, shade(col, 1.4));
    });
  } else if (it.slot === 'hands') {
    url = make((c) => {
      r(c, 4, 6, 8, 8, col);
      r(c, 3, 3, 2, 5, shade(col, 1.2));
      r(c, 6, 2, 2, 5, shade(col, 1.2));
      r(c, 9, 3, 2, 4, shade(col, 1.2));
      r(c, 4, 12, 8, 3, shade(col, 0.6));
    });
  } else if (it.slot === 'feet') {
    url = make((c) => {
      r(c, 5, 2, 6, 9, col);
      r(c, 3, 10, 11, 4, shade(col, 0.8));
      r(c, 3, 13, 11, 1, 0x2a2018);
      r(c, 5, 2, 6, 2, shade(col, 1.3));
    });
  } else {
    const gem = [0xd04050, 0x4060d0, 0x40b060, 0xe0c040, 0xa050d0, 0xff8a2a][tier]!;
    url = make((c) => {
      r(c, 4, 6, 8, 8, 0xd8b848);
      r(c, 6, 8, 4, 4, 0x000000);
      c.clearRect(6, 8, 4, 4);
      r(c, 6, 2, 4, 5, gem);
      r(c, 7, 3, 1, 2, 0xffffff);
    });
  }
  cache.set(key, url);
  return url;
}

const skillCache = new Map<string, string>();

export function skillIcon(s: SkillDef): string {
  const hit = skillCache.get(s.id);
  if (hit) return hit;
  const url = make((c) => {
    if (s.heal !== undefined) {
      r(c, 6, 2, 4, 12, 0x60e890);
      r(c, 2, 6, 12, 4, 0x60e890);
      r(c, 7, 3, 2, 10, 0xe8fff0);
    } else if (s.area === 'Nahkampf') {
      diag(c, 1, 14, 12, 0xe8e8f0, 3);
      r(c, 11, 1, 4, 4, 0xff6a4a);
      r(c, 1, 12, 4, 3, 0x8a5a2a);
    } else if (s.area === 'Fernkampf') {
      r(c, 2, 8, 12, 1, 0xd8c890);
      r(c, 12, 6, 3, 5, 0xe8e0d0);
      r(c, 2, 5, 2, 7, 0x8a5a2a);
      r(c, 3, 4, 1, 9, 0x8a5a2a);
      if (s.dot) r(c, 6, 10, 4, 3, 0x7fe060);
    } else {
      const col = s.id === 'frost_nova' ? 0x7fd0ff : s.id === 'lightning' ? 0xc0d8ff : 0xff8a2a;
      r(c, 4, 4, 8, 8, col);
      r(c, 3, 6, 10, 4, shade(col, 1.2));
      r(c, 6, 2, 4, 12, shade(col, 1.2));
      r(c, 6, 6, 4, 4, 0xffffff);
    }
  });
  skillCache.set(s.id, url);
  return url;
}

const potionCache = new Map<string, string>();
/** Kleines Trank-Icon für die Schnellleiste (Q/E). */
export function potionIcon(kind: 'heal' | 'mana'): string {
  const hit = potionCache.get(kind);
  if (hit) return hit;
  const liquid = kind === 'heal' ? 0xd83a4a : 0x3a6ae0;
  const url = make((c) => {
    r(c, 6, 1, 4, 2, 0x8a6a42);
    r(c, 7, 3, 2, 2, 0xcfe8f0);
    r(c, 4, 6, 8, 9, 0xcfe8f0);
    r(c, 5, 8, 6, 6, liquid);
    r(c, 5, 8, 6, 1, shade(liquid, 1.5));
    r(c, 5, 7, 1, 7, 0xffffff);
  });
  potionCache.set(kind, url);
  return url;
}

export function arrowIcon(): string {
  return make((c) => {
    for (let i = 0; i < 3; i++) {
      r(c, 3 + i * 3, 3, 1, 11, 0x8a6a42);
      r(c, 2 + i * 3, 1, 3, 3, 0xd8d0b8);
      r(c, 2 + i * 3, 12, 3, 2, 0xe8e0d0);
    }
  });
}
