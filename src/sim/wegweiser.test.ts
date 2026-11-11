import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { NPC_LORE, QUESTS, isGiverOf } from './data';
import { NPC_TOPICS, TRUHEN } from './topicsData';
import { regionAt } from './world';
import { stripMarks } from './topics';
import { questSpeech, questWhere } from './quests';
import type { World } from './world';

/** T1: Es gibt keine Markierungen mehr. Jeder Auftrag muss sich über Worte finden lassen: Himmelsrichtung plus Landmarke. */
const DIRECTION = /nördlich|südlich|östlich|westlich|nordöstlich|nordwestlich|südöstlich|südwestlich|\b(?:Nord|Süd|Ost|West)(?:en|osten|westen)?\b|im (?:Norden|Süden|Osten|Westen)/i;
// Aufträge ohne festen Ort (Zufallsziele überall); Truhen haben seit T2a feste Orte und stehen nicht mehr hier
const ORTLOS = new Set(['q_unique1', 'q_unique2', 'q_champs1', 'q_champs2', 'c_thr3']);

const { world: w } = buildWorld(3, mapJson as unknown as TiledMap);

/** Landmarken eines Auftrags: Regionen, Lager und Auftragsort (aus der Weltkarte, nicht von Hand). */
function landmarks(world: World, id: string): string[] {
  const def = QUESTS.find((q) => q.id === id)!;
  const out = new Set<string>();
  for (const part of questWhere(world, def).split(/,\s*|\s*\(|\)/)) if (part.trim()) out.add(part.trim());
  if (def.place) out.add(def.place);
  if (def.chestRegion) out.add(def.chestRegion);
  return [...out];
}

/** Alles, was der Spieler zu diesem Auftrag hören kann: Auftragstext plus die Themen der NPCs, die ihn geben oder freischalten. */
function corpus(id: string): string[] {
  const def = QUESTS.find((q) => q.id === id)!;
  const sentences: string[] = [];
  const add = (t: string) => sentences.push(...stripMarks(t).split(/(?<=[.!?:])\s+/));
  add(questSpeech(w, def));
  for (const [name, t] of Object.entries(NPC_TOPICS)) {
    const npc = w.npcs.find((n) => n.name === name);
    const gives = (npc && isGiverOf(npc, def)) || Object.values(t.topics).some((a) => a.quest === id);
    if (!gives) continue;
    for (const a of Object.values(t.topics)) for (const line of a.text) add(line);
  }
  return sentences;
}

describe('T1 Wegbeschreibung statt Markierung', () => {
  it('jeder Auftrag nennt in Auftragstext oder Gespräch Himmelsrichtung und Landmarke in einem Satz', () => {
    const missing: string[] = [];
    for (const q of QUESTS) {
      if (ORTLOS.has(q.id)) continue;
      const lms = landmarks(w, q.id);
      // Ziele in der Stadt erklärt Joren in seiner Begrüßung („Nördlich der Straße: das Lehrhaus …“)
      if (lms.every((l) => l === 'Aschenhafen' || w.npcs.some((n) => n.name === l))) {
        if (!DIRECTION.test(NPC_LORE['Hafenmeister Joren']!.join(' '))) missing.push(`${q.id} (Stadt)`);
        continue;
      }
      const ok = corpus(q.id).some((s) => DIRECTION.test(s) && lms.some((l) => s.includes(l)));
      if (!ok) missing.push(`${q.id} (${lms.join(' / ')})`);
    }
    expect(missing).toEqual([]);
  });
});

describe('T2a Truhen-Gerüchte', () => {
  it('jede Truhe der Karte wird mit Himmelsrichtung und Landmarke erwähnt, und der NPC sagt es im Stichwort „truhen“', () => {
    expect(w.chests.length).toBeGreaterThanOrEqual(12);
    const missing: string[] = [];
    for (const c of w.chests) {
      const key = c.camp ? `lager:${c.camp}` : (regionAt(w, c.x, c.y)?.name ?? '?');
      const r = TRUHEN[key];
      if (!r) { missing.push(`${c.x},${c.y} (${key}): kein Gerücht`); continue; }
      if (!DIRECTION.test(r.text) || !r.text.includes(r.ort)) missing.push(`${c.x},${c.y} (${key}): Richtung oder Landmarke fehlt`);
      if (!NPC_TOPICS[r.npc]?.topics.truhen?.text.includes(r.text)) missing.push(`${c.x},${c.y} (${key}): ${r.npc} sagt es nicht`);
      if (!w.npcs.some((n) => n.name === r.npc)) missing.push(`${key}: ${r.npc} fehlt in der Karte`);
    }
    expect(missing).toEqual([]);
    // keine Gerüchte über Truhen, die es nicht gibt
    const keys = new Set(w.chests.map((c) => (c.camp ? `lager:${c.camp}` : regionAt(w, c.x, c.y)?.name ?? '?')));
    expect(Object.keys(TRUHEN).filter((k) => !keys.has(k))).toEqual([]);
  });

  it('Truhen-Aufträge sind erfüllbar: genug Truhen, und die genannten Orte gibt es', () => {
    for (const q of QUESTS.filter((x) => x.kind === 'chest')) {
      expect(q.count ?? 1, q.id).toBeLessThanOrEqual(w.chests.length);
      expect(questWhere(w, q), q.id).not.toBe('');
    }
  });
});
