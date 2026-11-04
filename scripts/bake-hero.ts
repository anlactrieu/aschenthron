// Kontaktbögen des Skelett-Helden (gleicher Code wie im Spiel: src/render/hero.ts), zum Ansehen beim Verfeinern.
//   npx tsx scripts/bake-hero.ts [name ...]     Namen aus LOOKS unten, ohne Namen alle
//   Optionen: --cols 0,4,12 (nur diese Spalten), --k 4 (Maßstab), --ground (auf Spielboden, mit DARK_GRADE abgedunkelt)
// Ausgabe nach public/probe/held/ (ignoriert): contact-<name>.png; Zeilen = Seite, zur Kamera, weg; Spalten = Stehen, Gehen, Angriff, Getroffen, Sterben.
import { join } from 'node:path';
import { bakeHero, type HeroLook } from '../src/render/hero';
import { writeContact } from './contact';

const BASE: HeroLook = { armor: 'cloth', robe: false, helm: 0, helmMat: 'iron', gloves: 0, legs: 0, weapon: 'sword', weaponTier: 0, shield: 0, cloak: '', quiver: false, rar: [0, 0, 0] };
const LOOKS: Record<string, Partial<HeroLook>> = {
  tuch: { weapon: 'none' },
  leder: { armor: 'leather', helm: 1, helmMat: 'leather', gloves: 1, legs: 1, cloak: 'hunter' },
  ritter: { armor: 'iron', helm: 2, gloves: 2, legs: 2, shield: 2, cloak: 'wool', rar: [2, 1, 2] },
  topf: { armor: 'dread', helm: 3, helmMat: 'dread', gloves: 2, legs: 2, weapon: 'greatsword', cloak: 'dread', rar: [4, 4, 4] },
  krone: { armor: 'ash', helm: 4, helmMat: 'ash', gloves: 2, legs: 2, weapon: 'axe', shield: 3, rar: [3, 3, 3] },
  jaeger: { armor: 'leather', helm: 5, helmMat: 'cloth', gloves: 1, legs: 1, weapon: 'bow', quiver: true, cloak: 'hunter' },
  magier: { armor: 'acolyte', robe: true, helm: 5, helmMat: 'cloth', weapon: 'staff', weaponTier: 2, cloak: 'dread', rar: [0, 2, 1] },
  knochen: { armor: 'bone', robe: true, weapon: 'staff', weaponTier: 4, rar: [0, 3, 0] },
  hammer: { armor: 'iron', helm: 2, gloves: 1, weapon: 'mace', shield: 1 },
};

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
const K = +(opt('--k') ?? 4);
const ground = flag('--ground');
const names = argv.length ? argv : Object.keys(LOOKS);
for (const name of names) {
  const look = { ...BASE, ...LOOKS[name] };
  const t = performance.now();
  const s = bakeHero(look);
  const ms = performance.now() - t;
  const file = writeContact(join('held', `contact-${name}${pick || rows ? '-sel' : ''}${ground ? '-boden' : ''}.png`), s, { cols: pick, rows, k: K, ground });
  console.log(`${file}  ${ms.toFixed(0)} ms, Kopf ${s.top} px, Körper ${s.bodyW} px breit, abgeschnitten ${s.clipped}`);
}
