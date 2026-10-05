import type { StatusId } from './data';
import type { Actor } from './world';

/**
 * Zentrale Regeln für Statuseffekte (Stufe 6): Art, Stapelverhalten, Entfernbarkeit, Kontroll-Verkürzung.
 * Nur Daten und reine Hilfsfunktionen; kein Wert-Import aus `world.ts` (sonst Importzyklus).
 */
export type EffectKind = 'buff' | 'debuff' | 'control';
/** refresh: längere Dauer gewinnt · replace: stärkerer Effekt ersetzt den schwächeren · stack: Stärken addieren sich (bis `cap`) */
export type StackRule = 'refresh' | 'replace' | 'stack';

export interface EffectDef {
  kind: EffectKind;
  stack: StackRule;
  /** Obergrenze der Stärke bei `stack` */
  cap?: number;
  /** Bannung entfernt Buffs; Läuterung entfernt Debuffs und Kontrolle */
  removable: boolean;
  /** Kontroll-Verkürzung: Wirkt derselbe Effekt innerhalb von `window` Ticks erneut, sinkt die Dauer je Wiederholung um `step` (Anteil), Untergrenze `floor` */
  dr?: { window: number; step: number; floor: number };
  /** Anzeigename für Log-Erklärungen (Akkusativ-neutral, ohne Artikel) */
  label: string;
}

export const EFFECTS: Record<StatusId, EffectDef> = {
  slow: { kind: 'control', stack: 'refresh', removable: true, label: 'Verlangsamung' },
  stun: { kind: 'control', stack: 'refresh', removable: true, label: 'Betäubung' },
  burn: { kind: 'debuff', stack: 'refresh', removable: true, label: 'Brand' },
};

export interface StatusState {
  until: number;
  mag?: number;
}

/** Verschmilzt einen neuen Effekt mit einem vorhandenen nach der Stapelregel. `null`: der neue Effekt ändert nichts. */
export function mergeStatus(def: EffectDef, cur: StatusState | undefined, next: StatusState): StatusState | null {
  if (!cur || cur.until <= 0) return next;
  const curMag = cur.mag ?? 0;
  const nextMag = next.mag ?? 0;
  switch (def.stack) {
    case 'refresh': {
      // wie bisher: nur eine längere Dauer verlängert; Stärke wird nur mit verlängert übernommen
      if (cur.until >= next.until) return null;
      return { until: next.until, ...(next.mag !== undefined ? { mag: Math.max(curMag, nextMag) } : {}) };
    }
    case 'replace': {
      if (nextMag < curMag) return null;
      if (nextMag === curMag && cur.until >= next.until) return null;
      return next;
    }
    case 'stack': {
      const mag = Math.min(def.cap ?? Infinity, curMag + nextMag);
      return { until: Math.max(cur.until, next.until), mag };
    }
  }
}

/** Dauerfaktor durch Kontroll-Verkürzung (1 = unverändert) und neuer Zustand des Zählers. */
export function controlDr(def: EffectDef, last: { at: number; n: number } | undefined, now: number): { factor: number; state: { at: number; n: number } } {
  if (!def.dr) return { factor: 1, state: { at: now, n: 0 } };
  const n = last && now - last.at <= def.dr.window ? last.n + 1 : 0;
  return { factor: Math.max(def.dr.floor, 1 - def.dr.step * n), state: { at: now, n } };
}

/** Entfernt alle Effekte der gewünschten Arten; liefert die entfernten Namen (für Log). */
export function removeStatuses(a: Actor, kinds: EffectKind[], ids: readonly StatusId[]): StatusId[] {
  const out: StatusId[] = [];
  for (const id of ids) {
    if (a.status[id] === undefined) continue;
    const d = EFFECTS[id];
    if (!d.removable || !kinds.includes(d.kind)) continue;
    delete a.status[id];
    if (a.statusMag) delete a.statusMag[id];
    if (id === 'burn') a.burn = null;
    out.push(id);
  }
  return out;
}

/** Läuterung: entfernt Debuffs und Kontrolle (Gift-Schaden über Zeit eingeschlossen). Liefert die Zahl entfernter Wirkungen. */
export function cleanse(a: Actor, ids: readonly StatusId[]): number {
  let n = removeStatuses(a, ['debuff', 'control'], ids).length;
  if (a.dot) {
    a.dot = null;
    n++;
  }
  return n;
}

/** Bannung: entfernt Verstärkungen und Schutz. */
export function dispel(a: Actor, ids: readonly StatusId[]): StatusId[] {
  return removeStatuses(a, ['buff'], ids);
}
