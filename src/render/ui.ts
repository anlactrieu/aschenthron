import { ATTR_KEYS, ATTR_NAME, SKILLS, SHOP_ITEMS, totalXpFor, MAX_LEVEL, monsterKind } from '../sim/data';
import { templateById, type Item, type Slot } from '../sim/items';
import {
  TICK_RATE, armorOf, buyPrice, carriedWeight, carryCapacity, damageRange, maxHpOf, maxManaOf, nearNpc, sellPrice,
  type Actor, type Command, type World,
} from '../sim/world';

const RARITY_COLOR: Record<Item['rarity'], string> = { normal: '#c9c4bd', magic: '#7f9fff', rare: '#f2c94c' };
const SLOT_NAME: Record<Slot, string> = { weapon: 'Waffe', head: 'Kopf', chest: 'Brust', hands: 'Hände', feet: 'Füße', ring: 'Ring' };
const STAT_NAME = { damage: 'Schaden', armor: 'Rüstung', maxHp: 'Leben', kraft: 'Kraft' } as const;

export function describeItem(i: Item): string {
  const base: string[] = [];
  if (i.damage) base.push(`Schaden ${i.damage[0]}-${i.damage[1]}`);
  if (i.armor) base.push(`Rüstung ${i.armor}`);
  const aff = i.affixes.map((a) => `+${a.value} ${STAT_NAME[a.stat]}`);
  return [...base, ...aff, `Gewicht ${i.weight}`, i.reqKraft ? `Kraft ${i.reqKraft} nötig` : ''].filter(Boolean).join(' · ');
}

interface Bar {
  box: HTMLElement;
  fill: HTMLElement;
  text: HTMLElement;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, css = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  if (text) e.textContent = text;
  return e;
}

export class Ui {
  private panel = el('div', 'position:fixed;right:12px;top:12px;width:360px;max-height:92vh;overflow-y:auto;background:rgba(14,12,18,.93);border:1px solid #4b3f3a;color:#c9b79c;font:13px/1.4 system-ui,sans-serif;padding:10px;display:none');
  private hud = el('div', 'position:fixed;left:50%;bottom:10px;transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;align-items:center;font:13px system-ui,sans-serif;color:#c9b79c;pointer-events:none');
  private bars = el('div', 'display:flex;gap:10px;align-items:center;background:rgba(14,12,18,.85);border:1px solid #4b3f3a;padding:6px 10px');
  private hotbar = el('div', 'display:flex;gap:6px;pointer-events:auto');
  private target = el('div', 'position:fixed;left:50%;top:10px;transform:translateX(-50%);background:rgba(14,12,18,.85);border:1px solid #4b3f3a;color:#c9b79c;font:13px system-ui,sans-serif;padding:4px 10px;display:none;text-align:center');
  private toast = el('div', 'position:fixed;left:12px;bottom:84px;width:420px;color:#c9b79c;font:13px/1.35 system-ui,sans-serif;pointer-events:none;text-shadow:0 1px 2px #000');
  private msgs: string[] = [];
  private key = '';
  private open = false;

  constructor(private send: (c: Command) => void, private useSkillSlot: (i: number) => void, private newGame: () => void) {
    this.buildBars();
    this.hud.append(this.hotbar, this.bars);
    document.body.append(this.panel, this.hud, this.target, this.toast);
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'i' || k === 'c') this.toggle();
      if (k >= '1' && k <= '9') this.useSkillSlot(Number(k) - 1);
    });
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.panel.style.display = this.open ? 'block' : 'none';
    this.key = '';
  }

  say(m: string): void {
    this.msgs.push(m);
    this.msgs = this.msgs.slice(-7);
    this.toast.replaceChildren(...this.msgs.map((t) => el('div', '', t)));
  }

  update(w: World, p: Actor, target?: Actor): void {
    this.updateHud(p, target);
    if (!this.open) return;
    const near = [nearNpc(w, p, 'trainer'), nearNpc(w, p, 'merchant'), nearNpc(w, p, 'stash')].map((n) => n?.id ?? 0);
    const key = JSON.stringify([p.inventory, p.equipment, p.stash, p.attrs, p.statPoints, p.skills, p.gold, p.level, near]);
    if (key === this.key) return;
    this.key = key;
    this.renderPanel(w, p);
  }

  private barParts: { lv: HTMLElement; hp: Bar; mp: Bar; xp: Bar; gold: HTMLElement; pts: HTMLElement } | null = null;
  private hotKey = '';
  private hotButtons: HTMLButtonElement[] = [];
  private panelHp: HTMLElement | null = null;

  private buildBars(): void {
    const bar = (color: string): Bar => {
      const box = el('div', 'width:120px;position:relative;height:16px;background:#241f2a');
      const fill = el('div', `height:100%;background:${color}`);
      const text = el('div', 'position:absolute;inset:0;text-align:center;font-size:11px;line-height:16px;color:#fff');
      box.append(fill, text);
      return { box, fill, text };
    };
    const parts = { lv: el('span'), hp: bar('#a4332b'), mp: bar('#3558a8'), xp: bar('#8a7a2a'), gold: el('span'), pts: el('span', 'opacity:.7') };
    this.barParts = parts;
    this.bars.append(parts.lv, parts.hp.box, parts.mp.box, parts.xp.box, parts.gold, parts.pts);
  }

  private setBar(b: Bar, label: string, v: number, max: number): void {
    b.fill.style.width = `${Math.max(0, Math.min(1, v / max)) * 100}%`;
    b.text.textContent = `${label} ${Math.ceil(v)}/${max}`;
  }

  private updateHud(p: Actor, t?: Actor): void {
    const bp = this.barParts!;
    const span = totalXpFor(Math.min(p.level + 1, MAX_LEVEL)) - totalXpFor(p.level);
    const into = Math.max(0, p.xp - totalXpFor(p.level));
    bp.lv.textContent = `Lv ${p.level}`;
    this.setBar(bp.hp, 'LP', p.hp, maxHpOf(p));
    this.setBar(bp.mp, 'MP', p.mana, maxManaOf(p));
    this.setBar(bp.xp, 'XP', into, p.level >= MAX_LEVEL ? 1 : span);
    bp.gold.textContent = `Gold ${p.gold}`;
    bp.pts.textContent = p.statPoints ? `${p.statPoints} Punkte (C)` : '';
    if (this.panelHp) this.panelHp.textContent = `Leben ${Math.ceil(p.hp)}/${maxHpOf(p)} · Mana ${Math.floor(p.mana)}/${maxManaOf(p)}`;

    // Hotbar: Buttons nur bei geänderter Skill-Liste neu bauen, sonst Text in place aktualisieren
    const hk = p.skills.join(',');
    if (hk !== this.hotKey) {
      this.hotKey = hk;
      this.hotButtons = p.skills.map((id, i) => {
        const s = SKILLS.find((x) => x.id === id)!;
        const b = el('button', 'cursor:pointer;min-width:84px;padding:4px 6px;background:#241f2a;color:#c9b79c;border:1px solid #4b3f3a');
        b.title = s.desc;
        b.onclick = () => this.useSkillSlot(i);
        return b;
      });
      this.hotbar.replaceChildren(...this.hotButtons);
    }
    p.skills.forEach((id, i) => {
      const s = SKILLS.find((x) => x.id === id)!;
      const cd = p.skillCd[id] ?? 0;
      const label = `${i + 1} ${s.name}${cd > 0 ? ` (${Math.ceil(cd / TICK_RATE)}s)` : ''}`;
      const b = this.hotButtons[i]!;
      if (b.textContent !== label) b.textContent = label;
    });

    if (t && t.alive && t.kind === 'monster') {
      this.target.style.display = 'block';
      const k = monsterKind(t.kindId!);
      this.target.textContent = `${t.name} (Lv ${k.level}) ${Math.ceil(t.hp)}/${t.maxHp}`;
    } else this.target.style.display = 'none';
  }

  private renderPanel(w: World, p: Actor): void {
    const out: HTMLElement[] = [];
    const h = (t: string) => out.push(el('div', 'margin-top:10px;font-weight:bold;border-top:1px solid #4b3f3a;padding-top:6px', t));
    const [lo, hi] = damageRange(p);
    out.push(el('div', 'font-weight:bold', `Held · Level ${p.level} (I/C schließen)`));
    this.panelHp = el('div');
    out.push(this.panelHp);
    out.push(el('div', '', `Schaden ${lo}-${hi} · Rüstung ${armorOf(p)} · Gewicht ${carriedWeight(p).toFixed(1)}/${carryCapacity(p)}`));

    h(`Attribute (${p.statPoints} Punkte)`);
    for (const k of ATTR_KEYS) {
      const row = el('div', 'display:flex;justify-content:space-between;align-items:center');
      row.append(el('span', '', `${ATTR_NAME[k]}: ${p.attrs[k]}`));
      if (p.statPoints > 0) row.append(this.btn('+', () => this.send({ type: 'spendStat', attr: k })));
      out.push(row);
    }
    out.push(el('div', 'font-size:11px;opacity:.65', 'Kraft: Schaden & Tragkraft · Gewandtheit: Angriffstempo & Fernkampf · Ausdauer: Leben · Verstand: Mana & Magie · Willenskraft: Mana-Regeneration'));

    if (p.skills.length) {
      h('Fertigkeiten');
      p.skills.forEach((id, i) => {
        const s = SKILLS.find((x) => x.id === id)!;
        out.push(el('div', '', `${i + 1}: ${s.name} (${s.mana} Mana) – ${s.desc}`));
      });
    }

    h('Ausgerüstet');
    for (const slot of Object.keys(SLOT_NAME) as Slot[]) {
      const it = p.equipment[slot];
      out.push(this.itemRow(`${SLOT_NAME[slot]}: ${it ? it.name : '–'}`, it, it ? [['Ablegen', () => this.send({ type: 'unequip', slot })]] : []));
    }

    const merchant = nearNpc(w, p, 'merchant');
    const stash = nearNpc(w, p, 'stash');
    h('Rucksack');
    if (!p.inventory.length) out.push(el('i', '', 'leer'));
    for (const it of p.inventory) {
      const acts: [string, () => void][] = [['Anlegen', () => this.send({ type: 'equip', itemId: it.id })], ['Fallen', () => this.send({ type: 'drop', itemId: it.id })]];
      if (merchant) acts.push([`Verkaufen (${sellPrice(it)}g)`, () => this.send({ type: 'sell', itemId: it.id })]);
      if (stash) acts.push(['In Truhe', () => this.send({ type: 'stashPut', itemId: it.id })]);
      out.push(this.itemRow(it.name, it, acts));
    }

    if (nearNpc(w, p, 'trainer')) {
      h('Lehrer Varn');
      for (const s of SKILLS) {
        const learned = p.skills.includes(s.id);
        const row = el('div', 'margin:4px 0');
        row.append(el('div', '', `${s.name} [${s.area}] · Lv ${s.levelReq} · ${s.price}g`), el('div', 'font-size:11px;opacity:.7', s.desc));
        row.append(learned ? el('i', '', 'gelernt') : this.btn('Lernen', () => this.send({ type: 'learnSkill', skillId: s.id })));
        out.push(row);
      }
    }
    if (merchant) {
      h('Händlerin Mirel');
      for (const t of SHOP_ITEMS.map(templateById)) {
        const row = el('div', 'display:flex;justify-content:space-between;align-items:center;margin:2px 0');
        row.append(el('span', '', `${t.name} (${t.weight})`), this.btn(`${buyPrice(t.id)}g`, () => this.send({ type: 'buy', templateId: t.id })));
        out.push(row);
      }
    }
    if (stash) {
      h('Truhe (sicher, auch beim Tod)');
      if (!p.stash.length) out.push(el('i', '', 'leer'));
      for (const it of p.stash) out.push(this.itemRow(it.name, it, [['Nehmen', () => this.send({ type: 'stashTake', itemId: it.id })]]));
    }
    out.push(el('hr', 'border-color:#4b3f3a;margin-top:12px'), this.btn('Neues Spiel (löscht Spielstand)', () => { if (confirm('Spielstand wirklich löschen und neu beginnen?')) this.newGame(); }));
    this.panel.replaceChildren(...out);
  }

  private btn(label: string, fn: () => void): HTMLButtonElement {
    const b = el('button', 'margin:2px 4px 0 0;cursor:pointer', label);
    b.onclick = fn;
    return b;
  }

  private itemRow(label: string, it: Item | undefined, actions: [string, () => void][]): HTMLElement {
    const d = el('div', 'margin:4px 0');
    d.append(el('div', it ? `color:${RARITY_COLOR[it.rarity]}` : '', label));
    if (it) d.append(el('div', 'font-size:11px;opacity:.7', describeItem(it)));
    for (const [n, f] of actions) d.append(this.btn(n, f));
    return d;
  }
}
