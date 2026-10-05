import { handsOf, itemAffixes, type Stat } from './items';
import { equippedItems, type Actor } from './world';

/**
 * Buildprofil (Stufe 6): keine Klassen, sondern eine Einschätzung, welchem Archetyp der Charakter gerade ähnelt.
 * Rein informativ (Anzeige im Charakterfenster); beeinflusst keine Spielregeln.
 */
export type ArchetypeId = 'melee' | 'shield' | 'elemental' | 'healer' | 'ranged' | 'battlemage' | 'control';

export interface Archetype {
  id: ArchetypeId;
  name: string;
  /** Empfehlung: Attribute, Fertigkeiten und Ausrüstung */
  tip: string;
}

export const ARCHETYPES: Archetype[] = [
  { id: 'melee', name: 'Offensiver Nahkämpfer', tip: 'Kraft und Gewandtheit; Wuchtschlag, Wirbelhieb, Schädelspalter, Rüstungsbrecher; Zweihänder oder schnelle Dolche.' },
  { id: 'shield', name: 'Defensiver Schildkämpfer', tip: 'Ausdauer und Kraft; Parieren, Schildbeherrschung, Steinhaut; Einhandwaffe mit Bollwerk- oder Turmschild.' },
  { id: 'elemental', name: 'Elementarmagier', tip: 'Verstand und Willenskraft; Glutblitz, Feuerball, Frostnova, Blitzschlag, Manafluss; Stab mit Feuer- oder Frostzauber-Wert.' },
  { id: 'healer', name: 'Heiler und Unterstützer', tip: 'Verstand und Willenskraft; Heilende Hand, Läuterung, Erste Hilfe, Elementarschild; Heilkraft-Ringe und -Stäbe.' },
  { id: 'ranged', name: 'Fernkämpfer', tip: 'Gewandtheit; Schnellschuss, Giftpfeil, Salve, Präzision, Ausweichtraining, Schleichen; Bogen, Pfeile und Windläuferstiefel.' },
  { id: 'battlemage', name: 'Kampfmagier', tip: 'Kraft und Verstand; Wuchtschlag plus Glutblitz oder Frostnova, Steinhaut, Heilende Hand; Einhandwaffe, Mana-Items.' },
  { id: 'control', name: 'Kontroll- und Debuff-Spezialist', tip: 'Verstand; Entkräftung, Fluch der Blöße, Verstummen, Entzaubern, Frostnova; Kontrolldauer-Amulette.' },
];

const SKILL_GROUPS: Record<'melee' | 'shield' | 'elemental' | 'healer' | 'ranged' | 'control', string[]> = {
  melee: ['power_strike', 'whirlwind', 'skull_split', 'armor_break'],
  shield: ['parry', 'shield_mastery', 'stone_skin'],
  elemental: ['ember_bolt', 'fireball', 'frost_nova', 'lightning', 'mana_flow', 'elemental_ward'],
  healer: ['healing_hand', 'cleanse', 'first_aid', 'elemental_ward'],
  ranged: ['quick_shot', 'poison_shot', 'multishot', 'precision', 'evasion_training', 'stealth'],
  control: ['weaken', 'curse', 'silence', 'dispel_magic', 'frost_nova'],
};

export interface BuildResult {
  /** Archetypen mit Punktzahl, beste zuerst */
  scores: { arch: Archetype; score: number }[];
  /** Hauptrichtung; null solange nichts erkennbar ist */
  primary: Archetype | null;
  /** zweite Richtung, wenn sie fast so stark ist (Hybrid) */
  secondary: Archetype | null;
}

const ranks = (p: Actor, group: string[]): number => group.reduce((n, id) => n + (p.skills.includes(id) ? (p.skillRanks[id] ?? 1) : 0), 0);
const gearStat = (p: Actor, stat: Stat): number => {
  let sum = 0;
  for (const it of equippedItems(p)) for (const a of itemAffixes(it)) if (a.stat === stat) sum += a.value;
  return sum;
};

/** Schätzt aus Attributen (über 10), Skill-Rängen und Ausrüstung, welche Archetypen am besten passen. */
export function buildProfile(p: Actor): BuildResult {
  const a = (k: keyof Actor['attrs']) => Math.max(0, p.attrs[k] - 10);
  const wp = p.equipment.weapon;
  const shield = p.equipment.offhand?.off === 'shield';
  const bow = wp?.kind === 'bow';
  const staff = wp?.kind === 'staff';
  const meleeWp = !!wp && !bow && !staff;
  const oneHand = meleeWp && handsOf(wp!) === 1;
  const magicRanks = ranks(p, SKILL_GROUPS.elemental) + ranks(p, SKILL_GROUPS.healer) + ranks(p, SKILL_GROUPS.control);

  const meleePart = a('kraft') * 0.8 + a('gewandtheit') * 0.2 + ranks(p, SKILL_GROUPS.melee) * 5 + (meleeWp ? 12 : 0);
  const magicPart = a('verstand') * 0.9 + a('willenskraft') * 0.2 + magicRanks * 4 + (staff ? 10 : 0);
  const raw: Record<ArchetypeId, number> = {
    melee: meleePart + (shield ? -8 : 0),
    shield: a('ausdauer') * 0.6 + a('kraft') * 0.4 + ranks(p, SKILL_GROUPS.shield) * 6 + (shield ? 25 : 0) + (oneHand ? 5 : 0) + gearStat(p, 'parry') * 1.5,
    elemental: a('verstand') + a('willenskraft') * 0.2 + ranks(p, SKILL_GROUPS.elemental) * 6 + (staff ? 12 : 0) + (gearStat(p, 'spellFire') + gearStat(p, 'spellFrost')) * 0.6,
    healer: a('verstand') * 0.5 + a('willenskraft') * 0.8 + ranks(p, SKILL_GROUPS.healer) * 7 + gearStat(p, 'healPower') * 0.8,
    ranged: a('gewandtheit') + ranks(p, SKILL_GROUPS.ranged) * 6 + (bow ? 25 : 0) + gearStat(p, 'move') * 0.3,
    battlemage: Math.min(meleePart, magicPart) * 1.35,
    control: ranks(p, SKILL_GROUPS.control) * 9 + gearStat(p, 'ctrl') * 0.9 + a('verstand') * 0.3,
  };
  const scores = ARCHETYPES.map((arch) => ({ arch, score: Math.round(raw[arch.id]) })).sort((x, y) => y.score - x.score);
  const top = scores[0]!;
  if (top.score < 20) return { scores, primary: null, secondary: null };
  const second = scores[1]!;
  return { scores, primary: top.arch, secondary: second.score >= top.score * 0.75 && second.score >= 20 ? second.arch : null };
}
