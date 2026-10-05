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
