/**
 * Spieluhr (P6): Die Uhrzeit ist Teil der Sim und folgt allein dem Tick. 1 Spielstunde = 1 Minute Echtzeit
 * (24 Spielstunden = 24 Minuten, wie vorher in der Atmosphäre). Im Mehrspieler zählt der Tick des Servers, den
 * jeder Schnappschuss mitbringt. `World.fixedHour` (Testhilfe `?stunde=`, nur Einzelspieler) friert die Uhr ein.
 */
/** Ticks je Spielstunde (eine Minute bei 20 Ticks/s; `clock.test.ts` prüft den Gleichstand mit `TICK_RATE`, kein Import wegen Zirkelbezug) */
export const TICKS_PER_HOUR = 20 * 60;
/** Uhrzeit bei Tick 0: früher Morgen, die erste Nacht beginnt nach 13 Minuten */
export const START_HOUR = 8;
/** Nacht: von `NIGHT_FROM` bis `NIGHT_TO` (über Mitternacht). Läden machen genau dann zu. */
export const NIGHT_FROM = 21;
export const NIGHT_TO = 5.5;

/** Innenzonen: Tageszeit gilt dort nicht (Dunkelheit ist Dauerzustand) */
export const DUNGEON_REGIONS = ['Gruft der Moorhexe', 'Katakomben', 'Tiefenmine', 'Thron der Asche', 'Goblinbau', 'Spinnennest'];

export interface Clocked { tick: number; fixedHour?: number | null }

/** Spielstunde 0–24 (mit Nachkomma) */
export function hourOf(w: Clocked): number {
  if (w.fixedHour !== undefined && w.fixedHour !== null) return w.fixedHour;
  return (START_HOUR + w.tick / TICKS_PER_HOUR) % 24;
}

export const isNightHour = (h: number): boolean => {
  const x = ((h % 24) + 24) % 24;
  return x >= NIGHT_FROM || x < NIGHT_TO;
};

/** Laufende Nummer der Nacht (springt um 21 Uhr); bestimmt die Wahl der Spawn-Orte */
export function nightNumber(w: Clocked): number {
  return Math.floor((START_HOUR + w.tick / TICKS_PER_HOUR + (24 - NIGHT_FROM)) / 24);
}

/** "21:05" */
export function clockText(h: number): string {
  const x = ((h % 24) + 24) % 24;
  const hh = Math.floor(x);
  const mm = Math.floor((x - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** "6 Uhr" / "5:30 Uhr" */
export function openText(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh}:${String(mm).padStart(2, '0')} Uhr` : `${hh} Uhr`;
}
