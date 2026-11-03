import type Phaser from 'phaser';

/**
 * pixelfx-Effekte (patch-gg, MIT, siehe tools/pixelfx und ASSETS.md) als vorgebackene Spritesheets in dunkler Palette
 * (`sh scripts/bake-fx.sh` erzeugt public/assets/fx/*.png + *.json). Import-sicher in Node: ohne `Image` bleibt alles aus.
 * Abgespielt als Phaser-Animation mit dem Pixelmaßstab der Figuren (2x).
 */

export const FX_NAMES = [
  'hit', 'crit', 'levelup', 'loot_magic', 'loot_rare', 'loot_set', 'loot_legendary',
  'frost_nova', 'whirl', 'slam', 'lightning', 'heal', 'learn',
] as const;
export type FxName = (typeof FX_NAMES)[number];
/** Pixelmaßstab der Effekte = Maßstab der Figuren */
export const FX_SCALE = 2;

const FX_BASE = `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'}assets/fx/`;

interface FxMeta {
  fps: number;
  loop: boolean;
  frames: number;
  frameSize: [number, number];
  pivot: [number, number];
}
interface Loaded {
  img: HTMLImageElement;
  meta: FxMeta;
}
const store = new Map<FxName, Loaded>();

/** Lädt Bild und Metadaten aller Effekte; Fehler/Zeitüberschreitung ist erlaubt (dann gibt es den Effekt nicht). */
export function preloadPixelfx(timeoutMs = 8000): Promise<void> {
  if (typeof Image === 'undefined' || typeof fetch === 'undefined') return Promise.resolve();
  const one = async (n: FxName): Promise<void> => {
    try {
      const [meta, img] = await Promise.all([
        fetch(`${FX_BASE}${n}.json`).then((r) => r.json() as Promise<{ meta: { pixelfx: FxMeta } }>),
        new Promise<HTMLImageElement>((ok, no) => {
          const i = new Image();
          i.onload = () => ok(i);
          i.onerror = no;
          i.src = `${FX_BASE}${n}.png`;
        }),
      ]);
      store.set(n, { img, meta: meta.meta.pixelfx });
    } catch {
      /* Effekt fehlt: ohne ihn weiterspielen */
    }
  };
  return Promise.race([Promise.all(FX_NAMES.map(one)).then(() => undefined), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

/** Texturen und Animationen in der Szene anlegen (einmal je Szene). */
export function registerPixelfx(scene: Phaser.Scene): void {
  for (const n of store.keys()) registerOne(scene, n);
}

/** Legt Textur + Animation eines geladenen Effekts an (auch nachträglich, wenn das Sheet erst nach dem Szenenstart kam). */
function registerOne(scene: Phaser.Scene, n: FxName): boolean {
  const l = store.get(n);
  if (!l) return false;
  const key = `pfx_${n}`;
  if (scene.textures.exists(key)) return true;
  const { img, meta } = l;
  scene.textures.addSpriteSheet(key, img, { frameWidth: meta.frameSize[0], frameHeight: meta.frameSize[1], endFrame: meta.frames - 1 });
  if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: meta.frames - 1 }), frameRate: meta.fps, repeat: meta.loop ? -1 : 0 });
  return true;
}

export interface PlayOpts {
  depth: number;
  flip?: boolean;
  alpha?: number;
  /** Phaser.BlendModes (0 normal, 1 add) */
  blend?: number;
  scale?: number;
  /** ab dieser Sekunde abspielen (Vorlauf des Effekts überspringen, wenn der Treffer schon feststeht) */
  from?: number;
}

/**
 * Spielt einen Effekt mit dem Drehpunkt (Aufprallpunkt/Füße) bei x, y. Einmal-Effekte entfernen sich selbst;
 * Schleifen liefern das Sprite zurück, der Aufrufer zerstört es. `undefined`, wenn der Effekt nicht geladen ist.
 */
export function playPixelfx(scene: Phaser.Scene, name: FxName, x: number, y: number, o: PlayOpts): Phaser.GameObjects.Sprite | undefined {
  const m = store.get(name)?.meta;
  const key = `pfx_${name}`;
  if (!m || !registerOne(scene, name)) return undefined;
  const s = scene.add.sprite(x, y, key, 0).setOrigin(m.pivot[0] / m.frameSize[0], m.pivot[1] / m.frameSize[1]).setScale(o.scale ?? FX_SCALE).setDepth(o.depth).setAlpha(o.alpha ?? 1);
  if (o.flip) s.setFlipX(true);
  if (o.blend) s.setBlendMode(o.blend);
  s.play({ key, startFrame: Math.min(m.frames - 1, Math.max(0, Math.round((o.from ?? 0) * m.fps))) });
  if (!m.loop) s.once('animationcomplete', () => s.destroy());
  return s;
}
