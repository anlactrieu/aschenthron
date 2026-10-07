/** Einstellungen (Lautstärke, Anzeigen, Schnell aufheben) und Tastenbelegung; liegt nur im Browser (localStorage). */

export type Action =
  | 'inv' | 'char' | 'skills' | 'quests' | 'ach' | 'settings' | 'rest' | 'heal' | 'mana' | 'quicksave' | 'quickload'
  | 'skill1' | 'skill2' | 'skill3' | 'skill4' | 'skill5' | 'skill6' | 'skill7' | 'skill8' | 'skill9';

export const ACTIONS: { id: Action; label: string; def: string }[] = [
  { id: 'inv', label: 'Inventar', def: 'i' },
  { id: 'char', label: 'Charakter', def: 'c' },
  { id: 'skills', label: 'Fertigkeiten', def: 'k' },
  { id: 'quests', label: 'Aufgaben', def: 'j' },
  { id: 'ach', label: 'Erfolge', def: 'o' },
  { id: 'settings', label: 'Einstellungen', def: 'p' },
  { id: 'rest', label: 'Rasten', def: 'r' },
  { id: 'heal', label: 'Heiltrank', def: 'q' },
  { id: 'mana', label: 'Manatrank', def: 'e' },
  { id: 'quicksave', label: 'Schnell speichern', def: 'f5' },
  { id: 'quickload', label: 'Schnell laden', def: 'f9' },
  ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => ({ id: `skill${n}` as Action, label: `Fertigkeit ${n}`, def: String(n) })),
];

/** Feste Tasten, die nicht belegbar sind (Menü schließen, Ton, Karte, Laufen) */
const RESERVED = new Set(['escape', 'm', 'u', 'n', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter', 'tab']);

export interface Settings {
  /** Lautstärke 0–1 */
  volume: number;
  /** Kampf-Schadenszahlen anzeigen */
  dmgNumbers: boolean;
  /** Namen über Figuren anzeigen */
  labels: boolean;
  /** Tränke, Edelsteine und Pfeile beim Darüberlaufen einsammeln */
  autoPickup: boolean;
  keys: Partial<Record<Action, string>>;
}

const KEY = 'aschenthron.settings';
const DEFAULTS: Settings = { volume: 1, dmgNumbers: true, labels: true, autoPickup: true, keys: {} };

function load(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw) as Partial<Settings>;
      const keys: Partial<Record<Action, string>> = {};
      for (const a of ACTIONS) {
        const k = o.keys?.[a.id];
        if (typeof k === 'string' && k.length > 0) keys[a.id] = k;
      }
      return {
        volume: typeof o.volume === 'number' ? Math.min(1, Math.max(0, o.volume)) : DEFAULTS.volume,
        dmgNumbers: o.dmgNumbers !== false,
        labels: o.labels !== false,
        autoPickup: o.autoPickup !== false,
        keys,
      };
    }
  } catch {
    /* ohne Speicher oder beschädigt: Standard */
  }
  return { ...DEFAULTS, keys: {} };
}

let cur = load();
const listeners = new Set<() => void>();
/** Läuft gerade die Tastenabfrage im Einstellungsfenster: Spiel-Tasten pausieren */
let capturing = false;

function persist(): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    /* Speicher voll oder gesperrt */
  }
  for (const f of listeners) f();
}

export const settings = (): Settings => cur;

export function onSettings(fn: () => void): void {
  listeners.add(fn);
}

export function setSetting<K extends Exclude<keyof Settings, 'keys'>>(k: K, v: Settings[K]): void {
  cur = { ...cur, [k]: v };
  persist();
}

export function keyOf(a: Action): string {
  return cur.keys[a] ?? ACTIONS.find((x) => x.id === a)!.def;
}

/** Zur gedrückten Taste (klein geschrieben) gehörige Aktion, null wenn keine oder gerade Tastenabfrage. */
export function actionFor(key: string): Action | null {
  if (capturing) return null;
  const k = key.toLowerCase();
  return ACTIONS.find((a) => keyOf(a.id) === k)?.id ?? null;
}

/** Taste neu belegen. Rückgabe: null = ok, sonst Fehlertext (reserviert oder schon belegt). */
export function rebind(a: Action, key: string): string | null {
  const k = key.toLowerCase();
  if (RESERVED.has(k)) return 'Diese Taste ist fest vergeben.';
  const other = ACTIONS.find((x) => x.id !== a && keyOf(x.id) === k);
  if (other) return `Schon belegt: ${other.label}`;
  cur = { ...cur, keys: { ...cur.keys, [a]: k } };
  persist();
  return null;
}

export function resetKeys(): void {
  cur = { ...cur, keys: {} };
  persist();
}

export function setCapturing(v: boolean): void {
  capturing = v;
}

/** Taste für die Anzeige (Pfeil, Leertaste usw. lesbar) */
export function keyLabel(k: string): string {
  return k === ' ' ? 'Leertaste' : k.length === 1 ? k.toUpperCase() : k;
}
