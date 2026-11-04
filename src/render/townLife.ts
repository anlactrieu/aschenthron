/**
 * Lebende Städte (rein clientseitig, nichts davon berührt Sim, Spielstand oder Mehrspieler): Aschenhafen und Felsenwacht
 * bekommen Bewohner ohne Funktion (Wache, Kinder, Bauer, Fischer, Ausrufer …), Tiere (Hühner, Katze, Hund, Krähen, Möwen),
 * einen Tagesablauf nach der Spielstunde, kurze Zurufe als Sprechblasen, Stadtgeräusche und Glückwünsche beim Stufenaufstieg.
 * Bewohner sind pixelfx-Skelett-Figuren (`npc.ts`, Rollen `res_*`), Tiere und Platz-Schmuck kleine Pixelbilder in einem Atlas.
 * Der reine Teil (Daten, Zeitplan, Wegesuche, Texte) hängt nicht an Phaser und ist getestet (`townLife.test.ts`).
 */
import type Phaser from 'phaser';
import { isWalkable, type Grid } from '../sim/path';
import { TILE_H, TILE_W, toScreen } from './iso';
import { walkFrame } from './figure';
import { idleFrame } from './hero';
import { FIG_SCALE, originOf } from './heroSheet';
import { figureTexture, prefetchFigure } from './monsterSheet';
import { npcFigKey } from './npc';
import { LIGHT_DEPTH } from './atmosphere';
import type { Sfx } from './audio';

/* ------------------------------------------------------------------------------------------------ Daten */

export type Role = 'guard' | 'nightguard' | 'child' | 'farmer' | 'woman' | 'fisher' | 'crier' | 'drunk' | 'elder';
type Rect = readonly [number, number, number, number];
/** Stunden von/bis (Spielstunde 0–24, über Mitternacht erlaubt) */
type Shift = readonly [number, number];

interface ResidentDef {
  role: Role;
  /** Figur (npc.ts RESIDENTS) */
  look: string;
  /** Aufenthaltsorte (Namen aus `zones`) */
  zones: string[];
  shift: Shift;
  /** Haustür: hier verschwindet und erscheint der Bewohner */
  home: readonly [number, number];
  /** Tiles pro Sekunde */
  speed: number;
  /** Wartezeit zwischen zwei Wegen in Sekunden */
  idle: readonly [number, number];
  /** Sekunden zwischen zwei Zurufen */
  shout: readonly [number, number];
  torch?: boolean;
}

interface AnimalDef {
  kind: 'chicken' | 'cat' | 'dog' | 'crow' | 'gull';
  zones: string[];
  shift: Shift;
}

interface TownDef {
  name: string;
  zones: Record<string, Rect>;
  residents: ResidentDef[];
  animals: AnimalDef[];
  /** Schmuck: Aufbau auf freier Fläche (`flat`) oder an Wänden (`wall`, dort ist schon alles blockiert) */
  decor: { kind: DecorKind; x: number; y: number }[];
}

export type DecorKind = 'banner' | 'board' | 'cart' | 'hay' | 'sacks' | 'baskets';
/** Nur diese stehen auf begehbaren Kacheln (flach, man geht darüber); die anderen nur auf schon blockierten */
export const FLAT_DECOR: ReadonlySet<DecorKind> = new Set(['hay', 'sacks', 'baskets']);

const rs = (role: Role, look: string, zones: string[], shift: Shift, home: readonly [number, number], o: Partial<ResidentDef> = {}): ResidentDef => ({
  role, look, zones, shift, home, speed: 1, idle: [2, 8], shout: [16, 34], ...o,
});

export const TOWNS: TownDef[] = [
  {
    name: 'Aschenhafen',
    zones: {
      markt: [28, 138, 34, 144], strasse: [29, 145, 33, 166], nord: [29, 133, 34, 137],
      hafenplatz: [25, 167, 35, 172], kai: [16, 173, 45, 175], steg: [30, 176, 32, 182],
      gartenW: [15, 140, 17, 143], gartenO: [44, 140, 46, 143],
      gasse1: [16, 150, 45, 151], gasse2: [16, 158, 45, 159], gasse3: [16, 166, 45, 166],
    },
    residents: [
      rs('guard', 'res_guard', ['strasse', 'markt', 'nord', 'hafenplatz'], [6, 20], [23, 139], { speed: 0.8, idle: [3, 9], shout: [26, 50] }),
      rs('nightguard', 'res_guard', ['markt', 'strasse', 'hafenplatz', 'kai'], [20, 6.5], [23, 139], { speed: 0.7, idle: [3, 8], shout: [28, 50], torch: true }),
      rs('child', 'res_child', ['markt', 'gasse1', 'strasse'], [7.5, 19], [35, 155], { speed: 1.7, idle: [1, 4], shout: [12, 26] }),
      rs('child', 'res_child2', ['hafenplatz', 'markt', 'gasse2'], [8, 19.5], [25, 170], { speed: 1.6, idle: [1, 4], shout: [12, 26] }),
      rs('child', 'res_child', ['gartenW', 'gasse1', 'markt'], [8, 18.5], [23, 143], { speed: 1.6, idle: [1, 5], shout: [14, 28] }),
      rs('farmer', 'res_farmer', ['gartenO', 'gasse2', 'markt'], [6, 19], [40, 143], { speed: 0.9 }),
      rs('woman', 'res_woman', ['markt', 'gasse1', 'strasse'], [7, 19.5], [40, 139], { speed: 0.9 }),
      rs('woman', 'res_woman', ['hafenplatz', 'markt', 'gasse3'], [7, 19.5], [35, 163], { speed: 0.9 }),
      rs('fisher', 'res_fisher', ['steg'], [5, 20], [25, 170], { speed: 0.7, idle: [14, 30], shout: [30, 60] }),
      rs('fisher', 'res_fisher', ['kai', 'steg'], [5.5, 20], [25, 170], { speed: 0.7, idle: [8, 20], shout: [24, 50] }),
      rs('crier', 'res_crier', ['markt', 'nord', 'hafenplatz'], [8, 19], [40, 143], { speed: 0.9, idle: [8, 18], shout: [14, 24] }),
      rs('drunk', 'res_drunk', ['kai', 'hafenplatz', 'gasse3'], [19.5, 2], [25, 170], { speed: 0.45, idle: [4, 12], shout: [14, 28] }),
      rs('elder', 'res_elder', ['markt', 'gartenW'], [8, 18], [23, 143], { speed: 0.5, idle: [6, 16], shout: [24, 48] }),
    ],
    animals: [
      { kind: 'chicken', zones: ['gartenW'], shift: [6, 20] }, { kind: 'chicken', zones: ['gartenW'], shift: [6, 20] },
      { kind: 'chicken', zones: ['gartenO'], shift: [6, 20] }, { kind: 'chicken', zones: ['gartenO'], shift: [6, 20] },
      { kind: 'cat', zones: ['gasse2', 'gasse3', 'hafenplatz'], shift: [0, 24] },
      { kind: 'dog', zones: ['strasse', 'markt', 'hafenplatz'], shift: [6.5, 20] },
      { kind: 'crow', zones: ['nord', 'gasse1'], shift: [5.5, 20.5] }, { kind: 'crow', zones: ['gasse1', 'strasse'], shift: [5.5, 20.5] },
      { kind: 'gull', zones: ['kai'], shift: [5, 21] }, { kind: 'gull', zones: ['kai', 'steg'], shift: [5, 21] },
      { kind: 'gull', zones: ['steg'], shift: [5, 21] }, { kind: 'gull', zones: ['kai'], shift: [5, 21] },
    ],
    decor: [
      { kind: 'banner', x: 28, y: 132 }, { kind: 'banner', x: 34, y: 132 }, { kind: 'banner', x: 22, y: 132 }, { kind: 'banner', x: 40, y: 132 },
      { kind: 'board', x: 26, y: 132 }, { kind: 'board', x: 36, y: 132 },
      { kind: 'cart', x: 16, y: 154 }, { kind: 'cart', x: 44, y: 148 },
      { kind: 'hay', x: 15, y: 152 }, { kind: 'hay', x: 45, y: 160 },
      { kind: 'sacks', x: 26, y: 168 }, { kind: 'sacks', x: 37, y: 174 }, { kind: 'sacks', x: 20, y: 174 },
      { kind: 'baskets', x: 29, y: 143 }, { kind: 'baskets', x: 33, y: 139 }, { kind: 'baskets', x: 26, y: 171 },
    ],
  },
  {
    name: 'Felsenwacht',
    zones: {
      platz: [104, 66, 121, 72], nord: [104, 61, 121, 65], tor: [110, 73, 114, 78],
    },
    residents: [
      rs('guard', 'res_guard', ['platz', 'tor', 'nord'], [6, 20], [112, 79], { speed: 0.8, idle: [3, 9], shout: [26, 50] }),
      rs('nightguard', 'res_guard', ['platz', 'tor'], [20, 6.5], [112, 79], { speed: 0.7, idle: [3, 8], shout: [28, 50], torch: true }),
      rs('child', 'res_child', ['platz', 'nord'], [7.5, 19], [112, 79], { speed: 1.7, idle: [1, 4], shout: [12, 26] }),
      rs('child', 'res_child2', ['platz', 'tor'], [8, 19.5], [122, 70], { speed: 1.6, idle: [1, 4], shout: [12, 26] }),
      rs('farmer', 'res_farmer', ['nord', 'platz'], [6, 19], [122, 70], { speed: 0.9 }),
      rs('woman', 'res_woman', ['platz', 'nord'], [7, 19.5], [112, 79], { speed: 0.9 }),
      rs('crier', 'res_crier', ['platz', 'nord', 'tor'], [8, 19], [112, 79], { speed: 0.9, idle: [8, 18], shout: [14, 24] }),
      rs('drunk', 'res_drunk', ['platz', 'tor'], [19.5, 2], [112, 79], { speed: 0.45, idle: [4, 12], shout: [14, 28] }),
      rs('elder', 'res_elder', ['platz'], [8, 18], [104, 70], { speed: 0.5, idle: [6, 16], shout: [24, 48] }),
    ],
    animals: [
      { kind: 'chicken', zones: ['platz'], shift: [6, 20] }, { kind: 'chicken', zones: ['platz', 'nord'], shift: [6, 20] },
      { kind: 'chicken', zones: ['nord'], shift: [6, 20] },
      { kind: 'cat', zones: ['platz', 'tor'], shift: [0, 24] },
      { kind: 'dog', zones: ['platz', 'tor'], shift: [6.5, 20] },
      { kind: 'crow', zones: ['nord', 'platz'], shift: [5.5, 20.5] }, { kind: 'crow', zones: ['platz', 'tor'], shift: [5.5, 20.5] },
      { kind: 'crow', zones: ['nord'], shift: [5.5, 20.5] },
    ],
    decor: [
      { kind: 'banner', x: 110, y: 60 }, { kind: 'banner', x: 111, y: 60 }, { kind: 'banner', x: 106, y: 60 }, { kind: 'banner', x: 118, y: 60 },
      { kind: 'board', x: 108, y: 60 }, { kind: 'board', x: 116, y: 60 },
      { kind: 'cart', x: 104, y: 68 },
      { kind: 'hay', x: 104, y: 72 }, { kind: 'hay', x: 121, y: 66 },
      { kind: 'sacks', x: 120, y: 72 }, { kind: 'sacks', x: 105, y: 66 },
      { kind: 'baskets', x: 109, y: 66 }, { kind: 'baskets', x: 116, y: 71 },
    ],
  },
];

export const townByName = (name: string): TownDef | undefined => TOWNS.find((t) => t.name === name);
/** Alle Bewohner-Figuren einer Stadt (zum Vorbacken) */
export const looksOf = (t: TownDef): string[] => [...new Set(t.residents.map((r) => r.look))];

/* ------------------------------------------------------------------------------------------------ Zeitplan */

/** Liegt die Stunde in [von, bis)? Auch über Mitternacht (20 → 6,5) */
export function inShift(hour: number, [from, to]: Shift): boolean {
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

export type DayPhase = 'day' | 'dusk' | 'night';
export function dayPhase(hour: number): DayPhase {
  return hour >= 6 && hour < 19 ? 'day' : hour >= 19 && hour < 21.5 ? 'dusk' : 'night';
}

/* ------------------------------------------------------------------------------------------------ Wege */

type Rng = () => number;
export const rangeOf = (r: readonly [number, number], rng: Rng): number => r[0] + (r[1] - r[0]) * rng();

/** Kachel unter einem Ort (Kachelmitte liegt bei ganzen Zahlen) */
const tileWalk = (g: Grid, x: number, y: number): boolean => isWalkable(g, Math.round(x), Math.round(y));

/** Frei von (ax,ay) nach (bx,by)? Alle 0,25 Kacheln geprüft */
export function lineClear(g: Grid, ax: number, ay: number, bx: number, by: number): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 4));
  for (let i = 0; i <= n; i++) if (!tileWalk(g, ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n)) return false;
  return true;
}

/** Zufälliger begehbarer Ort in einer Zone, frei erreichbar vom Standort aus (sonst null) */
export function pickSpot(g: Grid, zone: Rect, from: { x: number; y: number } | null, rng: Rng, tries = 10, maxDist = 14): { x: number; y: number } | null {
  for (let i = 0; i < tries; i++) {
    const x = zone[0] + Math.floor(rng() * (zone[2] - zone[0] + 1));
    const y = zone[1] + Math.floor(rng() * (zone[3] - zone[1] + 1));
    if (!isWalkable(g, x, y)) continue;
    if (from && (Math.hypot(x - from.x, y - from.y) > maxDist || !lineClear(g, from.x, from.y, x, y))) continue;
    return { x, y };
  }
  return null;
}

/* ------------------------------------------------------------------------------------------------ Texte */

const SHOUTS: Record<Role, Record<string, string[]>> = {
  guard: {
    Aschenhafen: ['Halt die Augen offen, Bürger.', 'Hier ist alles ruhig. Noch.', 'Draußen in den Roggenfeldern raschelt es wieder.', 'Wer zu spät zum Tor kommt, schläft im Heu.', 'Ich zähle die Laternen, damit ich nicht einschlafe.', 'Mit Ärger auf dem Markt mache ich kurzen Prozess.'],
    Felsenwacht: ['Die Felsenwacht fällt nicht. Nicht heute.', 'Vom Wall sieht man bis zum Räuberlager.', 'Die Straße nach Süden ist lang. Nimm Wasser mit.', 'Ich habe den Hochlandwind satt.', 'Wer hier Ärger macht, übernachtet beim Hauptmann.'],
  },
  nightguard: {
    Aschenhafen: ['Nachtwache. Bleib im Licht, Fremder.', 'Dunkel wie ein Brunnen – und genauso still.', 'Die Fackel hält die Schatten auf Abstand.', 'Geh heim, die Stunde ist spät.'],
    Felsenwacht: ['Nachts pfeift der Wind durch die Zinnen.', 'Ruhige Nacht. Mir gefällt das nicht.', 'Fackel hoch, Augen auf. Das ist die ganze Kunst.', 'Auch Räuber schlafen mal. Hoffe ich.'],
  },
  child: {
    '': ['Fang mich doch!', 'Ich hab einen Frosch gesehen, so groß!', 'Mutter sagt, ich darf nicht an den Kai.', 'Wer zuerst am Brunnen ist!', 'Der Hund hat meinen Apfel gefressen!', 'Wenn ich groß bin, werde ich Held. Oder Bäcker.', 'Hast du ein richtiges Schwert? Zeig mal!'],
  },
  farmer: {
    Aschenhafen: ['Die Roggenfelder tragen gut dieses Jahr.', 'Die Ratten fressen mir das Korn weg!', 'Zu trocken, zu nass – immer ist es falsch.', 'Meine Hühner sind klüger als mein Nachbar.'],
    Felsenwacht: ['Auf dem Hochland wächst nur Stein und Hartnäckigkeit.', 'Die Ziegen fressen mir die Haare vom Kopf.', 'Frischer Käse, wer will?', 'Seit die Räuber da sind, traue ich mich nicht mehr auf die Weide.'],
  },
  woman: {
    '': ['Brot! Frisches Brot!', 'Der Preis für Wolle ist ein Skandal.', 'Hast du meinen Jungen gesehen? Ach, da ist er.', 'Ein Korb voll Äpfel, süß wie Honig!', 'Aus dem Moor zieht wieder Nebel auf, der nach Kohl riecht.'],
  },
  fisher: {
    '': ['Heute beißen sie nicht.', 'Ein Netz voll Silber – morgen ist Markttag.', 'Der Wind dreht, das merke ich im Knie.', 'Wer nachts am Kai steht, hört Dinge im Wasser.', 'Möwen! Die Biester stehlen mir den Fang.'],
  },
  crier: {
    Aschenhafen: ['Hört, hört! Der Hafenmeister sucht tapfere Hände!', 'Neuigkeiten! Schatzsucher wurden in der Tiefenmine gesehen!', 'Im Düsterwald treiben Wegelagerer ihr Unwesen – geht nicht allein!', 'Hört, hört! Die Katakomben haben wieder Besuch bekommen.', 'Aus der Gruft der Moorhexe dringt Licht – wer wagt sich hin?', 'Der Hauptmann sucht Leute für die Wache. Gutes Essen!'],
    Felsenwacht: ['Hört, hört! Im Goblinbau regt sich wieder etwas!', 'Das Spinnennest ist größer als gedacht, sagt ein Jäger!', 'Neuigkeiten vom Totenacker: Es spukt, und zwar laut!', 'Das Räuberlager sucht niemanden – aber wir suchen Euch, tapfere Leute!', 'Hört, hört! Aus der Aschenöde steigt wieder Rauch auf!'],
  },
  drunk: {
    '': ['*hicks* Noch eins … nur eins …', 'Ich war mal … jemand. Glaub ich.', 'Der Mond tanzt. Siehst du ihn tanzen?', 'Wo ist mein Stiefel? Ich hatte zwei … nein, einen.', 'Prost auf die Wache, die mich nie findet!'],
  },
  elder: {
    '': ['Früher war alles besser. Und lauter.', 'Ich erinnere mich an die Zeit, bevor die Asche kam.', 'Die Alten sagen: Wer den Thron sucht, findet nur Asche.', 'Setz dich, Junge. Nein, besser nicht, es ist nass.', 'Der Brunnen singt, wenn niemand zuhört.'],
  },
};

/** Zuruf für eine Rolle in einer Stadt (nie zweimal derselbe hintereinander, wenn `last` übergeben wird) */
export function pickShout(role: Role, town: string, rng: Rng, last = ''): string {
  const by = SHOUTS[role];
  const pool = by[town] ?? by[''] ?? [];
  const opts = pool.filter((t) => t !== last);
  return (opts.length ? opts : pool)[Math.floor(rng() * (opts.length ? opts.length : pool.length))] ?? '';
}

const CONGRAT: Record<Role | 'npc', string[]> = {
  npc: ['Glückwunsch, Stufe {n}!', 'Stufe {n}! Das hat sich gelohnt.', 'Na, so was – Stufe {n}!', 'Bravo, Stufe {n}!', 'Wieder ein Stück stärker – Stufe {n}!'],
  guard: ['Stufe {n}. Die Stadt ist stolz auf Euch.', 'Gut gemacht. Stufe {n}.'],
  nightguard: ['Stufe {n}. Gut gemacht, auch im Dunkeln.'],
  child: ['Wooow! Stufe {n}!', 'Ich will auch Stufe {n}!'],
  farmer: ['Stufe {n}! Das muss begossen werden – mit Most.'],
  woman: ['Stufe {n}! Wie schön, kommt, nehmt einen Apfel.'],
  fisher: ['Stufe {n}! Der Fang des Tages.'],
  crier: ['Hört, hört! Ein Held erreicht Stufe {n}!'],
  drunk: ['Prooost auf Stufe {n}! *hicks*'],
  elder: ['Stufe {n}. Ich war auch mal so jung.'],
};
const MILESTONE: Record<number, string> = {
  10: 'Stufe 10! Zehn! Ein erprobter Streiter!',
  20: 'Stufe 20! Die ganze Stadt spricht von Euch!',
  30: 'Stufe 30! Höher geht es nicht – singt, ihr Leute!',
};

export function congratText(role: Role | 'npc', level: number, rng: Rng): string {
  const m = MILESTONE[level];
  if (m && (role === 'npc' || role === 'crier' || role === 'guard' || rng() < 0.5)) return m;
  const pool = rng() < 0.35 || role === 'npc' ? CONGRAT.npc : CONGRAT[role];
  return pool[Math.floor(rng() * pool.length)]!.replace('{n}', String(level));
}

/* ------------------------------------------------------------------------------------------------ Bilder (Atlas) */

const ATLAS = 'town_life';
const PAL: Record<string, string> = {
  w: '#f0ead8', W: '#cfc6ae', s: '#a89c80', r: '#c8362a', o: '#e0a030', k: '#1a1410', t: '#6a5a46',
  c: '#b8864a', d: '#7a5030', C: '#d8aa6a', p: '#e8a0a0',
  g: '#6a6a72', G: '#9a9aa4', b: '#26242a', B: '#4a4850', y: '#d8c060',
  h: '#a8a8b0', n: '#8a6a3a', N: '#5a4024', e: '#caa84a', E: '#8a6c24', f: '#7a4a2a', F: '#c04a3a', l: '#5a8a3a', m: '#a63a30', u: '#2a4a8a',
  x: '#e8d070', X: '#c8a040', a: '#d86a2a',
};

/** Sprite-Zeilen mit gleicher Breite (geprüft im Test); '.' ist leer */
const SPRITES: Record<string, string[]> = {
  chick_0: ['......r...', '.....wwk..', '.....wwwo.', 't...wwww..', 'tt.wwwwws.', '.twwwwwwss', '..wwwwwss.', '...wwwss..', '....o.o...'],
  chick_1: ['..........', '..........', '.......r..', 't...wwwwk.', 'tt.wwwwwwo', '.twwwwwwss', '..wwwwwss.', '...wwwss..', '....o.o...'],
  cat_0: ['.........c.c', '.........ccc', '.........ckc', 'c.ccccccccpc', 'c.cdcdcdccc.', 'cccccccccc..', '.cccccccccc.', '..c.c..c.c..', '..d.d..d.d..'],
  cat_1: ['.........c.c', '.........ccc', '.........ckc', 'c.ccccccccpc', 'c.cdcdcdccc.', 'cccccccccc..', '.cccccccccc.', '.c..c.c..c..', '.d..d.d..d..'],
  cat_sit: ['.........c.c', '.........ccc', '.........ckc', '.....cccccpc', '....ccdccccc', '...ccccccccc', 'c.ccccccccc.', 'ccccccccccc.', '.dddd.dd.dd.'],
  dog_0: ['..........ff..', '.........fnnn.', '.........nnkn.', 'N.nnnnnnnnnnbb', 'Nnnnnnnnnnnn..', '.nnnnnnnnnn...', '.nnnnnnnnnn...', '..n.n..n.n....', '..N.N..N.N....'],
  dog_1: ['..........ff..', '.........fnnn.', '.........nnkn.', 'N.nnnnnnnnnnbb', 'Nnnnnnnnnnnn..', '.nnnnnnnnnn...', '.nnnnnnnnnn...', '.n...nn..n....', '.N...NN..N....'],
  crow_0: ['.......bb.', '......bbbo', '.....bbBb.', 'b...bbbbb.', 'bb.bbbBbb.', '.bbbbbBb..', '..bbbbb...', '...b.b....'],
  crow_fly0: ['..bb......', '.bbbb.bb..', 'bbbbbbbbbo', '..bbbbbbb.', '...bbbb...', '..........', '..........', '..........'],
  crow_fly1: ['..........', '..........', '.bbbbbbbbo', 'bbbbbbbbb.', '.bb.bbb...', '..bb......', '..........', '..........'],
  gull_0: ['........ww....', '.......wwwyy..', '.......wkw....', '..wwwwwwww....', '.bGGGGGGwww...', 'bbGGGGGGwww...', '..wwwwwwww....', '...wwwwww.....', '.....o.o......'],
  gull_fly0: ['..G.........', '.GwG....ww..', 'GwwwwGwwwwo.', '..wwwwwwww..', '...GwwwwG...', '............', '............'],
  gull_fly1: ['............', '............', '..GGwwwwwwo.', 'GwwwwwwwwWw.', '.G.wwwwWW...', '...G..G.....', '............'],
  torch_0: ['..a.', '.aya', '.ayy', '..n.', '..n.', '..N.', '..N.'],
  torch_1: ['.a..', 'ayya', 'ayya', '..n.', '..n.', '..N.', '..N.'],
  banner: ['....NN....', '....NN....', 'mmmmmmmmmm', 'mmmeeeemmm', 'mmeEeEeEmm', 'mmmeeeemmm', 'mmmmmmmmmm', 'mmmmmmmmmm', 'mmmmmmmmmm', 'mmmmmmmmmm', 'mmmmmmmmmm', 'mm.mmmm.mm', 'm...mm...m', '.....mm...'],
  board: ['NNNNNNNNNNNNNN', 'NnnnnnnnnnnnnN', 'NnwwnnWWnnwwnN', 'NnwwnnWWnnwwnN', 'NnwwnnWWnnwWnN', 'NnnnnnnnnnnnnN', 'NnWWnnwwnnnwnN', 'NnWWnnwwnnnwnN', 'NnnnnnnnnnnnnN', 'NNNNNNNNNNNNNN', '.....NN.NN....', '.....NN.NN....'],
  hay: ['.....XXXX.....', '...XXxxxxXXX..', '.XXxxXxxxxxXX.', 'XxxxxxxXxxxxXX', 'XXxXxxxxxxXxXX', '.XXXXXXXXXXXX.'],
  sacks: ['....gGG....', '...gGGGg.GG', '.gGGGGgGGGg', 'gGGGGGGGGGG', 'gGGGGGGGGGg', '.ggggggggg.'],
  baskets: ['..nn..nn..', '.n..n.n.n.', 'nnnnnnnnnn', 'nNnNnNnNnn', 'nnnnnnnnnn', '.NNNNNNNN.'],
  cart: ['......xxXxxxxxXxxx........', '.....nnnnnnnnnnnnnn.......', '.....nNNnNNnNNnNNn.....ff.', '.....nnnnnnnnnnnnnn...ffN.', '.....nNNnNNnNNnNNn...fN...', '.....nnnnnnnnnnnnnn..fN...', '.....NNNNNNNNNNNNNN.fN....', '......NN........NN........', '.....NggN......NggN.......', '....NgbbgN....NgbbgN......', '....NgbbgN....NgbbgN......', '.....NggN......NggN.......'],
};

interface FrameBox { x: number; y: number; w: number; h: number }
const frames = new Map<string, FrameBox>();

/** Erstes Anlegen des Atlas (eine Textur, kein Stückwerk: neue GL-Texturen sind die Ruckelquelle) */
export function initTownAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists(ATLAS)) return;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  let cx = 0;
  let cy = 0;
  let rowH = 0;
  const place = (name: string, w: number, h: number): FrameBox => {
    if (cx + w > canvas.width) {
      cx = 0;
      cy += rowH + 1;
      rowH = 0;
    }
    const b = { x: cx, y: cy, w, h };
    frames.set(name, b);
    cx += w + 1;
    rowH = Math.max(rowH, h);
    return b;
  };
  for (const [name, rows] of Object.entries(SPRITES)) {
    const w = rows[0]!.length;
    const b = place(name, w, rows.length);
    rows.forEach((row, y) => {
      for (let x = 0; x < w; x++) {
        const col = PAL[row[x]!];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(b.x + x, b.y + y, 1, 1);
      }
    });
  }
  // Fackelschein: weicher warmer Kreis
  const g = place('glow', 64, 64);
  const grad = ctx.createRadialGradient(g.x + 32, g.y + 32, 2, g.x + 32, g.y + 32, 32);
  grad.addColorStop(0, 'rgba(255,190,90,0.85)');
  grad.addColorStop(0.45, 'rgba(255,150,60,0.38)');
  grad.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(g.x, g.y, 64, 64);
  const tex = scene.textures.addCanvas(ATLAS, canvas);
  if (!tex) return;
  for (const [name, b] of frames) tex.add(name, 0, b.x, b.y, b.w, b.h);
}

/** Beschreibungen, die der Test prüft: gleiche Zeilenbreite in jedem Sprite */
export const spriteRows = (): Record<string, string[]> => SPRITES;

/* ------------------------------------------------------------------------------------------------ Szene */

const ADD = 1; // Phaser.BlendModes.ADD
const OVERLAY = 1e7;
const HEAR = 11;

export interface LifeCtx {
  time: number;
  dtMs: number;
  hour: number;
  night: number;
  zoom: number;
  region: string;
  grid: Grid;
  player: { x: number; y: number };
  /** Sichtbarer Weltausschnitt in Bildschirmpixeln (Kamera) */
  view: { x: number; y: number; width: number; height: number };
  smiths: { x: number; y: number }[];
}

type Anchor = () => { sx: number; sy: number } | null;

interface Bubble {
  box: Phaser.GameObjects.Graphics;
  txt: Phaser.GameObjects.Text;
  anchor: Anchor | null;
  head: number;
  until: number;
  from: number;
  tw: number;
  th: number;
}

const FONT = "NinjaUi, 'Courier New', monospace";

interface Resident {
  def: ResidentDef;
  img: Phaser.GameObjects.Image;
  torch?: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image };
  key: string;
  req: { t: 'n'; kind: string };
  x: number;
  y: number;
  tx: number;
  ty: number;
  state: 'idle' | 'walk' | 'home' | 'gone';
  until: number;
  alpha: number;
  flip: boolean;
  side: boolean;
  up: boolean;
  dist: number;
  movingUntil: number;
  shoutAt: number;
  lastShout: string;
  top: number;
  placed: boolean;
}

interface Animal {
  def: AnimalDef;
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Höhe über dem Boden in Pixeln (Vögel im Flug) */
  alt: number;
  state: 'idle' | 'walk' | 'fly' | 'away' | 'gone';
  until: number;
  flip: boolean;
  alpha: number;
  soundAt: number;
  placed: boolean;
  phase: number;
}

export class TownLife {
  private town: TownDef | null = null;
  private res: Resident[] = [];
  private animals: Animal[] = [];
  private decor: Phaser.GameObjects.Image[] = [];
  private built = new Map<string, { res: Resident[]; animals: Animal[]; decor: Phaser.GameObjects.Image[] }>();
  private shadow: Phaser.GameObjects.Graphics;
  private bubbles: Bubble[] = [];
  private npcAnchor: ((id: number) => { sx: number; sy: number; head: number } | null) | null = null;
  private rng: Rng;
  private hammerAt = 0;
  private hammerHits = 0;
  private lastLevel = 0;

  constructor(private scene: Phaser.Scene, private sfx: Sfx) {
    let s = (Date.now() ^ 0x9e3779b9) >>> 0;
    this.rng = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    initTownAtlas(scene);
    this.shadow = scene.add.graphics().setDepth(-9e5 + 1);
  }

  /** Damit NPCs der Karte mitgratulieren können, liefert die Szene deren Kopfposition */
  setNpcAnchor(f: (id: number) => { sx: number; sy: number; head: number } | null): void {
    this.npcAnchor = f;
  }

  /** Figurentexturen der gerade sichtbaren Bewohner (dürfen nicht aus dem Cache fliegen) */
  keysInUse(): string[] {
    return this.res.filter((r) => r.img.visible).map((r) => r.img.texture.key);
  }

  /* ---------------------------------------------------------------------------- Aufbau */

  private enter(def: TownDef): void {
    this.hideAll();
    this.town = def;
    let b = this.built.get(def.name);
    if (!b) {
      b = { res: [], animals: [], decor: [] };
      for (const r of def.residents) b.res.push(this.makeResident(r));
      for (const a of def.animals) b.animals.push(this.makeAnimal(a));
      b.decor = this.makeDecor(def);
      this.built.set(def.name, b);
    }
    this.res = b.res;
    this.animals = b.animals;
    this.decor = b.decor;
    for (const d of this.decor) d.setVisible(true);
    for (const l of looksOf(def)) prefetchFigure(`nfig_${l}`, { t: 'n', kind: l });
  }

  private hideAll(): void {
    for (const r of this.res) {
      r.img.setVisible(false);
      r.torch?.img.setVisible(false);
      r.torch?.glow.setVisible(false);
    }
    for (const a of this.animals) a.img.setVisible(false);
    for (const d of this.decor) d.setVisible(false);
    this.res = [];
    this.animals = [];
    this.decor = [];
    this.shadow.clear();
  }

  private makeResident(def: ResidentDef): Resident {
    const img = this.scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    const r: Resident = {
      def, img, key: npcFigKey(def.look), req: { t: 'n', kind: def.look }, x: 0, y: 0, tx: 0, ty: 0, state: 'gone', until: 0, alpha: 0,
      flip: false, side: false, up: false, dist: 0, movingUntil: 0, shoutAt: 0, lastShout: '', top: 56, placed: false,
    };
    if (def.torch) {
      const glow = this.scene.add.image(0, 0, ATLAS, 'glow').setBlendMode(ADD).setDepth(LIGHT_DEPTH).setVisible(false).setScale(3.4);
      const fl = this.scene.add.image(0, 0, ATLAS, 'torch_0').setVisible(false).setScale(2);
      r.torch = { img: fl, glow };
    }
    return r;
  }

  private makeAnimal(def: AnimalDef): Animal {
    const first = { chicken: 'chick_0', cat: 'cat_0', dog: 'dog_0', crow: 'crow_0', gull: 'gull_0' }[def.kind];
    const img = this.scene.add.image(0, 0, ATLAS, first).setVisible(false).setScale(2).setOrigin(0.5, 1);
    return { def, img, x: 0, y: 0, tx: 0, ty: 0, alt: 0, state: 'gone', until: 0, flip: false, alpha: 0, soundAt: 0, placed: false, phase: this.rng() * 6.28 };
  }

  private makeDecor(def: TownDef): Phaser.GameObjects.Image[] {
    return def.decor.map((d) => {
      const { sx, sy } = toScreen(d.x, d.y);
      const key = { banner: 'banner', board: 'board', cart: 'cart', hay: 'hay', sacks: 'sacks', baskets: 'baskets' }[d.kind];
      // Fußpunkt am unteren Rand der Kachel; Wandschmuck hängt vor die Mauer, daher knapp über dem Boden-Fuß der Kachel
      const foot = sy + TILE_H / 2 - (FLAT_DECOR.has(d.kind) ? 6 : 0);
      return this.scene.add.image(sx, foot, ATLAS, key).setOrigin(0.5, 1).setScale(2).setDepth(foot + 1).setVisible(false);
    });
  }

  /* ---------------------------------------------------------------------------- Takt */

  update(c: LifeCtx): void {
    const def = townByName(c.region);
    if (def !== this.town) {
      if (!def) {
        this.hideAll();
        this.town = null;
        this.sfx.town(0);
      } else this.enter(def);
    }
    this.updateBubbles(c);
    if (!this.town) return;
    this.shadow.clear();
    const live = Math.min(c.dtMs, 100);
    for (const r of this.res) this.stepResident(r, c, live);
    for (const a of this.animals) this.stepAnimal(a, c, live);
    this.sounds(c);
  }

  private fresh(r: Resident | Animal, zones: string[], c: LifeCtx): { x: number; y: number } | null {
    const t = this.town!;
    for (let i = 0; i < 6; i++) {
      const z = t.zones[zones[Math.floor(this.rng() * zones.length)]!]!;
      const p = pickSpot(c.grid, z, null, this.rng, 8);
      if (p) return p;
    }
    void r;
    return null;
  }

  private nextSpot(r: Resident | Animal, zones: string[], c: LifeCtx, maxDist: number): { x: number; y: number } | null {
    const t = this.town!;
    for (let i = 0; i < 4; i++) {
      const z = t.zones[zones[Math.floor(this.rng() * zones.length)]!]!;
      const p = pickSpot(c.grid, z, r, this.rng, 8, maxDist);
      if (p) return p;
    }
    return null;
  }

  private stepResident(r: Resident, c: LifeCtx, dt: number): void {
    const d = r.def;
    const on = inShift(c.hour, d.shift);
    // Zeitplan: außerhalb der Schicht heimgehen und verschwinden, in der Schicht erscheinen
    if (!on && r.state !== 'home' && r.state !== 'gone') {
      r.state = 'home';
      r.tx = d.home[0];
      r.ty = d.home[1];
      r.until = c.time + 14000;
    }
    if (on && r.state === 'gone') {
      const home = r.placed ? { x: d.home[0], y: d.home[1] } : this.fresh(r, d.zones, c);
      const at = home && isWalkable(c.grid, Math.round(home.x), Math.round(home.y)) ? home : this.fresh(r, d.zones, c);
      if (!at) return;
      r.x = at.x;
      r.y = at.y;
      r.placed = true;
      r.state = 'idle';
      r.until = c.time + rangeOf(d.idle, this.rng) * 1000;
      r.shoutAt = c.time + rangeOf(d.shout, this.rng) * 1000;
      r.alpha = 0;
    }
    if (r.state === 'gone') {
      r.img.setVisible(false);
      r.torch?.img.setVisible(false);
      r.torch?.glow.setVisible(false);
      return;
    }
    // Bewegung
    if (r.state === 'walk' || r.state === 'home') {
      const dx = r.tx - r.x;
      const dy = r.ty - r.y;
      const dist = Math.hypot(dx, dy);
      const step = (d.speed * dt) / 1000;
      if (dist <= step + 0.02) {
        r.x = r.tx;
        r.y = r.ty;
        if (r.state === 'home') r.state = 'gone';
        else {
          r.state = 'idle';
          r.until = c.time + rangeOf(d.idle, this.rng) * 1000;
        }
      } else {
        // Betrunkene schwanken
        const sway = d.role === 'drunk' ? Math.sin(c.time / 260) * 0.35 : 0;
        const nx = r.x + (dx / dist) * step - (dy / dist) * sway * step;
        const ny = r.y + (dy / dist) * step + (dx / dist) * sway * step;
        if (tileWalk(c.grid, nx, ny)) {
          if (Math.abs(nx - r.x) > 0.0005) r.flip = nx < r.x;
          r.side = Math.abs(nx - r.x) > Math.abs(ny - r.y) * 0.8;
          if (Math.abs(ny - r.y) > 0.0005) r.up = ny < r.y;
          r.dist += Math.hypot((nx - r.x) * TILE_W, (ny - r.y) * TILE_H);
          r.x = nx;
          r.y = ny;
          r.movingUntil = c.time + 160;
        } else if (r.state === 'home') r.state = 'gone';
        else {
          r.state = 'idle';
          r.until = c.time + 600;
        }
      }
      if (r.state === 'home' && c.time > r.until) r.state = 'gone';
    } else if (r.state === 'idle' && c.time >= r.until) {
      const p = this.nextSpot(r, d.zones, c, d.role === 'fisher' ? 20 : 12);
      if (p) {
        r.tx = p.x;
        r.ty = p.y;
        r.state = 'walk';
      } else r.until = c.time + 1500;
    }
    // Der Held steht im Weg: seitlich ausweichen
    const px = c.player.x - r.x;
    const py = c.player.y - r.y;
    const pd = Math.hypot(px, py);
    if (pd < 0.8 && pd > 0.001) {
      const nx = r.x - (px / pd) * 0.04 * (dt / 16);
      const ny = r.y - (py / pd) * 0.04 * (dt / 16);
      if (tileWalk(c.grid, nx, ny)) {
        r.x = nx;
        r.y = ny;
      }
    }
    // Blenden
    const goal = r.state === 'home' && Math.hypot(r.tx - r.x, r.ty - r.y) < 0.6 ? 0 : 1;
    r.alpha += Math.sign(goal - r.alpha) * Math.min(Math.abs(goal - r.alpha), dt / 700);
    this.drawResident(r, c);
    // Zuruf
    if (r.state !== 'home' && c.time >= r.shoutAt) {
      r.shoutAt = c.time + rangeOf(d.shout, this.rng) * 1000;
      const near = Math.hypot(r.x - c.player.x, r.y - c.player.y);
      const reach = d.role === 'crier' ? 13 : 7;
      if (near <= reach && r.img.visible && this.free(2)) {
        const line = pickShout(d.role, this.town!.name, this.rng, r.lastShout);
        r.lastShout = line;
        this.say(() => this.resAnchor(r), r.top, line, 3200 + line.length * 45, c.time);
      }
    }
  }

  private resAnchor(r: Resident): { sx: number; sy: number } | null {
    return r.img.visible ? { sx: r.img.x, sy: r.img.y } : null;
  }

  private drawResident(r: Resident, c: LifeCtx): void {
    const got = figureTexture(this.scene, r.key, r.req);
    const { sx, sy } = toScreen(r.x, r.y);
    const onscreen = sx > c.view.x - 80 && sx < c.view.x + c.view.width + 80 && sy > c.view.y - 120 && sy < c.view.y + c.view.height + 120;
    if (!got || got === 'wait' || !onscreen) {
      r.img.setVisible(false);
      r.torch?.img.setVisible(false);
      r.torch?.glow.setVisible(false);
      return;
    }
    const sheet = got.sheet;
    const v3 = r.side ? 'side' : r.up ? 'back' : 'front';
    const A = sheet.anims;
    const o = originOf(sheet);
    const moving = c.time < r.movingUntil;
    r.img.setTexture(got.key, moving ? `walk_${v3}_${walkFrame(r.dist, A.walk, sheet.cyclePx)}` : `idle_${v3}_${idleFrame(c.time + r.def.role.length * 1231, A.idle)}`);
    r.top = sheet.top * FIG_SCALE;
    r.img.setOrigin(o.x, o.y).setScale(FIG_SCALE).setFlipX(r.side && r.flip).setAlpha(r.alpha).setVisible(r.alpha > 0.02).setPosition(sx, sy + 8).setDepth(sy + 8);
    this.shadow.fillStyle(0x000000, 0.2 * r.alpha);
    this.shadow.fillEllipse(sx, sy + 9, r.def.look === 'res_child' || r.def.look === 'res_child2' ? 20 : 26, 10);
    if (r.torch) {
      const hx = sx + (r.side ? (r.flip ? -14 : 14) : 13);
      const hy = sy + 8 - r.top * 0.42;
      const fl = r.torch.img;
      fl.setFrame(Math.floor(c.time / 140) % 2 ? 'torch_1' : 'torch_0').setOrigin(0.5, 1).setPosition(hx, hy).setDepth(sy + 9).setVisible(r.alpha > 0.1);
      // Fackelschein nur nachts (tagsüber unsichtbar); flackert leicht
      r.torch.glow.setPosition(hx, hy - 8).setAlpha(c.night * r.alpha * (0.75 + 0.25 * Math.sin(c.time / 90 + r.def.role.length))).setVisible(c.night > 0.05);
    }
  }

  private stepAnimal(a: Animal, c: LifeCtx, dt: number): void {
    const k = a.def.kind;
    const on = inShift(c.hour, a.def.shift);
    const dpl = Math.hypot(a.x - c.player.x, a.y - c.player.y);
    if (!on && a.state !== 'gone') {
      a.state = 'gone';
    }
    if (on && a.state === 'gone') {
      const p = this.fresh(a, a.def.zones, c);
      if (!p) return;
      a.x = p.x;
      a.y = p.y;
      a.placed = true;
      a.alt = 0;
      a.state = 'idle';
      a.until = c.time + 1000 + this.rng() * 3000;
      a.alpha = 1;
    }
    if (a.state === 'gone') {
      a.img.setVisible(false);
      return;
    }
    const flyer = k === 'crow' || k === 'gull';
    // Vögel flattern auf, wenn der Held zu nah kommt, und landen später wieder
    if (flyer && (a.state === 'idle' || a.state === 'walk') && dpl < 3.2) {
      const away = Math.atan2(a.y - c.player.y, a.x - c.player.x) + (this.rng() - 0.5) * 1.2;
      a.tx = a.x + Math.cos(away) * 14;
      a.ty = a.y + Math.sin(away) * 14;
      a.state = 'fly';
      a.until = c.time + 4200;
      if (k === 'gull') this.sfx.gull(0.7);
      else this.sfx.caw(0.7);
    }
    if (a.state === 'fly') {
      const dx = a.tx - a.x;
      const dy = a.ty - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = 4.2 * (dt / 1000);
      a.x += (dx / d) * sp;
      a.y += (dy / d) * sp;
      a.flip = dx < 0;
      a.alt = Math.min(70, a.alt + dt * 0.12);
      if (c.time > a.until) {
        a.state = 'away';
        a.until = c.time + 12000 + this.rng() * 22000;
      }
    } else if (a.state === 'away') {
      // außer Sichtweite; die Möwe kreist hoch über der Stadt, bevor sie wieder landet
      if (k === 'gull') {
        const t = c.time / 1800 + a.phase;
        const mid = this.town!.zones.kai ?? this.town!.zones.platz!;
        a.x = (mid[0] + mid[2]) / 2 + Math.cos(t) * 7;
        a.y = (mid[1] + mid[3]) / 2 + Math.sin(t) * 3 - 2;
        a.alt = 96;
        a.flip = Math.sin(t) > 0;
      } else a.alt = 0;
      if (c.time > a.until) {
        const p = this.fresh(a, a.def.zones, c);
        if (p && Math.hypot(p.x - c.player.x, p.y - c.player.y) > 4) {
          a.x = p.x + (this.rng() - 0.5) * 6;
          a.y = p.y - 2;
          a.tx = p.x;
          a.ty = p.y;
          a.state = 'walk';
          a.alt = 70;
        } else a.until = c.time + 3000;
      }
      if (k === 'crow') {
        a.img.setVisible(false);
        return;
      }
    } else if (a.state === 'walk') {
      const dx = a.tx - a.x;
      const dy = a.ty - a.y;
      const d = Math.hypot(dx, dy);
      const sp = ({ chicken: 0.9, cat: 1.2, dog: 1.6, crow: 0.7, gull: 0.7 }[k]) * (dt / 1000);
      if (a.alt > 0) {
        // Landeanflug
        a.alt = Math.max(0, a.alt - dt * 0.07);
        a.x += (dx / (d || 1)) * 3 * (dt / 1000);
        a.y += (dy / (d || 1)) * 3 * (dt / 1000);
        a.flip = dx < 0;
        if (a.alt <= 0) {
          a.state = 'idle';
          a.until = c.time + 2000 + this.rng() * 5000;
        }
      } else if (d <= sp + 0.02) {
        a.x = a.tx;
        a.y = a.ty;
        a.state = 'idle';
        a.until = c.time + (k === 'cat' ? 4000 + this.rng() * 12000 : 1200 + this.rng() * 4500);
      } else {
        const nx = a.x + (dx / d) * sp;
        const ny = a.y + (dy / d) * sp;
        if (tileWalk(c.grid, nx, ny)) {
          a.x = nx;
          a.y = ny;
          a.flip = dx < 0;
        } else {
          a.state = 'idle';
          a.until = c.time + 800;
        }
      }
    } else if (a.state === 'idle' && c.time >= a.until) {
      const reach = k === 'dog' ? 9 : k === 'cat' ? 6 : 3.5;
      const p = this.nextSpot(a, a.def.zones, c, reach);
      if (p && !(flyer && this.rng() < 0.5)) {
        a.tx = p.x;
        a.ty = p.y;
        a.state = 'walk';
      } else a.until = c.time + 1500 + this.rng() * 3000;
    }
    this.drawAnimal(a, c);
  }

  private drawAnimal(a: Animal, c: LifeCtx): void {
    const { sx, sy } = toScreen(a.x, a.y);
    const onscreen = sx > c.view.x - 60 && sx < c.view.x + c.view.width + 60 && sy - a.alt > c.view.y - 120 && sy - a.alt < c.view.y + c.view.height + 120;
    if (!onscreen) {
      a.img.setVisible(false);
      return;
    }
    const k = a.def.kind;
    const airborne = a.alt > 6 || a.state === 'fly';
    const t = c.time;
    let frame: string;
    if (airborne) frame = `${k}_fly${Math.floor(t / 110 + a.phase) % 2}`;
    else if (k === 'chicken') frame = a.state === 'idle' && Math.floor(t / 420 + a.phase * 3) % 3 === 0 ? 'chick_1' : 'chick_0';
    else if (k === 'cat') frame = a.state === 'walk' ? `cat_${Math.floor(t / 170) % 2}` : 'cat_sit';
    else if (k === 'dog') frame = a.state === 'walk' ? `dog_${Math.floor(t / 130) % 2}` : 'dog_0';
    else frame = `${k}_0`;
    const lift = airborne ? Math.sin(t / 220 + a.phase) * 2 : 0;
    a.img.setFrame(frame).setFlipX(a.flip).setVisible(true).setAlpha(1).setPosition(sx, sy + 8 - a.alt + lift).setDepth(sy + 8 + (airborne ? 400 : 0));
    this.shadow.fillStyle(0x000000, airborne ? 0.12 : 0.2);
    this.shadow.fillEllipse(sx, sy + 9, k === 'dog' ? 24 : k === 'chicken' ? 14 : airborne ? 12 : 16, k === 'dog' ? 8 : 6);
    // Tierlaute (leise, nur in Hörweite)
    const dist = Math.hypot(a.x - c.player.x, a.y - c.player.y);
    if (t > a.soundAt && dist < 14 && a.state !== 'away') {
      a.soundAt = t + 7000 + this.rng() * 16000;
      const v = Math.max(0.15, 1 - dist / 14);
      if (k === 'chicken') this.sfx.cluck(v);
      else if (k === 'cat') {
        if (this.rng() < 0.5) this.sfx.meow(v);
      }
      else if (k === 'dog') {
        if (this.rng() < 0.6) this.sfx.bark(v);
      }
      else if (k === 'crow') this.sfx.caw(v * 0.8);
      else this.sfx.gull(v);
    }
  }

  /** Schmiedehammer und Gemurmel nach Nähe zu Bewohnern und Tageszeit */
  private sounds(c: LifeCtx): void {
    let near = 0;
    for (const r of this.res) if (r.state !== 'gone' && r.alpha > 0.5 && Math.hypot(r.x - c.player.x, r.y - c.player.y) < 13) near++;
    const day = dayPhase(c.hour) === 'day' ? 1 : dayPhase(c.hour) === 'dusk' ? 0.6 : 0.25;
    this.sfx.town(Math.min(1, 0.25 + near * 0.18) * day);
    // Hammer: drei bis vier Schläge, dann Pause; nur tagsüber
    if (dayPhase(c.hour) !== 'day') return;
    let best = 99;
    for (const s of c.smiths) best = Math.min(best, Math.hypot(s.x - c.player.x, s.y - c.player.y));
    if (best > 16) return;
    if (c.time < this.hammerAt) return;
    this.sfx.hammer(Math.max(0.15, 1 - best / 16));
    this.hammerHits++;
    if (this.hammerHits >= 3 + Math.floor(this.rng() * 2)) {
      this.hammerHits = 0;
      this.hammerAt = c.time + 2600 + this.rng() * 3200;
    } else this.hammerAt = c.time + 520;
  }

  /* ---------------------------------------------------------------------------- Sprechblasen */

  private free(max: number): boolean {
    return this.bubbles.filter((b) => b.until > 0).length < max;
  }

  private say(anchor: Anchor, head: number, text: string, ms: number, now: number, delay = 0): void {
    let b = this.bubbles.find((x) => x.until === 0);
    if (!b) {
      const box = this.scene.add.graphics().setDepth(OVERLAY + 4).setVisible(false);
      const txt = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '16px', color: '#2a1d12', align: 'center', wordWrap: { width: 170 }, lineSpacing: 1 }).setOrigin(0.5, 1).setDepth(OVERLAY + 5).setVisible(false);
      b = { box, txt, anchor: null, head: 0, until: 0, from: 0, tw: 0, th: 0 };
      this.bubbles.push(b);
    }
    // die Pixelschrift hat sehr schmale Leerzeichen: doppelt setzen, sonst kleben die Wörter
    b.txt.setText(text.replace(/ /g, '  '));
    b.tw = Math.ceil(b.txt.width) + 14;
    b.th = Math.ceil(b.txt.height) + 10;
    b.anchor = anchor;
    b.head = head;
    b.from = now + delay;
    b.until = now + delay + ms;
  }

  private updateBubbles(c: LifeCtx): void {
    const k = Math.max(1, 10 / (12 * c.zoom));
    for (const b of this.bubbles) {
      if (!b.until) continue;
      if (c.time > b.until) {
        b.until = 0;
        b.anchor = null;
        b.box.setVisible(false).clear();
        b.txt.setVisible(false);
        continue;
      }
      const at = b.anchor?.();
      if (!at || c.time < b.from) {
        b.box.setVisible(false);
        b.txt.setVisible(false);
        continue;
      }
      const a = Math.min(1, (c.time - b.from) / 160, (b.until - c.time) / 260);
      const w = b.tw;
      const h = b.th;
      const x = Math.round(at.sx);
      const y = Math.round(at.sy - b.head - 12 * k);
      // Pergament mit dunklem Rand und Schwänzchen, Pixelecken
      const g = b.box.clear();
      g.setPosition(x, y).setScale(k).setAlpha(a).setVisible(true);
      g.fillStyle(0x2a1d12, 1).fillRect(-w / 2, -h - 6, w, h);
      g.fillRect(-w / 2 + 2, -h - 8, w - 4, 2).fillRect(-w / 2 + 2, -8, w - 4, 2).fillRect(-w / 2 - 2, -h - 4, 2, h - 4).fillRect(w / 2, -h - 4, 2, h - 4);
      g.fillStyle(0xf2e6c4, 1).fillRect(-w / 2 + 2, -h - 4, w - 4, h - 4);
      g.fillRect(-w / 2, -h - 2, 2, h - 8).fillRect(w / 2 - 2, -h - 2, 2, h - 8);
      g.fillStyle(0xd8c898, 1).fillRect(-w / 2 + 2, -10, w - 4, 2);
      g.fillStyle(0x2a1d12, 1).fillRect(-4, -6, 8, 3).fillRect(-2, -3, 4, 3);
      g.fillStyle(0xf2e6c4, 1).fillRect(-2, -6, 4, 2);
      b.txt.setPosition(x, y - 10 * k).setScale(k).setAlpha(a).setVisible(true);
    }
  }

  /** Stufenaufstieg: Bewohner und NPCs in Hörweite gratulieren (höchstens drei, gestaffelt) */
  congratulate(level: number, c: { time: number; player: { x: number; y: number }; npcs: { id: number; x: number; y: number }[] }): void {
    if (level === this.lastLevel && c.time - this.lastCongrat < 1500) return;
    this.lastLevel = level;
    this.lastCongrat = c.time;
    const cands: { d: number; role: Role | 'npc'; anchor: Anchor; head: number }[] = [];
    for (const r of this.res) {
      if (r.state === 'gone' || r.alpha < 0.5 || !r.img.visible) continue;
      const d = Math.hypot(r.x - c.player.x, r.y - c.player.y);
      if (d <= HEAR) cands.push({ d, role: r.def.role, anchor: () => this.resAnchor(r), head: r.top });
    }
    for (const n of c.npcs) {
      const d = Math.hypot(n.x - c.player.x, n.y - c.player.y);
      const a = this.npcAnchor?.(n.id);
      if (d <= HEAR && a) cands.push({ d, role: 'npc', anchor: () => this.npcAnchor?.(n.id) ?? null, head: a.head });
    }
    cands.sort((a, b) => a.d - b.d);
    // Verschiedene Rollen zuerst, damit nicht nur Kinder rufen
    const picked: typeof cands = [];
    for (const x of cands) if (picked.length < 3 && !picked.some((p) => p.role === x.role)) picked.push(x);
    for (const x of cands) if (picked.length < 3 && !picked.includes(x)) picked.push(x);
    picked.forEach((p, i) => this.say(p.anchor, p.head, congratText(p.role, level, this.rng), 3800, c.time, 500 + i * 450));
  }
  private lastCongrat = -1e9;
}
