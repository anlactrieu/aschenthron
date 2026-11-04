import type Phaser from 'phaser';
import { TEMPLATES, type Item } from '../sim/items';
import { itemIcon } from './icons';

/**
 * Beute-Icons (Tränke, Schriftrollen, Edelsteine) in einer gemeinsamen Leinwand-Textur: einmal beim Szenenstart angelegt,
 * die Icons werden in freien Frames (eins je Frame) hineingezeichnet. Eine neue GL-Textur beim ersten Drop kostete dagegen
 * 100-250 ms, das Auslesen der Icon-Leinwände stockte, solange die GPU beschäftigt war.
 */
export const LOOT_TEX = 'loot_icons';
const SLOT = 70;
const PAD = 1;
const COLS = 8;

const ids = (): string[] => TEMPLATES.filter((t) => t.slot === 'potion' || t.slot === 'gem').map((t) => t.id);

const frames = new Map<string, string>();
const queue: string[] = [];
const loading = new Set<string>();
/** Beuteansichten, die auf ihr Icon warten; werden beim Zeichnen des Icons umgestellt */
const waiting = new Map<Phaser.GameObjects.Image, string>();
let slots = 0;

export function initLootAtlas(scene: Phaser.Scene): void {
  frames.clear();
  queue.length = 0;
  loading.clear();
  waiting.clear();
  slots = 0;
  const all = ids();
  // Szene neu gestartet: Textur samt Bildnamen frisch anlegen, sonst passen die Felder nicht mehr
  if (scene.textures.exists(LOOT_TEX)) scene.textures.remove(LOOT_TEX);
  scene.textures.createCanvas(LOOT_TEX, SLOT * COLS, SLOT * Math.ceil(all.length / COLS));
  queue.push(...all);
}

/** Beuteansicht `img` auf das Icon umstellen, sobald es da ist (sofort, wenn schon gezeichnet); das Icon rückt in der Warteschlange vor */
export function useLootIcon(img: Phaser.GameObjects.Image, templateId: string): void {
  const f = frames.get(templateId);
  if (f) {
    img.setTexture(LOOT_TEX, f).setDisplaySize(30, 30);
    return;
  }
  waiting.set(img, templateId);
  const at = queue.indexOf(templateId);
  if (at > 0) {
    queue.splice(at, 1);
    queue.unshift(templateId);
  }
}

/** Ein Icon je Frame in die Textur zeichnen (Bild dekodiert asynchron, das Zeichnen selbst kostet kaum) und wartende Ansichten umstellen */
export function pumpLootIcons(scene: Phaser.Scene): void {
  for (const [img, id] of waiting) {
    const f = frames.get(id);
    if (!img.scene) waiting.delete(img);
    else if (f) {
      img.setTexture(LOOT_TEX, f).setDisplaySize(30, 30);
      waiting.delete(img);
    }
  }
  const id = queue[0];
  if (!id || loading.size > 0 || !scene.textures.exists(LOOT_TEX)) return;
  queue.shift();
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) return;
  loading.add(id);
  const im = new Image();
  im.onload = () => {
    loading.delete(id);
    if (!scene.textures.exists(LOOT_TEX)) return;
    const tex = scene.textures.get(LOOT_TEX) as Phaser.Textures.CanvasTexture;
    const slot = slots++;
    const x = (slot % COLS) * SLOT + PAD;
    const y = Math.floor(slot / COLS) * SLOT + PAD;
    tex.context.drawImage(im, x, y);
    tex.add(id, 0, x, y, im.width, im.height);
    tex.refresh();
    frames.set(id, id);
  };
  im.onerror = () => loading.delete(id);
  // Vorlage statt Gegenstand: Icon hängt nur an Vorlage (Heil-/Manawert, Stadt, Edelstein)
  im.src = itemIcon({ ...t, templateId: t.id } as unknown as Item);
}
