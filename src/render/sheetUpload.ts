import type Phaser from 'phaser';
import type { FigSource } from './heroSheet';

/**
 * Sheet-Texturen scheibenweise auf die GPU: Die Textur wird leer in voller Größe angelegt (kostet kaum) und dann Zeile für
 * Zeile gefüllt, höchstens `BYTES_PER_FRAME` je Frame. Erst wenn sie voll ist, wird sie als Phaser-Textur eingetragen (bis dahin
 * zeigt das Spiel den Schattenriss). Ein Upload am Stück stockte unter GPU-Last einzeln 25-200 ms (Befehlspuffer voll).
 */
const BYTES_PER_FRAME = 1 << 20;

interface Job {
  key: string;
  src: FigSource & Uint8Array;
  wrapper: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper;
  w: number;
  h: number;
  row: number;
}

const jobs: Job[] = [];

/** Läuft für `key` gerade ein Upload? */
export const uploading = (key: string): boolean => jobs.some((j) => j.key === key);

/** Anzahl laufender Uploads */
export const pendingUploads = (): number => jobs.length;

/** Upload einreihen (oder, wenn `urgent`, nach vorn ziehen). `false`, wenn es keine rohen Pixel / kein WebGL gibt. */
export function queueUpload(scene: Phaser.Scene, key: string, src: FigSource, urgent: boolean): boolean {
  const r = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  const sheet = src.figSheet;
  if (!('gl' in r) || !(src instanceof Uint8Array) || !sheet) return false;
  const at = jobs.findIndex((j) => j.key === key);
  if (at >= 0) {
    if (urgent && at > 0) jobs.unshift(...jobs.splice(at, 1));
    return true;
  }
  const gl = r.gl;
  const wrapper = r.createTexture2D(0, gl.NEAREST, gl.NEAREST, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.RGBA, undefined, sheet.w, sheet.h, true, true, true);
  const job: Job = { key, src: src as FigSource & Uint8Array, wrapper, w: sheet.w, h: sheet.h, row: 0 };
  if (urgent) jobs.unshift(job);
  else jobs.push(job);
  return true;
}

/** Upload abbrechen (Sheet aus dem Cache geworfen) */
export function cancelUpload(scene: Phaser.Scene, key: string): void {
  const at = jobs.findIndex((j) => j.key === key);
  if (at < 0) return;
  const [j] = jobs.splice(at, 1);
  (scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).deleteTexture(j!.wrapper);
}

/** Jeden Frame: die vorderen Aufträge um bis zu `BYTES_PER_FRAME` weiter füllen; fertige Texturen samt Bildnamen eintragen */
export function pumpUploads(scene: Phaser.Scene): void {
  if (!jobs.length) return;
  const r = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  const gl = r.gl;
  let left = BYTES_PER_FRAME;
  while (left > 0 && jobs.length) {
    const j = jobs[0]!;
    const rows = Math.min(j.h - j.row, Math.max(1, Math.floor(left / (j.w * 4))));
    r.glTextureUnits.bind(j.wrapper, 0);
    r.glWrapper.updateTexturing({ texturing: { flipY: true, premultiplyAlpha: true } });
    // mit UNPACK_FLIP_Y wird die Scheibe in sich gespiegelt: sie gehört deshalb an die gespiegelte Stelle
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, j.h - j.row - rows, j.w, rows, gl.RGBA, gl.UNSIGNED_BYTE, j.src.subarray(j.row * j.w * 4, (j.row + rows) * j.w * 4));
    j.row += rows;
    left -= rows * j.w * 4;
    if (j.row < j.h) break;
    jobs.shift();
    const sheet = j.src.figSheet!;
    Object.assign(j.wrapper, { figTop: j.src.figTop, figW: j.src.figW, figDir: j.src.figDir, figScale: j.src.figScale, figSheet: sheet });
    if (scene.textures.exists(j.key)) {
      r.deleteTexture(j.wrapper);
      continue;
    }
    // Phaser setzt beim Eintragen mit pixelArt den Filter neu und lädt dabei `wrapper.pixels` (hier leer) noch einmal hoch,
    // das würde die gefüllte Textur löschen. Der Filter ist schon NEAREST, also die Neusetzung kurz abschalten.
    const cfg = scene.game.config as { antialias: boolean };
    const aa = cfg.antialias;
    cfg.antialias = true;
    let tex: Phaser.Textures.Texture;
    try {
      tex = scene.textures.addGLTexture(j.key, j.wrapper)!;
    } finally {
      cfg.antialias = aa;
    }
    // für die Wiederherstellung nach Verlust des GL-Kontexts (Phaser lädt `pixels` dann neu hoch)
    j.wrapper.pixels = j.src;
    for (const [name, f] of Object.entries(sheet.frames)) tex.add(name, 0, f.x, f.y, sheet.frame.w, sheet.frame.h);
  }
}
