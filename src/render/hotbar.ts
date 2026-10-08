import { activeSkills, type Actor } from '../sim/world';
import { setHotbarSlot, settings } from './settings';

export const HOTBAR_SLOTS = 9;

/** Belegung der Schnellleiste (Plätze 1–9): gespeicherte Wahl, Lücken füllen sich mit neu gelernten Fertigkeiten in Lernreihenfolge. */
export function hotbarFor(p: Actor): (string | null)[] {
  const act = activeSkills(p);
  const saved = settings().hotbar;
  const slots: (string | null)[] = [];
  for (let i = 0; i < HOTBAR_SLOTS; i++) {
    const id = saved[i];
    slots.push(id && act.includes(id) ? id : null);
  }
  // nur wer die Leiste nie angefasst hat, bekommt sie automatisch gefüllt; sonst bleiben bewusst leere Plätze leer
  if (!saved.length) {
    const rest = act.filter((id) => !slots.includes(id));
    for (let i = 0; i < HOTBAR_SLOTS && rest.length; i++) if (!slots[i]) slots[i] = rest.shift()!;
  }
  return slots;
}

/** Fertigkeit auf einen Platz legen (null: Platz leeren); dieselbe Fertigkeit wandert von ihrem alten Platz. */
export function assignHotbar(p: Actor, slot: number, id: string | null): void {
  const cur = hotbarFor(p).map((x) => x ?? '');
  if (id) for (let i = 0; i < cur.length; i++) if (cur[i] === id) cur[i] = '';
  cur[slot] = id ?? '';
  setHotbarSlot(cur);
}
