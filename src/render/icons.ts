import type { Item } from '../sim/items';
import { GEM_COLOR, templateById } from '../sim/items';
import { schoolOf, type SkillDef, type StatusId } from '../sim/data';
import { sprite } from './sprites';
import { ITEM_SPRITES, POTION_QUICK, SKILL_SPRITES } from './spriteMap';

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

/** Sprite-Icon (32×32 aus Dungeon Crawl Stone Soup, CC0) mit dunklem Umriss, ×2 hochskaliert; null = Fallback. */
function spriteIcon(path: string | undefined): string | null {
  const img = path ? sprite(path) : null;
  if (!img) return null;
  const n = 32;
  const base = document.createElement('canvas');
  base.width = n + 2;
  base.height = n + 2;
  const x = base.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.drawImage(img, 1, 1);
  const d = x.getImageData(0, 0, n + 2, n + 2).data;
  const a = (px: number, py: number) => (px < 0 || py < 0 || px > n + 1 || py > n + 1 ? 0 : d[(py * (n + 2) + px) * 4 + 3]!);
  const out = document.createElement('canvas');
  out.width = (n + 2) * 2;
  out.height = (n + 2) * 2;
  const oc = out.getContext('2d')!;
  oc.imageSmoothingEnabled = false;
  const o2 = document.createElement('canvas');
  o2.width = n + 2;
  o2.height = n + 2;
  const o2c = o2.getContext('2d')!;
  o2c.fillStyle = '#120e12';
  for (let py = 0; py < n + 2; py++) for (let px = 0; px < n + 2; px++) if (!a(px, py) && (a(px - 1, py) || a(px + 1, py) || a(px, py - 1) || a(px, py + 1))) o2c.fillRect(px, py, 1, 1);
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
  const spriteUrl = spriteIcon(ITEM_SPRITES[it.templateId]);
  if (spriteUrl) {
    cache.set(key, spriteUrl);
    return spriteUrl;
  }
  const t = templateById(it.templateId);
  const tier = tierOf(t.minLevel);
  const col = TIER_COL[tier]!;
  let url: string;
  if (it.town) {
    const seal = it.town === 'Felsenwacht' ? 0x5a7ad8 : 0xc83a3a;
    url = make((c) => {
      r(c, 3, 3, 10, 10, 0xe8d8a8);
      r(c, 3, 3, 10, 1, 0xf6ecc8);
      r(c, 3, 12, 10, 1, 0xb89c60);
      r(c, 2, 4, 1, 8, 0xc8b078);
      r(c, 13, 4, 1, 8, 0xc8b078);
      for (let y = 5; y < 10; y += 2) r(c, 5, y, 6, 1, 0x8a6a42);
      r(c, 6, 9, 4, 3, seal);
      r(c, 7, 10, 2, 1, 0xffffff);
    });
  } else if (it.slot === 'potion') {
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
  } else if (it.slot === 'offhand' && t.off === 'shield') {
    url = make((c) => {
      r(c, 3, 2, 10, 9, shade(col, 0.7));
      r(c, 4, 3, 8, 7, col);
      r(c, 5, 11, 6, 2, shade(col, 0.7));
      r(c, 6, 13, 4, 1, shade(col, 0.7));
      r(c, 4, 3, 8, 1, shade(col, 1.4));
      r(c, 7, 4, 2, 8, shade(col, 1.3));
      r(c, 5, 6, 6, 2, shade(col, 1.3));
    });
  } else if (it.slot === 'offhand') {
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
      if (id.endsWith('_axe')) {
        r(c, 7, 3, 2, 12, 0x6a4a2a);
        r(c, 3, 2, 6, 6, col);
        r(c, 3, 3, 2, 4, shade(col, 1.3));
      } else if (id.endsWith('hammer') || id === 'bone_club') {
        r(c, 7, 6, 2, 9, 0x6a4a2a);
        r(c, 3, 2, 10, 5, id === 'bone_club' ? 0xd8d0b8 : col);
        r(c, 3, 2, 10, 1, shade(col, 1.4));
      } else if (id.endsWith('_dagger')) {
        diag(c, 4, 12, 7, shade(col, 1.2), 2);
        diag(c, 5, 12, 7, shade(col, 0.8), 1);
        r(c, 3, 10, 4, 2, 0x6a4a2a);
        r(c, 2, 12, 3, 2, 0x4a3020);
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
  } else if (it.slot === 'gem' && it.gem) {
    const gc = GEM_COLOR[it.gem.kind];
    const q = it.gem.q;
    url = make((c) => {
      // Facettierter Stein, mit der Qualität größer und glänzender
      const w = 6 + q * 2;
      const x0 = 8 - w / 2;
      const y0 = 8 - Math.round(w / 2);
      r(c, x0 + 1, y0, w - 2, 1, shade(gc, 1.35));
      r(c, x0, y0 + 1, w, w - 3, gc);
      r(c, x0 + 1, y0 + w - 2, w - 2, 1, shade(gc, 0.75));
      r(c, x0 + 2, y0 + w - 1, w - 4, 1, shade(gc, 0.55));
      r(c, x0 + 1, y0 + 1, 2, 2, 0xffffff);
      r(c, x0 + w - 3, y0 + 2, 1, w - 5, shade(gc, 0.75));
      if (q === 3) r(c, 13, 2, 2, 2, 0xffffff);
    });
  } else if (it.slot === 'belt') {
    url = make((c) => {
      r(c, 1, 6, 14, 4, shade(col, 0.8));
      r(c, 1, 6, 14, 1, shade(col, 1.3));
      r(c, 1, 9, 14, 1, shade(col, 0.5));
      r(c, 6, 5, 4, 6, 0xd8b848);
      r(c, 7, 6, 2, 4, 0x1a1418);
      r(c, 11, 7, 1, 2, shade(col, 0.5));
    });
  } else if (it.slot === 'cloak') {
    url = make((c) => {
      r(c, 4, 1, 8, 2, shade(col, 1.2));
      r(c, 3, 3, 10, 4, col);
      r(c, 2, 7, 12, 4, shade(col, 0.9));
      r(c, 1, 11, 14, 3, shade(col, 0.7));
      r(c, 7, 3, 2, 10, shade(col, 0.55));
      r(c, 4, 4, 1, 7, shade(col, 1.35));
      r(c, 6, 1, 4, 1, 0xd8b848);
    });
  } else if (it.slot === 'legs') {
    url = make((c) => {
      r(c, 3, 1, 10, 3, shade(col, 1.2));
      r(c, 3, 4, 4, 11, col);
      r(c, 9, 4, 4, 11, col);
      r(c, 7, 4, 2, 3, shade(col, 0.6));
      r(c, 3, 11, 4, 1, shade(col, 0.6));
      r(c, 9, 11, 4, 1, shade(col, 0.6));
      r(c, 4, 4, 1, 8, shade(col, 1.4));
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
  const url = spriteIcon(SKILL_SPRITES[s.id]) ?? make((c) => {
    if (s.heal !== undefined) {
      r(c, 6, 2, 4, 12, 0x60e890);
      r(c, 2, 6, 12, 4, 0x60e890);
      r(c, 7, 3, 2, 10, 0xe8fff0);
    } else if (s.passive || s.effect || s.action) {
      // Schule bestimmt die Farbe: Schutz blau, Schwächung violett, Kontrolle gelb, Bannung weiß, Hilfe grün
      const school = schoolOf(s);
      const col = school === 'protect' ? 0x6a9ae0 : school === 'debuff' ? 0xa070d0 : school === 'control' ? 0xe8d860 : school === 'dispel' ? 0xe8e8f0 : school === 'resource' ? 0x4ac0d8 : school === 'direct' ? 0xe08a4a : 0x6ad080;
      r(c, 3, 2, 10, 8, col);
      r(c, 4, 10, 8, 2, col);
      r(c, 6, 12, 4, 2, col);
      r(c, 5, 4, 6, 4, shade(col, 1.4));
      if (s.passive) r(c, 1, 1, 14, 1, 0xffffff);
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
  const url = spriteIcon(POTION_QUICK[kind]) ?? make((c) => {
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

const statusCache = new Map<string, string>();
/** Kleine Symbole für die Status-Chips im HUD (selbst gezeichnet; die DCSS-Pakete enthalten keine Statussymbole). */
export function statusIcon(id: StatusId | 'poison'): string {
  const hit = statusCache.get(id);
  if (hit) return hit;
  const url = make((c) => {
    if (id === 'slow') {
      // Schneeflocke
      r(c, 7, 1, 2, 14, 0x9fd8ff);
      r(c, 1, 7, 14, 2, 0x9fd8ff);
      diag(c, 2, 13, 12, 0xd8f0ff, 1);
      for (let i = 0; i < 12; i++) r(c, 2 + i, 2 + i, 1, 1, 0xd8f0ff);
    } else if (id === 'stun') {
      // Sterne um den Kopf
      r(c, 2, 8, 4, 1, 0xffe45a); r(c, 3, 7, 2, 3, 0xffe45a);
      r(c, 10, 3, 4, 1, 0xffe45a); r(c, 11, 2, 2, 3, 0xffe45a);
      r(c, 8, 11, 5, 1, 0xfff0a0); r(c, 9, 10, 3, 3, 0xfff0a0);
      r(c, 1, 3, 2, 2, 0xffc040);
    } else if (id === 'burn') {
      // Flamme
      r(c, 6, 1, 3, 3, 0xff7a2a);
      r(c, 4, 4, 8, 4, 0xff7a2a);
      r(c, 3, 7, 10, 6, 0xff9a3a);
      r(c, 5, 12, 6, 3, 0xff9a3a);
      r(c, 6, 8, 4, 6, 0xffd23a);
      r(c, 7, 11, 2, 3, 0xfff4b0);
    } else if (id === 'ward' || id === 'stoneskin') {
      // Schild
      const col = id === 'ward' ? 0x7fb0ff : 0xc8b898;
      r(c, 3, 2, 10, 8, col);
      r(c, 4, 10, 8, 2, col);
      r(c, 6, 12, 4, 2, col);
      r(c, 5, 3, 6, 6, id === 'ward' ? 0xd8ecff : 0x8a7a60);
    } else if (id === 'bandage') {
      // Verband mit Kreuz
      r(c, 2, 5, 12, 6, 0xe8e0d0);
      r(c, 7, 4, 2, 8, 0xd84a4a);
      r(c, 4, 7, 8, 2, 0xd84a4a);
    } else if (id === 'weaken') {
      // gesenkte Faust
      r(c, 3, 3, 10, 6, 0xb08adf);
      r(c, 5, 9, 6, 4, 0xb08adf);
      r(c, 6, 13, 4, 2, 0x6a4a9a);
    } else if (id === 'curse') {
      // Totenkopf
      r(c, 4, 2, 8, 8, 0xe8d0dc);
      r(c, 6, 10, 4, 3, 0xe8d0dc);
      r(c, 5, 5, 2, 2, 0xd05a8a);
      r(c, 9, 5, 2, 2, 0xd05a8a);
    } else if (id === 'silence') {
      // durchgestrichener Mund
      r(c, 3, 6, 10, 4, 0xe0e0e8);
      diag(c, 2, 13, 12, 0xd84a4a, 2);
    } else {
      // Gifttropfen
      r(c, 7, 1, 2, 3, 0x7fe060);
      r(c, 6, 4, 4, 3, 0x7fe060);
      r(c, 4, 7, 8, 6, 0x6ad050);
      r(c, 5, 13, 6, 1, 0x6ad050);
      r(c, 5, 8, 2, 3, 0xd8ffc8);
    }
  });
  statusCache.set(id, url);
  return url;
}

const cursorCache = new Map<string, string>();

/** Mauszeiger-Bild eines Zaubers: nur das Motiv, ohne dunklen Kachelhintergrund (der vom Rand her zusammenhängende dunkle Bereich wird durchsichtig). */
export function skillCursor(s: SkillDef): string {
  const hit = cursorCache.get(s.id);
  if (hit) return hit;
  const img = SKILL_SPRITES[s.id] ? sprite(SKILL_SPRITES[s.id]!) : null;
  if (!img) return skillIcon(s);
  const n = 32;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.drawImage(img, 0, 0, n, n);
  const im = x.getImageData(0, 0, n, n);
  const d = im.data;
  const bg = (i: number) => d[i + 3]! < 16 || (d[i]! + d[i + 1]! + d[i + 2]!) / 3 < 60;
  const seen = new Uint8Array(n * n);
  const stack: number[] = [];
  for (let k = 0; k < n; k++) stack.push(k, (n - 1) * n + k, k * n, k * n + n - 1);
  while (stack.length) {
    const q = stack.pop()!;
    if (seen[q] || !bg(q * 4)) continue;
    seen[q] = 1;
    d[q * 4 + 3] = 0;
    const px = q % n;
    if (px > 0) stack.push(q - 1);
    if (px < n - 1) stack.push(q + 1);
    if (q >= n) stack.push(q - n);
    if (q < n * n - n) stack.push(q + n);
  }
  x.putImageData(im, 0, 0);
  const url = c.toDataURL();
  cursorCache.set(s.id, url);
  return url;
}
