import { NPC_TOPICS, type TopicAnswer } from './topicsData';

/** Stichwort im Text: `[[schluessel|Anzeige]]` */
const MARK = /\[\[([a-z0-9_]+)\|([^\]]+)\]\]/g;

export interface Mark {
  key: string;
  label: string;
}

export function marksOf(text: string): Mark[] {
  return [...text.matchAll(MARK)].map((m) => ({ key: m[1]!, label: m[2]! }));
}

/** Text in Stücke zerlegt: einfacher Text oder Stichwort (für die Anzeige als Knopf). */
export function splitMarks(text: string): (string | Mark)[] {
  const out: (string | Mark)[] = [];
  let last = 0;
  for (const m of text.matchAll(MARK)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push({ key: m[1]!, label: m[2]! });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Text ohne Markierungen (für Tests und einfache Anzeigen) */
export const stripMarks = (text: string): string => text.replace(MARK, '$2');

/** Anzeigewort je Stichwort (erstes Vorkommen in allen Gesprächen). */
const labels = new Map<string, string>();
for (const n of Object.values(NPC_TOPICS)) {
  for (const t of [n.open, ...Object.values(n.topics).flatMap((a) => a.text)]) for (const m of marksOf(t)) if (!labels.has(m.key)) labels.set(m.key, m.label);
}

/** Alle Stichworte, die es überhaupt gibt (Spielstand-Prüfung). */
export const KEYWORDS: ReadonlySet<string> = new Set([
  ...labels.keys(),
  ...Object.values(NPC_TOPICS).flatMap((n) => Object.keys(n.topics)),
]);

export const keywordLabel = (key: string): string => labels.get(key) ?? key;

export const hasTopics = (npcName: string): boolean => !!NPC_TOPICS[npcName];

/** Frei anklickbare Stichworte eines NPC (stehen in seiner Einstiegszeile). */
export function openKeys(npcName: string): string[] {
  const t = NPC_TOPICS[npcName];
  return t ? marksOf(t.open).map((m) => m.key) : [];
}

/** Antwort eines NPC auf ein Stichwort, falls er eine hat. */
export function answerOf(npcName: string, key: string): TopicAnswer | undefined {
  return NPC_TOPICS[npcName]?.topics[key];
}

/** Darf der Spieler dieses Thema bei diesem NPC ansprechen? Frei (Einstiegszeile) oder schon bekannt. */
export function canAsk(npcName: string, key: string, known: readonly string[] | undefined): boolean {
  return !!answerOf(npcName, key) && (openKeys(npcName).includes(key) || !!known?.includes(key));
}

/** Stichworte, die man durch Lesen einer Antwort (oder des Einstiegs) lernt. */
export function learnedFrom(npcName: string, key: string): string[] {
  const a = answerOf(npcName, key);
  return [key, ...(a ? a.text.flatMap((t) => marksOf(t).map((m) => m.key)) : [])];
}
