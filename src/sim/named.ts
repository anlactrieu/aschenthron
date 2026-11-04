import type { NamedDef } from './items';

/**
 * Benannte Funde (P3 „Fortschritt mit Gewicht“): feste Gegenstände mit eigenem Namen und festen Werten,
 * je Stufenband (1/6/11/16/21/26) und Slot genau einer, jeder einer Beute-Gruppe (`LOOT_GROUPS`) zugeordnet.
 * Regeln (geprüft in `named.test.ts`): Grundvorlage passt zu Slot und Band, die Gruppe jagt im Band,
 * magic = 2 Werte, rare = 3 Werte, Werte im Rahmen der alten Affix-Bereiche. Eigene Namen, nichts aus T4C.
 * Reihenfolge der Einträge nicht umsortieren (bestimmt den Wurf bei festem Seed).
 */
export const NAMED: NamedDef[] = [
  // Band 1
  { id: 'n_rattenbiss', name: 'Rattenbiss', base: 'rusty_sword', band: 1, group: 'rats', rarity: 'magic', affixes: [{ stat: 'damage', value: 2 }, { stat: 'haste', value: 3 }], lore: 'Die Scharten stammen von Zähnen, nicht von Klingen.' },
  { id: 'n_wildererkappe', name: 'Wildererkappe', base: 'leather_cap', band: 1, group: 'hounds', rarity: 'magic', affixes: [{ stat: 'evasion', value: 5 }, { stat: 'maxHp', value: 10 }] },
  { id: 'n_gobelinsack', name: 'Goblinflickwams', base: 'ash_mail', band: 1, group: 'goblins', rarity: 'rare', affixes: [{ stat: 'armor', value: 2 }, { stat: 'maxHp', value: 15 }, { stat: 'resPoison', value: 6 }], sockets: 1, lore: 'Aus drei Wämsern zusammengenäht, keines davon gehörte einem Goblin.' },
];
