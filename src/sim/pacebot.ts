import { xpToNext } from './data';
import { isShop } from './night';
import { inSafeZone, type Actor, type GameEvent, type World } from './world';

/**
 * Entscheidungen des Pace-Bots (`pace.sim.ts`), getrennt vom Messlauf, damit sie testbar sind.
 * `old` = Bot vor fa18c17, `fa18` = Stand fa18c17, `new` = mit Review-Resten und Nachtvorsicht (nachts in der Stadt warten,
 * vorsichtig jagen), `vess` = wie `new`, kauft nachts zusätzlich beim Nachthändler (geht ohne Sim-Änderung). Nur der Messlauf nutzt die Varianten.
 */
export type BotVariant = 'old' | 'fa18' | 'new' | 'vess';

/** `new` und `vess` tragen die Reparaturen aus fa18c17 und der Nachtvorsicht */
export const repaired = (bot: BotVariant): boolean => bot === 'new' || bot === 'vess';

export const WINDOW_MIN = 20;
export const STALL_MIN = 240;
export const BAN_MIN = 90;
export const BAN_RADIUS = 25;
/** Nachts bei geschlossenen Läden und weniger Heiltränken als hier jagt der Bot nur Ziele bis Stufe +0 */
export const CAUTION_HEALS = 4;
/** Nachts bei geschlossenen Läden und weniger Heiltränken als hier wartet der Bot in der Stadt, bis jemand verkauft */
export const WAIT_HEALS = 2;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Händler, bei denen gekauft werden kann: `new` zählt auch den Nachthändler (Typ quest mit Ware), `old`/`fa18` nur `merchant` */
export function openShops(w: World, bot: BotVariant): World['npcs'] {
  if (bot === 'old') return w.npcs.filter((n) => n.kind === 'merchant');
  return w.npcs.filter((n) => (bot === 'vess' ? isShop(n) : n.kind === 'merchant') && !n.closed && !n.away);
}

/** Händler für die Stadtfahrt: der nächste offene, sonst (nur `old`/`fa18`) der nächste überhaupt */
export function pickMerchant(w: World, p: Actor, bot: BotVariant): World['npcs'][number] | undefined {
  const byDist = (a: { x: number; y: number }, b: { x: number; y: number }) => dist(a, p) - dist(b, p);
  if (repaired(bot)) return openShops(w, bot).sort(byDist)[0];
  const merchants = w.npcs.filter((n) => n.kind === 'merchant').sort(byDist);
  return bot === 'old' ? merchants[0] : merchants.find((n) => !n.closed && !n.away) ?? merchants[0];
}

/** Nachts bei zu und knappen Tränken: Bot soll vorsichtig sein (`caution`) oder in der Stadt warten (`wait`) */
export function nightCare(w: World, p: Actor, bot: BotVariant): { caution: boolean; wait: boolean } {
  const closed = openShops(w, bot).length === 0;
  const heals = p.inventory.filter((i) => i.heal).length;
  return { caution: closed && heals < CAUTION_HEALS, wait: closed && heals < WAIT_HEALS };
}

/**
 * Zielwahl: nah = nächster Gegner in `[Stufe−4, Stufe+cap]` außerhalb gemiedener Plätze, sonst weit = nächster
 * (`new`/`vess`) bzw. höchster (`old`/`fa18`) Gegner bis `Stufe+cap+1`. `cap` ist 1, bei Vorsicht 0.
 */
export function pickTarget(w: World, p: Actor, opts: { bot: BotVariant; free: (a: Actor) => boolean; caution?: boolean }): Actor | undefined {
  const cap = opts.caution ? 0 : 1;
  const base = (a: Actor) => a.kind === 'monster' && a.alive && !a.boss && !a.unique;
  const near = w.actors
    .filter((a) => base(a) && a.level <= p.level + cap && a.level >= p.level - 4 && (opts.bot === 'old' || opts.free(a)))
    .sort((a, b) => dist(a, p) - dist(b, p))[0];
  if (near) return near;
  const farAll = w.actors.filter((a) => base(a) && a.level <= p.level + cap + 1);
  const far = opts.bot === 'old' ? farAll : farAll.some(opts.free) ? farAll.filter(opts.free) : farAll;
  return far.sort(repaired(opts.bot) ? (a, b) => dist(a, p) - dist(b, p) : (a, b) => b.level - a.level)[0];
}

/** Platzwechsel: misst die Jagd-XP je Fenster; reicht sie nicht für einen Aufstieg in `STALL_MIN`, wird der Ort gemieden. */
export class SpotWatch {
  gained = 0;
  windowTicks = 0;
  readonly bans: { x: number; y: number; until: number }[] = [];
  constructor(private readonly bot: BotVariant) {}

  banned = (w: Pick<World, 'tick'>, x: number, y: number): boolean => this.bans.some((b) => b.until > w.tick && dist(b, { x, y }) < BAN_RADIUS);

  /** Erfahrung aus den Ereignissen eines Ticks; Quest-Belohnungen (`questTurned`) zählen nicht als Jagdertrag (`new`) */
  addEvents(events: readonly GameEvent[], playerId: number): void {
    const quest = repaired(this.bot) ? events.filter((e) => e.type === 'questTurned' && (e.to === undefined || e.to === playerId)).map((e) => (e.type === 'questTurned' ? e.xp : 0)) : [];
    for (const e of events) {
      if (e.type !== 'xp' || (e.to !== undefined && e.to !== playerId)) continue;
      const q = quest.indexOf(e.amount);
      if (q >= 0) quest.splice(q, 1);
      else this.gained += e.amount;
    }
  }

  /**
   * Ein Jagdschritt von `ticks` Ticks. Gibt `true` zurück, wenn der Bot das Ziel fallen lassen und weiterziehen soll
   * (der Ort ist dann gemieden). `new` bannt nur, wo gejagt wird: nicht in der Stadt, nicht auf dem Weg (kein Ziel in Reichweite).
   */
  step(w: World, p: Actor, ticks: number, tickRate: number): boolean {
    if (this.bot === 'old') return false;
    this.windowTicks += ticks;
    if (this.windowTicks < WINDOW_MIN * 60 * tickRate) return false;
    if (repaired(this.bot)) {
      const target = p.targetId !== null ? w.actors.find((a) => a.id === p.targetId) : undefined;
      const hunting = !inSafeZone(w, p.x, p.y) && !!target && dist(target, p) < 12;
      if (!hunting) return false; // Fenster läuft weiter, bis der Bot wirklich jagt
    }
    const minutes = this.windowTicks / tickRate / 60;
    const rate = this.gained / minutes;
    const stall = rate * STALL_MIN < xpToNext(p.level) && !this.banned(w, p.x, p.y);
    if (stall) this.bans.push({ x: p.x, y: p.y, until: w.tick + BAN_MIN * 60 * tickRate });
    this.gained = 0;
    this.windowTicks = 0;
    return stall;
  }
}

/** Ein Ziel, das sich in so vielen Sekunden weder bewegt noch Leben verliert, während der Bot still steht, gilt als unerreichbar */
export const STUCK_SEC = 30;
export const IGNORE_MIN = 20;

/**
 * Hängt der Bot an einem Ziel fest (Messlauf Seed 21: steht neben einem Wolf, der nie angegriffen wird, 40 h lang auf Stufe 11),
 * wird das Ziel eine Weile ignoriert. Nur `new`/`vess`.
 */
export class StuckWatch {
  private sig = '';
  private since = 0;
  private readonly ignore = new Map<number, number>();
  constructor(private readonly bot: BotVariant) {}

  ignored = (w: Pick<World, 'tick'>, id: number): boolean => (this.ignore.get(id) ?? 0) > w.tick;

  /** Jeden Schritt aufrufen; `true` = Ziel verwerfen (Bot soll neu wählen) */
  step(w: World, p: Actor, tickRate: number): boolean {
    if (!repaired(this.bot)) return false;
    const t = p.targetId !== null ? w.actors.find((a) => a.id === p.targetId) : undefined;
    if (!t) { this.sig = ''; return false; }
    const sig = `${t.id}:${Math.round(p.x * 2)},${Math.round(p.y * 2)}:${t.hp}`;
    if (sig !== this.sig) { this.sig = sig; this.since = w.tick; return false; }
    if (w.tick - this.since < STUCK_SEC * tickRate) return false;
    this.ignore.set(t.id, w.tick + IGNORE_MIN * 60 * tickRate);
    this.sig = '';
    return true;
  }
}
