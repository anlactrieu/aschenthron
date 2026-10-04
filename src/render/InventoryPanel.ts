import type { Item, Slot } from '../sim/items';
import { carriedWeight, carryCapacity, armorOf, damageRange, maxHpOf, type Actor, type Command } from '../sim/world';

const RARITY_COLOR: Record<Item['rarity'], string> = { normal: '#c9c4bd', magic: '#6f8fff', rare: '#f2c94c' };
const SLOT_NAME: Record<Slot, string> = {
  weapon: 'Waffe', head: 'Kopf', chest: 'Brust', hands: 'Hände', feet: 'Füße', ring: 'Ring',
};
const STAT_NAME = { damage: 'Schaden', armor: 'Rüstung', maxHp: 'Leben', kraft: 'Kraft' } as const;

export function describeItem(i: Item): string {
  const base: string[] = [];
  if (i.damage) base.push(`Schaden ${i.damage[0]}-${i.damage[1]}`);
  if (i.armor) base.push(`Rüstung ${i.armor}`);
  const aff = i.affixes.map((a) => `+${a.value} ${STAT_NAME[a.stat]}`);
  return [...base, ...aff, `Gewicht ${i.weight}`, i.reqKraft ? `Benötigt Kraft ${i.reqKraft}` : ''].filter(Boolean).join(' · ');
}

export class InventoryPanel {
  private el: HTMLDivElement;
  private lastKey = '';

  constructor(private send: (c: Command) => void) {
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed', right: '12px', top: '12px', width: '340px', maxHeight: '90vh', overflowY: 'auto',
      background: 'rgba(14,12,18,0.92)', border: '1px solid #4b3f3a', color: '#c9b79c',
      font: '13px/1.4 system-ui, sans-serif', padding: '10px', display: 'none',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'i' || e.key === 'I') this.el.style.display = this.el.style.display === 'none' ? 'block' : 'none';
    });
  }

  update(p: Actor): void {
    const key = JSON.stringify([p.inventory, p.equipment, p.kraft, p.hp]);
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.el.replaceChildren();
    const [lo, hi] = damageRange(p);
    this.line(`<b>Inventar</b> (I zum Schließen)`);
    this.line(`Leben ${p.hp}/${maxHpOf(p)} · Schaden ${lo}-${hi} · Rüstung ${armorOf(p)} · Kraft ${p.kraft}`);
    this.line(`Gewicht ${carriedWeight(p).toFixed(1)} / ${carryCapacity(p)}`);
    this.line('<hr style="border-color:#4b3f3a">');
    this.line('<b>Ausgerüstet</b>');
    for (const slot of Object.keys(SLOT_NAME) as Slot[]) {
      const it = p.equipment[slot];
      this.row(`${SLOT_NAME[slot]}: ${it ? it.name : '–'}`, it, it ? [['Ablegen', () => this.send({ type: 'unequip', slot })]] : []);
    }
    this.line('<hr style="border-color:#4b3f3a">');
    this.line('<b>Rucksack</b>');
    if (!p.inventory.length) this.line('<i>leer</i>');
    for (const it of p.inventory) {
      this.row(it.name, it, [
        ['Anlegen', () => this.send({ type: 'equip', itemId: it.id })],
        ['Fallen', () => this.send({ type: 'drop', itemId: it.id })],
      ]);
    }
  }

  private line(html: string): void {
    const d = document.createElement('div');
    d.innerHTML = html;
    this.el.appendChild(d);
  }

  private row(label: string, it: Item | undefined, actions: [string, () => void][]): void {
    const d = document.createElement('div');
    d.style.margin = '4px 0';
    const t = document.createElement('div');
    t.textContent = label;
    if (it) t.style.color = RARITY_COLOR[it.rarity];
    d.appendChild(t);
    if (it) {
      const sub = document.createElement('div');
      sub.textContent = describeItem(it);
      sub.style.cssText = 'font-size:11px;opacity:.7';
      d.appendChild(sub);
    }
    for (const [name, fn] of actions) {
      const b = document.createElement('button');
      b.textContent = name;
      b.style.cssText = 'margin:2px 4px 0 0;cursor:pointer';
      b.onclick = fn;
      d.appendChild(b);
    }
    this.el.appendChild(d);
  }
}
