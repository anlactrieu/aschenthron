/**
 * Gefahrenstufe eines Gegners gegenüber dem Spieler (P4), für die Namensfarbe beim Zeigen:
 * grau = harmlos, weiß = ebenbürtig, gelb = etwas stärker, orange = gefährlich, rot = tödlich.
 * Maß ist der Stufenabstand; Champions zählen +1, Bosse und Unikate +3 (sie schlagen härter, als die Stufe sagt).
 */
export type Threat = 'grau' | 'weiss' | 'gelb' | 'orange' | 'rot';

export const THREAT_COLOR: Record<Threat, string> = { grau: '#9a9a9a', weiss: '#f2f2f2', gelb: '#ffe45a', orange: '#ff9a2a', rot: '#ff4a3a' };
export const THREAT_TEXT: Record<Threat, string> = { grau: 'harmlos', weiss: 'ebenbürtig', gelb: 'etwas stärker', orange: 'gefährlich', rot: 'tödlich' };

export function threatOf(playerLevel: number, m: { level: number; boss?: boolean; unique?: string; champ?: string }): Threat {
  const d = m.level - playerLevel + (m.boss || m.unique ? 3 : m.champ ? 1 : 0);
  if (d <= -5) return 'grau';
  if (d <= 0) return 'weiss';
  if (d <= 2) return 'gelb';
  if (d <= 4) return 'orange';
  return 'rot';
}
