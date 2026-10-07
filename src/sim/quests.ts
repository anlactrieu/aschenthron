import { QUESTS, NPC_KEYS, npcKeyOf, monsterKind, type QuestDef } from './data';
import { regionAt, type Actor, type World } from './world';

/** Kann der Spieler die Aufgabe jetzt annehmen? (Stufe, Vorgänger der Kette abgegeben, noch nicht angenommen) */
export function questAvailable(p: Actor, def: QuestDef): boolean {
  if (p.quests[def.id] || p.level < def.minLevel) return false;
  return !def.requires || p.quests[def.requires]?.state === 'turned';
}

/** Ketten in Reihenfolge: Titel → Glieder. */
export function questChains(): { name: string; quests: QuestDef[] }[] {
  const out: { name: string; quests: QuestDef[] }[] = [];
  for (const q of QUESTS) {
    if (!q.chain) continue;
    let c = out.find((x) => x.name === q.chain);
    if (!c) out.push((c = { name: q.chain, quests: [] }));
    c.quests.push(q);
  }
  return out;
}

const center = (r: { x: number; y: number; w: number; h: number }) => ({ x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2) });

export interface QuestMark {
  x: number;
  y: number;
  /** Region-Name des Ziels (für Anzeige) */
  region: string;
  questId: string;
  /** erfüllt: Abgabe beim Auftraggeber */
  done: boolean;
}

/** Zielort einer Aufgabe in der Welt (Region-Mittelpunkt, NPC oder nächster passender Gegner); undefined, wenn nicht ortbar. */
export function questTarget(w: World, p: Actor, def: QuestDef, done: boolean): { x: number; y: number } | undefined {
  // nächster passender Gegner (ein Durchlauf); Tote zählen mit ihrem Heimatplatz, damit Weltboss-Ziele während der Wartezeit sichtbar bleiben
  const nearest = (pred: (a: Actor) => boolean): { x: number; y: number } | undefined => {
    let best: { x: number; y: number } | undefined;
    let bd = Infinity;
    for (const a of w.actors) {
      if (a.kind !== 'monster' || !pred(a)) continue;
      const at = a.alive ? a : a.respawnTicks < 1e9 ? a.home : undefined;
      if (!at) continue;
      const d = Math.hypot(at.x - p.x, at.y - p.y);
      if (d < bd) {
        bd = d;
        best = { x: at.x, y: at.y };
      }
    }
    return best;
  };
  if (done) return giverLocation(w, def)?.pos;
  switch (def.kind) {
    case 'visit': {
      const r = w.regions.find((x) => x.name === def.place);
      return r ? center(r) : undefined;
    }
    case 'talk': {
      const n = w.npcs.find((x) => npcKeyOf(x.name) === def.target);
      return n ? { x: n.x, y: n.y } : undefined;
    }
    case 'kill': return nearest((a) => a.kindId === def.target);
    case 'unique': return def.target ? nearest((a) => a.unique === def.target) : undefined;
    case 'bring': {
      if (def.chestRegion) {
        const r = w.regions.find((x) => x.name === def.chestRegion);
        return r ? center(r) : undefined;
      }
      return nearest((a) => !!a.kindId && !!def.monsters?.includes(a.kindId));
    }
    default: return undefined;
  }
}

/** Auftraggeber einer Aufgabe: Position und Anzeigetext „Name (Region)“. */
export function giverLocation(w: World, def: QuestDef): { pos: { x: number; y: number }; text: string } | undefined {
  const g = w.npcs.find((n) => n.quests?.includes(def.id));
  return g ? { pos: { x: g.x, y: g.y }, text: `${g.name} (${regionAt(w, g.x, g.y)?.name ?? '?'})` } : undefined;
}

/** Marker für Karte/Minimap: Ziele aller aktiven Aufgaben. */
export function questMarks(w: World, p: Actor): QuestMark[] {
  const out: QuestMark[] = [];
  for (const def of QUESTS) {
    const st = p.quests[def.id];
    if (!st || st.state === 'turned') continue;
    const t = questTarget(w, p, def, st.state === 'done');
    if (t) out.push({ x: t.x, y: t.y, region: regionAt(w, t.x, t.y)?.name ?? '', questId: def.id, done: st.state === 'done' });
  }
  return out;
}

/** Ortsangabe für die Aufgabenliste: Region-Name(n), in denen das Ziel zu finden ist. */
export function questWhere(w: World, def: QuestDef, done = false): string {
  if (done) return giverLocation(w, def)?.text ?? '';
  const names = new Set<string>();
  if (def.kind === 'visit' && def.place) names.add(def.place);
  else if (def.kind === 'talk') {
    const n = w.npcs.find((x) => npcKeyOf(x.name) === def.target);
    if (n) return `${n.name} (${regionAt(w, n.x, n.y)?.name ?? '?'})`;
  } else if (def.kind === 'bring' && def.chestRegion) names.add(def.chestRegion);
  else {
    const kinds = def.kind === 'bring' ? def.monsters ?? [] : def.kind === 'kill' ? [def.target] : [];
    for (const a of w.actors) {
      if (a.kind !== 'monster' || !a.home) continue;
      const hit = def.kind === 'unique' ? !!def.target && a.unique === def.target : !!a.kindId && kinds.includes(a.kindId);
      const r = hit ? regionAt(w, a.home.x, a.home.y) : undefined;
      if (r) names.add(r.name);
      if (names.size >= 3) break;
    }
  }
  return [...names].join(', ');
}

/** Name des Quest-Monsters für Anzeigen (z. B. „Sumpfhexe“). */
export function targetName(def: QuestDef): string {
  if (def.kind === 'kill') return monsterKind(def.target).name;
  if (def.kind === 'talk') return NPC_KEYS[def.target] ?? def.target;
  return def.item ?? def.target;
}

export interface NextStep {
  kind: 'turnin' | 'story' | 'hunt' | 'quest' | 'zone';
  text: string;
  x?: number;
  y?: number;
}

/** Stufenbereich einer Region ("3-10") oder undefined (Stadt, ohne Angabe). */
function levelRange(levels: string): [number, number] | undefined {
  const m = /^(\d+)-(\d+)$/.exec(levels);
  return m ? [Number(m[1]), Number(m[2])] : undefined;
}

/**
 * Der eine „nächste Schritt“ für den Spieler, nach Wichtigkeit:
 * fertige Aufgabe abgeben → Geschichte weiterführen → gesuchten Elitegegner jagen → laufende Aufgabe → Jagdgebiet für die Stufe.
 */
export function nextStep(w: World, p: Actor): NextStep | null {
  // 1) Abgabe
  for (const def of QUESTS) {
    if (p.quests[def.id]?.state !== 'done') continue;
    const g = giverLocation(w, def);
    return { kind: 'turnin', text: `Abgeben: „${def.name}“ bei ${g?.text ?? 'dem Auftraggeber'}`, x: g?.pos.x, y: g?.pos.y };
  }
  // 2) Geschichte: nächstes Kettenglied, das jetzt angenommen werden kann
  const chained = QUESTS.filter((q) => q.chain && questAvailable(p, q) && p.level - q.minLevel <= 6).sort((a, b) => a.minLevel - b.minLevel)[0];
  if (chained) {
    const g = giverLocation(w, chained);
    return { kind: 'story', text: `Geschichte: „${chained.name}“ – sprich mit ${g?.text ?? 'dem Auftraggeber'}`, x: g?.pos.x, y: g?.pos.y };
  }
  // 3) Gesucht: lebender benannter Gegner in Reichweite der Stufe (1–2 seltene Gegenstände, Chance auf Legendäres oder Set-Teil)
  let hunt: Actor | undefined;
  let hd = Infinity;
  for (const a of w.actors) {
    if (a.kind !== 'monster' || !a.alive || !a.unique || Math.abs(a.level - p.level) > 4) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d < hd) { hd = d; hunt = a; }
  }
  if (hunt) return { kind: 'hunt', text: `Gesucht: ${hunt.name} (Stufe ${hunt.level}, ${regionAt(w, hunt.x, hunt.y)?.name ?? '?'}) – bringt seltene Beute`, x: hunt.x, y: hunt.y };
  // 4) laufende Aufgabe (Ziel in der Nähe zuerst)
  let best: { def: QuestDef; t: { x: number; y: number }; d: number } | undefined;
  for (const def of QUESTS) {
    if (p.quests[def.id]?.state !== 'active') continue;
    const t = questTarget(w, p, def, false);
    if (!t) continue;
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (!best || d < best.d) best = { def, t, d };
  }
  if (best) return { kind: 'quest', text: `Aufgabe: „${best.def.name}“ – ${questWhere(w, best.def) || 'Ziel suchen'}`, x: best.t.x, y: best.t.y };
  // 5) Jagdgebiet: die fortgeschrittenste Zone, deren Stufenbereich zur Stufe passt
  let zone: (typeof w.regions)[number] | undefined;
  let zl = -1;
  for (const r of w.regions) {
    const lr = levelRange(r.levels);
    if (!lr || p.level < lr[0] || p.level > lr[1] + 2) continue;
    if (lr[0] > zl) { zl = lr[0]; zone = r; }
  }
  if (zone) {
    const c = center(zone);
    return { kind: 'zone', text: `Jagdgebiet für Stufe ${p.level}: ${zone.name} (Stufe ${zone.levels})`, x: c.x, y: c.y };
  }
  return null;
}
