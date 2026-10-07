/** Erfolge: rein clientseitig (Zähler in localStorage), die Simulation bleibt unberührt. */
export interface Stats {
  kills: number;
  bosses: number;
  deaths: number;
  legendary: number;
  rares: number;
  chests: number;
  quests: number;
  level: number;
  king: number;
}

export interface Achievement {
  id: string;
  name: string;
  text: string;
  done: (s: Stats) => boolean;
  /** Fortschritt (aktuell, Ziel) für die Anzeige */
  prog?: (s: Stats) => [number, number];
}

const count = (key: keyof Stats, n: number): Pick<Achievement, 'done' | 'prog'> => ({
  done: (s) => s[key] >= n,
  prog: (s) => [Math.min(s[key], n), n],
});

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'k100', name: 'Erste Jagd', text: '100 Gegner erlegt', ...count('kills', 100) },
  { id: 'k1000', name: 'Schlächter von Aschental', text: '1.000 Gegner erlegt', ...count('kills', 1000) },
  { id: 'k5000', name: 'Geißel der Wildnis', text: '5.000 Gegner erlegt', ...count('kills', 5000) },
  { id: 'king', name: 'Der Thron ist leer', text: 'Den Aschenkönig besiegt – das Ende der Herrschaft', ...count('king', 1) },
  { id: 'b1', name: 'Königsmörder', text: 'Ersten Boss besiegt', ...count('bosses', 1) },
  { id: 'b5', name: 'Bossjäger', text: '5 Bosse besiegt', ...count('bosses', 5) },
  { id: 'l10', name: 'Erprobt', text: 'Stufe 10 erreicht', ...count('level', 10) },
  { id: 'l20', name: 'Veteran', text: 'Stufe 20 erreicht', ...count('level', 20) },
  { id: 'l30', name: 'Aschenbezwinger', text: 'Stufe 30 erreicht', ...count('level', 30) },
  { id: 'r1', name: 'Glückliche Hand', text: 'Ersten seltenen Gegenstand gefunden', ...count('rares', 1) },
  { id: 'r25', name: 'Schatzsucher', text: '25 seltene Gegenstände gefunden', ...count('rares', 25) },
  { id: 'g1', name: 'Legendär', text: 'Ersten legendären Gegenstand oder Set-Teil gefunden', ...count('legendary', 1) },
  { id: 'g10', name: 'Sammler der Asche', text: '10 legendäre Funde', ...count('legendary', 10) },
  { id: 'c25', name: 'Truhenräuber', text: '25 Truhen geöffnet', ...count('chests', 25) },
  { id: 'q10', name: 'Helfende Hand', text: '10 Aufgaben abgeschlossen', ...count('quests', 10) },
  { id: 'q25', name: 'Held des Tals', text: '25 Aufgaben abgeschlossen', ...count('quests', 25) },
  { id: 'd10', name: 'Zäh', text: '10-mal gestorben und weitergemacht', ...count('deaths', 10) },
];

const KEY = 'aschenthron.ach.v1';
const empty = (): Stats => ({ kills: 0, bosses: 0, deaths: 0, legendary: 0, rares: 0, chests: 0, quests: 0, level: 1, king: 0 });

function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export class AchievementTracker {
  stats: Stats = empty();
  unlocked = new Set<string>();

  constructor() {
    try {
      const raw = store()?.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.stats = { ...empty(), ...(d.stats ?? {}) };
        this.unlocked = new Set<string>(Array.isArray(d.unlocked) ? d.unlocked : []);
      }
    } catch { /* kaputter Speicher: neu anfangen */ }
  }

  /** Zähler erhöhen bzw. Stufe setzen; liefert neu freigeschaltete Erfolge. */
  bump(key: keyof Stats, by = 1): Achievement[] {
    if (key === 'level') this.stats.level = Math.max(this.stats.level, by);
    else this.stats[key] += by;
    const fresh = ACHIEVEMENTS.filter((a) => !this.unlocked.has(a.id) && a.done(this.stats));
    for (const a of fresh) this.unlocked.add(a.id);
    try { store()?.setItem(KEY, JSON.stringify({ stats: this.stats, unlocked: [...this.unlocked] })); } catch { /* ignorieren */ }
    return fresh;
  }
}
