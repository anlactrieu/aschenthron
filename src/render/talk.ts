import type { Actor } from '../sim/world';
import { DAY_MS } from './atmosphere';
import { hourOf, type Clocked } from '../sim/clock';

/** Aktuelle Spielstunde 0–24: mit Welt die Uhr der Sim (P6), sonst Echtzeit (`?stunde=22` fixiert sie). */
export function gameHour(w?: Clocked): number {
  if (w) return hourOf(w);
  const h = new URLSearchParams(location.search).get('stunde');
  return h !== null && Number.isFinite(Number(h)) ? Number(h) : ((Date.now() % DAY_MS) / DAY_MS) * 24;
}

export type Phase = 'day' | 'dusk' | 'night';
export const phaseOf = (hour: number): Phase => (hour >= 6 && hour < 19 ? 'day' : hour >= 19 && hour < 21.5 ? 'dusk' : 'night');

/** Bekanntheit: abgegebene Aufgaben plus Titel; der Gruß wird mit ihr wärmer. */
export const fameOf = (p: Pick<Actor, 'quests' | 'titles'>): number =>
  Object.values(p.quests).filter((q) => q.state === 'turned').length + (p.titles?.length ?? 0);

type Tier = 'fremd' | 'bekannt' | 'beruehmt';
export const tierOf = (p: Pick<Actor, 'level' | 'quests' | 'titles'>): Tier => {
  const fame = fameOf(p);
  return p.level >= 20 || fame >= 12 ? 'beruehmt' : p.level >= 6 || fame >= 3 ? 'bekannt' : 'fremd';
};

const GREET: Record<Tier, Record<Phase, string>> = {
  fremd: {
    day: 'Ein neues Gesicht. Willkommen, Fremder.',
    dusk: 'Spät noch unterwegs für einen Neuling. Pass auf dich auf.',
    night: 'Nachts ist man hier besser vorsichtig, Fremder.',
  },
  bekannt: {
    day: 'Du schon wieder. Man hört Gutes über dich.',
    dusk: 'Der Abend kommt. Gut, dass du noch da bist.',
    night: 'So spät noch wach? Dann setz dich kurz.',
  },
  beruehmt: {
    day: 'Der Name, den man in den Schenken flüstert. Es ist mir eine Ehre.',
    dusk: 'Die Dämmerung gehört den Helden. Was brauchst du?',
    night: 'Selbst bei Nacht erkenne ich dich. Sprich, ich höre.',
  },
};

/** Gruß nach Bekanntheit/Stufe und Tageszeit. */
export const greeting = (p: Pick<Actor, 'level' | 'quests' | 'titles'>, hour: number): string => GREET[tierOf(p)][phaseOf(hour)];
