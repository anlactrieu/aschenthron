// Kontaktbögen der Skelett-Monster (gleicher Code wie im Spiel: src/render/monster.ts), zum Ansehen beim Verfeinern.
//   npx tsx scripts/bake-monsters.ts [id ...]   ohne IDs alle Arten; NPCs als npc:<Name> oder npc:<Art> (z. B. npc:"Ritter Aldric", npc:smith)
//   Optionen: --cols 0,4,12 (nur diese Spalten), --k 4 (Maßstab), --ground (auf Spielboden, abgedunkelt)
// Ausgabe nach public/probe/monster/ (ignoriert): contact-<id>.png; Zeilen = Seite, zur Kamera, weg; Spalten = Stehen, Gehen, Angriff, Getroffen, Sterben.
import { join } from 'node:path';
import { bakeFigure } from '../src/render/figure';
import { MONSTER_DEFS, monsterSpec } from '../src/render/monster';
import { NPC_FIG_NAMES, npcSpec } from '../src/render/npc';
import { writeContact, writeGallery } from './contact';

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv.splice(i, 2)[1] : undefined;
};
const flag = (name: string): boolean => {
  const i = argv.indexOf(name);
  if (i >= 0) argv.splice(i, 1);
  return i >= 0;
};
const pick = opt('--cols')?.split(',').map(Number);
// --rows 1,2: nur diese Ansichten (0 Seite, 1 zur Kamera, 2 weg)
const rows = opt('--rows')?.split(',').map(Number);
const K = +(opt('--k') ?? 3);
const ground = flag('--ground');
// --gallery: alle gewählten Arten in eine Galerie (Stehen seitlich/vorn/hinten, Gehen, Schlag, liegend)
const gallery = flag('--gallery');
const sheets = [];
for (const id of argv.length ? argv : Object.keys(MONSTER_DEFS)) {
  const npc = id.startsWith('npc:') ? id.slice(4) : undefined;
  const spec = npc !== undefined ? npcSpec(NPC_FIG_NAMES.includes(npc) ? 'trainer' : npc, NPC_FIG_NAMES.includes(npc) ? npc : undefined) : monsterSpec(id);
  if (!spec) {
    console.log(`${id}: keine Figur`);
    continue;
  }
  const t = performance.now();
  const s = bakeFigure(spec);
  const ms = performance.now() - t;
  sheets.push(s);
  if (gallery) continue;
  const file = writeContact(join('monster', `contact-${id.replace(/[^\w]+/g, '_')}${pick || rows ? '-sel' : ''}.png`), s, { cols: pick, rows, k: K, ground });
  console.log(`${file.replace(/.*probe\//, '')}  ${ms.toFixed(0)} ms, ${s.w}x${s.h}, Kopf ${s.top}, Breite ${s.bodyW}, abgeschnitten ${s.clipped}`);
}
if (gallery) {
  const names = ['idle_side_0', 'walk_side_2', 'attack_side_3', 'idle_front_0', 'walk_front_5', 'idle_back_0', 'hit_side_0', `die_side_3`];
  console.log(writeGallery(join('monster', `galerie${argv.length ? '-' + argv[0] : ''}.png`), sheets, names, K, ground));
}
