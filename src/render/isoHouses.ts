/**
 * Iso-Häuser (P9 Iso). Schnittstelle für GameScene, Inhalt gehört P9.3.
 * Ein Haus (aus `detectHouses`, Wandring samt Tür) wird zu wenigen Bildern (`IsoHousePart`). GameScene legt jedes Teil an seiner
 * Bildschirmposition ab (Maßstab 2, Ursprung links oben), schneidet es in Spalten von 32 px und gibt jeder Spalte die Tiefe der
 * vorderen bzw. hinteren Bodenkante der Grundfläche (`footprintColumns`, Feld `layer`). Ausblenden: `isoHouseFade` liefert die
 * Ziel-Deckkraft je Gruppe (`fade`), GameScene blendet weich dorthin. Die Wand- und Türkacheln des Rings zeichnet in Iso nur
 * dieses Modul (GameScene legt dafür keine Props an); der Boden darunter (Dielen) kommt wie bisher aus dem Boden-Chunk.
 * P9.3: Fachwerkhaus mit Satteldach, Ostgiebel, Schornstein und Fensterlicht nach der Vorlage `iso()` in `scripts/bake-iso-probe.ts`.
 * Türen gibt es auf allen vier Seiten. Süd und Ost sieht man von außen (Schild über der Tür); Nord und West liegen hinter dem Haus,
 * dort hängt das Schild auf einer Stange über der Dachkante (mit Lampenschein), die Tür selbst zeigt die Innenseite bei ausgeblendetem Dach.
 * Texturen hängen nur an Bauart, Tür und Variante, nicht an der Lage: Häuser gleicher Art teilen sich ein Bild.
 * Ohne DOM nutzbar (reine Raster).
 */
import type { House } from './houses';
import type { Raster } from './world/raster';
import { project } from './iso';
import { UZ } from './isoDraw';
import { isoPropKey, propAnchor } from './isoTownArt';
import { ROOF, WH, boxOf, drawBack, drawLight, drawRoof, drawWalls, houseFrame, partKey, shapeKey, type HouseShape, type PartName } from './isoHouseArt';

/** Ausblend-Gruppen eines Hauses: Dach, Vorderwände, Rückwände (Innenseiten von Nord- und Westwand) */
export type IsoFade = 'roof' | 'walls' | 'back';

export interface IsoHousePart {
  /** Textur-Schlüssel (eindeutig je Haus und Teil) */
  key: string;
  make: () => Raster;
  /** Bildschirmposition der linken oberen Bildecke (das Bild wird mit Maßstab 2 gezeigt) */
  sx: number;
  sy: number;
  /** Tiefe aus der vorderen (Vorderwände, Dach) oder hinteren Bodenkante (Rückwände, von innen gesehen) */
  layer: 'front' | 'back';
  /** Ausblend-Gruppe (Ziel-Deckkraft aus `isoHouseFade`); 'none' bleibt immer deckend */
  fade: IsoFade | 'none';
  /** additiv über allem (Fensterlicht nachts, Deckkraft = Nacht); P9.3 */
  light?: boolean;
}

/** Grundfläche in Rasterkoordinaten (Kachelkanten) */
const absBox = (hs: House): { xa: number; ya: number; xb: number; yb: number } => {
  const b = boxOf({ w: hs.w, h: hs.h, variant: 0, door: null });
  return { xa: b.xa + hs.x0, ya: b.ya + hs.y0, xb: b.xb + hs.x0, yb: b.yb + hs.y0 };
};

/** Bauart eines Hauses aus der Kartenerkennung: Tür samt Kachelnummer entlang der Wand */
function shapeOf(hs: House): HouseShape {
  const d = hs.door;
  if (!d) return { w: hs.w, h: hs.h, variant: hs.variant, door: null };
  const idx = d.side === 'S' || d.side === 'N' ? d.x - hs.x0 : hs.y0 + hs.h - 1 - d.y;
  return { w: hs.w, h: hs.h, variant: hs.variant, door: { side: d.side, idx, icon: d.icon } };
}

/** Dachbild je Bauart (auch das Licht braucht es, um die Stange des Nord-/Westschildes zu finden) */
const roofs = new Map<string, Raster>();

/**
 * Teile eines Hauses: Rückwände, Vorderwände (Süd/Ost), Dach (samt Schornstein, Giebel, Stange) und Licht. Reihenfolge = Zeichenreihenfolge
 * bei gleicher Tiefe. Die Bilder sind träge (`make`) und gelten für alle Häuser gleicher Bauart; nur die Lage (`sx`/`sy`) ist je Haus.
 */
export function isoHouseParts(hs: House): IsoHousePart[] {
  const sh = shapeOf(hs);
  const f = houseFrame(sh);
  const at = project(true, hs.x0, hs.y0);
  const id = shapeKey(sh);
  const roof = (): Raster => {
    let r = roofs.get(id);
    if (!r) roofs.set(id, (r = drawRoof(sh, f)));
    return r;
  };
  const part = (name: PartName, layer: IsoHousePart['layer'], fade: IsoHousePart['fade'], make: () => Raster, light = false): IsoHousePart => ({
    key: `ih_${partKey(sh, name)}`, sx: f.sx + at.sx, sy: f.sy + at.sy, layer, fade, make, ...(light ? { light } : {}),
  });
  return [
    part('back', 'back', 'back', () => drawBack(sh, f)),
    part('walls', 'front', 'walls', () => drawWalls(sh, f)),
    part('roof', 'front', 'roof', roof),
    part('light', 'front', 'none', () => drawLight(sh, f, roof()), true),
  ];
}

/**
 * Ziel-Deckkraft je Ausblend-Gruppe, wenn der Held auf (px, py) steht (Rasterkoordinaten, auch Zwischenwerte): im Haus Dach und
 * Vorderwände fast weg, die Rückwände bleiben; verdeckt (Fuß hinter der Vorderkante und unter der Dachspitze, im Bild also vom
 * Haus überdeckt, auch hinter Nord- oder Westwand) alles halb durchsichtig; vor der Tür das Dach halb. Werte wie das Dach der
 * Draufsicht (0,2 / 0,5).
 */
export function isoHouseFade(hs: House, px: number, py: number): Record<IsoFade, number> {
  const inside = px >= hs.x0 - 0.5 && px <= hs.x0 + hs.w - 0.5 && py >= hs.y0 - 0.5 && py <= hs.y0 + hs.h - 0.5;
  if (inside) return { roof: 0.2, walls: 0.2, back: 1 };
  if (covers(hs, px, py)) return { roof: 0.4, walls: 0.4, back: 0.4 };
  const d = hs.door;
  const near = !!d && Math.abs(px - d.x) <= 2 && Math.abs(py - d.y) <= 2;
  return { roof: near ? 0.5 : 1, walls: 1, back: 1 };
}

/** Liegt eine Figur auf (px, py) im Bild hinter dem Haus? Bildschirm-x innerhalb der Grundfläche, Fuß über der Vorderkante, Kopf unter der Dachspitze */
function covers(hs: House, px: number, py: number): boolean {
  const { xa, ya, xb, yb } = absBox(hs);
  const f = project(true, px, py);
  const L = project(true, xa, yb);
  const F = project(true, xb, yb);
  const Rt = project(true, xb, ya);
  const B = project(true, xa, ya);
  if (f.sx <= L.sx + 8 || f.sx >= Rt.sx - 8) return false;
  const on = (a: { sx: number; sy: number }, b: { sx: number; sy: number }): number => a.sy + ((f.sx - a.sx) * (b.sy - a.sy)) / (b.sx - a.sx || 1);
  const front = f.sx <= F.sx ? on(L, F) : on(F, Rt);
  const back = f.sx <= B.sx ? on(L, B) : on(B, Rt);
  // Kopf etwa 56 px über dem Fuß; das Haus reicht bis (Wand + Dach) über die hintere Kante
  return f.sy < front && f.sy - 40 > back - (WH + ROOF) * UZ * 2;
}

/* ---------------------------------------------------------------- Stadtprops (Hook für P9.3) */

/** Iso-Bild eines Stadtprops: Schlüssel (Textur muss registriert sein, z. B. in `registerTownArt`), Anker, flach = liegt am Boden */
export interface IsoTownProp {
  key: string;
  /** Ursprung y (0..1) und Versatz unter der Kachelmitte in Bildschirm-Pixeln; fehlen sie, gelten die Werte der Draufsicht */
  oy?: number;
  dy?: number;
  /** flach am Boden (Teppich, Heu, Raute): liegt unter allen Figuren */
  flat?: boolean;
}

/**
 * Stadtprop in Iso: `key` ist der Draufsicht-Schlüssel aus GameScene `townProp`, `axis` die Richtung des Zugs aus gleichen
 * Nachbarn ('x' = Nachbar links/rechts im Raster, sonst 'y'). Stände und Blumenkästen gibt es in beiden Richtungen als Iso-Bild
 * (`isoTownArt.ts`, registriert in `registerTownArt`), alle übrigen (Fass, Kisten, Brunnen, Laterne, Pfahl, Boot, Schiff) bleiben
 * die stehenden Bilder der Code-Welt. Das Bild steht auf der Kachelmitte (`dy` 0).
 */
export function isoTownProp(key: string, axis: 'x' | 'y', x: number, y: number): IsoTownProp {
  void x;
  void y;
  const kind = key === 'twn_stall' ? 'stall' : key === 'twn_flowers' ? 'flowers' : null;
  if (!kind) return { key };
  return { key: isoPropKey(kind, axis), oy: propAnchor(kind).oy, dy: 0 };
}
