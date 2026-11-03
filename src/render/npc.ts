/**
 * Skelett-NPCs: Stadtbewohner als Menschen im Stil des Helden (Zweibeiner-Rig, `monster.ts humSpec`), Kleidung nach Rolle
 * (Lehrer, Magierin, Händler, Schmied, Wache, Lagerverwalter …). Benannte NPCs aus der Karte bekommen eine eigene Aufmachung,
 * die übrigen eine nach ihrer Art. Truhen ohne Verwalter bleiben Truhen (`null`).
 */
import type { FigAnim, FigureSpec } from './figure';
import { ACCENT, CLOAKS, MAT } from './hero';
import { human, humSpec, ramp, RAG, type HumDef } from './monster';

/** NPCs greifen nicht an und sterben nicht: je ein Bild genügt, spart Speicher */
const NPC_ANIMS: Record<FigAnim, number> = { idle: 4, walk: 8, attack: 1, hit: 1, die: 1 };

const HAIR = { brown: MAT.hair, black: ramp(0x3a3034), grey: ramp(0xa8a49c), blond: ramp(0xc8a060), red: ramp(0x9a4a2a), white: ramp(0xd8d4cc) };

const robe = (c: number, o: Partial<HumDef> = {}): HumDef => human({ style: 'none', ...o, gear: { robe: true, ...o.gear }, pal: { robe: ramp(c), top: ramp(c), sleeve: ramp(c), robeHem: MAT.belt, ...o.pal } });
const guard = (o: Partial<HumDef> = {}): HumDef => human({ style: 'staff', weapon: 'spear', wscale: 0.55, shield: 2, ...o, gear: { helm: 2, pauldron: true, ...o.gear }, pal: { top: MAT.iron, metal: MAT.iron, waist: MAT.tabard, sleeve: MAT.chain, legs: MAT.chain, boots: MAT.boot, ...o.pal } });

const BY_NAME: Record<string, HumDef> = {
  'Lehrer Varn': human({ gear: { helm: 0 }, pal: { top: MAT.leather, sleeve: MAT.leatherD, legs: MAT.trousers, boots: MAT.boot, hair: HAIR.grey } }, { size: 1 }),
  'Magierin Selka': robe(0x5a4a9a, { style: 'staff', orb: [0xc0a0ff, 0x6a48c8], gear: { hat: true }, pal: { hood: ramp(0x3a2e6a), robeHem: ACCENT[1], hair: HAIR.red } }),
  'Erzmagier Orvan': robe(0x3a4a8a, { style: 'staff', orb: [0x9ad0ff, 0x4a7ac8], gear: { hat: true, beard: 1.4, cloak: true }, pal: { hood: ramp(0x2a3060), robeHem: ACCENT[2], cloak: ramp(0x2a2a50), hair: HAIR.white, beard: HAIR.white } }),
  'Hafenmeister Joren': robe(0x2e4a6a, { gear: { helm: 1, cloak: true, beard: 0.8 }, pal: { helm: ramp(0x2a3040), cloak: CLOAKS.wool, robeHem: MAT.belt, hair: HAIR.grey, beard: HAIR.grey } }, ),
  'Lagerverwalter Ottmar': robe(0x7a5a3a, { gear: { helm: 1 }, pal: { helm: MAT.leatherD, top: ramp(0x8a8070), sleeve: ramp(0x8a8070), hair: HAIR.brown } }),
  'Lagerverwalter Torvin': robe(0x6a5a4a, { gear: { beard: 1 }, pal: { top: ramp(0x7a7a70), sleeve: ramp(0x7a7a70), hair: HAIR.black, beard: HAIR.black } }),
  'Händler Wenzel': robe(0x3a7a4a, { gear: { helm: 1, beard: 1.2 }, pal: { helm: ramp(0x2a5a34), robeHem: ACCENT[2], hair: HAIR.red, beard: HAIR.red } }),
  'Meisterin Kjorra': human({ shield: 2, gear: { helm: 2, crest: true, pauldron: true }, pal: { top: MAT.iron, metal: MAT.iron, waist: ramp(0x3a5a8a), crest: ramp(0x3a5a8a), sleeve: MAT.chain, legs: MAT.chain, boots: MAT.boot, hair: HAIR.blond } }),
  'Händlerin Mirel': robe(0x8a3a5a, { gear: { helm: 5 }, pal: { hood: ramp(0x5a2a4a), robeHem: ACCENT[2], hair: HAIR.black } }),
  'Händler Dorn': robe(0x6a6a3a, { gear: { beard: 1.3 }, pal: { robeHem: MAT.belt, hair: HAIR.brown, beard: HAIR.brown } }, ),
  'Schmiedin Ilse': human({ style: 'mace', pal: { top: MAT.leatherD, sleeve: MAT.skin, legs: MAT.trousers, boots: MAT.boot, hair: HAIR.red } }, { belly: 1.05, limb: 1.1 }),
  'Schmied Torgal': human({ style: 'mace', gear: { beard: 1.5 }, pal: { top: MAT.leatherD, sleeve: MAT.skin, legs: MAT.trousers, boots: MAT.boot, hair: HAIR.black, beard: HAIR.black } }, { belly: 1.25, limb: 1.15, width: 1.1 }),
  'Hauptmann Brandt': guard({ style: 'sword', weapon: undefined, wscale: undefined, gear: { helm: 2, crest: true, pauldron: true, cloak: true }, pal: { crest: MAT.tabard, cloak: CLOAKS.wool, hair: HAIR.brown } }),
  'Kräuterfrau Odda': robe(0x4a6a3a, { style: 'staff', orb: [0x9aff8a, 0x3a9a3a], gear: { helm: 5 }, pal: { hood: ramp(0x3a4a2a), hair: HAIR.grey } }, ),
  'Wachführerin Tessa': guard({ gear: { helm: 2, crest: true, pauldron: true }, pal: { crest: ramp(0x3a5a8a), waist: ramp(0x3a5a8a), hair: HAIR.blond } }),
  'Späher Ruven': human({ style: 'bow', gear: { helm: 5, quiver: true, cloak: true }, pal: { top: MAT.leather, sleeve: MAT.leatherD, hood: ramp(0x3a4a2a), cloak: CLOAKS.hunter, legs: MAT.trousers, boots: MAT.boot } }),
  'Chronistin Maren': robe(0x7a2a2a, { gear: { helm: 0 }, pal: { robeHem: ACCENT[2], hair: HAIR.black } }),
  'Torwache Haldor': guard({ pal: { hair: HAIR.brown } }),
  'Jägerin Ysa': human({ style: 'bow', gear: { helm: 5, quiver: true, cloak: true }, pal: { top: MAT.leather, sleeve: MAT.leatherD, hood: ramp(0x4a5a32), cloak: CLOAKS.hunter, legs: MAT.trousers, boots: MAT.boot, hair: HAIR.red } }),
  'Eremit Olm': robe(0x6a5a46, { style: 'staff', weapon: 'staff', orb: [0xb0a080, 0x6a5a40], gear: { helm: 5, beard: 1.6 }, pal: { hood: RAG, robe: RAG, top: RAG, hair: HAIR.white, beard: HAIR.white } }, ),
  'Schatzsucher Pell': human({ style: 'dagger', gear: { helm: 1, cloak: true }, pal: { top: MAT.leather, helm: MAT.leatherD, cloak: CLOAKS.rag, legs: MAT.trousers, boots: MAT.boot, hair: HAIR.blond } }),
  'Ritter Aldric': human({ shield: 2, gear: { helm: 3, crest: true, pauldron: true, cloak: true }, pal: { top: MAT.iron, metal: MAT.iron, helm: MAT.iron, waist: ramp(0xd8d0c0), crest: ACCENT[2], cloak: ramp(0xd8d0c0), cloakHem: ACCENT[2], sleeve: MAT.chain, legs: MAT.chain, boots: MAT.iron, shield: ramp(0xd8d0c0) } }, { size: 1.04 }),
};

const BY_KIND: Record<string, HumDef> = {
  trainer: human({ gear: { helm: 0 }, pal: { top: MAT.leather, sleeve: MAT.leatherD, legs: MAT.trousers, boots: MAT.boot } }),
  merchant: robe(0x3a7a4a, { gear: { helm: 1 }, pal: { helm: ramp(0x2a5a34), robeHem: ACCENT[2] } }),
  smith: BY_NAME['Schmied Torgal']!,
  quest: human({ style: 'none', gear: { cloak: true }, pal: { top: ramp(0x6a5a8a), sleeve: ramp(0x5a4a7a), legs: MAT.trousers, boots: MAT.boot, cloak: CLOAKS.rag } }),
};

/** Figur des NPCs oder `null` (Truhe ohne Verwalter) */
export function npcDef(kind: string, name?: string): HumDef | null {
  const d = name ? BY_NAME[name] : undefined;
  if (d) return d;
  if (kind === 'stash') return name && /Lagerverwalter/.test(name) ? BY_NAME['Lagerverwalter Ottmar']! : null;
  return BY_KIND[kind] ?? BY_KIND.quest!;
}

export const npcFigKey = (kind: string, name?: string): string => (name && BY_NAME[name] ? `nfig_n_${name}` : `nfig_${kind}`);

export function npcSpec(kind: string, name?: string): FigureSpec | null {
  const d = npcDef(kind, name);
  return d ? humSpec(npcFigKey(kind, name), d, undefined, NPC_ANIMS) : null;
}

/** benannte NPCs (Tests) */
export const NPC_FIG_NAMES = Object.keys(BY_NAME);
