import { ATTR_KEYS, ATTR_NAME, ATTR_THRESHOLD, ATTR_THRESHOLD_BONUS, WILL_RES_PER_2, SKILLS, SHOPS, QUESTS, MAX_SKILL_RANK, questById, rankLevelReq, rankPrice, respecPrice, totalXpFor, MAX_LEVEL, monsterKind, FAMILY_RES, DMG_NAME, DMG_COLOR, STATUS_NAME, STATUS_COLOR, type SkillDef, type MonsterFamily, type DmgType, type StatusId } from '../sim/data';
import { POWER_TEXT, TIER_COLOR, GEM_COLOR, affixRange, gemAffix, gemName, handsOf, itemAffixes, itemReq, setById, templateById, weaponSpeedOf, type EquipSlot, type GemInfo, type Item } from '../sim/items';
import {
  NPC_RANGE, TICK_RATE, activeSetBonuses, craftCost, armorOf, attackCooldownOf, buyPrice, carriedWeight, carryCapacity, damageRange,
  critChance, attrBonus, equipSlotFor, socketCost, maxHpOf, maxManaOf, missingReq, nearNpc, powerOf, resistOf, type Actor, type Command, type Npc, type World,
} from '../sim/world';
import { itemIcon, potionIcon, skillIcon } from './icons';
import { lookOf, playerCanvas } from './art';

const RARITY_COLOR: Record<Item['rarity'], string> = { normal: '#c9c4bd', magic: '#7f9fff', rare: '#f2c94c', set: '#5fd070', legendary: '#ff8a2a' };
const SLOT_NAME: Record<EquipSlot, string> = { weapon: 'Waffe', head: 'Kopf', chest: 'Brust', hands: 'Hände', feet: 'Füße', ring: 'Ring', ring2: 'Ring', amulet: 'Amulett', offhand: 'Nebenhand', belt: 'Gürtel', cloak: 'Umhang', legs: 'Beine' };

/** Affixzeile: Prozent-Werte als "+3 % Angriffstempo", sonst "+3 Schaden". */
function affixText(a: { stat: keyof typeof STAT_NAME; value: number }): string {
  return `+${a.value} ${STAT_NAME[a.stat]}`;
}

const AFFIX_WEIGHT: Record<string, number> = { damage: 3, armor: 2, maxHp: 0.25, kraft: 2.5, maxMana: 0.2, haste: 4, crit: 5, regen: 6, accuracy: 0.8, evasion: 0.8, resFire: 0.8, resFrost: 0.8, resPoison: 0.8 };

/** Grobe Gesamtwertung eines Ausrüstungsstücks (für den ▲-Hinweis auf Verbesserungen). */
function gearScore(i: Item): number {
  let v = 0;
  if (i.damage) v += ((i.damage[0] + i.damage[1]) / 2) * (i.kind === 'bow' || i.kind === 'staff' ? 1.2 : 1.5);
  if (i.armor) v += i.armor * 2;
  for (const a of itemAffixes(i)) v += a.value * (AFFIX_WEIGHT[a.stat] ?? 1);
  if (i.power) v += 12;
  if (i.rarity === 'set') v += 8;
  return v;
}

function isUpgrade(p: Actor, it: Item): boolean {
  if (it.slot === 'potion' || it.slot === 'gem' || it.off === 'arrows') return false;
  const cur = p.equipment[equipSlotFor(p, it)];
  if (missingReq(p, it, cur).length) return false;
  return !cur || gearScore(it) > gearScore(cur) * 1.05;
}

/** Das angelegte Stück im selben Slot (Tränke haben keins). */
function equippedFor(p: Actor, it: Item): Item | undefined {
  return it.slot === 'potion' || it.slot === 'gem' ? undefined : p.equipment[equipSlotFor(p, it)];
}
const STAT_NAME = {
  damage: 'Schaden', armor: 'Rüstung', maxHp: 'Leben', kraft: 'Kraft', maxMana: 'Mana', haste: '% Angriffstempo', crit: '% Kritisch', regen: 'Leben/s',
  accuracy: 'Treffsicherheit', evasion: 'Ausweichen', resFire: '% Feuerwiderstand', resFrost: '% Frostwiderstand', resPoison: '% Giftwiderstand',
} as const;
const BAG_COLS = 8;

/** Wirkung eines Edelsteins als Text ("+10 Schaden"). */
const gemEffect = (g: GemInfo, slot: Item['slot']) => affixText(gemAffix(g, slot));

export function describeItem(i: Item): string {
  const base: string[] = [];
  if (i.slot === 'gem' && i.gem) {
    base.push(`In Waffen: ${gemEffect(i.gem, 'weapon')}`, `In Rüstung und Schilden: ${gemEffect(i.gem, 'chest')}`, 'Einsetzen beim Schmied');
  }
  if (i.off === 'arrows') base.push(`Pfeile (+${i.arrowBonus ?? 0} Schaden bei Fernkampf-Skills)`);
  if (i.heal) base.push(`Heilt ${i.heal} LP`);
  if (i.mana) base.push(`Stellt ${i.mana} MP wieder her`);
  if (i.damage) base.push(`Schaden ${i.damage[0]}-${i.damage[1]}`);
  if (i.slot === 'weapon') {
    const h = handsOf(i);
    const sp = weaponSpeedOf(i);
    base.push(`${h === 2 ? 'Zweihand' : 'Einhand'}${sp < 1 ? ' · Tempo schnell' : sp > 1 ? ' · Tempo langsam' : ''}`);
  }
  if (i.armor) base.push(`Rüstung ${i.armor}`);
  const aff = i.affixes.map((a) => `+${a.value} ${STAT_NAME[a.stat]}`);
  if (i.sockets?.length) aff.push(`Sockel ${i.sockets.filter(Boolean).length}/${i.sockets.length}`);
  if (i.power) aff.push(POWER_TEXT[i.power.id](i.power.value));
  if (i.setId) aff.push(`Set: ${setById(i.setId).name}`);
  const need = reqLabels(i);
  return [...base, ...aff, `Gewicht ${i.weight}`, need.length ? `Benötigt ${need.join(', ')}` : ''].filter(Boolean).join(' · ');
}

/** Anforderungen als Textliste (nur Werte über dem Grundwert). */
export function reqLabels(i: Item): string[] {
  const r = itemReq(i);
  const out: string[] = [];
  if ((r.level ?? 1) > 1) out.push(`Stufe ${r.level}`);
  if (r.kraft) out.push(`Kraft ${r.kraft}`);
  if (r.gewandtheit) out.push(`Gewandtheit ${r.gewandtheit}`);
  if (r.ausdauer) out.push(`Ausdauer ${r.ausdauer}`);
  if (r.verstand) out.push(`Verstand ${r.verstand}`);
  if (r.willenskraft) out.push(`Willenskraft ${r.willenskraft}`);
  return out;
}

/** Starke Resistenzen/Schwächen einer Monsterfamilie für die Zielanzeige. */
export function resNote(family: MonsterFamily): string {
  const parts: string[] = [];
  for (const [dt, v] of Object.entries(FAMILY_RES[family] ?? {}) as [DmgType, number][]) {
    if (v <= -30) parts.push(`Schwach gegen ${DMG_NAME[dt]}`);
    else if (v >= 100) parts.push(`Immun gegen ${DMG_NAME[dt]}`);
    else if (v >= 50) parts.push(`Resistent gegen ${DMG_NAME[dt]}`);
  }
  return parts.length ? ` – ${parts.join(', ')}` : '';
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

const CSS = `
.a-win{position:fixed;background:linear-gradient(180deg,#1b1620 0%,#120f16 100%);border:2px solid #6b5a48;box-shadow:0 0 0 1px #14100c,0 0 0 3px #3a2f26,0 8px 30px rgba(0,0,0,.7);color:#d4c4a8;font:13px/1.4 Georgia,'Times New Roman',serif;display:none;z-index:10;user-select:none}
.a-win{max-height:calc(100vh - 24px)}
@media (max-width:1000px){.a-win{zoom:.76}}
.a-win h3{margin:0;padding:6px 10px;font:bold 14px Georgia,serif;letter-spacing:.5px;color:#e8d4a8;background:linear-gradient(180deg,#3a2f26,#241d18);border-bottom:1px solid #6b5a48}
.a-tabs{display:flex;background:#241d18;border-bottom:1px solid #6b5a48}
.a-tab{flex:1;padding:6px 4px;text-align:center;cursor:pointer;color:#9a8a70;border-right:1px solid #3a2f26;font-size:12px}
.a-tab:hover{color:#e8d4a8;background:#2e251e}
.a-tab.on{color:#ffe8b0;background:#3a2f26;box-shadow:inset 0 -2px 0 #d8a24a}
.a-body{padding:10px;overflow-y:auto;max-height:calc(100vh - 140px)}
.a-sec{margin:12px 0 6px;padding-bottom:3px;border-bottom:1px solid #4b3f3a;font-weight:bold;color:#e8c888;letter-spacing:.5px}
.a-grid{display:grid;gap:3px;grid-template-columns:repeat(${BAG_COLS},46px)}
.a-slot{position:relative;width:46px;height:46px;background:#0d0a10;border:1px solid #3a3040;box-shadow:inset 0 0 6px #000;box-sizing:border-box}
.a-slot.item{cursor:grab;border-width:2px}
.a-slot img{width:38px;height:38px;image-rendering:pixelated;position:absolute;left:3px;top:3px;pointer-events:none}
.a-slot .n{position:absolute;right:2px;bottom:0;font:bold 11px system-ui;color:#fff;text-shadow:0 0 3px #000,0 0 3px #000;pointer-events:none}
.a-slot .l{position:absolute;left:2px;top:1px;font:10px system-ui;color:#7a6a58;pointer-events:none}
.a-slot.ok{box-shadow:inset 0 0 0 2px #5fd070,0 0 8px #5fd070}
.a-slot.bad{box-shadow:inset 0 0 0 2px #d04a3a}
.a-drop.ok{outline:2px dashed #5fd070;outline-offset:-3px;background:rgba(95,208,112,.08)}
.a-btn{background:linear-gradient(180deg,#4a3c2e,#2e251e);color:#f0e0c0;border:1px solid #8a7258;padding:3px 9px;cursor:pointer;font:12px Georgia,serif;border-radius:2px}
.a-btn:hover{background:linear-gradient(180deg,#6a5640,#3e3226);color:#fff}
.a-btn:disabled,.a-btn.off{opacity:.45;cursor:default}
.a-row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:3px 0}
.a-note{font-size:11px;opacity:.65}
.a-card{border:1px solid #3a3040;background:#0f0c13;padding:6px 8px;margin:5px 0;display:flex;gap:8px;align-items:center}
.a-card img{width:36px;height:36px;image-rendering:pixelated;flex:none}
.a-bar{height:8px;background:#241f2a;border:1px solid #3a3040;position:relative}
.a-bar>div{height:100%}
.a-doll{position:relative;width:324px;height:196px;margin:0 auto;background:radial-gradient(ellipse at 50% 60%,#2a2230 0%,#120f16 70%);border:1px solid #3a3040}
.a-doll .a-slot{position:absolute}
.a-doll img.me{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);width:104px;image-rendering:pixelated;opacity:.95;pointer-events:none}
.orb{position:relative;width:92px;height:92px;border-radius:50%;border:3px solid #6b5a48;background:#0b080d;overflow:hidden;box-shadow:0 0 0 2px #14100c,0 4px 14px rgba(0,0,0,.7),inset 0 0 14px #000}
.orb .liq{position:absolute;left:0;right:0;bottom:0}
.orb .shine{position:absolute;left:14%;top:10%;width:38%;height:26%;border-radius:50%;background:rgba(255,255,255,.18);filter:blur(2px)}
.orb .t{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:bold 13px system-ui;color:#fff;text-shadow:0 1px 3px #000,0 0 4px #000}
.hb{position:relative;width:52px;height:52px;background:#0d0a10;border:2px solid #6b5a48;box-shadow:inset 0 0 6px #000,0 2px 6px rgba(0,0,0,.6);cursor:pointer}
.hb img{width:42px;height:42px;image-rendering:pixelated;position:absolute;left:3px;top:3px;pointer-events:none}
.hb .k{position:absolute;left:2px;top:0;font:bold 11px system-ui;color:#ffe8b0;text-shadow:0 0 3px #000,0 0 3px #000}
.hb .cd{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.62)}
.hb .c{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:bold 15px system-ui;color:#fff;text-shadow:0 0 4px #000}
.hb.armed{border-color:#ffd86a;box-shadow:inset 0 0 8px #000,0 0 10px #ffd86a}
.hb.nomana img{filter:grayscale(.8) brightness(.6)}
.hb .cnt{position:absolute;right:3px;bottom:0;font:bold 12px system-ui;color:#fff;text-shadow:0 0 3px #000,0 0 3px #000}
`;

type Tab = 'inv' | 'char' | 'skills' | 'quests';

interface Drag {
  item: Item;
  from: 'bag' | 'equip' | 'stash' | 'shop';
  slot?: EquipSlot;
  templateId?: string;
}

export class Ui {
  open = false;
  private tab: Tab = 'inv';
  private main = el('div', 'a-win');
  private side = el('div', 'a-win');
  private hud = el('div');
  private orbHp = el('div', 'orb');
  private orbMp = el('div', 'orb');
  private orbParts: { hp: { liq: HTMLElement; t: HTMLElement }; mp: { liq: HTMLElement; t: HTMLElement } } | null = null;
  private hotbar = el('div');
  private xpBar = el('div', 'a-bar');
  private xpFill = el('div');
  private xpText = el('div');
  private target = el('div');
  private statusBar = el('div');
  private statusKey = '';
  private toast = el('div');
  private bannerEl = el('div');
  private bannerTimer = 0;
  private tip = el('div');
  private msgs: string[] = [];
  private key = '';
  private hotKey = '';
  private armedId: string | null = null;
  private hotButtons: { el: HTMLElement; cd: HTMLElement; txt: HTMLElement }[] = [];
  private potionBtns: { heal: HTMLElement; mana: HTMLElement } | null = null;
  private dragging: Drag | null = null;
  private ghost: HTMLImageElement | null = null;
  private lastP: Actor | null = null;
  private lastW: World | null = null;
  private dollKey = '';
  private dollUrl = '';

  constructor(
    private send: (c: Command) => void,
    private useSkillSlot: (i: number) => void,
    private usePotionKind: (kind: 'heal' | 'mana') => void,
    private newGame: () => void,
  ) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    Object.assign(this.main.style, { right: '12px', top: '12px', width: '420px' });
    Object.assign(this.side.style, { left: '12px', top: '190px', width: '420px' });

    this.hud.style.cssText = 'position:fixed;left:50%;bottom:8px;transform:translateX(-50%);display:flex;align-items:flex-end;gap:10px;pointer-events:none;z-index:5';
    const mid = el('div');
    mid.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none';
    this.hotbar.style.cssText = 'display:flex;gap:4px;pointer-events:auto;min-height:56px;align-items:flex-end';
    this.xpBar.style.cssText = 'width:100%;min-width:300px;position:relative';
    this.xpFill.style.cssText = 'background:linear-gradient(180deg,#d8b84a,#8a7220)';
    this.xpText.style.cssText = 'position:absolute;inset:-3px 0 0;text-align:center;font:10px system-ui;color:#fff;text-shadow:0 0 3px #000;line-height:14px';
    this.xpBar.append(this.xpFill, this.xpText);
    this.statusBar.style.cssText = 'display:flex;gap:4px;min-height:20px;pointer-events:none';
    mid.append(this.statusBar, this.hotbar, this.xpBar);
    this.buildOrbs();
    this.hud.append(this.orbHp, mid, this.orbMp);

    this.target.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);background:rgba(14,12,18,.88);border:1px solid #6b5a48;color:#d4c4a8;font:13px Georgia,serif;padding:4px 12px;display:none;text-align:center;min-width:160px';
    this.toast.style.cssText = 'position:fixed;left:12px;bottom:112px;width:420px;color:#d4c4a8;font:13px/1.35 Georgia,serif;pointer-events:none;text-shadow:0 1px 2px #000,0 0 4px #000';
    this.bannerEl.style.cssText = 'position:fixed;left:50%;top:70px;transform:translateX(-50%);color:#e8d9b0;font:bold 24px Georgia,serif;text-shadow:0 2px 8px #000,0 0 2px #000;letter-spacing:1.5px;opacity:0;transition:opacity .6s;pointer-events:none;z-index:6;text-align:center';
    this.tip.style.cssText = 'position:fixed;z-index:50;max-width:270px;background:rgba(10,8,14,.97);border:1px solid #8a7258;color:#d4c4a8;font:12px/1.45 Georgia,serif;padding:8px 10px;pointer-events:none;display:none;box-shadow:0 4px 16px #000';
    document.body.append(this.main, this.side, this.hud, this.target, this.toast, this.bannerEl, this.tip);

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'i') this.toggleTab('inv');
      if (k === 'c') this.toggleTab('char');
      if (k === 'k') this.toggleTab('skills');
      if (k === 'j') this.toggleTab('quests');
      if (k === 'escape') this.toggle(false);
      if (k >= '1' && k <= '9') this.useSkillSlot(Number(k) - 1);
      if (k === 'r') this.send({ type: 'rest' });
      if (k === 'q') this.usePotionKind('heal');
      if (k === 'e') this.usePotionKind('mana');
    });
  }

  /* ----------------------------------------------------------- Fenster */

  private toggleTab(t: Tab): void {
    if (this.open && this.tab === t) this.toggle(false);
    else {
      this.tab = t;
      this.toggle(true);
    }
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.main.style.display = this.open ? 'block' : 'none';
    this.key = '';
    if (!this.open) this.tip.style.display = 'none';
  }

  setArmed(id: string | null): void {
    this.armedId = id;
  }

  banner(text: string, color = '#e8d9b0'): void {
    this.bannerEl.textContent = text;
    this.bannerEl.style.color = color;
    this.bannerEl.style.opacity = '1';
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => (this.bannerEl.style.opacity = '0'), 2800);
  }

  say(m: string): void {
    this.msgs.push(m);
    this.msgs = this.msgs.slice(-6);
    this.toast.replaceChildren(...this.msgs.map((t) => el('div', '', t)));
  }

  /* -------------------------------------------------------------- HUD */

  private buildOrbs(): void {
    const mk = (orb: HTMLElement, color: string) => {
      const liq = el('div', 'liq');
      liq.style.background = `linear-gradient(180deg,${color} 0%,#000 160%)`;
      const t = el('div', 't');
      orb.append(liq, el('div', 'shine'), t);
      return { liq, t };
    };
    this.orbParts = { hp: mk(this.orbHp, '#d83a3a'), mp: mk(this.orbMp, '#3a6ae0') };
  }

  update(w: World, p: Actor, target?: Actor): void {
    this.lastP = p;
    this.lastW = w;
    this.updateHud(p, target);
    const near = w.npcs.filter((n) => Math.hypot(n.x - p.x, n.y - p.y) <= NPC_RANGE);
    const key = JSON.stringify([this.open, this.tab, p.inventory, p.equipment, p.stash, p.attrs, p.statPoints, p.skills, p.skillRanks, p.skillPoints, p.gold, p.level, near.map((n) => n.id), p.quests, p.xp > 0]);
    if (key === this.key || this.dragging) return;
    this.key = key;
    if (this.open) this.renderMain(p);
    this.renderSide(p, this.open ? near : []);
  }

  private updateHud(p: Actor, t?: Actor): void {
    const o = this.orbParts!;
    const hpMax = maxHpOf(p);
    const mpMax = maxManaOf(p);
    o.hp.liq.style.height = `${Math.max(0, Math.min(1, p.hp / hpMax)) * 100}%`;
    o.mp.liq.style.height = `${Math.max(0, Math.min(1, p.mana / mpMax)) * 100}%`;
    o.hp.t.textContent = `${Math.ceil(p.hp)}`;
    o.mp.t.textContent = `${Math.floor(p.mana)}`;
    this.orbHp.title = `Leben ${Math.ceil(p.hp)}/${hpMax}`;
    this.orbMp.title = `Mana ${Math.floor(p.mana)}/${mpMax}`;

    const span = totalXpFor(Math.min(p.level + 1, MAX_LEVEL)) - totalXpFor(p.level);
    const into = Math.max(0, p.xp - totalXpFor(p.level));
    const frac = p.level >= MAX_LEVEL ? 1 : Math.min(1, into / Math.max(1, span));
    this.xpFill.style.width = `${frac * 100}%`;
    this.xpText.textContent = `Stufe ${p.level} · ${p.level >= MAX_LEVEL ? 'Maximum' : `${into} / ${span} XP`} · ${p.gold} Gold${p.statPoints ? ` · ${p.statPoints} Attributpunkte (C)` : ''}${p.skillPoints ? ` · ${p.skillPoints} Skillpunkte` : ''}`;

    // Schnellleiste: Tränke (Q/E) und Skills (1–9); Elemente bleiben bestehen, nur Zustand wird aktualisiert
    const hk = p.skills.join(',');
    if (hk !== this.hotKey || !this.potionBtns) {
      this.hotKey = hk;
      this.hotbar.replaceChildren();
      const mkPotion = (kind: 'heal' | 'mana', key: string) => {
        const b = el('div', 'hb');
        b.title = kind === 'heal' ? 'Heiltrank (Q)' : 'Manatrank (E)';
        b.append(Object.assign(el('img'), { src: potionIcon(kind) }), el('div', 'k', key), el('div', 'cnt'));
        b.onclick = () => this.usePotionKind(kind);
        return b;
      };
      this.potionBtns = { heal: mkPotion('heal', 'Q'), mana: mkPotion('mana', 'E') };
      this.hotbar.append(this.potionBtns.heal);
      this.hotButtons = p.skills.map((id, i) => {
        const s = SKILLS.find((x) => x.id === id)!;
        const b = el('div', 'hb');
        b.title = `${s.name} – ${s.desc}`;
        const cd = el('div', 'cd');
        const txt = el('div', 'c');
        b.append(Object.assign(el('img'), { src: skillIcon(s) }), cd, txt, el('div', 'k', i < 9 ? String(i + 1) : ''));
        b.onclick = () => this.useSkillSlot(i);
        this.hotbar.append(b);
        return { el: b, cd, txt };
      });
      this.hotbar.append(this.potionBtns.mana);
    }
    const count = (k: 'heal' | 'mana') => p.inventory.filter((i) => i.slot === 'potion' && i[k] !== undefined).length;
    for (const k of ['heal', 'mana'] as const) {
      const cnt = this.potionBtns![k].querySelector('.cnt') as HTMLElement;
      const n = count(k);
      if (cnt.textContent !== String(n)) cnt.textContent = String(n);
      this.potionBtns![k].style.opacity = n ? '1' : '.45';
    }
    p.skills.forEach((id, i) => {
      const s = SKILLS.find((x) => x.id === id)!;
      const cd = p.skillCd[id] ?? 0;
      const hb = this.hotButtons[i]!;
      hb.cd.style.height = cd > 0 ? `${Math.min(100, (cd / s.cooldown) * 100)}%` : '0';
      const txt = cd > 0 ? String(Math.ceil(cd / TICK_RATE)) : '';
      if (hb.txt.textContent !== txt) hb.txt.textContent = txt;
      hb.el.classList.toggle('nomana', p.mana < s.mana);
      hb.el.classList.toggle('armed', this.armedId === id);
    });

    // Statusanzeige des Spielers: Name und Restzeit, nur bei Änderung neu aufgebaut
    const now = this.lastW?.tick ?? 0;
    const chips: [string, string, number][] = [];
    for (const id of ['slow', 'stun', 'burn'] as StatusId[]) if (p.status?.[id] && p.status[id]! > now) chips.push([STATUS_NAME[id], STATUS_COLOR[id], Math.ceil((p.status[id]! - now) / TICK_RATE)]);
    if (p.dot && p.dot.until > now) chips.push(['Gift', DMG_COLOR.poison, Math.ceil((p.dot.until - now) / TICK_RATE)]);
    const ck = JSON.stringify(chips);
    if (ck !== this.statusKey) {
      this.statusKey = ck;
      this.statusBar.replaceChildren(...chips.map(([n, c, sec]) => {
        const d = el('div', '', `${n} ${sec}`);
        d.style.cssText = `font:bold 11px system-ui;padding:1px 6px;border:1px solid ${c};color:${c};background:rgba(10,8,14,.85);border-radius:3px`;
        return d;
      }));
    }

    if (t && t.alive && t.kind === 'monster') {
      this.target.style.display = 'block';
      const k = monsterKind(t.kindId!);
      const mod = t.champ ? { swift: 'sehr schnell', armored: 'sehr zäh', fiery: 'setzt in Brand', vampiric: 'heilt sich durch Treffer', thorned: 'wirft Schaden zurück' }[t.champ] : '';
      this.target.textContent = `${t.name} (Stufe ${k.level}) ${Math.ceil(t.hp)}/${t.maxHp}${mod ? ` – ${mod}` : t.unique ? ' – Mini-Boss' : ''}${resNote(k.family)}`;
    } else this.target.style.display = 'none';
  }

  /* -------------------------------------------------- Tooltip & Drag */

  private statsOf(i: Item): Record<string, number> {
    const o: Record<string, number> = {};
    if (i.damage) o['Schaden'] = (i.damage[0] + i.damage[1]) / 2;
    if (i.armor) o['Rüstung'] = i.armor;
    for (const a of itemAffixes(i)) o[STAT_NAME[a.stat]] = (o[STAT_NAME[a.stat]] ?? 0) + a.value;
    return o;
  }

  private showTip(it: Item, equipped: Item | undefined, ev: MouseEvent): void {
    if (this.dragging) return;
    const box = this.tip;
    box.replaceChildren();
    const head = el('div', '', it.name);
    head.style.cssText = `font-weight:bold;color:${RARITY_COLOR[it.rarity]}`;
    box.append(head);
    const rar = { normal: 'Normal', magic: 'Magisch', rare: 'Selten', set: 'Set', legendary: 'Legendär' }[it.rarity];
    const slotName = it.slot === 'potion' ? 'Trank' : it.slot === 'gem' ? 'Edelstein' : it.off === 'arrows' ? 'Pfeile' : it.off === 'shield' ? 'Schild' : SLOT_NAME[it.slot];
    const baseName = it.slot !== 'potion' && it.slot !== 'gem' && it.rarity === 'rare' ? templateById(it.templateId).name : '';
    const sub = el('div', '', `${rar} · ${slotName}${baseName ? ` (${baseName})` : ''}`);
    sub.style.opacity = '.6';
    box.append(sub);
    // gewürfelte Affixe und Sockel zeigt der Block darunter (mit Stufe bzw. Edelstein), nicht doppelt
    const tmpl = it.slot === 'potion' || it.slot === 'gem' ? undefined : templateById(it.templateId);
    const skip = new Set(it.affixes.slice(tmpl?.base?.length ?? 0).map((a) => `+${a.value} ${STAT_NAME[a.stat]}`));
    for (const part of describeItem(it).split(' · ')) {
      if (part.startsWith('Benötigt ') || skip.has(part) || (it.sockets?.length && part.startsWith('Sockel '))) continue;
      box.append(el('div', '', part));
    }
    if (it.affixes.length && it.slot !== 'potion' && it.slot !== 'gem') {
      const t = templateById(it.templateId);
      const base = t.base?.length ?? 0;
      const q = el('div');
      q.style.cssText = 'margin-top:4px;font-size:11px';
      it.affixes.slice(base).forEach((a) => {
        let line: HTMLElement;
        if (a.tier) {
          // Affix-Stufe T1–T5 mit Spannweite dieser Stufe (T5 golden)
          const [lo, hi] = affixRange(a.stat, t.minLevel, a.tier);
          line = el('div', '', `${affixText(a)} · T${a.tier} (${lo}–${hi})`);
          line.style.color = TIER_COLOR[a.tier - 1]!;
          if (a.tier === 5) line.style.fontWeight = 'bold';
        } else {
          const [lo, hi] = affixRange(a.stat, t.minLevel);
          const pct = hi > lo ? Math.round(((a.value - lo) / (hi - lo)) * 100) : 100;
          line = el('div', '', `${affixText(a)} (Wurf ${Math.max(0, Math.min(100, pct))} %)`);
          line.style.color = pct >= 85 ? '#6fe08a' : pct >= 50 ? '#d8c890' : '#9a8a78';
        }
        q.append(line);
      });
      if (q.childNodes.length) box.append(q);
    }
    if (it.sockets?.length) {
      const sk = el('div');
      sk.style.cssText = 'margin-top:4px;font-size:11px';
      for (const g of it.sockets) {
        const line = el('div', '', g ? `◆ ${gemName(g)}: ${gemEffect(g, it.slot)}` : '◇ leerer Sockel');
        line.style.color = g ? `#${GEM_COLOR[g.kind].toString(16).padStart(6, '0')}` : '#7a6a58';
        sk.append(line);
      }
      box.append(sk);
    }
    const labels = reqLabels(it);
    if (labels.length && it.slot !== 'potion' && it.slot !== 'gem') {
      const missing = this.lastP ? missingReq(this.lastP, it, equipped) : [];
      const line = el('div');
      line.append('Benötigt: ');
      labels.forEach((l, idx) => {
        const sp = el('span', '', l);
        sp.style.color = missing.includes(l) ? '#ff6a5a' : '#8fd890';
        line.append(sp);
        if (idx < labels.length - 1) line.append(', ');
      });
      line.style.marginTop = '3px';
      box.append(line);
    }
    if (equipped && equipped.id !== it.id && it.slot !== 'potion' && it.slot !== 'gem') {
      const a = this.statsOf(it);
      const b = this.statsOf(equipped);
      const h = el('div', '', `Verglichen mit: ${equipped.name}`);
      h.style.cssText = 'margin-top:6px;border-top:1px solid #4b3f3a;padding-top:4px;opacity:.7';
      box.append(h);
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const d = Math.round(((a[k] ?? 0) - (b[k] ?? 0)) * 10) / 10;
        if (d === 0) continue;
        const line = el('div', '', `${d > 0 ? '▲ +' : '▼ '}${d} ${k}`);
        line.style.color = d > 0 ? '#6fe08a' : '#ff7a6a';
        box.append(line);
      }
    } else if (!equipped && it.slot !== 'potion' && it.slot !== 'gem' && !(this.lastP && Object.values(this.lastP.equipment).some((e) => e?.id === it.id))) {
      const free = el('div', '', 'Slot ist frei');
      free.style.cssText = 'margin-top:6px;color:#6fe08a';
      box.append(free);
    }
    box.style.display = 'block';
    this.moveTip(ev);
  }

  private moveTip(ev: MouseEvent): void {
    const w = this.tip.offsetWidth;
    const h = this.tip.offsetHeight;
    const x = ev.clientX - w - 16 < 8 ? ev.clientX + 16 : ev.clientX - w - 16;
    this.tip.style.left = `${x}px`;
    this.tip.style.top = `${Math.min(window.innerHeight - h - 8, Math.max(8, ev.clientY - 20))}px`;
  }

  private canDrop(d: Drag, zone: string): boolean {
    if (zone.startsWith('equip:')) return d.from === 'bag' && (zone === 'equip:ring2' ? d.item.slot === 'ring' : d.item.slot === zone.slice(6));
    if (zone === 'bag') return d.from === 'equip' || d.from === 'stash' || d.from === 'shop';
    if (zone === 'stash') return d.from === 'bag' && !!this.lastW && !!this.lastP && !!nearNpc(this.lastW, this.lastP, 'stash');
    if (zone === 'sell') return d.from === 'bag' && !!this.lastW && !!this.lastP && !!nearNpc(this.lastW, this.lastP, 'merchant');
    return false;
  }

  private perform(d: Drag, zone: string | null): void {
    if (!zone) {
      if (d.from === 'bag') {
        const valuable = d.item.rarity === 'rare' || d.item.rarity === 'set' || d.item.rarity === 'legendary';
        if (valuable && !confirm(`${d.item.name} wirklich auf den Boden werfen?`)) return;
        this.send({ type: 'drop', itemId: d.item.id });
      }
      return;
    }
    if (!this.canDrop(d, zone)) {
      this.say(zone.startsWith('equip:') ? `${d.item.name} passt nicht in diesen Slot.` : 'Das geht hier nicht.');
      return;
    }
    if (zone.startsWith('equip:')) this.send({ type: 'equip', itemId: d.item.id, ...(d.item.slot === 'ring' ? { to: zone.slice(6) as 'ring' | 'ring2' } : {}) });
    else if (zone === 'bag') {
      if (d.from === 'equip') this.send({ type: 'unequip', slot: d.slot! });
      else if (d.from === 'stash') this.send({ type: 'stashTake', itemId: d.item.id });
      else if (d.from === 'shop') this.send({ type: 'buy', templateId: d.templateId! });
    } else if (zone === 'stash') this.send({ type: 'stashPut', itemId: d.item.id });
    else if (zone === 'sell') this.send({ type: 'sell', itemId: d.item.id });
  }

  /** Macht ein Element ziehbar (Zeiger-Ereignisse) und bindet Tooltip und Doppelklick. */
  private makeDraggable(e: HTMLElement, d: Drag, equipped: Item | undefined, onDouble: () => void): void {
    e.onmouseenter = (ev) => this.showTip(d.item, equipped, ev);
    e.onmousemove = (ev) => this.moveTip(ev);
    e.onmouseleave = () => (this.tip.style.display = 'none');
    e.ondblclick = () => {
      this.tip.style.display = 'none';
      onDouble();
    };
    e.onpointerdown = (down) => {
      if (down.button !== 0) return;
      const sx = down.clientX;
      const sy = down.clientY;
      let started = false;
      const move = (m: PointerEvent) => {
        if (!started && Math.hypot(m.clientX - sx, m.clientY - sy) > 5) {
          started = true;
          this.beginDrag(d);
        }
        if (started && this.ghost) {
          this.ghost.style.left = `${m.clientX - 22}px`;
          this.ghost.style.top = `${m.clientY - 22}px`;
          this.markZones(m.clientX, m.clientY);
        }
      };
      const up = (u: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (!started) return;
        const under = document.elementFromPoint(u.clientX, u.clientY);
        const zone = (under?.closest('[data-drop]') as HTMLElement | null)?.dataset.drop ?? null;
        const overUi = !!under?.closest('.a-win, .hb, .orb');
        this.endDrag();
        if (zone) this.perform(d, zone);
        else if (!overUi) this.perform(d, null);
        this.key = '';
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
  }

  private beginDrag(d: Drag): void {
    this.dragging = d;
    this.tip.style.display = 'none';
    const g = el('img');
    g.src = itemIcon(d.item);
    g.style.cssText = 'position:fixed;width:44px;height:44px;image-rendering:pixelated;pointer-events:none;z-index:100;opacity:.9;filter:drop-shadow(0 4px 6px #000)';
    document.body.appendChild(g);
    this.ghost = g;
    for (const z of document.querySelectorAll<HTMLElement>('[data-drop]')) {
      if (this.canDrop(d, z.dataset.drop!)) z.classList.add('ok');
    }
  }

  private markZones(x: number, y: number): void {
    const under = document.elementFromPoint(x, y)?.closest('[data-drop]') as HTMLElement | null;
    for (const z of document.querySelectorAll<HTMLElement>('[data-drop]')) {
      z.classList.toggle('bad', z === under && !!this.dragging && !this.canDrop(this.dragging, z.dataset.drop!));
    }
  }

  private endDrag(): void {
    this.dragging = null;
    this.ghost?.remove();
    this.ghost = null;
    for (const z of document.querySelectorAll<HTMLElement>('[data-drop]')) z.classList.remove('ok', 'bad');
  }

  /* -------------------------------------------------------- Hauptfenster */

  private slotEl(item: Item | null, label = ''): HTMLElement {
    const s = el('div', item ? 'a-slot item' : 'a-slot');
    if (label) s.append(el('div', 'l', label));
    if (item) {
      s.style.borderColor = RARITY_COLOR[item.rarity];
      if (item.rarity !== 'normal') s.style.boxShadow = `inset 0 0 8px ${RARITY_COLOR[item.rarity]}55`;
      s.append(Object.assign(el('img'), { src: itemIcon(item) }));
    }
    return s;
  }

  private renderMain(p: Actor): void {
    const tabs = el('div', 'a-tabs');
    for (const [id, label] of [['inv', 'Inventar (I)'], ['char', 'Charakter (C)'], ['skills', 'Fertigkeiten (K)'], ['quests', 'Aufgaben (J)']] as [Tab, string][]) {
      const t = el('div', `a-tab${this.tab === id ? ' on' : ''}`, label);
      t.onclick = () => {
        this.tab = id;
        this.key = '';
      };
      tabs.append(t);
    }
    const body = el('div', 'a-body');
    if (this.tab === 'inv') this.renderInventory(body, p);
    else if (this.tab === 'char') this.renderChar(body, p);
    else if (this.tab === 'skills') this.renderSkills(body, p);
    else this.renderQuests(body, p);
    const title = el('h3', '', `${p.name} · Stufe ${p.level}`);
    this.main.replaceChildren(title, tabs, body);
  }

  private dollImage(p: Actor): string {
    const look = lookOf(p);
    const key = `${look.chest}_${look.head}_${look.weapon}_${look.hands}_${look.weaponKind}_${look.robe}_${look.quiver}_${look.shield}`;
    if (key !== this.dollKey) {
      this.dollKey = key;
      this.dollUrl = playerCanvas(look, 0).toDataURL();
    }
    return this.dollUrl;
  }

  private renderInventory(body: HTMLElement, p: Actor): void {
    // Figur mit Ausrüstungsfeldern
    const doll = el('div', 'a-doll');
    doll.dataset.drop = 'bag';
    doll.append(Object.assign(el('img', 'me'), { src: this.dollImage(p) }));
    // 12 Felder in zwei Spalten links und zwei rechts, die Figur steht frei in der Mitte:
    // links außen Amulett/Waffe/Hände, links innen Kopf/Brust/Beine, rechts innen Umhang/Gürtel/Füße, rechts außen Ring/Nebenhand/Ring
    const pos: Record<EquipSlot, [number, number]> = {
      amulet: [8, 10], weapon: [8, 70], hands: [8, 130],
      head: [64, 10], chest: [64, 70], legs: [64, 130],
      cloak: [214, 10], belt: [214, 70], feet: [214, 130],
      ring: [270, 10], offhand: [270, 70], ring2: [270, 130],
    };
    for (const slot of Object.keys(pos) as EquipSlot[]) {
      const it = p.equipment[slot] ?? null;
      const s = this.slotEl(it, it ? '' : SLOT_NAME[slot]);
      s.dataset.drop = `equip:${slot}`;
      s.style.left = `${pos[slot][0]}px`;
      s.style.top = `${pos[slot][1]}px`;
      if (it) this.makeDraggable(s, { item: it, from: 'equip', slot }, undefined, () => this.send({ type: 'unequip', slot }));
      doll.append(s);
    }
    body.append(doll);

    // Werte-Kurzfassung
    const [lo, hi] = damageRange(p);
    const sum = el('div', 'a-row');
    sum.style.justifyContent = 'center';
    sum.style.gap = '16px';
    sum.append(el('span', '', `Schaden ${lo}–${hi}`), el('span', '', `Rüstung ${armorOf(p)}`), el('span', '', `Leben ${maxHpOf(p)}`));
    body.append(sum);

    // Rucksack
    body.append(el('div', 'a-sec', 'Rucksack'));
    const grid = el('div', 'a-grid a-drop');
    grid.dataset.drop = 'bag';
    // Tränke gleicher Art stapeln (ein Slot, Anzahl als Zahl)
    const stacks: { item: Item; n: number }[] = [];
    for (const it of p.inventory) {
      const st = it.slot === 'potion' ? stacks.find((s) => s.item.templateId === it.templateId) : undefined;
      if (st) st.n++;
      else stacks.push({ item: it, n: 1 });
    }
    const cells = Math.max(BAG_COLS * 5, Math.ceil((stacks.length + 1) / BAG_COLS) * BAG_COLS);
    for (let i = 0; i < cells; i++) {
      const st = stacks[i];
      const s = this.slotEl(st?.item ?? null);
      if (st) {
        if (st.n > 1) s.append(el('div', 'n', String(st.n)));
        const it = st.item;
        if (isUpgrade(p, it)) {
          const up = el('div', 'n', '▲');
          up.style.cssText = 'right:auto;left:3px;bottom:auto;top:1px;color:#6fe08a;font-size:12px';
          s.append(up);
        }
        this.makeDraggable(s, { item: it, from: 'bag' }, equippedFor(p, it), () =>
          this.send(it.slot === 'potion' ? { type: 'usePotion', itemId: it.id } : { type: 'equip', itemId: it.id }),
        );
      }
      grid.append(s);
    }
    body.append(grid);
    const wgt = carriedWeight(p);
    const cap = carryCapacity(p);
    const bar = el('div', 'a-bar');
    bar.style.marginTop = '6px';
    const fill = el('div');
    fill.style.cssText = `width:${Math.min(100, (wgt / cap) * 100)}%;background:${wgt / cap > 0.85 ? '#c04a3a' : '#7a9a4a'}`;
    bar.append(fill);
    body.append(bar, el('div', 'a-note', `Gewicht ${wgt.toFixed(1)} / ${cap} · ${p.gold} Gold · Ziehen: anlegen, ablegen, in die Welt werfen · Doppelklick: anlegen/benutzen`));
  }

  private renderChar(body: HTMLElement, p: Actor): void {
    const [lo, hi] = damageRange(p);
    body.append(el('div', 'a-sec', `Attribute${p.statPoints ? ` – ${p.statPoints} Punkte zu verteilen` : ''}`));
    const help: Record<string, string> = {
      kraft: 'mehr Schaden, mehr Tragkraft', gewandtheit: 'schnellere Hiebe, Fernkampf', ausdauer: 'mehr Leben und Regeneration',
      verstand: 'mehr Mana, stärkere Magie', willenskraft: `schnellere Mana-Regeneration, +${WILL_RES_PER_2} % Resistenz je 2 Punkte über 10, kürzere Betäubung/Verlangsamung`,
    };
    for (const k of ATTR_KEYS) {
      const row = el('div', 'a-row');
      const left = el('div');
      const th = ATTR_THRESHOLD_BONUS[k];
      const reached = attrBonus(p, k) > 0;
      const thLine = el('div', 'a-note', `ab ${ATTR_THRESHOLD}: +${th.pct} % ${th.text}${reached ? ' (aktiv)' : ''}`);
      thLine.style.color = reached ? '#6fe08a' : '#9a8a70';
      thLine.style.opacity = '1';
      left.append(el('div', '', `${ATTR_NAME[k]}: ${p.attrs[k]}`), el('div', 'a-note', help[k]), thLine);
      row.append(left);
      const b = el('button', `a-btn${p.statPoints ? '' : ' off'}`, '+');
      b.onclick = () => p.statPoints > 0 && this.send({ type: 'spendStat', attr: k });
      row.append(b);
      body.append(row);
    }
    body.append(el('div', 'a-sec', 'Werte'));
    const rows: [string, string][] = [
      ['Leben', `${Math.ceil(p.hp)} / ${maxHpOf(p)}`], ['Mana', `${Math.floor(p.mana)} / ${maxManaOf(p)}`], ['Schaden pro Hieb', `${lo}–${hi}`],
      ['Rüstung', String(armorOf(p))], ['Angriffstempo', `${(TICK_RATE / attackCooldownOf(p)).toFixed(2)} Hiebe/s`],
      ['Tragkraft', `${carriedWeight(p).toFixed(1)} / ${carryCapacity(p)}`],
      ['Feuerwiderstand', `${resistOf(p, 'fire')} %`], ['Frostwiderstand', `${resistOf(p, 'frost')} %`], ['Giftwiderstand', `${resistOf(p, 'poison')} %`],
      ['Kritisch', `${critChance(p)} %`], ['Lebensraub', `${powerOf(p, 'lifesteal')} %`], ['Dornen', `${powerOf(p, 'thorns')} %`],
    ];
    for (const [a, b] of rows) {
      const r = el('div', 'a-row');
      r.append(el('span', '', a), el('span', '', b));
      body.append(r);
    }
    const sets = activeSetBonuses(p);
    if (sets.length) {
      body.append(el('div', 'a-sec', 'Set-Boni'));
      for (const st of sets) {
        const h = el('div', '', `${st.name} (${st.pieces} Teile)`);
        h.style.color = '#5fd070';
        body.append(h);
        for (const [n, b] of st.bonuses) {
          const txt = [...(b.affixes ?? []).map((a) => `+${a.value} ${STAT_NAME[a.stat]}`), ...(b.power ? [POWER_TEXT[b.power.id](b.power.value)] : [])].join(', ');
          body.append(el('div', 'a-note', `${n} Teile: ${txt}`));
        }
      }
    }
    const nb = el('button', 'a-btn', 'Neues Spiel (löscht Spielstand)');
    nb.style.marginTop = '14px';
    nb.onclick = () => {
      if (confirm('Spielstand wirklich löschen und neu beginnen?')) this.newGame();
    };
    body.append(nb);
  }

  private renderSkills(body: HTMLElement, p: Actor): void {
    body.append(el('div', 'a-sec', `Gelernte Fertigkeiten – ${p.skillPoints} Skillpunkte übrig`));
    if (!p.skills.length) body.append(el('div', 'a-note', 'Noch keine – Lehrer in den Städten bringen dir Fertigkeiten bei.'));
    p.skills.forEach((id, i) => {
      const s = SKILLS.find((x) => x.id === id)!;
      const c = el('div', 'a-card');
      c.append(Object.assign(el('img'), { src: skillIcon(s) }));
      const t = el('div');
      t.append(el('div', '', `${s.name}${i < 9 ? ` [${i + 1}]` : ''} · ${s.area} · Rang ${p.skillRanks[s.id] ?? 1}`), el('div', 'a-note', `${s.mana} Mana · ${Math.round(s.cooldown / TICK_RATE)} s Abklingzeit`), el('div', 'a-note', s.desc));
      c.append(t);
      body.append(c);
    });
  }

  private renderQuests(body: HTMLElement, p: Actor): void {
    const active = QUESTS.filter((q) => p.quests[q.id] && p.quests[q.id]!.state !== 'turned');
    body.append(el('div', 'a-sec', 'Aktive Aufgaben'));
    if (!active.length) body.append(el('div', 'a-note', 'Keine. Questgeber (gelbes ! über dem Kopf) stehen in den Städten.'));
    for (const q of active) {
      const st = p.quests[q.id]!;
      const c = el('div', 'a-card');
      c.style.display = 'block';
      c.append(el('div', '', q.name), el('div', 'a-note', q.text));
      const bar = el('div', 'a-bar');
      const f = el('div');
      f.style.cssText = `width:${Math.min(100, (st.progress / q.count) * 100)}%;background:${st.state === 'done' ? '#6fe08a' : '#d8a24a'}`;
      bar.append(f);
      c.append(bar, el('div', 'a-note', st.state === 'done' ? 'Fertig – beim Auftraggeber abgeben!' : `${st.progress}/${q.count} · Belohnung ${q.xp} XP, ${q.gold} Gold`));
      body.append(c);
    }
  }

  /* -------------------------------------------------- Händler-Fenster */

  private renderSide(p: Actor, near: Npc[]): void {
    if (!near.length) {
      this.side.style.display = 'none';
      return;
    }
    const body = el('div', 'a-body');
    const trainer = near.find((n) => n.kind === 'trainer');
    const merchants = near.filter((n) => n.kind === 'merchant');
    const stash = near.find((n) => n.kind === 'stash');
    const smith = near.find((n) => n.kind === 'smith');
    const givers = near.filter((n) => n.kind === 'quest');
    for (const m of merchants) {
      body.append(el('div', 'a-sec', `${m.name} – Waren`));
      const grid = el('div', 'a-grid');
      for (const id of SHOPS[m.shop ?? 'basic'] ?? []) {
        const t = templateById(id);
        const fake: Item = {
          id: -1, templateId: id, name: t.name, slot: t.slot, rarity: 'normal', weight: t.weight, damage: t.damage, armor: t.armor,
          heal: t.heal, mana: t.mana, reqKraft: t.reqKraft, value: t.value, affixes: [],
        };
        const s = this.slotEl(fake);
        const price = el('div', 'n', `${buyPrice(id)}g`);
        price.style.color = p.gold >= buyPrice(id) ? '#ffd84a' : '#ff7a6a';
        s.append(price);
        this.makeDraggable(s, { item: fake, from: 'shop', templateId: id }, equippedFor(p, fake), () => this.send({ type: 'buy', templateId: id }));
        grid.append(s);
      }
      body.append(grid);
      body.append(el('div', 'a-note', 'Ziehen in den Rucksack oder Doppelklick: kaufen.'));
    }
    if (merchants.length) {
      const sell = el('div', 'a-card a-drop');
      sell.dataset.drop = 'sell';
      sell.style.cssText += ';justify-content:center;height:46px;border-style:dashed;color:#ffd84a';
      sell.textContent = 'Zum Verkaufen Gegenstand hierher ziehen';
      body.append(sell);
    }
    if (stash) {
      body.append(el('div', 'a-sec', 'Truhe (sicher, auch beim Tod)'));
      const grid = el('div', 'a-grid a-drop');
      grid.dataset.drop = 'stash';
      const cells = Math.max(BAG_COLS * 3, Math.ceil((p.stash.length + 1) / BAG_COLS) * BAG_COLS);
      for (let i = 0; i < cells; i++) {
        const it = p.stash[i] ?? null;
        const s = this.slotEl(it);
        if (it) this.makeDraggable(s, { item: it, from: 'stash' }, equippedFor(p, it), () => this.send({ type: 'stashTake', itemId: it.id }));
        grid.append(s);
      }
      body.append(grid, el('div', 'a-note', 'Gegenstände aus dem Rucksack hierher ziehen (und zurück).'));
    }
    if (trainer) {
      body.append(el('div', 'a-sec', `${trainer.name} – Lehrer · ${p.skillPoints} Skillpunkte`));
      const rs = el('button', 'a-btn', `Alles neu verteilen (${respecPrice(p.level)}g)`);
      rs.title = 'Setzt Attribute und Fertigkeiten zurück, du bekommst alle Punkte zurück.';
      rs.style.marginBottom = '6px';
      rs.onclick = () => {
        if (confirm(`Attribute und Fertigkeiten für ${respecPrice(p.level)} Gold zurücksetzen?`)) this.send({ type: 'respec' });
      };
      body.append(rs);
      for (const s of SKILLS.filter((x) => x.tier <= (trainer.tier ?? 1))) body.append(this.skillCard(s, p));
    }
    if (smith) {
      body.append(el('div', 'a-sec', `${smith.name} – Schmiede`));
      body.append(el('div', 'a-note', 'Aufwerten (normal → magisch → selten), Affixe neu würfeln, Affix hinzufügen (selten).'));
      const gems = p.inventory.filter((i) => i.slot === 'gem' && i.gem);
      const gear = p.inventory.filter((i) => i.slot !== 'potion' && i.slot !== 'gem' && (i.rarity !== 'legendary' && i.rarity !== 'set' || i.sockets?.length));
      body.append(el('div', 'a-note', gems.length ? 'Edelsteine: Knopf je Gegenstand mit Sockel. Ersetzen zerstört den alten Edelstein.' : 'Edelsteine (selten, ab Stufe 8) setzt der Schmied in Sockel von Waffen, Brust, Kopf, Beinen und Schilden.'));
      if (!gear.length) body.append(el('i', 'a-note', 'Nichts zu verbessern.'));
      for (const it of gear) {
        const c = el('div', 'a-card');
        c.append(Object.assign(el('img'), { src: itemIcon(it) }));
        const t = el('div');
        const nm = el('div', '', it.name);
        nm.style.color = RARITY_COLOR[it.rarity];
        t.append(nm, el('div', 'a-note', describeItem(it)));
        const row = el('div');
        row.style.marginTop = '3px';
        const add = (label: string, op: 'upgrade' | 'reroll' | 'extend') => {
          const b = el('button', 'a-btn', label);
          b.style.marginRight = '4px';
          b.onclick = () => this.send({ type: 'craft', itemId: it.id, op });
          row.append(b);
        };
        const craftable = it.rarity !== 'legendary' && it.rarity !== 'set';
        if (craftable && it.rarity !== 'rare') add(`Aufwerten ${craftCost(it, 'upgrade')}g`, 'upgrade');
        if (craftable && it.rarity !== 'normal') add(`Neu würfeln ${craftCost(it, 'reroll')}g`, 'reroll');
        if (craftable && it.rarity === 'rare' && it.affixes.length < 5) add(`Affix + ${craftCost(it, 'extend')}g`, 'extend');
        t.append(row);
        if (it.sockets?.length && gems.length) {
          // je Edelsteinart (gleiche Vorlage) ein Knopf: setzt in den ersten leeren Sockel, sonst ersetzt Sockel 1
          const full = it.sockets.every(Boolean);
          const seen = new Set<string>();
          const grow = el('div');
          grow.style.marginTop = '3px';
          for (const g of gems) {
            if (seen.has(g.templateId)) continue;
            seen.add(g.templateId);
            const gi = g.gem!;
            const b = el('button', `a-btn${p.gold >= socketCost(gi) ? '' : ' off'}`, `${full ? 'Ersetze mit' : '+'} ${gemName(gi)} ${socketCost(gi)}g`);
            b.style.cssText += `;margin:0 4px 3px 0;border-color:#${GEM_COLOR[gi.kind].toString(16).padStart(6, '0')}`;
            b.onclick = () => {
              if (full && !confirm(`${gemName(gi)} ersetzt den Edelstein in Sockel 1 (der alte geht verloren). Fortfahren?`)) return;
              this.send({ type: 'socket', gemId: g.id, itemId: it.id, ...(full ? { index: 0 } : {}) });
            };
            grow.append(b);
          }
          t.append(grow);
        }
        c.append(t);
        c.onmouseenter = (ev) => this.showTip(it, equippedFor(p, it), ev);
        c.onmousemove = (ev) => this.moveTip(ev);
        c.onmouseleave = () => (this.tip.style.display = 'none');
        body.append(c);
      }
    }
    for (const g of givers) {
      body.append(el('div', 'a-sec', `${g.name} – Aufgaben`));
      for (const id of g.quests ?? []) {
        const def = questById(id);
        if (!def) continue;
        const st = p.quests[id];
        const c = el('div', 'a-card');
        c.style.display = 'block';
        const t = el('div', '', `${def.name} (ab Stufe ${def.minLevel})`);
        t.style.fontWeight = 'bold';
        c.append(t, el('div', 'a-note', def.text), el('div', 'a-note', `Belohnung: ${def.xp} XP, ${def.gold} Gold`));
        if (!st) {
          const b = el('button', `a-btn${p.level < def.minLevel ? ' off' : ''}`, 'Annehmen');
          b.onclick = () => this.send({ type: 'acceptQuest', questId: id });
          c.append(b);
        } else if (st.state === 'active') c.append(el('i', 'a-note', `Fortschritt ${st.progress}/${def.count}`));
        else if (st.state === 'done') {
          const b = el('button', 'a-btn', 'Abgeben');
          b.onclick = () => this.send({ type: 'turnInQuest', questId: id });
          c.append(b);
        } else c.append(el('i', 'a-note', 'erledigt'));
        body.append(c);
      }
    }
    const title = el('h3', '', near.map((n) => n.name).join(' · '));
    this.side.replaceChildren(title, body);
    this.side.style.display = 'block';
  }

  private skillCard(s: SkillDef, p: Actor): HTMLElement {
    const known = p.skills.includes(s.id);
    const rank = known ? (p.skillRanks[s.id] ?? 1) : 0;
    const c = el('div', 'a-card');
    c.append(Object.assign(el('img'), { src: skillIcon(s) }));
    const t = el('div');
    t.style.flex = '1';
    const head = el('div', '', `${s.name} · ${s.area}${known ? ` · Rang ${rank}/${MAX_SKILL_RANK}` : ''}`);
    t.append(head, el('div', 'a-note', `${s.desc} Ab Stufe ${s.levelReq}.`));
    c.append(t);
    if (rank >= MAX_SKILL_RANK) c.append(el('i', 'a-note', 'Maximum'));
    else {
      const next = rank + 1;
      const price = rankPrice(s.price, next);
      const lvl = rankLevelReq(s.levelReq, next);
      const can = p.level >= lvl && p.gold >= price && p.skillPoints >= 1;
      const b = el('button', `a-btn${can ? '' : ' off'}`, known ? `Rang ${next}: 1 Pkt · ${price}g` : `Lernen: 1 Pkt · ${price}g`);
      b.title = p.level < lvl ? `Benötigt Stufe ${lvl}` : p.skillPoints < 1 ? 'Keine Skillpunkte' : p.gold < price ? 'Nicht genug Gold' : '';
      b.onclick = () => this.send({ type: known ? 'trainSkill' : 'learnSkill', skillId: s.id });
      c.append(b);
    }
    return c;
  }
}
