import { assignHotbar, HOTBAR_SLOTS, hotbarFor } from './hotbar';
import { skillReq, SPECS, SPEC_LEVEL, NPC_ROLE, npcKeyOf, ATTR_KEYS, ATTR_NAME, ATTR_THRESHOLD, ATTR_THRESHOLD_2, ATTR_THRESHOLD_BONUS, WILL_RES_PER_2, STATUS_IDS, SCHOOL_NAME, schoolOf, SKILLS, SHOPS, QUESTS, MAX_SKILL_RANK, questById, rankLevelReq, rankPrice, respecPrice, totalXpFor, questXp, MAX_LEVEL, monsterKind, uniqueDef, LOOT_GROUPS, KILL_GOALS, UNIQUES, MONSTERS, NPC_LORE, NPC_TOPICS, isGiverOf, type QuestDef, FAMILY_RES, DMG_NAME, DMG_COLOR, STATUS_NAME, STATUS_COLOR, type SkillDef, type MonsterFamily, type DmgType, type StatusId } from '../sim/data';
import { NAMED } from '../sim/named';
import { Rng } from '../sim/rng';
import { LEGENDARIES, POWER_TEXT, TEMPLATES, SETS, TIER_COLOR, GEM_COLOR, affixRange, generateLegendary, generateNamed, gemAffix, gemName, handsOf, itemAffixes, itemReq, setById, templateById, weaponSpeedOf, type EquipSlot, type GemInfo, type Item } from '../sim/items';
import {
  NPC_RANGE, TICK_RATE, activeSetBonuses, craftCost, armorOf, attackCooldownOf, buyPrice, carriedWeight, carryCapacity, damageRange,
  bulkSellable, sellPrice, critChance, attrBonus, equipSlotFor, socketCost, maxHpOf, maxManaOf, missingReq, nearNpc, trainerTeaches, powerOf, resistOf, type Actor, type Command, type Npc, type World,
  gearStat, parryChance, passiveSum, questRewardChoices, missingSkillReq, groupKills, merchantNamed, namedPrice,
} from '../sim/world';
import { buildProfile } from '../sim/build';
import { itemIcon, potionIcon, skillIcon, statusIcon } from './icons';
import { ACTIONS, actionFor, keyLabel, keyOf, rebind, resetKeys, setCapturing, setSetting, settings } from './settings';
import type { AchievementTracker } from './achievements';
import { ACHIEVEMENTS } from './achievements';
import { type NextStep, giverLocation, questAvailable, questChains, questWhere, targetName } from '../sim/quests';
import { answerOf, canAsk, hasTopics, keywordLabel, openKeys, splitMarks } from '../sim/topics';
import { greeting, gameHour } from './talk';
import { lookKey, lookOf, playerPortrait } from './art';
import { heroMode } from './heroSheet';
import { initCredits, toggleCredits } from './credits';
import { goFullscreen, isFullscreen, isTouch } from './touch';
import { BAR_CSS, faceUrl, installTheme } from './theme';
import { FIG_LABEL, FIG_MODES, HERO_BASE, figureMode, savedFigureMode, setFigureMode, usesNinja } from './figureMap';

const RARITY_COLOR: Record<Item['rarity'], string> = { normal: '#c9c4bd', magic: '#7f9fff', rare: '#f2c94c', set: '#5fd070', legendary: '#ff8a2a' };
const SLOT_NAME: Record<EquipSlot, string> = { weapon: 'Waffe', head: 'Kopf', chest: 'Brust', hands: 'Hände', feet: 'Füße', ring: 'Ring', ring2: 'Ring', amulet: 'Amulett', offhand: 'Nebenhand', belt: 'Gürtel', cloak: 'Umhang', legs: 'Beine' };

/** Affixzeile: Prozent-Werte als "+3 % Angriffstempo", sonst "+3 Schaden". */
function affixText(a: { stat: keyof typeof STAT_NAME; value: number }): string {
  return `${a.value < 0 ? '−' : '+'}${Math.abs(a.value)} ${STAT_NAME[a.stat]}`;
}

const AFFIX_WEIGHT: Record<string, number> = { damage: 3, armor: 2, maxHp: 0.25, kraft: 2.5, maxMana: 0.2, haste: 4, procBurn: 1, procFrost: 1, crit: 5, regen: 6, accuracy: 0.8, evasion: 0.8, resFire: 0.8, resFrost: 0.8, resPoison: 0.8, spellFire: 2, spellFrost: 2, healPower: 1.5, manaCost: -1.5, ctrl: 1.5, move: 1.5, parry: 3 };

const POWER_WEIGHT: Record<string, number> = { lifesteal: 3, crit: 1.5, thorns: 0.6, manaKill: 2, xpBonus: 1.2, goldBonus: 0.3, execute: 0.5, healKill: 1.5, burnHit: 1, frostHit: 0.8 };

/** Grobe Gesamtwertung eines Ausrüstungsstücks (für den ▲-Hinweis auf Verbesserungen). */
function gearScore(i: Item): number {
  let v = 0;
  if (i.damage) v += ((i.damage[0] + i.damage[1]) / 2) * (i.kind === 'bow' || i.kind === 'staff' ? 1.2 : 1.5);
  if (i.armor) v += i.armor * 2;
  for (const a of itemAffixes(i)) v += a.value * (AFFIX_WEIGHT[a.stat] ?? 1);
  if (i.power) v += i.power.value * (POWER_WEIGHT[i.power.id] ?? 1);
  if (i.rarity === 'set') v += 8;
  return v;
}

/** Verschlechterung: lohnt nur, wenn die Anforderungen erfüllt sind und ein Stück im Slot liegt (deutlich schwächer). */
export function isDowngrade(p: Actor, it: Item): boolean {
  if (it.slot === 'potion' || it.slot === 'gem' || it.off === 'arrows') return false;
  const cur = p.equipment[equipSlotFor(p, it)];
  return !!cur && gearScore(it) < gearScore(cur) * 0.85;
}

export function isUpgrade(p: Actor, it: Item): boolean {
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
  spellFire: '% Feuerzauberschaden', spellFrost: '% Frostzauberschaden', healPower: '% Heilung', manaCost: '% Manakosten', ctrl: '% Kontrolldauer', move: '% Bewegungstempo', parry: '% Parieren',
  procBurn: '% Chance auf Brand', procFrost: '% Chance auf Verlangsamung',
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
  if (i.town) base.push(`Teleportiert dich nach ${i.town} (3 s Lesezeit, nicht im Kampf; Bewegen oder Treffer bricht ab)`);
  if (i.heal) base.push(`Heilt ${i.heal} LP`);
  if (i.mana) base.push(`Stellt ${i.mana} MP wieder her`);
  if (i.damage) base.push(`Schaden ${i.damage[0]}-${i.damage[1]}`);
  if (i.slot === 'weapon') {
    const h = handsOf(i);
    const sp = weaponSpeedOf(i);
    base.push(`${h === 2 ? 'Zweihand' : 'Einhand'}${sp < 1 ? ' · Tempo schnell' : sp > 1 ? ' · Tempo langsam' : ''}`);
  }
  if (i.armor) base.push(`Rüstung ${i.armor}`);
  const aff = i.affixes.map((a) => affixText(a));
  if (i.sockets?.length) aff.push(`Sockel ${i.sockets.filter(Boolean).length}/${i.sockets.length}`);
  if (i.power) aff.push(POWER_TEXT[i.power.id](i.power.value));
  if (i.setId) aff.push(`Set: ${setById(i.setId).name}`);
  const need = reqLabels(i);
  const hint = i.slot === 'potion' || i.slot === 'gem' ? '' : TEMPLATES.find((t) => t.id === i.templateId)?.hint;
  return [...base, ...aff, ...(hint ? [`Build: ${hint}`] : []), `Gewicht ${i.weight}`, need.length ? `Benötigt ${need.join(', ')}` : ''].filter(Boolean).join(' · ');
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

/** Einklappbare Erklärung eines Skills: Wirkung, Build, Synergie, Entscheidung, Grenze. */
function skillInfo(s: SkillDef): HTMLElement[] {
  if (!s.info) return [];
  const d = el('details');
  d.append(el('summary', 'a-note', 'Wofür? (Build, Synergie, Grenze)'));
  for (const [label, text] of [['Wirkung', s.info.role], ['Build', s.info.build], ['Synergie', s.info.synergy], ['Entscheidung', s.info.decision], ['Grenze', s.info.limit]] as const) d.append(el('div', 'a-note', `${label}: ${text}`));
  return [d];
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** Titelleiste eines Fensters: zum Verschieben ziehen, ✕ schließt. Die Position bleibt, weil nur der Inhalt neu aufgebaut wird. */
function titleBar(text: string, win: HTMLElement, onClose: () => void, extra: HTMLElement[] = []): HTMLElement {
  const h = el('h3');
  h.append(el('span', '', text));
  if (isTouch) {
    // Handy: kein Verschieben; Titel antippen oder „–“ klappt das Fenster ein, damit die Welt wieder frei ist
    const right = el('span');
    right.style.cssText = 'display:flex;align-items:stretch;margin-left:auto';
    const fold = el('span', 'a-x a-fold', win.classList.contains('a-min') ? '▢' : '–');
    fold.onclick = () => {
      win.classList.toggle('a-min');
      fold.textContent = win.classList.contains('a-min') ? '▢' : '–';
    };
    const x = el('span', 'a-x', '✕');
    x.onclick = onClose;
    right.append(...extra, fold, x);
    h.append(right);
    (h.firstElementChild as HTMLElement).onclick = () => fold.click();
    return h;
  }
  const x = el('span', 'a-x', '✕');
  x.title = 'Schließen';
  x.onpointerdown = (e) => e.stopPropagation();
  x.onclick = onClose;
  h.append(x);
  h.onpointerdown = (e) => {
    if (e.button !== 0) return;
    const r = win.getBoundingClientRect();
    const zoom = r.width / win.offsetWidth || 1;
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    h.setPointerCapture(e.pointerId);
    h.onpointermove = (m) => {
      const left = Math.max(0, Math.min(window.innerWidth - 80, m.clientX - dx));
      const top = Math.max(0, Math.min(window.innerHeight - 40, m.clientY - dy));
      Object.assign(win.style, { left: `${left / zoom}px`, top: `${top / zoom}px`, right: 'auto' });
    };
    h.onpointerup = () => {
      h.onpointermove = null;
      h.onpointerup = null;
    };
  };
  return h;
}

const CSS = `
.a-win{position:fixed;display:none;z-index:10;user-select:none;max-height:calc(100vh - 24px - 2*var(--bw));box-shadow:0 8px 24px rgba(0,0,0,.6)}
@media (max-width:1000px){.a-win{zoom:.76}}
.a-win h3{margin:0 0 4px;padding:2px 8px 0;font:18px/1.2 var(--ui-font);letter-spacing:.5px;color:var(--ink);display:flex;align-items:center;justify-content:space-between;cursor:move;touch-action:none}
.a-x{cursor:pointer;color:var(--ink);padding:0 6px;margin:0 -2px 0 8px;font:18px/1.2 var(--ui-font)}
.a-x:hover{color:#fff;background:#9b2a2a}
.a-tabs{display:flex;flex-wrap:wrap;gap:2px;margin:0 0 4px}
.a-tab{flex:1 1 30%;min-width:0;padding:0;text-align:center;cursor:pointer;font-size:15px;line-height:18px;border-width:3px 3px 5px;border-image-width:3px 3px 5px}
.a-tab.on{color:var(--ink)}
.a-body{padding:6px 8px;overflow-y:auto;max-height:calc(100vh - 200px)}
.a-sec{margin:12px 0 6px;padding-bottom:3px;border-bottom:2px solid var(--wood-l);color:var(--gold);letter-spacing:.8px}
.a-grid{display:grid;gap:3px;grid-template-columns:repeat(${BAG_COLS},46px)}
.a-slot{position:relative;width:46px;height:46px}
.a-slot.item{cursor:grab}
.a-slot img,.hb img{width:100%;height:100%;image-rendering:pixelated;position:absolute;left:0;top:0;pointer-events:none;object-fit:contain}
.a-slot .n{position:absolute;right:0;bottom:-2px;font:14px/1 var(--ui-font);color:#fff;text-shadow:-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000;pointer-events:none}
.a-slot .l{position:absolute;left:0;top:-3px;font:11px/1 var(--ui-font);letter-spacing:0;white-space:nowrap;color:#fff;text-shadow:-1px 0 #131b1b,1px 0 #131b1b,0 -1px #131b1b,0 1px #131b1b;pointer-events:none}
.a-slot.ok{box-shadow:inset 0 0 0 2px #5fd070,0 0 8px #5fd070}
.a-slot.bad{box-shadow:inset 0 0 0 2px #d04a3a}
.a-drop.ok{outline:2px dashed #5fd070;outline-offset:-3px;background:rgba(95,208,112,.08)}
.pulse{animation:xpPulse 1.4s ease-in-out infinite}
@keyframes hbNew{0%,100%{box-shadow:0 0 0 0 rgba(176,122,222,0)}50%{box-shadow:0 0 12px 4px rgba(176,122,222,.9)}}
.hb.hb-new{animation:hbNew .7s ease-in-out 4}
@keyframes xpPulse{0%,100%{box-shadow:0 0 0 0 rgba(216,162,74,0)}50%{box-shadow:0 0 10px 3px rgba(216,162,74,.85)}}
.a-btn{padding:0 8px;cursor:pointer;font:15px/20px var(--ui-font)}
.a-row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:3px 0}
.a-note{font-size:15px;color:var(--dim)}
.a-card{border:2px solid var(--ink);background:var(--wood-d);box-shadow:inset 0 0 0 2px #5a4e34;padding:6px 8px;margin:5px 0;display:flex;gap:8px;align-items:center}
.a-card img{width:36px;height:36px;image-rendering:pixelated;flex:none}
.a-bar{height:10px;background:#1d1810;border:2px solid var(--ink);position:relative}
.a-bar>div{height:100%}
.a-doll{position:relative;width:324px;height:196px;margin:0 auto;background:radial-gradient(ellipse at 50% 60%,#5a5238 0%,#2d2a1f 75%);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px #5a4e34}
.a-doll .a-slot{position:absolute}
.a-doll img.me{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);width:104px;image-rendering:pixelated;opacity:.95;pointer-events:none;object-fit:initial}
.a-win input[type=range]{accent-color:#f06733}
.a-win select{background:var(--wood-d);color:var(--txt);border:2px solid var(--ink);font-size:16px}
.a-win input[type=text],.a-win input:not([type]){background:var(--wood-d);color:var(--txt);border:2px solid var(--ink)}
.hb{position:relative;width:52px;flex:0 1 auto;min-width:30px;height:52px;cursor:pointer}
.hb .k{position:absolute;left:-3px;top:-5px;font:14px/1 var(--ui-font);color:#fff;text-shadow:-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000}
.hb .cd{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.62)}
.hb .c{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:20px var(--ui-font);color:#fff;text-shadow:-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000}
.hb.armed{box-shadow:inset 0 0 0 3px var(--gold),0 0 10px var(--gold)}
.hb.nomana img{filter:grayscale(.8) brightness(.6)}
.hb .cnt{position:absolute;right:-2px;bottom:-5px;font:14px/1 var(--ui-font);color:#fff;text-shadow:-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000}
/* unten: Leben | Schnellleiste + XP | Mana */
.hud>.pbar{width:150px;flex:0 1 auto;min-width:84px;margin-bottom:34px}
#hud-tl{position:fixed;left:12px;top:12px;z-index:5;display:flex;align-items:stretch;gap:0;pointer-events:none}
#hud-tl .face{width:76px;height:76px;image-rendering:pixelated;display:block;background:#17120f;box-shadow:inset 0 0 0 1px #4b3f3a}
#hud-tl .hdr{display:flex;flex-direction:column;justify-content:center;min-width:168px;padding:0 4px 0 8px;gap:0}
#hud-tl .nm{font-size:20px;line-height:1.1;color:var(--gold);text-shadow:0 2px var(--ink);max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#hud-tl .lv{font-size:16px;line-height:1.1;color:var(--txt);margin-bottom:2px}
#hud-tl .pbar{height:18px;margin:4px 5px 4px 3px}
${BAR_CSS}
`;

type Tab = 'inv' | 'char' | 'skills' | 'quests' | 'best' | 'ach' | 'set';
type BagFilter = 'all' | 'weapon' | 'armor' | 'potion' | 'other';
type BagSort = 'none' | 'slot' | 'rarity' | 'value';

interface Drag {
  item: Item;
  from: 'bag' | 'equip' | 'stash' | 'shop';
  slot?: EquipSlot;
  templateId?: string;
}

const SKILL_GROUPS = ['Feuer', 'Frost', 'Blitz', 'Gift', 'Heilung', 'Schutz & Zauberkunst', 'Nahkampf', 'Fernkampf', 'Überleben'];
const LIGHTNING_IDS = ['lightning', 'spark', 'chain_lightning', 'storm_call'];
/** Anzeigegruppe beim Lehrer: Element des Zaubers, sonst das Fachgebiet. */
function skillGroup(s: SkillDef): string {
  if (s.dmgType === 'fire') return 'Feuer';
  if (s.dmgType === 'frost') return 'Frost';
  if (s.dmgType === 'poison') return 'Gift';
  if (LIGHTNING_IDS.includes(s.id)) return 'Blitz';
  if (s.heal !== undefined) return 'Heilung';
  return s.area === 'Magie' ? 'Schutz & Zauberkunst' : s.area;
}

export class Ui {
  open = false;
  ach: AchievementTracker | null = null;
  /** Server-Rangliste (nur online) */
  board: { name: string; level: number; xp: number }[] | null = null;
  private tab: Tab = 'inv';
  private main = el('div', 'a-win');
  private side = el('div', 'a-win');
  private hud = el('div');
  private orbHp = el('div', 'pbar hp');
  private orbMp = el('div', 'pbar mp');
  private orbParts: { hp: { liq: HTMLElement; t: HTMLElement }; mp: { liq: HTMLElement; t: HTMLElement } } | null = null;
  /** Porträt oben links: Name, Stufe und die zweiten Leisten für Leben/Mana */
  private tl = el('div', 'w-frame');
  private tlName = el('div', 'nm');
  private tlLevel = el('div', 'lv');
  private tlParts: { hp: { liq: HTMLElement; t: HTMLElement }; mp: { liq: HTMLElement; t: HTMLElement } } | null = null;
  private hotbar = el('div');
  private xpBar = el('div', 'a-bar');
  private xpFill = el('div');
  private xpText = el('div');
  private target = el('div');
  private statusBar = el('div');
  private statusKey = '';
  private toast = el('div');
  private bannerEl = el('div');
  private tracker = el('div');
  private trackerKey = '';
  private sideClosed = '';
  /** Geöffnetes Gesprächsthema (nur Anzeige; die Sim lernt es über `askTopic`) */
  private topicView: { npcId: number; key: string } | null = null;
  /** Nächster Schritt (von der Szene alle 0,5 s gesetzt) */
  step: NextStep | null = null;
  private bannerTimer = 0;
  private hintEl = el('div', '', 'Gespeichert');
  private hintTimer = 0;
  private tip = el('div');
  private msgs: string[] = [];
  private toastTimer = 0;
  private key = '';
  private hotKey = '';
  private armedId: string | null = null;
  private hotButtons: { el: HTMLElement; cd: HTMLElement; txt: HTMLElement }[] = [];
  private potionBtns: { heal: HTMLElement; mana: HTMLElement } | null = null;
  private dragging: Drag | null = null;
  private ghost: HTMLImageElement | null = null;
  private lastP: Actor | null = null;
  private titleCount = 0;
  private lastW: World | null = null;
  private dollKey = '';
  private face?: HTMLImageElement;
  private faceKey = '';
  /** nächster Versuch für das Brustbild, solange die Sprites noch laden */
  private faceRetryAt = 0;
  /** neu gelernte Fertigkeit: ihr Schnellleisten-Platz pulsiert kurz (Säule 3) */
  private newSkill: { id: string; until: number } | null = null;
  private dollUrl = '';
  private dollWidth = 104;
  private showSaveIo = false;
  /** Laufende Tastenabfrage im Einstellungsfenster (wird beim Start einer neuen beendet) */
  private cancelCapture: (() => void) | null = null;
  private bagFilter: BagFilter = 'all';
  private bagSort: BagSort = 'none';
  /** Handy: gewählter Gegenstand (Tippen statt Ziehen) mit Aktionsleiste */
  private sel: { d: Drag; equipped: Item | undefined } | null = null;
  /** Handy: zeigt das Rucksack-Fenster (true) oder das Händler-/NPC-Fenster (false), wenn beide offen wären */
  private touchMain = true;
  private sideShown = false;
  private tipPanel = false;
  private trackerOpen = false;
  private touchMenu = el('div', 'w-frame');

  constructor(
    private send: (c: Command) => void,
    private useSkillSlot: (i: number) => void,
    private usePotionKind: (kind: 'heal' | 'mana') => void,
    private newGame: () => void,
    private saveIo: { export: () => string; import: (json: string) => boolean } | null = null,
    private slotIo: { list: () => { n: number; label: string; exists: boolean; active: boolean }[]; switchTo: (n: number) => void } | null = null,
    private manualIo: { save: () => void; load: () => void; info: () => string | null } | null = null,
  ) {
    installTheme();
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    Object.assign(this.main.style, { right: '12px', top: '12px', width: '480px' });
    // Höhe bis knapp über den unteren Rand begrenzen (Fenster beginnt unter dem Porträt), Inhalt scrollt im Fenster
    Object.assign(this.side.style, { left: '12px', top: 'calc(var(--tl-h) + 24px)', width: '480px', maxHeight: 'calc(100vh - var(--tl-h) - 36px)', boxSizing: 'border-box', overflowY: 'auto' });

    this.hud.className = 'hud';
    this.hud.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;display:flex;justify-content:center;align-items:flex-end;gap:4px;pointer-events:none;z-index:5';
    const mid = el('div');
    mid.style.cssText = 'display:flex;flex-direction:column;align-items:stretch;gap:8px;pointer-events:none;min-width:0;flex:0 1 auto';
    this.hotbar.style.cssText = 'display:flex;gap:4px;pointer-events:auto;min-height:56px;align-items:flex-end;justify-content:center';
    this.xpBar.style.cssText = 'width:100%;min-width:300px;position:relative;height:16px;box-sizing:border-box';
    this.xpFill.style.cssText = 'background:linear-gradient(180deg,#ffe27a 0 2px,#e8b832 2px calc(100% - 3px),#9a7a1a calc(100% - 3px))';
    this.xpText.style.cssText = 'position:absolute;inset:-2px 4px 0;text-align:center;font:14px var(--ui-font);color:#fff;text-shadow:-1px 0 #131b1b,1px 0 #131b1b,0 -1px #131b1b,0 1px #131b1b;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    this.xpBar.append(this.xpFill, this.xpText);
    this.statusBar.style.cssText = 'display:flex;gap:4px;min-height:20px;pointer-events:none';
    mid.append(this.statusBar, this.hotbar, this.xpBar);
    this.buildOrbs();
    this.hud.append(this.orbHp, mid, this.orbMp);
    this.buildPortrait();

    this.target.className = 'w-frame';
    this.target.style.cssText = 'position:fixed;z-index:4;left:50%;top:8px;transform:translateX(-50%);--bw:6px;font:15px var(--ui-font);padding:0 8px;display:none;text-align:center;min-width:160px;max-width:min(560px,60vw)';
    this.toast.style.cssText = 'position:fixed;z-index:4;left:12px;bottom:112px;width:420px;color:#f1e6c8;font:15px/1.3 var(--ui-font);pointer-events:none;text-shadow:0 1px 2px #000,0 0 4px #000';
    this.tracker.style.cssText = 'position:fixed;right:12px;top:calc(var(--mm-h) + 12px);max-width:260px;text-align:right;color:#f1e6c8;font:15px var(--ui-font);text-shadow:0 1px 4px #000,0 0 2px #000;background:rgba(29,24,16,.7);border-right:3px solid #f06733;padding:6px 10px;pointer-events:auto;z-index:5;display:none';
    this.bannerEl.style.cssText = 'position:fixed;left:50%;top:70px;transform:translateX(-50%);color:#e8d9b0;font:28px var(--ui-font);text-shadow:0 2px 8px #000,0 0 2px #000;letter-spacing:1.5px;opacity:0;transition:opacity .6s;pointer-events:none;z-index:6;text-align:center';
    this.tip.className = 'w-frame tipbox';
    this.tip.style.cssText = 'position:fixed;z-index:50;max-width:290px;--bw:8px;background:#26221a;font:14px/1.4 var(--ui-font);padding:4px 6px;pointer-events:none;display:none;box-shadow:0 4px 16px #000';
    this.hintEl.style.cssText = 'position:fixed;left:12px;top:calc(var(--tl-h) + 20px);z-index:5;color:#a8d8a0;font:14px var(--ui-font);text-shadow:0 1px 3px #000;opacity:0;transition:opacity .5s;pointer-events:none';
    if (isTouch) {
      this.tracker.onclick = (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        this.trackerOpen = !this.trackerOpen;
        this.trackerKey = '';
      };
      Object.assign(this.toast.style, { width: '26vw', bottom: '84px', font: '13px/1.25 var(--ui-font)' });
      this.tracker.style.top = 'max(8px,env(safe-area-inset-top))';
      this.tracker.style.right = 'max(8px,env(safe-area-inset-right))';
      this.bannerEl.style.fontSize = '20px';
      Object.assign(this.xpBar.style, { minWidth: '0', width: '100%', height: '12px' });
      this.hud.id = 't-hud';
      this.hotbar.classList.add('t-hot');
      Object.assign(this.xpText.style, { font: '12px/12px var(--ui-font)', inset: '-1px 4px 0' });
    }
    document.body.append(this.main, this.side, this.hud, this.tl, this.tracker, this.target, this.toast, this.bannerEl, this.tip, this.hintEl);

    if (isTouch) this.buildTouchControls();
    initCredits();
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') this.toggle(false);
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const a = actionFor(e.key);
      if (!a) return;
      if (e.repeat && (a === 'quicksave' || a === 'quickload')) {
        e.preventDefault();
        return;
      }
      if (a === 'inv') this.toggleTab('inv');
      else if (a === 'char') this.toggleTab('char');
      else if (a === 'skills') this.toggleTab('skills');
      else if (a === 'quests') this.toggleTab('quests');
      else if (a === 'ach') this.toggleTab('ach');
      else if (a === 'bestiary') this.toggleTab('best');
      else if (a === 'settings') this.toggleTab('set');
      else if (a === 'rest') this.send({ type: 'rest' });
      else if (a === 'heal') this.usePotionKind('heal');
      else if (a === 'mana') this.usePotionKind('mana');
      else if (a === 'quicksave' || a === 'quickload') {
        e.preventDefault();
        if (a === 'quicksave') this.manualIo?.save();
        else this.confirmLoad();
      }
      else this.useSkillSlot(Number(a.slice(5)) - 1);
    });
  }

  /* ----------------------------------------------------------- Fenster */

  private toggleTab(t: Tab): void {
    if (this.open && this.tab === t && (!isTouch || this.touchMain || !this.sideShown)) this.toggle(false);
    else {
      this.tab = t;
      this.toggle(true);
      this.touchMain = true;
      this.main.classList.remove('a-min');
      this.layout();
    }
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    // Handy: Antippen eines NPCs öffnet dessen Fenster (Rucksack über den Knopf im Titel)
    if (isTouch && this.open) this.touchMain = false;
    this.key = '';
    this.sel = null;
    if (!this.open) this.tip.style.display = 'none';
    this.layout();
  }

  /** Welches Fenster ist sichtbar? Am Laptop beide wie bisher, am Handy nur eines (sonst verdeckt es die Welt). */
  private layout(): void {
    const sideOn = this.sideShown && this.open;
    const showMain = this.open && (!isTouch || this.touchMain || !sideOn);
    this.main.style.display = showMain ? (isTouch ? 'flex' : 'block') : 'none';
    this.side.style.display = sideOn && !(isTouch && showMain) ? (isTouch ? 'flex' : 'block') : 'none';
    // schmaler Bildschirm: Aufgabenanzeige würde unter dem Seitenfenster liegen, solange es offen ist
    this.tracker.style.visibility = this.side.style.display !== 'none' && window.innerWidth < 900 ? 'hidden' : 'visible';
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
    this.msgs = this.msgs.slice(isTouch ? -3 : -6);
    this.toast.replaceChildren(...this.msgs.map((t) => el('div', '', t)));
    // Handy: Meldungen verschwinden nach einigen Sekunden, sonst blockieren sie dauerhaft die linke Bildschirmseite
    if (isTouch) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = window.setTimeout(() => this.say2(), 6000);
    }
  }

  /** Gerahmtes Hinweisfenster (Holzrahmen, Pixelschrift) mit „Verstanden“; ersetzt lange Willkommenstexte im Meldungsprotokoll. */
  welcome(title: string, lines: string[]): void {
    const win = el('div', 'w-frame');
    win.style.cssText = 'position:fixed;z-index:6;left:50%;top:22%;transform:translateX(-50%);width:min(440px,86vw);padding:6px 12px 10px;--bw:10px;pointer-events:auto';
    const h = el('div', '', title);
    h.style.cssText = 'color:var(--gold);font-size:22px;margin-bottom:6px;text-align:center';
    win.append(h, ...lines.map((t) => {
      const d = el('div', '', t);
      d.style.cssText = 'margin:6px 0;line-height:1.3';
      return d;
    }));
    const ok = el('button', 'a-btn', 'Verstanden');
    ok.style.cssText = 'display:block;margin:10px auto 0;padding:0 18px';
    ok.onclick = () => win.remove();
    win.append(ok);
    document.body.append(win);
  }

  private say2(): void {
    this.msgs.shift();
    this.toast.replaceChildren(...this.msgs.map((t) => el('div', '', t)));
    if (this.msgs.length) this.toastTimer = window.setTimeout(() => this.say2(), 2500);
  }

  /* -------------------------------------------------------------- HUD */

  private buildOrbs(): void {
    this.orbParts = { hp: this.barParts(this.orbHp), mp: this.barParts(this.orbMp) };
  }

  private barParts(bar: HTMLElement): { liq: HTMLElement; t: HTMLElement } {
    const liq = el('div', 'liq');
    const t = el('div', 't');
    bar.append(liq, t);
    return { liq, t };
  }

  /** Porträt (Faceset des Ninja-Helden) mit Name, Stufe und Leisten oben links. */
  private buildPortrait(): void {
    this.tl.id = 'hud-tl';
    const fc = el('div', 'fc');
    const face = el('img', 'face') as HTMLImageElement;
    // DCSS: leer (dunkler Grund) bis das Brustbild steht, sonst blitzt kurz das Ninja-Gesicht auf
    if (usesNinja(figureMode()) && heroMode() !== 'skelett') face.src = faceUrl(HERO_BASE);
    face.alt = '';
    this.face = face;
    fc.append(face);
    const hdr = el('div', 'hdr');
    const hp = el('div', 'pbar hp');
    const mp = el('div', 'pbar mp');
    this.tlParts = { hp: this.barParts(hp), mp: this.barParts(mp) };
    hdr.append(this.tlName, this.tlLevel, hp, mp);
    this.tl.append(fc, hdr);
  }

  /** Skelett-Held oder DCSS-Modus: Brustbild (Kopf und Schultern) des Helden mit aktueller Ausrüstung, ganzzahlig skaliert. */
  private updatePortrait(p: Actor): void {
    const face = this.face;
    if (!face || (usesNinja(figureMode()) && heroMode() !== 'skelett')) return;
    const look = lookOf(p);
    const key = lookKey(look, 0, false);
    if (key === this.faceKey || performance.now() < this.faceRetryAt) return;
    const src = playerPortrait(look).canvas;
    const sx = src.getContext('2d');
    if (!sx || !src.width || !src.height) return;
    const data = sx.getImageData(0, 0, src.width, src.height).data;
    let top = src.height, minX = src.width, maxX = -1;
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
      if ((data[(y * src.width + x) * 4 + 3] ?? 0) < 8) continue;
      if (y < top) top = y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    if (maxX < 0) {
      // Sprites noch nicht geladen: in einer halben Sekunde erneut (nicht jeden Frame neu zeichnen und scannen)
      this.faceRetryAt = performance.now() + 500;
      return;
    }
    this.faceKey = key;
    const box = 76;
    const out = document.createElement('canvas');
    out.width = out.height = box;
    const ox = out.getContext('2d')!;
    ox.fillStyle = '#17120f';
    ox.fillRect(0, 0, box, box);
    ox.imageSmoothingEnabled = false;
    const cx = Math.round((minX + maxX) / 2);
    ox.drawImage(src, cx - box / 2, top - 6, box, box, 0, 0, box, box);
    face.src = out.toDataURL();
  }

  /** Lässt den Schnellleisten-Platz einer neu gelernten Fertigkeit pulsieren, sobald sie dort liegt. */
  pulseSkill(id: string): void {
    this.newSkill = { id, until: performance.now() + 3000 };
  }

  update(w: World, p: Actor, target?: Actor): void {
    // Neuer Titel (Stufe oder Kill-Ziel): Banner; beim ersten Blick (Laden) nur merken
    const nt = p.titles?.length ?? 0;
    if (this.lastP === p && nt > this.titleCount) this.banner(`Neuer Titel: „${p.titles![nt - 1]}“`, '#ffd23a');
    this.titleCount = nt;
    this.lastP = p;
    this.updatePortrait(p);
    this.lastW = w;
    this.updateHud(p, target);
    this.updateTracker(w, p);
    const near = w.npcs.filter((n) => Math.hypot(n.x - p.x, n.y - p.y) <= NPC_RANGE);
    const key = JSON.stringify([settings().hotbar, this.open, this.tab, p.inventory, this.bagFilter, this.bagSort, p.equipment, p.stash, p.attrs, p.statPoints, p.skills, p.skillRanks, p.skillPoints, p.freeRespec, p.gold, p.level, p.spec, near.map((n) => n.id), p.quests, p.bounties, p.kills, p.found, p.titles, p.title, p.topics, this.topicView, p.xp > 0, this.board?.map((r) => r.name + r.xp).join(), this.ach?.unlocked.size, this.ach?.stats.kills, this.sel?.d.item.id, this.sel?.d.templateId, this.touchMain]);
    if (key === this.key || this.dragging) return;
    this.key = key;
    if (isTouch && this.sel && !this.selValid(p)) this.sel = null;
    if (this.open) this.renderMain(p);
    this.renderSide(p, this.open ? near : []);
    this.layout();
  }

  /** Dauerhafte Aufgabenanzeige oben links: bis zu 3 laufende Aufgaben mit Ziel und Ort. */
  private updateTracker(w: World, p: Actor): void {
    const act = QUESTS.filter((q) => p.quests[q.id] && p.quests[q.id]!.state !== 'turned');
    act.sort((a, b) => Number(p.quests[b.id]!.state === 'done') - Number(p.quests[a.id]!.state === 'done'));
    const shown = act.slice(0, 3);
    const step = this.step;
    const key = JSON.stringify([shown.map((q) => [q.id, p.quests[q.id]]), step?.text, this.trackerOpen]);
    if (key === this.trackerKey) return;
    this.trackerKey = key;
    this.tracker.replaceChildren();
    this.tracker.classList.toggle('tr-fold', isTouch && !this.trackerOpen);
    this.tracker.classList.toggle('tr-open', isTouch && this.trackerOpen);
    this.tracker.style.display = shown.length || step ? 'block' : 'none';
    if (step) {
      const row = el('div');
      row.style.cssText = 'margin:0 0 6px;padding-bottom:5px;border-bottom:1px solid #6b5a48';
      const head = el('div', '', '▶ Nächster Schritt');
      head.style.cssText = 'font-weight:bold;color:#ffcf6a;font-size:14px;letter-spacing:.5px';
      const txt = el('div', '', step.text);
      row.append(head, txt);
      if (step.x !== undefined && step.y !== undefined) {
        const go = el('button', 'a-btn', 'Hinlaufen');
        go.style.cssText = 'margin-top:4px;font-size:13px;padding:2px 8px;cursor:pointer';
        go.onclick = () => this.send({ type: 'moveTo', x: Math.round(step.x!), y: Math.round(step.y!) });
        row.append(go);
      }
      this.tracker.append(row);
    }
    for (const q of shown) {
      const done = p.quests[q.id]!.state === 'done';
      const row = el('div');
      row.style.margin = '2px 0';
      const title = el('div', '', q.name);
      title.style.cssText = `font-weight:bold;color:${done ? '#6fe08a' : '#e8d9b0'}`;
      const goal = el('div', '', done ? 'Fertig – beim Auftraggeber abgeben' : this.questGoal(q, p));
      goal.style.opacity = '.85';
      row.append(title, goal);
      const where = questWhere(w, q, done);
      if (where) { const wh = el('div', '', where); wh.style.cssText = 'opacity:.6;font-size:14px'; row.append(wh); }
      this.tracker.append(row);
    }
    if (act.length > shown.length) { const more = el('div', '', `+${act.length - shown.length} weitere (J)`); more.style.cssText = 'opacity:.6;font-size:14px'; this.tracker.append(more); }
  }

  private updateHud(p: Actor, t?: Actor): void {
    const o = this.orbParts!;
    const hpMax = maxHpOf(p);
    const mpMax = maxManaOf(p);
    const hpFrac = `${Math.max(0, Math.min(1, p.hp / hpMax)) * 100}%`;
    const mpFrac = `${Math.max(0, Math.min(1, p.mana / mpMax)) * 100}%`;
    const hpTxt = `${Math.ceil(p.hp)}/${hpMax}`;
    const mpTxt = `${Math.floor(p.mana)}/${mpMax}`;
    for (const parts of [o, this.tlParts!]) {
      parts.hp.liq.style.width = hpFrac;
      parts.mp.liq.style.width = mpFrac;
      if (parts.hp.t.textContent !== hpTxt) parts.hp.t.textContent = hpTxt;
      if (parts.mp.t.textContent !== mpTxt) parts.mp.t.textContent = mpTxt;
    }
    const specName = p.spec ? SPECS.find((x) => x.id === p.spec)?.name : '';
    const lvTxt = `Stufe ${p.level}${specName ? ` · ${specName}` : ''}`;
    if (this.tlName.textContent !== p.name) this.tlName.textContent = p.name;
    if (this.tlLevel.textContent !== lvTxt) this.tlLevel.textContent = lvTxt;
    this.orbHp.title = `Leben ${Math.ceil(p.hp)}/${hpMax}`;
    this.orbMp.title = `Mana ${Math.floor(p.mana)}/${mpMax}`;

    const span = totalXpFor(Math.min(p.level + 1, MAX_LEVEL)) - totalXpFor(p.level);
    const into = Math.max(0, p.xp - totalXpFor(p.level));
    const frac = p.level >= MAX_LEVEL ? 1 : Math.min(1, into / Math.max(1, span));
    this.xpFill.style.width = `${frac * 100}%`;
    // offene Punkte: Leiste pulsiert, damit Neulinge sie nicht übersehen
    this.xpBar.classList.toggle('pulse', p.statPoints > 0 || p.skillPoints > 0);
    const load = carriedWeight(p) / Math.max(1, carryCapacity(p));
    const heavy = load >= 0.9;
    const narrow = window.innerWidth < 900;
    this.xpText.textContent = `Stufe ${p.level} · ${p.level >= MAX_LEVEL ? 'Maximum' : `${into} / ${span} XP`} · ${p.gold} Gold${p.statPoints ? ` · ${p.statPoints} ${narrow ? 'AP' : 'Attributpunkte'} (C)` : ''}${p.skillPoints ? ` · ${p.skillPoints} ${narrow ? 'SP' : 'Skillpunkte'} (K)` : ''}${heavy ? ` · Last ${carriedWeight(p).toFixed(0)}/${carryCapacity(p)}` : ''}`;
    this.xpText.style.color = heavy ? '#ffb0a0' : '#fff';
    this.xpBar.title = this.xpText.textContent;

    // Schnellleiste: Tränke (Q/E) und Skills (1–9); Elemente bleiben bestehen, nur Zustand wird aktualisiert
    const act = hotbarFor(p);
    const hk = act.join(',');
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
      this.hotButtons = act.map((id, i) => {
        if (!id) {
          const e = el('div', 'hb');
          e.style.opacity = '.35';
          e.title = 'Leer – im Fertigkeiten-Fenster (K) einen Zauber auf diesen Platz legen';
          e.append(el('div', 'k', String(i + 1)));
          this.hotbar.append(e);
          return { el: e, cd: el('div'), txt: el('div') };
        }
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
    if (this.newSkill) {
      const i = act.indexOf(this.newSkill.id);
      if (performance.now() > this.newSkill.until) this.newSkill = null;
      else if (i >= 0 && this.hotButtons[i] && !this.hotButtons[i]!.el.classList.contains('hb-new')) this.hotButtons[i]!.el.classList.add('hb-new');
    }
    const count = (k: 'heal' | 'mana') => p.inventory.filter((i) => i.slot === 'potion' && i[k] !== undefined).length;
    for (const k of ['heal', 'mana'] as const) {
      const cnt = this.potionBtns![k].querySelector('.cnt') as HTMLElement;
      const n = count(k);
      if (cnt.textContent !== String(n)) cnt.textContent = String(n);
      this.potionBtns![k].style.opacity = n ? '1' : '.45';
    }
    act.forEach((id, i) => {
      if (!id) return;
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
    const chips: [string, string, number, StatusId | 'poison'][] = [];
    for (const id of STATUS_IDS) if (p.status?.[id] && p.status[id]! > now) chips.push([STATUS_NAME[id], STATUS_COLOR[id], Math.ceil((p.status[id]! - now) / TICK_RATE), id]);
    if (p.dot && p.dot.until > now) chips.push(['Gift', DMG_COLOR.poison, Math.ceil((p.dot.until - now) / TICK_RATE), 'poison']);
    const ck = JSON.stringify(chips);
    if (ck !== this.statusKey) {
      this.statusKey = ck;
      this.statusBar.replaceChildren(...chips.map(([n, c, sec, id]) => {
        const d = el('div');
        d.style.cssText = `font:13px var(--ui-font);padding:1px 6px 1px 3px;border:1px solid ${c};color:${c};background:rgba(10,8,14,.85);border-radius:3px;display:flex;align-items:center;gap:3px`;
        const ic = document.createElement('img');
        ic.src = statusIcon(id);
        ic.alt = '';
        ic.style.cssText = 'width:14px;height:14px;image-rendering:pixelated';
        d.append(ic, document.createTextNode(`${n} ${sec}`));
        return d;
      }));
    }

    if (t && t.alive && t.kind === 'monster') {
      this.target.style.display = 'block';
      const k = monsterKind(t.kindId!);
      const mod = t.champ ? { swift: 'sehr schnell', armored: 'sehr zäh', fiery: 'setzt in Brand', vampiric: 'heilt sich durch Treffer', thorned: 'wirft Schaden zurück' }[t.champ] : '';
      this.target.textContent = `${t.name} (Stufe ${k.level}) ${Math.ceil(t.hp)}/${t.maxHp}${mod ? ` – ${mod}` : t.unique ? (uniqueDef(t.unique)?.world ? ' – Weltboss' : ' – Mini-Boss') : ''}${resNote(k.family)}`;
    } else this.target.style.display = 'none';
  }

  /* ----------------------------------------------------------- Handy */

  /** Gewählter Gegenstand ist noch da? (Nach Anlegen, Verkauf usw. ändern sich die Listen.) */
  private selValid(p: Actor): boolean {
    const s = this.sel;
    if (!s) return true;
    const id = s.d.item.id;
    if (s.d.from === 'bag') return p.inventory.some((i) => i.id === id);
    if (s.d.from === 'equip') return Object.values(p.equipment).some((i) => i?.id === id);
    if (s.d.from === 'stash') return p.stash.some((i) => i.id === id);
    return true;
  }

  /** Handy: Aktionsleiste unter dem Fenster für den angetippten Gegenstand (statt Ziehen und Doppelklick). */
  private selPanel(p: Actor): HTMLElement | null {
    const s = this.sel;
    if (!isTouch || !s) return null;
    const { d } = s;
    const box = el('div', 'a-sel tipbox');
    this.tipPanel = true;
    this.showTip(d.item, s.equipped, { clientX: 0, clientY: 0 } as MouseEvent);
    this.tipPanel = false;
    for (const n of Array.from(this.tip.childNodes)) box.append(n.cloneNode(true));
    this.tip.style.display = 'none';
    const acts = el('div', 'a-acts');
    const add = (label: string, fn: () => void, off = false) => {
      const b = el('button', `a-btn${off ? ' off' : ''}`, label) as HTMLButtonElement;
      b.onclick = () => {
        fn();
        this.sel = null;
        this.key = '';
      };
      acts.append(b);
    };
    const w = this.lastW;
    const merchant = !!w && !!nearNpc(w, p, 'merchant');
    const stash = !!w && !!nearNpc(w, p, 'stash');
    if (d.from === 'bag') {
      add(d.item.slot === 'potion' ? 'Benutzen' : 'Anlegen', () => this.send(d.item.slot === 'potion' ? { type: 'usePotion', itemId: d.item.id } : { type: 'equip', itemId: d.item.id }));
      if (merchant) add('Verkaufen', () => this.perform(d, 'sell'));
      if (stash) add('In die Truhe', () => this.perform(d, 'stash'));
      add('Wegwerfen', () => this.perform(d, null));
    } else if (d.from === 'equip') add('Ablegen', () => this.send({ type: 'unequip', slot: d.slot! }));
    else if (d.from === 'stash') add('Nehmen', () => this.perform(d, 'bag'));
    else add('Kaufen', () => this.perform(d, 'bag'));
    const close = el('button', 'a-btn', 'Zurück') as HTMLButtonElement;
    close.onclick = () => {
      this.sel = null;
      this.key = '';
    };
    acts.append(close);
    box.append(acts);
    return box;
  }

  /** Handy: Bedienleiste unten rechts (Rasten, Rucksack, Menü) und ausklappbares Menü mit den übrigen Fenstern. */
  private buildTouchControls(): void {
    const bar = el('div');
    bar.id = 't-bar';
    this.touchMenu.id = 't-menu';
    const mk = (label: string, fn: () => void) => {
      const b = el('button', 't-btn', label);
      b.onclick = () => {
        fn();
        if (label !== 'Menü') this.touchMenu.classList.remove('open');
      };
      return b;
    };
    const win = (t: Tab) => () => this.toggleTab(t);
    this.touchMenu.append(
      mk('Charakter', win('char')), mk('Fertigkeiten', win('skills')),
      mk('Aufgaben', win('quests')), mk('Bestiarium', win('best')), mk('Erfolge', win('ach')),
      mk('Karte', () => window.dispatchEvent(new CustomEvent('aschenthron:map'))), mk('Einstellungen', win('set')),
      mk('Speichern', () => this.manualIo?.save()), mk('Laden', () => this.confirmLoad()),
      mk('Vollbild', () => {
        if (isFullscreen()) this.say('Schon im Vollbild.');
        else if (!goFullscreen()) this.say('iPhone: In Safari auf Teilen tippen, „Zum Home-Bildschirm“ wählen und das Spiel von dort starten – dann ohne Adressleiste.');
      }),
      mk('Zoom +', () => window.dispatchEvent(new CustomEvent('aschenthron:zoom', { detail: 1.2 }))),
      mk('Zoom −', () => window.dispatchEvent(new CustomEvent('aschenthron:zoom', { detail: 1 / 1.2 }))),
    );
    const menu = mk('Menü', () => this.touchMenu.classList.toggle('open'));
    bar.append(this.touchMenu, mk('Rasten', () => this.send({ type: 'rest' })), mk('Rucksack', win('inv')), menu);
    document.body.append(bar);
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
    if (this.dragging || (isTouch && !this.tipPanel)) return;
    const box = this.tip;
    box.replaceChildren();
    box.append(el('div', 'tp-name', it.name));
    const rar = (it.named ? 'Benannter Fund · ' : '') + { normal: 'Normal', magic: 'Magisch', rare: 'Selten', set: 'Set', legendary: 'Legendär' }[it.rarity];
    const slotName = it.slot === 'potion' ? 'Trank' : it.slot === 'gem' ? 'Edelstein' : it.off === 'arrows' ? 'Pfeile' : it.off === 'shield' ? 'Schild' : SLOT_NAME[it.slot];
    const baseName = it.slot !== 'potion' && it.slot !== 'gem' && (it.rarity === 'rare' || it.named) ? templateById(it.templateId).name : '';
    const sub = el('div');
    const rarEl = el('span', '', rar);
    rarEl.style.color = RARITY_COLOR[it.rarity];
    sub.append(rarEl, ` · ${slotName}${baseName ? ` (${baseName})` : ''}`);
    box.append(sub);
    // gewürfelte Affixe und Sockel zeigt der Block darunter (mit Stufe bzw. Edelstein), nicht doppelt
    const tmpl = it.slot === 'potion' || it.slot === 'gem' ? undefined : templateById(it.templateId);
    const skip = new Set(it.affixes.slice(tmpl?.base?.length ?? 0).map((a) => affixText(a)));
    for (const part of describeItem(it).split(' · ')) {
      if (part.startsWith('Benötigt ') || skip.has(part) || (it.sockets?.length && part.startsWith('Sockel '))) continue;
      // Primärwerte violett (Schaden groß), Boni grün, Set orange, Gewicht/Build gedämpft
      const cls = part.startsWith('Schaden ') ? 'tp-big' : /^(Rüstung |Heilt |Stellt |Pfeile |Einhand|Zweihand|Teleportiert)/.test(part) ? 'tp-pri' : part.startsWith('Set: ') ? 'tp-set' : /^(Gewicht |Build: )/.test(part) ? 'tp-dim' : 'tp-bonus';
      box.append(el('div', cls, part));
    }
    if (it.affixes.length && it.slot !== 'potion' && it.slot !== 'gem') {
      const t = templateById(it.templateId);
      const base = t.base?.length ?? 0;
      const q = el('div');
      q.style.cssText = 'margin-top:4px;font-size:13px';
      it.affixes.slice(base).forEach((a) => {
        let line: HTMLElement;
        if (it.named || it.unique) {
          // feste Werte (benannte Funde, Unikate): kein Wurf
          line = el('div', '', affixText(a));
          line.style.color = '#8fd890';
        } else if (a.tier) {
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
    const lore = it.named ? NAMED.find((d) => d.id === it.named)?.lore : undefined;
    if (lore) {
      const l = el('div', 'tp-dim', `„${lore}“`);
      l.style.cssText = 'margin-top:4px;font-style:italic';
      box.append(l);
    }
    if (it.sockets?.length) {
      const sk = el('div');
      sk.style.cssText = 'margin-top:4px;font-size:13px';
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
      // Gesamturteil: grobe Wertung beider Stücke (Effekte zählen mit ihrer Stärke)
      const sa = gearScore(it);
      const sb = gearScore(equipped);
      const pct = sb > 0 ? Math.round(((sa - sb) / sb) * 100) : 0;
      const verdict = el('div', '', Math.abs(pct) < 5 ? 'Gesamt: etwa gleichwertig' : pct > 0 ? `Gesamt: Verbesserung (≈ +${pct} %)` : `Gesamt: Verschlechterung (≈ ${pct} %)`);
      verdict.style.cssText = `font-weight:bold;color:${Math.abs(pct) < 5 ? '#d4c4a8' : pct > 0 ? '#6fe08a' : '#ff7a6a'}`;
      box.append(verdict);
      if (it.power?.id !== equipped.power?.id && (it.power || equipped.power)) {
        const eff = el('div', '', `Effekt: ${equipped.power ? POWER_TEXT[equipped.power.id](equipped.power.value) : 'keiner'} → ${it.power ? POWER_TEXT[it.power.id](it.power.value) : 'keiner'}`);
        eff.style.cssText = 'color:#e8c888;font-size:13px';
        box.append(eff);
      }
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
    if (isTouch) {
      const same = this.sel && this.sel.d.from === d.from && this.sel.d.item.id === d.item.id && this.sel.d.templateId === d.templateId;
      if (same) e.classList.add('sel');
      e.onclick = () => {
        this.sel = same ? null : { d, equipped };
        this.key = '';
      };
      return;
    }
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
      // Seltenheit als Innenring in der Ninja-Inventarzelle (border-image ignoriert border-color)
      const rc = RARITY_COLOR[item.rarity];
      s.style.setProperty('--rc', rc);
      s.style.boxShadow = item.rarity !== 'normal' ? `inset 0 0 0 2px ${rc}, inset 0 0 8px ${rc}99` : `inset 0 0 0 2px ${rc}66`;
      s.append(Object.assign(el('img'), { src: itemIcon(item) }));
    }
    return s;
  }

  private renderMain(p: Actor): void {
    this.tip.style.display = 'none'; // Inhalt wird neu aufgebaut: ein hängender Tooltip würde auf nichts mehr zeigen
    const tabs = el('div', 'a-tabs');
    for (const [id, label] of ([['inv', 'Inventar', 'inv'], ['char', 'Charakter', 'char'], ['skills', 'Fertigkeiten', 'skills'], ['quests', 'Aufgaben', 'quests'], ['best', 'Bestiarium', 'bestiary'], ['ach', 'Erfolge', 'ach'], ['set', 'Einstellungen', 'settings']] as [Tab, string, Parameters<typeof keyOf>[0]][]).map(([id, name, act]): [Tab, string] => [id, isTouch ? name : `${name} (${keyLabel(keyOf(act))})`])) {
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
    else if (this.tab === 'ach') this.renderAch(body);
    else if (this.tab === 'best') this.renderBestiary(body, p);
    else if (this.tab === 'set') this.renderSettings(body);
    else {
      this.renderQuests(body, p);
      this.renderHunts(body, p);
    }
    const toNpc = isTouch && this.sideShown ? [Object.assign(el('span', 'a-x', 'Händler'), { onclick: () => { this.touchMain = false; this.sel = null; this.key = ''; this.layout(); } })] : [];
    for (const b of toNpc) b.style.cssText = 'font-size:15px;padding:0 10px;display:flex;align-items:center;border-left:1px solid #4b3f3a';
    const title = titleBar(`${p.name}${p.title ? ` „${p.title}“` : ''} · Stufe ${p.level}`, this.main, () => this.toggle(false), toNpc);
    this.main.replaceChildren(...[title, tabs, body, this.selPanel(p)].filter((x): x is HTMLElement => !!x));
  }

  private dollImage(p: Actor): { url: string; width: number } {
    const look = lookOf(p);
    const key = lookKey(look, 0, false);
    if (key !== this.dollKey) {
      this.dollKey = key;
      const portrait = playerPortrait(look);
      this.dollUrl = portrait.canvas.toDataURL();
      this.dollWidth = portrait.width;
    }
    return { url: this.dollUrl, width: this.dollWidth };
  }

  private renderInventory(body: HTMLElement, p: Actor): void {
    // Figur mit Ausrüstungsfeldern
    const doll = el('div', 'a-doll');
    doll.dataset.drop = 'bag';
    const portrait = this.dollImage(p);
    const me = Object.assign(el('img', 'me'), { src: portrait.url });
    me.style.width = `${portrait.width}px`;
    doll.append(me);
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
    const bagBar = el('div');
    bagBar.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin:2px 0 6px';
    const FILTERS: [BagFilter, string][] = [['all', 'Alle'], ['weapon', 'Waffen'], ['armor', 'Rüstung'], ['potion', 'Tränke'], ['other', 'Sonstiges']];
    for (const [id, label] of FILTERS) {
      const b = el('button', `a-btn${this.bagFilter === id ? ' off' : ''}`, label) as HTMLButtonElement;
      b.onclick = () => {
        this.bagFilter = id;
        this.key = '';
      };
      bagBar.append(b);
    }
    const SORTS: [BagSort, string][] = [['none', 'Sortieren: aus'], ['slot', 'Sortieren: Art'], ['rarity', 'Sortieren: Seltenheit'], ['value', 'Sortieren: Wert']];
    const sb = el('button', 'a-btn', SORTS.find((x) => x[0] === this.bagSort)![1]) as HTMLButtonElement;
    sb.onclick = () => {
      this.bagSort = SORTS[(SORTS.findIndex((x) => x[0] === this.bagSort) + 1) % SORTS.length]![0];
      this.key = '';
    };
    bagBar.append(sb);
    body.append(bagBar);
    const grid = el('div', 'a-grid a-drop');
    grid.dataset.drop = 'bag';
    // Tränke gleicher Art stapeln (ein Slot, Anzahl als Zahl)
    const stacks: { item: Item; n: number }[] = [];
    const RARITY_RANK: Record<string, number> = { normal: 0, magic: 1, rare: 2, set: 3, legendary: 4 };
    const kindOf = (it: Item): BagFilter =>
      it.slot === 'potion' ? 'potion' : it.slot === 'weapon' ? 'weapon' : ['head', 'chest', 'legs', 'hands', 'feet', 'cloak', 'belt', 'offhand'].includes(it.slot) ? 'armor' : 'other';
    const shown = p.inventory.filter((it) => this.bagFilter === 'all' || kindOf(it) === this.bagFilter);
    if (this.bagSort === 'slot') shown.sort((a, b) => a.slot.localeCompare(b.slot) || b.value - a.value);
    else if (this.bagSort === 'rarity') shown.sort((a, b) => (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0) || b.value - a.value);
    else if (this.bagSort === 'value') shown.sort((a, b) => b.value - a.value);
    for (const it of shown) {
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
          up.style.cssText = 'right:auto;left:3px;bottom:auto;top:1px;color:#6fe08a;font-size:14px';
          s.append(up);
        } else if (isDowngrade(p, it)) {
          const dn = el('div', 'n', '▼');
          dn.style.cssText = 'right:auto;left:3px;bottom:auto;top:1px;color:#ff7a6a;font-size:14px';
          s.append(dn);
        }
        this.makeDraggable(s, { item: it, from: 'bag' }, equippedFor(p, it), () =>
          this.send(it.slot === 'potion' ? { type: 'usePotion', itemId: it.id } : { type: 'equip', itemId: it.id }),
        );
      }
      grid.append(s);
    }
    body.append(grid);
    // Quest-Gegenstände (gesammelte Sammelaufgaben): nur Anzeige, zählen nicht zum Gewicht, nicht verkaufbar
    const qitems = QUESTS.filter((q) => q.kind === 'bring' && p.quests[q.id] && p.quests[q.id]!.state !== 'turned');
    if (qitems.length) {
      body.append(el('div', 'a-sec', 'Quest-Gegenstände'));
      for (const q of qitems) {
        const st = p.quests[q.id]!;
        const row = el('div', 'a-card', `${q.item ?? 'Gegenstand'} × ${Math.min(st.progress, q.count)}/${q.count}`);
        row.style.color = '#ffe8a0';
        row.title = 'Quest-Gegenstand – nicht verkaufbar, geht beim Tod nicht verloren';
        row.append(el('span', 'a-note', ` · ${q.name}`));
        body.append(row);
      }
    }
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
      const thLine = el('div', 'a-note', `ab ${ATTR_THRESHOLD}: +${th.pct} % ${th.text}${reached ? ' (aktiv)' : ''} · ab ${ATTR_THRESHOLD_2}: doppelt${p.attrs[k] >= ATTR_THRESHOLD_2 ? ' (aktiv)' : ''}`);
      thLine.style.color = reached ? '#6fe08a' : '#9a8a70';
      thLine.style.opacity = '1';
      left.append(el('div', '', `${ATTR_NAME[k]}: ${p.attrs[k]}`), el('div', 'a-note', help[k]), thLine);
      row.append(left);
      const b = el('button', `a-btn${p.statPoints ? '' : ' off'}`, '+');
      b.onclick = () => p.statPoints > 0 && this.send({ type: 'spendStat', attr: k });
      row.append(b);
      body.append(row);
    }
    // Titel (Stufen-Meilensteine, Kill-Ziele): einer wird im Namen gezeigt
    body.append(el('div', 'a-sec', 'Titel'));
    if (!p.titles?.length) body.append(el('div', 'a-note', `Noch keiner. Titel gibt es ab Stufe 10 und für ${KILL_GOALS[0]} Kills einer Gegnergruppe (Bestiarium).`));
    else {
      const row = el('div');
      row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
      for (const t of p.titles) {
        const b = el('button', `a-btn${p.title === t ? '' : ' off'}`, t);
        b.onclick = () => this.send({ type: 'setTitle', title: p.title === t ? null : t });
        row.append(b);
      }
      body.append(row, el('div', 'a-note', 'Klick wählt den gezeigten Titel, nochmal Klick legt ihn ab.'));
    }
    // Meisterschaft (ab Stufe 20): eine dauerhafte Weichenstellung
    if (p.level >= SPEC_LEVEL) {
      body.append(el('div', 'a-sec', 'Meisterschaft'));
      if (p.spec) {
        const cur = SPECS.find((x) => x.id === p.spec);
        body.append(el('div', '', cur?.name ?? ''), el('div', 'a-note', `${cur?.text ?? ''} Zurücksetzen beim Lehrer (Neuverteilen).`));
      } else {
        body.append(el('div', 'a-note', 'Wähle einen Pfad. Die Wahl gilt, bis du beim Lehrer alles neu verteilst.'));
        for (const sp of SPECS) {
          const c = el('div', 'a-card');
          c.style.display = 'block';
          const b = el('button', 'a-btn', `${sp.name} wählen`);
          b.onclick = () => this.send({ type: 'chooseSpec', spec: sp.id });
          c.append(el('div', '', sp.name), el('div', 'a-note', sp.text), b);
          body.append(c);
        }
      }
    }
    // Buildprofil: Einschätzung, welchem Archetyp der Charakter ähnelt (keine Klassen, nur Hinweis)
    const prof = buildProfile(p);
    body.append(el('div', 'a-sec', 'Buildprofil'));
    if (!prof.primary) body.append(el('div', 'a-note', 'Noch unspezialisiert: Verteile Attribute, lerne Fertigkeiten und rüste Ausrüstung aus, dann zeigt sich dein Stil.'));
    else {
      body.append(el('div', '', prof.secondary ? `Hybrid: ${prof.primary.name} + ${prof.secondary.name}` : prof.primary.name));
      body.append(el('div', 'a-note', `Passt am besten: ${prof.primary.tip}`));
      if (prof.secondary) body.append(el('div', 'a-note', `Zweite Richtung: ${prof.secondary.tip}`));
      body.append(el('div', 'a-note', `Weitere: ${prof.scores.slice(prof.secondary ? 2 : 1, 4).filter((x) => x.score >= 20).map((x) => `${x.arch.name} ${x.score}`).join(' · ') || '–'}`));
    }
    body.append(el('div', 'a-sec', 'Werte'));
    const rows: [string, string][] = [
      ['Leben', `${Math.ceil(p.hp)} / ${maxHpOf(p)}`], ['Mana', `${Math.floor(p.mana)} / ${maxManaOf(p)}`], ['Schaden pro Hieb', `${lo}–${hi}`],
      ['Rüstung', String(armorOf(p))], ['Angriffstempo', `${(TICK_RATE / attackCooldownOf(p)).toFixed(2)} Hiebe/s`],
      ['Tragkraft', `${carriedWeight(p).toFixed(1)} / ${carryCapacity(p)}`],
      ['Feuerwiderstand', `${resistOf(p, 'fire')} %`], ['Frostwiderstand', `${resistOf(p, 'frost')} %`], ['Giftwiderstand', `${resistOf(p, 'poison')} %`],
      ['Kritisch', `${critChance(p)} %`], ['Lebensraub', `${powerOf(p, 'lifesteal')} %`], ['Dornen', `${powerOf(p, 'thorns')} %`],
    ];
    // Build-Werte aus Ausrüstung und Fertigkeiten: nur anzeigen, wenn sie wirken
    const signed = (v: number, unit = '%') => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 10) / 10)} ${unit}`;
    const buildRows: [string, number][] = [
      ['Parieren', parryChance(p)], ['Feuerzauber', gearStat(p, 'spellFire')], ['Frostzauber', gearStat(p, 'spellFrost')], ['Heilkraft', gearStat(p, 'healPower')],
      ['Manakosten', gearStat(p, 'manaCost') - passiveSum(p, 'manaCost')], ['Kontrolldauer', gearStat(p, 'ctrl')], ['Bewegung', gearStat(p, 'move')],
    ];
    for (const [label, v] of buildRows) if (v !== 0) rows.push([label, signed(v)]);
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
          const txt = [...(b.affixes ?? []).map((a) => affixText(a)), ...(b.power ? [POWER_TEXT[b.power.id](b.power.value)] : [])].join(', ');
          body.append(el('div', 'a-note', `${n} Teile: ${txt}`));
        }
      }
    }
    const nb = el('button', 'a-btn', 'Neues Spiel (löscht Spielstand)');
    nb.style.marginTop = '14px';
    nb.onclick = () => {
      if (confirm('Spielstand wirklich löschen und neu beginnen?')) this.newGame();
    };
    const cb = el('button', 'a-btn', 'Credits (F1)');
    cb.style.margin = '14px 0 0 8px';
    cb.onclick = () => toggleCredits();
    body.append(nb, cb);
    if (this.saveIo) this.renderSaveIo(body);
  }

  private renderSettings(body: HTMLElement): void {
    const cfg = settings();
    if (this.manualIo) {
      const mio = this.manualIo;
      body.append(el('div', 'a-sec', 'Speichern und Laden'));
      const info = mio.info();
      body.append(el('div', 'a-note', `Das Spiel speichert auch von selbst. Mit „Jetzt speichern“ legst du einen Spielstand ab, zu dem du jederzeit zurückkehren kannst (${keyLabel(keyOf('quicksave'))} speichern, ${keyLabel(keyOf('quickload'))} laden). ${info ? `Gespeichert: ${info}` : 'Noch nichts gespeichert.'}`));
      const mr = el('div');
      mr.style.cssText = 'display:flex;gap:6px;margin:6px 0';
      const sv = el('button', 'a-btn', 'Jetzt speichern') as HTMLButtonElement;
      sv.onclick = () => {
        mio.save();
        this.key = '';
      };
      const ld = el('button', `a-btn${info ? '' : ' off'}`, 'Gespeicherten Stand laden') as HTMLButtonElement;
      if (info) ld.onclick = () => this.confirmLoad();
      mr.append(sv, ld);
      body.append(mr);
    }
    body.append(el('div', 'a-sec', 'Tipps für den Anfang'));
    for (const t of [
      'Klick auf den Boden: laufen. Klick auf einen Gegner: angreifen. Pfeiltasten laufen auch.',
      'Oben rechts steht dein nächster Schritt; „Hinlaufen“ führt dich dorthin.',
      `C: Attribute verteilen · K: Fertigkeiten lernen · ${keyLabel(keyOf('heal'))}/${keyLabel(keyOf('mana'))}: Tränke · ${keyLabel(keyOf('rest'))}: rasten · 1–9: Fertigkeiten.`,
      'Gegenstände im Rucksack: Doppelklick legt an oder benutzt, Ziehen verschiebt. Ein grünes ▲ zeigt eine Verbesserung.',
      'Stirbst du, erwachst du in der Stadt. Bis Stufe 5 kostet es nichts, danach XP und Gold (5 %, ab Stufe 11 je 10 %) und ein paar Rucksack-Gegenstände, die 5 Minuten an der Todesstelle liegen. Angelegtes, Tränke und benannte Funde bleiben.',
      'Ist der Rucksack zu schwer: verkaufen, einlagern (Lager-Truhe) oder Kraft steigern.',
    ]) body.append(el('div', 'a-note', `• ${t}`));
    body.append(el('div', 'a-sec', 'Anzeige und Ton'));
    const row = (label: string, ctl: HTMLElement): void => {
      const r = el('div', 'a-row');
      r.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin:4px 0';
      r.append(el('span', '', label), ctl);
      body.append(r);
    };
    const toggle = (label: string, on: boolean, set: (v: boolean) => void): void => {
      const b = el('button', 'a-btn', on ? 'An' : 'Aus') as HTMLButtonElement;
      b.onclick = () => {
        set(!on);
        this.key = '';
      };
      row(label, b);
    };
    const vol = Object.assign(document.createElement('input'), { type: 'range', min: '0', max: '100', value: String(Math.round(cfg.volume * 100)) });
    vol.oninput = () => setSetting('volume', Number(vol.value) / 100);
    row('Lautstärke', vol);
    toggle('Schadenszahlen', cfg.dmgNumbers, (v) => setSetting('dmgNumbers', v));
    toggle('Namen über Figuren', cfg.labels, (v) => setSetting('labels', v));
    toggle('Schnell aufheben (Tränke, Edelsteine, Pfeile)', cfg.autoPickup, (v) => setSetting('autoPickup', v));
    // Figuren-Vergleich: Mix (halb Ninja, halb DCSS), nur Ninja, nur DCSS (wirkt nach dem Neuladen)
    const figNow = figureMode();
    const figLabel = (m: typeof figNow): string => (m === figNow ? FIG_LABEL[m] : `${FIG_LABEL[m]} (neu laden)`);
    const figBtn = el('button', 'a-btn', figLabel(savedFigureMode())) as HTMLButtonElement;
    figBtn.onclick = () => {
      const next = FIG_MODES[(FIG_MODES.indexOf(savedFigureMode()) + 1) % FIG_MODES.length]!;
      setFigureMode(next);
      figBtn.textContent = figLabel(next);
    };
    row('Figuren: Mix / Ninja / DCSS (F5 zum Übernehmen)', figBtn);

    body.append(el('div', 'a-sec', 'Tastenbelegung'));
    body.append(el('div', 'a-note', 'Auf eine Taste klicken, dann die neue Taste drücken. Esc bricht ab. M (Ton), U (Musik), N (Karte) und die Pfeiltasten sind fest.'));
    const msg = el('div', 'a-note');
    msg.style.color = '#ff9a8a';
    const grid = el('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-top:6px';
    for (const a of ACTIONS) {
      const r = el('div');
      r.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:6px';
      const b = el('button', 'a-btn', keyLabel(keyOf(a.id))) as HTMLButtonElement;
      b.style.minWidth = '64px';
      b.onclick = () => {
        this.cancelCapture?.();
        b.textContent = 'Taste drücken …';
        setCapturing(true);
        const done = (e: KeyboardEvent): void => {
          e.preventDefault();
          e.stopImmediatePropagation();
          // reine Umschalttasten ignorieren und weiter auf die eigentliche Taste warten
          if (['shift', 'control', 'alt', 'altgraph', 'meta', 'capslock', 'dead', 'os', 'fn'].includes(e.key.toLowerCase())) return;
          window.removeEventListener('keydown', done, true);
          this.cancelCapture = null;
          setCapturing(false);
          if (e.key !== 'Escape') {
            const err = rebind(a.id, e.key);
            msg.textContent = err ?? '';
          }
          this.key = '';
        };
        window.addEventListener('keydown', done, true);
        this.cancelCapture = () => {
          window.removeEventListener('keydown', done, true);
          this.cancelCapture = null;
          setCapturing(false);
        };
      };
      r.append(el('span', '', a.label), b);
      grid.append(r);
    }
    body.append(grid, msg);
    const rs = el('button', 'a-btn', 'Tasten zurücksetzen') as HTMLButtonElement;
    rs.style.marginTop = '6px';
    rs.onclick = () => {
      resetKeys();
      this.key = '';
    };
    body.append(rs);

    if (this.slotIo) {
      body.append(el('div', 'a-sec', 'Speicherplätze'));
      body.append(el('div', 'a-note', 'Jeder Platz hat einen eigenen Spielstand. Beim Wechsel wird der aktuelle zuerst gesichert und die Seite neu geladen.'));
      const sl = this.slotIo;
      for (const s of sl.list()) {
        const r = el('div');
        r.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin:4px 0';
        r.append(el('span', '', `Platz ${s.n}: ${s.label}${s.active ? ' (aktiv)' : ''}`));
        const b = el('button', `a-btn${s.active ? ' off' : ''}`, s.active ? 'Aktiv' : s.exists ? 'Laden' : 'Neu beginnen') as HTMLButtonElement;
        if (!s.active) b.onclick = () => sl.switchTo(s.n);
        r.append(b);
        body.append(r);
      }
    }
    if (this.saveIo) {
      const adv = el('button', 'a-btn', this.showSaveIo ? 'Datei/Code-Sicherung ausblenden' : 'Erweitert: Datei/Code-Sicherung') as HTMLButtonElement;
      adv.style.marginTop = '10px';
      adv.onclick = () => {
        this.showSaveIo = !this.showSaveIo;
        this.key = '';
      };
      body.append(adv);
      if (this.showSaveIo) this.renderSaveIo(body);
    }
  }

  private confirmLoad(): void {
    if (!this.manualIo?.info()) {
      this.say('Es gibt noch keinen gespeicherten Stand.');
      return;
    }
    if (confirm('Gespeicherten Stand laden? Der aktuelle Fortschritt seit dem Speichern geht verloren.')) this.manualIo.load();
  }

  /** Kurzer Hinweis oben links, dass gespeichert wurde. */
  savedHint(text = 'Gespeichert'): void {
    this.hintEl.textContent = text;
    this.hintEl.style.opacity = '1';
    window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => (this.hintEl.style.opacity = '0'), 1400);
  }

  /** Spielstand liegt nur im Browser: Sicherung als Datei oder Code, damit er mit Browserwechsel/Inkognito mitzieht. */
  private renderSaveIo(body: HTMLElement): void {
    const io = this.saveIo!;
    body.append(el('div', 'a-sec', 'Spielstand sichern'));
    body.append(el('div', 'a-note', 'Der Spielstand liegt nur in diesem Browser (nicht im Inkognito-Fenster, nicht in anderen Browsern). Mit Datei oder Code nimmst du ihn mit.'));
    const row = el('div');
    row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px';
    const btn = (label: string, fn: () => void): HTMLButtonElement => {
      const b = el('button', 'a-btn', label) as HTMLButtonElement;
      b.onclick = fn;
      row.append(b);
      return b;
    };
    btn('Als Datei speichern', () => {
      const url = URL.createObjectURL(new Blob([io.export()], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `aschenthron-spielstand-${new Date().toISOString().slice(0, 10)}.json` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.say('Spielstand als Datei gespeichert.');
    });
    btn('Code kopieren', () => {
      const text = io.export();
      const done = () => this.say('Spielstand-Code in die Zwischenablage kopiert.');
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => window.prompt('Code kopieren (Strg/Cmd+C):', text));
      else window.prompt('Code kopieren (Strg/Cmd+C):', text);
    });
    const load = (json: string): void => {
      if (!confirm('Aktuellen Spielstand durch den geladenen ersetzen? (Der alte bleibt als Sicherung im Browser.)')) return;
      if (!io.import(json)) this.say('Das ist kein gültiger Spielstand.');
    };
    btn('Aus Datei laden', () => {
      const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
      inp.onchange = () => {
        const f = inp.files?.[0];
        if (f) void f.text().then(load);
      };
      inp.click();
    });
    btn('Code einfügen', () => {
      const t = window.prompt('Spielstand-Code hier einfügen:');
      if (t) load(t.trim());
    });
    body.append(row);
  }

  private renderSkills(body: HTMLElement, p: Actor): void {
    body.append(el('div', 'a-sec', `Gelernte Fertigkeiten – ${p.skillPoints} Skillpunkte übrig (nur für Passive)`));
    if (!p.skills.length) body.append(el('div', 'a-note', 'Noch keine – Lehrer in den Städten bringen dir Fertigkeiten bei.'));
    const barNow = hotbarFor(p);
    p.skills.forEach((id) => {
      const s = SKILLS.find((x) => x.id === id)!;
      const i = barNow.indexOf(id);
      const c = el('div', 'a-card');
      c.append(Object.assign(el('img'), { src: skillIcon(s) }));
      const t = el('div');
      t.append(el('div', '', `${s.name}${i >= 0 && i < 9 ? ` [${i + 1}]` : ''}${s.passive ? ' (passiv)' : ''} · ${s.area}${s.passive ? ` · Rang ${p.skillRanks[s.id] ?? 1}` : ''}`), el('div', 'a-note', `${SCHOOL_NAME[schoolOf(s)]}${s.passive ? '' : ` · ${s.mana} Mana · ${Math.round(s.cooldown / TICK_RATE)} s Abklingzeit`}`), el('div', 'a-note', s.desc), ...skillInfo(s));
      if (!s.passive) {
        const bar = hotbarFor(p);
        const sel = document.createElement('select');
        sel.title = 'Platz auf der Schnellleiste';
        sel.style.cssText = 'background:#1a1620;color:#fff;border:1px solid #4b3f3a;border-radius:3px;margin-left:8px';
        const none = document.createElement('option');
        none.value = '';
        none.textContent = 'Leiste: –';
        sel.append(none);
        for (let n = 0; n < HOTBAR_SLOTS; n++) {
          const o = document.createElement('option');
          o.value = String(n);
          o.textContent = `Leiste: ${n + 1}`;
          sel.append(o);
        }
        sel.value = bar.indexOf(s.id) >= 0 ? String(bar.indexOf(s.id)) : '';
        sel.onchange = () => {
          if (sel.value === '') {
            const at = bar.indexOf(s.id);
            if (at >= 0) assignHotbar(p, at, null);
          } else assignHotbar(p, Number(sel.value), s.id);
        };
        c.append(sel);
      }
      c.append(t);
      body.append(c);
    });
  }

  /** Zielbeschreibung einer Aufgabe: Art, Fortschritt und Ort (Region-Name). */
  private questGoal(def: QuestDef, p: Actor): string {
    const st = p.quests[def.id];
    const prog = st ? `${Math.min(st.progress, def.count)}/${def.count}` : `0/${def.count}`;
    switch (def.kind) {
      case 'kill': return `Töte ${def.count > 1 ? `${def.count}× ` : ''}${targetName(def)} (${prog})`;
      case 'bring': return `Sammle ${def.item} (${prog})`;
      case 'visit': return `Betritt: ${def.place}`;
      case 'talk': return `Sprich mit ${targetName(def)}`;
      case 'camp': return `Säubere: ${targetName(def)}`;
      case 'find': return `Suche ${def.item} (${prog}) – achte auf Funkeln am Boden`;
      case 'chest': return `Öffne Truhen (${prog})`;
      case 'champion': return `Besiege Champions (${prog})`;
      case 'unique': return def.target ? `Besiege den Weltboss (${prog})` : `Besiege benannte Gegner (${prog})`;
    }
  }

  private questCard(def: QuestDef, p: Actor, w: World | null): HTMLElement {
    const st = p.quests[def.id]!;
    const c = el('div', 'a-card');
    c.style.display = 'block';
    c.append(el('div', '', def.name), el('div', 'a-note', def.text), el('div', 'a-note', this.questGoal(def, p)));
    const where = w ? questWhere(w, def, st.state === 'done') : '';
    if (where) c.append(el('div', 'a-note', `${st.state === 'done' ? 'Abgabe' : 'Ort'}: ${where}`));
    const bar = el('div', 'a-bar');
    const f = el('div');
    f.style.cssText = `width:${Math.min(100, (st.progress / def.count) * 100)}%;background:${st.state === 'done' ? '#6fe08a' : '#d8a24a'}`;
    bar.append(f);
    const rew = `Belohnung ${questXp(def.minLevel, def.xp)} XP, ${def.gold} Gold${def.choices ? ', je nach Entscheidung' : def.reward ? (def.reward === 'unique' ? ', Wahl: 3 Stücke (Unikat/Set möglich)' : ', Wahl: 1 von 3 benannten Funden') : ''}`;
    c.append(bar, el('div', 'a-note', st.state === 'done' ? 'Fertig – beim Auftraggeber abgeben!' : rew));
    return c;
  }

  private renderAch(body: HTMLElement): void {
    if (this.board) {
      body.append(el('div', 'a-sec', 'Rangliste (Server)'));
      this.board.forEach((r, i) => {
        const row = el('div', 'a-row');
        row.append(el('span', '', `${i + 1}. ${r.name}`), el('span', '', `Stufe ${r.level} · ${r.xp} XP`));
        body.append(row);
      });
    }
    const t = this.ach;
    if (!t) { body.append(el('div', 'a-note', 'Erfolge gibt es nur im Einzelspielermodus.')); return; }
    body.append(el('div', 'a-sec', `Erfolge ${t.unlocked.size}/${ACHIEVEMENTS.length}`));
    const st = t.stats;
    body.append(el('div', 'a-note', `Bestwerte: ${st.kills} Gegner · ${st.bosses} Bosse · ${st.rares} seltene und ${st.legendary} legendäre Funde · ${st.chests} Truhen · ${st.quests} Aufgaben · ${st.deaths} Tode`));
    for (const a of ACHIEVEMENTS) {
      const got = t.unlocked.has(a.id);
      const c = el('div', 'a-card');
      c.style.display = 'block';
      c.style.opacity = got ? '1' : '.6';
      const pr = a.prog?.(t.stats);
      c.append(el('div', '', `${got ? '✔ ' : ''}${a.name}`), el('div', 'a-note', a.text + (!got && pr ? ` (${pr[0]}/${pr[1]})` : '')));
      body.append(c);
    }
  }

  /** Bestiarium: je Beute-Gruppe Kills, Kill-Ziele, Monsterarten und Funde (Name und Werte erst nach dem ersten Fund). */
  private renderBestiary(body: HTMLElement, p: Actor): void {
    const found = new Set(p.found ?? []);
    const seenAll = LOOT_GROUPS.reduce((n, g) => n + NAMED.filter((d) => d.group === g.id && found.has(d.id)).length, 0);
    body.append(el('div', 'a-sec', `Bestiarium · ${seenAll}/${NAMED.length} Funde`));
    body.append(el('div', 'a-note', `Name und Werte eines Funds zeigen sich erst, wenn du ihn einmal aufgehoben hast. ${KILL_GOALS[0]} Kills einer Gruppe: Titel. ${KILL_GOALS[1]}: zweiter Titel, und die Händler führen deine gefundenen Stücke dieser Gruppe.`));
    for (const g of LOOT_GROUPS) {
      const kills = groupKills(p, g.id);
      const c = el('div', 'a-card');
      c.style.display = 'block';
      if (!kills) c.style.opacity = '.55';
      const head = el('div', '', `${g.name} · ${kills} erlegt`);
      head.style.fontWeight = 'bold';
      const goals = KILL_GOALS.map((n, i) => `${kills >= n ? '✔' : `${Math.min(kills, n)}/${n}`} „${g.titles[i]}“`).join(' · ');
      c.append(head, el('div', 'a-note', goals));
      const kinds = g.monsters.map((id) => MONSTERS.find((m) => m.id === id)!).filter((m) => !!m).sort((a, b) => a.level - b.level);
      c.append(el('div', 'a-note', kinds.map((m) => ((p.kills?.[m.id] ?? 0) > 0 ? `${m.name} (St. ${m.level}): ${p.kills![m.id]}` : `??? (St. ${m.level})`)).join(' · ')));
      // Funde der Gruppe: benannte Funde nach Band, dazu Unikate ihrer Bosse und Mini-Bosse
      const bosses = new Set([...g.monsters, ...UNIQUES.filter((u) => g.monsters.includes(u.base)).map((u) => u.id)]);
      const drops: { id: string; level: number; item: () => Item; slot: string }[] = [
        ...NAMED.filter((d) => d.group === g.id).map((d) => ({ id: d.id, level: d.band, item: () => generateNamed(-1, d.id), slot: SLOT_NAME[templateById(d.base).slot as EquipSlot] ?? '' })),
        ...LEGENDARIES.filter((l) => l.source && bosses.has(l.source)).map((l) => ({ id: l.id, level: l.minLevel, item: () => generateLegendary(new Rng(1), -1, l.id), slot: SLOT_NAME[templateById(l.base).slot as EquipSlot] ?? '' })),
      ].sort((a, b) => a.level - b.level);
      const list = el('div');
      list.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px;font-size:13px';
      for (const d of drops) {
        if (!found.has(d.id)) {
          list.append(el('span', 'a-note', `??? · ${d.slot} · St. ${d.level}`));
          continue;
        }
        const it = d.item();
        const sp = el('span', '', `${it.name} · St. ${d.level}`);
        sp.style.color = RARITY_COLOR[it.rarity];
        sp.style.cursor = 'help';
        sp.onmouseenter = (ev) => this.showTip(it, equippedFor(p, it), ev);
        sp.onmouseleave = () => (this.tip.style.display = 'none');
        list.append(sp);
      }
      if (drops.length) c.append(list);
      body.append(c);
    }
  }

  private renderQuests(body: HTMLElement, p: Actor): void {
    const w = this.lastW;
    const chained = new Set(questChains().flatMap((c) => c.quests.map((q) => q.id)));
    const active = QUESTS.filter((q) => !chained.has(q.id) && p.quests[q.id] && p.quests[q.id]!.state !== 'turned');
    body.append(el('div', 'a-sec', 'Aufgaben'));
    body.append(el('div', 'a-note', 'Endziel: Besiege den Aschenkönig auf dem Thron der Asche (ab Stufe 28).'));
    if (!active.length) body.append(el('div', 'a-note', 'Keine. Questgeber (gelbes ! über dem Kopf) stehen in den Städten.'));
    for (const q of active) body.append(this.questCard(q, p, w));
    this.renderNotebook(body, p);
    for (const chain of questChains()) {
      const done = chain.quests.filter((q) => p.quests[q.id]?.state === 'turned').length;
      const cur = chain.quests.find((q) => p.quests[q.id] && p.quests[q.id]!.state !== 'turned');
      const next = chain.quests.find((q) => !p.quests[q.id]);
      if (!cur && done === 0 && !(next && p.level >= next.minLevel - 3)) continue;
      body.append(el('div', 'a-sec', `${chain.name} · Kapitel ${Math.min(done + (cur ? 1 : 0), chain.quests.length)}/${chain.quests.length}`));
      if (cur) body.append(this.questCard(cur, p, w));
      else if (done === chain.quests.length) body.append(el('div', 'a-note', 'Abgeschlossen.'));
      else if (next) body.append(el('div', 'a-note', `Nächstes Kapitel „${next.name}“ ab Stufe ${next.minLevel}${next.requires ? ' – beim Auftraggeber abholen' : ''}${w && giverLocation(w, next) ? `: ${giverLocation(w, next)!.text}` : ''}.`));
    }
  }

  /** Kopfgelder (täglicher Aushang) und Set-Jagd: Ziele für die Beute-Jagd. */
  private renderHunts(body: HTMLElement, p: Actor): void {
    const w = this.lastW;
    body.append(el('div', 'a-sec', 'Kopfgelder'));
    const inTown = !!w?.safe.some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
    const day = Math.floor(Date.now() / 86400000);
    const fresh = p.bountyDay === day && !!p.bounties?.length;
    if (!fresh) {
      body.append(el('div', 'a-note', inTown ? 'Am Aushang hängen heute neue Kopfgelder.' : 'Der Aushang hängt in den Städten. Dort gibt es täglich 3 neue Kopfgelder für deine Stufe.'));
      if (inTown) {
        const b = el('button', 'a-btn', 'Aushang ansehen');
        b.onclick = () => this.send({ type: 'bountyBoard', day });
        body.append(b);
      }
    }
    for (const b of p.bounties ?? []) {
      const c = el('div', 'a-card');
      c.style.display = 'block';
      let name = b.target;
      try { name = monsterKind(b.target).name; } catch { /* unbekannt */ }
      const done = b.progress >= b.count;
      c.append(el('div', '', `${b.claimed ? '✔ ' : ''}Erlege ${b.count}× ${name} (${Math.min(b.progress, b.count)}/${b.count})`), el('div', 'a-note', `Belohnung ${b.xp} XP, ${b.gold} Gold, 30 % Chance auf einen benannten Fund`));
      const bar = el('div', 'a-bar');
      const f = el('div');
      f.style.cssText = `width:${Math.min(100, (b.progress / b.count) * 100)}%;background:${done ? '#6fe08a' : '#d8a24a'}`;
      bar.append(f);
      c.append(bar);
      if (done && !b.claimed) {
        const claim = el('button', 'a-btn', inTown ? 'Abholen' : 'Abholen (nur in der Stadt)');
        claim.onclick = () => this.send({ type: 'claimBounty', id: b.id });
        c.append(claim);
      }
      body.append(c);
    }
    // Set-Jagd: alle Sets mit Teilen, Boni und Fundorten (Besitz wird abgehakt)
    const owned = new Set<string>();
    for (const it of [...p.inventory, ...p.stash, ...Object.values(p.equipment)]) if (it?.setId) owned.add(`${it.setId}:${it.name}`);
    body.append(el('div', 'a-sec', 'Set-Jagd'));
    body.append(el('div', 'a-note', 'Set-Teile erkennst du an der grünen Seltenheit. Je mehr Teile eines Sets du gleichzeitig trägst, desto stärker der Bonus.'));
    for (const st of SETS) {
      const c = el('div', 'a-card');
      c.style.display = 'block';
      const have = st.pieces.filter((pc) => owned.has(`${st.id}:${pc.name}`)).length;
      const title = el('div', '', `${st.name} (ab Stufe ${st.minLevel}): ${have}/${st.pieces.length} Teile`);
      title.style.fontWeight = 'bold';
      c.append(title);
      for (const pc of st.pieces) {
        const mine = owned.has(`${st.id}:${pc.name}`);
        const row = el('div', 'a-note', `${mine ? '✔' : '✖'} ${pc.name}  (${pc.affixes.map((x) => affixText(x)).join(', ')})`);
        row.style.opacity = mine ? '1' : '.7';
        c.append(row);
      }
      for (const [n, bo] of Object.entries(st.bonuses)) {
        const txt = [...(bo.affixes ?? []).map((x) => affixText(x)), ...(bo.power ? [POWER_TEXT[bo.power.id](bo.power.value)] : [])].join(', ');
        const row = el('div', 'a-note', `${n} Teile: ${txt}`);
        row.style.color = have >= Number(n) ? '#9be37a' : '';
        c.append(row);
      }
      c.append(el('div', 'a-note', `Fundorte: Mini-Bosse („Gesucht“, ca. jedes dritte Mal ein Set-Teil), Weltbosse, Aufgaben-Belohnungen zur Wahl (Unikat-Aufgaben) und selten bei Gegnern der Stufe ${st.minLevel - 1}–${st.minLevel + 9}.`));
      body.append(c);
    }
    // Boss-Waffen: feste Spezialwaffen der Bosse und Mini-Bosse (Waffen kauft man beim Händler, die besten holt man sich)
    body.append(el('div', 'a-sec', 'Boss-Waffen'));
    body.append(el('div', 'a-note', 'Normale Gegner lassen kaum Waffen fallen. Gute Waffen kaufst du beim Händler; die besten tragen Bosse und Mini-Bosse bei sich (jeder Kill hat eine gute Chance).'));
    const bossWeapons = LEGENDARIES.filter((d) => d.source && templateById(d.base).slot === 'weapon').sort((a, b) => a.minLevel - b.minLevel);
    for (const d of bossWeapons) {
      let from = d.source!;
      try { from = uniqueDef(d.source!)?.name ?? monsterKind(d.source!).name; } catch { /* Name unbekannt */ }
      const c = el('div', 'a-card');
      c.style.display = 'block';
      const t = templateById(d.base);
      const owned = [...p.inventory, ...p.stash, ...Object.values(p.equipment)].some((x) => x?.unique === d.id);
      const hd = el('div', '', `${owned ? '✔ ' : ''}${d.name} (Stufe ${d.minLevel}, ${t.name})`);
      hd.style.color = '#ff8a2a';
      c.append(hd, el('div', 'a-note', `Von: ${from} · ${POWER_TEXT[d.power.id](d.power.value)}`));
      body.append(c);
    }
  }

  /* -------------------------------------------------- Händler-Fenster */

  private renderSide(p: Actor, near: Npc[]): void {
    if (!near.length) {
      this.sideShown = false;
      this.sideClosed = '';
      return;
    }
    if (near.map((n) => n.id).join(',') === this.sideClosed) {
      this.sideShown = false;
      return;
    }
    this.sideClosed = '';
    const body = el('div', 'a-body');
    const trainers = near.filter((n) => n.kind === 'trainer');
    const merchants = near.filter((n) => n.kind === 'merchant');
    const stash = near.find((n) => n.kind === 'stash');
    const smith = near.find((n) => n.kind === 'smith');
    const hidden = (n: Npc) => QUESTS.filter((q) => q.hidden && isGiverOf(n, q) && p.quests[q.id]).map((q) => q.id);
    const givers = near.filter((n) => n.kind === 'quest' || !!n.quests?.length || hidden(n).length > 0);
    const talkers = near.filter((n) => NPC_LORE[n.name] || hasTopics(n.name));
    // Rolle jedes NPCs in Reichweite: was kann ich hier tun?
    for (const n of near) if (NPC_ROLE[n.name]) body.append(el('div', 'a-note', `${n.name}: ${NPC_ROLE[n.name]}`));
    // Gesprächsziel einer offenen Aufgabe ohne eigenen Dialogtext (Lehrer, Händler, Schmied, Lager)
    for (const n of near) {
      if (NPC_LORE[n.name] || hasTopics(n.name)) continue;
      const pend = QUESTS.find((q) => q.kind === 'talk' && q.target === npcKeyOf(n.name) && p.quests[q.id]?.state === 'active');
      if (!pend) continue;
      const b = el('button', 'a-btn', `Anliegen vortragen: ${pend.name}`);
      b.onclick = () => this.send({ type: 'talk', npcId: n.id });
      body.append(b);
    }
    for (const t of talkers) {
      // Gespräch: Text des NPC; mit offener Gesprächsaufgabe gibt es einen Knopf, das Anliegen vorzutragen
      body.append(el('div', 'a-sec', `Gespräch – ${t.name}`));
      const box = el('div', 'a-card');
      box.style.cssText += ';display:block;font-style:italic;line-height:1.5';
      const hello = el('div', '', greeting(p, gameHour()));
      hello.style.margin = '0 0 6px';
      hello.style.color = '#d9c9a3';
      box.append(hello);
      for (const para of NPC_LORE[t.name] ?? []) {
        const d = el('div', '', `„${para}“`);
        d.style.margin = '0 0 6px';
        box.append(d);
      }
      body.append(box);
      if (hasTopics(t.name)) this.topicBlock(body, t, p);
      const pending = QUESTS.find((q) => q.kind === 'talk' && q.target === npcKeyOf(t.name) && p.quests[q.id]?.state === 'active');
      if (pending) {
        const b = el('button', 'a-btn', `Anliegen vortragen: ${pending.name}`);
        b.onclick = () => this.send({ type: 'talk', npcId: t.id });
        body.append(b);
      }
    }
    for (const m of merchants) {
      body.append(el('div', 'a-sec', `${m.name} – Waren`));
      const grid = el('div', 'a-grid');
      for (const id of SHOPS[m.shop ?? 'basic'] ?? []) {
        const t = templateById(id);
        const fake: Item = {
          id: -1, templateId: id, name: t.name, slot: t.slot, rarity: 'normal', weight: t.weight, damage: t.damage, armor: t.armor,
          heal: t.heal, mana: t.mana, ...(t.town ? { town: t.town } : {}), reqKraft: t.reqKraft, value: t.value, affixes: [],
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
    const ordered = merchants.length ? merchantNamed(p) : [];
    if (ordered.length) {
      body.append(el('div', 'a-sec', 'Auf Bestellung (Kill-Ziele)'));
      for (const id of ordered) {
        const it = generateNamed(-1, id);
        const c = el('div', 'a-card');
        const nm = el('span', '', it.name);
        nm.style.color = RARITY_COLOR[it.rarity];
        const price = namedPrice(id);
        const b = el('button', `a-btn${p.gold >= price ? '' : ' off'}`, `${price}g`);
        b.onclick = () => p.gold >= price && this.send({ type: 'buy', templateId: it.templateId, named: id });
        c.append(nm, b);
        c.onmouseenter = (ev) => this.showTip(it, equippedFor(p, it), ev);
        c.onmouseleave = () => (this.tip.style.display = 'none');
        body.append(c);
      }
    }
    if (merchants.length) {
      const sell = el('div', 'a-card a-drop');
      sell.dataset.drop = 'sell';
      sell.style.cssText += ';justify-content:center;height:46px;border-style:dashed;color:#ffd84a';
      sell.textContent = 'Zum Verkaufen Gegenstand hierher ziehen';
      body.append(sell);
      const bulk = el('div', 'a-note');
      bulk.style.cssText += ';display:flex;gap:6px;flex-wrap:wrap;align-items:center';
      bulk.append('Alles auf einmal:');
      for (const [upTo, label] of [['normal', 'Normale'], ['magic', 'Bis magisch'], ['rare', 'Bis selten']] as const) {
        const items = bulkSellable(p, upTo);
        const gold = items.reduce((n, i) => n + sellPrice(i), 0);
        const b = el('button', 'a-btn' + (items.length ? '' : ' off'), `${label} (${items.length} · ${gold}g)`);
        b.title = 'Verkauft alle passenden Gegenstände im Rucksack. Tränke, Edelsteine, benannte Funde, Set- und Unikat-Teile bleiben.';
        b.onclick = () => {
          if (!items.length) return;
          if (upTo === 'rare' && !confirm(`${items.length} Gegenstände (auch seltene) für ${gold} Gold verkaufen?`)) return;
          this.send({ type: 'sellBulk', upTo });
        };
        bulk.append(b);
      }
      body.append(bulk);
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
    for (const trainer of trainers) {
      const label = trainer.field === 'Magie' ? 'Magielehrer' : trainer.field === 'Kampf' ? 'Kampflehrer' : 'Lehrer';
      body.append(el('div', 'a-sec', `${trainer.name} – ${label} · ${p.skillPoints} Skillpunkte`));
      if (trainer === trainers[0]) {
        const rs = el('button', 'a-btn', p.freeRespec ? 'Alles neu verteilen (einmal gratis)' : `Alles neu verteilen (${respecPrice(p.level)}g)`);
        rs.title = 'Setzt Attribute und Fertigkeiten zurück, du bekommst alle Punkte zurück.';
        rs.style.marginBottom = '6px';
        rs.onclick = () => {
          if (confirm(`Attribute und Fertigkeiten ${p.freeRespec ? 'einmalig kostenlos' : `für ${respecPrice(p.level)} Gold`} zurücksetzen?`)) this.send({ type: 'respec' });
        };
        body.append(rs);
      }
      // nach Element gruppiert (Feuer, Frost, Blitz, Gift, Heilung), Rest nach Fachgebiet; innerhalb nach Stufe
      const groups = new Map<string, SkillDef[]>();
      for (const s of SKILLS.filter((x) => trainerTeaches(trainer, x))) groups.set(skillGroup(s), [...(groups.get(skillGroup(s)) ?? []), s]);
      const order = [...groups.keys()].sort((a, b) => SKILL_GROUPS.indexOf(a) - SKILL_GROUPS.indexOf(b));
      for (const g of order) {
        if (order.length > 1) body.append(el('div', 'a-note', `— ${g} —`));
        for (const s of groups.get(g)!.sort((a, b) => a.levelReq - b.levelReq)) body.append(this.skillCard(s, p));
      }
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
        const craftable = it.rarity !== 'legendary' && it.rarity !== 'set' && !it.named;
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
            b.style.cssText += `;margin:0 4px 3px 0;box-shadow:0 0 0 2px #${GEM_COLOR[gi.kind].toString(16).padStart(6, '0')}`;
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
      let locked = 0;
      for (const id of [...(g.quests ?? []), ...hidden(g)]) {
        const def = questById(id);
        if (!def) continue;
        const st = p.quests[id];
        if (!st && def.requires && p.quests[def.requires]?.state !== 'turned') {
          locked++;
          continue;
        }
        const c = el('div', 'a-card');
        c.style.display = 'block';
        const t = el('div', '', `${def.name} (ab Stufe ${def.minLevel})`);
        t.style.fontWeight = 'bold';
        c.append(t);
        if (def.chain) c.append(el('div', 'a-note', `Kette: ${def.chain}`));
        c.append(el('div', 'a-note', def.text), el('div', 'a-note', `Belohnung: ${questXp(def.minLevel, def.xp)} XP, ${def.gold} Gold${def.reward ? (def.reward === 'unique' ? ', Unikat/Set-Teil' : ', benannter Fund') : ''}`));
        if (def.reward && st?.state !== 'turned') {
          const names = questRewardChoices(def).map((it) => it.name);
          const pv = el('div', 'a-note', `Zu holen: ${names.join(' · ')}`);
          pv.style.color = '#ffd23a';
          c.append(pv);
        }
        if (!st) {
          const b = el('button', `a-btn${questAvailable(p, def) ? '' : ' off'}`, 'Annehmen');
          b.onclick = () => this.send({ type: 'acceptQuest', questId: id });
          c.append(b);
        } else if (st.state === 'active') c.append(el('i', 'a-note', this.questGoal(def, p)));
        else if (st.state === 'done') {
          const choices = questRewardChoices(def);
          if (def.choices) {
            c.append(el('div', 'a-note', 'Entscheide dich:'));
            def.choices.forEach((o, pick) => {
              const b = el('button', 'a-btn', `${o.label} – ${o.item ? `${questXp(def.minLevel, o.xp)} XP + ${choices[0]!.name}` : `${o.gold} Gold, ${questXp(def.minLevel, o.xp)} XP`}`);
              b.style.cssText = 'display:block;margin:2px 0;text-align:left';
              if (o.item) {
                b.onmouseenter = (ev) => this.showTip(choices[0]!, equippedFor(p, choices[0]!), ev);
                b.onmouseleave = () => (this.tip.style.display = 'none');
              }
              b.onclick = () => { this.tip.style.display = 'none'; this.send({ type: 'turnInQuest', questId: id, pick }); };
              c.append(b);
            });
          } else if (choices.length) {
            c.append(el('div', 'a-note', 'Wähle deine Belohnung:'));
            choices.forEach((it, pick) => {
              const b = el('button', 'a-btn');
              b.style.cssText = 'display:flex;align-items:center;gap:6px;margin:2px 4px 2px 0;text-align:left';
              const nm = el('span', '', it.name);
              nm.style.color = RARITY_COLOR[it.rarity];
              b.append(Object.assign(el('img'), { src: itemIcon(it) }), nm);
              b.onmouseenter = (ev) => this.showTip(it, equippedFor(p, it), ev);
              b.onmouseleave = () => (this.tip.style.display = 'none');
              b.onclick = () => { this.tip.style.display = 'none'; this.send({ type: 'turnInQuest', questId: id, pick }); };
              c.append(b);
            });
          } else {
            const b = el('button', 'a-btn', 'Abgeben');
            b.onclick = () => this.send({ type: 'turnInQuest', questId: id });
            c.append(b);
          }
        } else c.append(el('i', 'a-note', 'erledigt'));
        body.append(c);
      }
      if (locked) body.append(el('div', 'a-note', `Weitere Aufgaben (${locked}) folgen, sobald die vorherige erledigt ist.`));
    }
    const toBag = isTouch ? [Object.assign(el('span', 'a-x', 'Rucksack'), { onclick: () => { this.touchMain = true; this.sel = null; this.key = ''; this.layout(); } })] : [];
    for (const b of toBag) b.style.cssText = 'font-size:15px;padding:0 10px;display:flex;align-items:center;border-left:1px solid #4b3f3a';
    const title = titleBar(near.map((n) => n.name).join(' · '), this.side, () => {
      this.sideClosed = near.map((n) => n.id).join(',');
      this.sideShown = false;
      this.sel = null;
      if (isTouch) this.open = false;
      this.layout();
    }, toBag);
    this.side.replaceChildren(...[title, body, this.selPanel(p)].filter((x): x is HTMLElement => !!x));
    this.sideShown = true;
  }

  /** Text mit anklickbaren Stichworten: bekannte mit Antwort sind Knöpfe, ohne Antwort nur hervorgehoben. */
  private markedText(text: string, n: Npc, p: Actor): HTMLElement {
    const out = el('div');
    out.style.cssText = 'margin:0 0 6px;line-height:1.6';
    for (const part of splitMarks(text)) {
      if (typeof part === 'string') {
        out.append(part);
        continue;
      }
      const ask = canAsk(n.name, part.key, p.topics);
      const b = el(ask ? 'button' : 'span', 'a-kw', part.label);
      b.style.cssText += `;color:#ffd84a;font:inherit;font-style:normal;border:0;border-bottom:1px dotted #ffd84a;background:rgba(255,216,74,.1);padding:0 3px;margin:0 1px;${ask ? 'cursor:pointer' : 'opacity:.7'}`;
      if (ask) b.onclick = () => this.askTopic(n, part.key);
      out.append(b);
    }
    return out;
  }

  private askTopic(n: Npc, key: string): void {
    this.topicView = { npcId: n.id, key };
    this.send({ type: 'askTopic', npcId: n.id, topic: key });
    this.key = '';
  }

  /** Themen eines NPC: Einstiegszeile mit Stichworten, offene Antwort, bereits Gehörtes zum Nachfragen. */
  private topicBlock(body: HTMLElement, n: Npc, p: Actor): void {
    const box = el('div', 'a-card');
    box.style.cssText += ';display:block;line-height:1.5';
    const open = NPC_TOPICS[n.name]!.open;
    box.append(this.markedText(open, n, p));
    const view = this.topicView?.npcId === n.id ? this.topicView.key : null;
    if (view) {
      const ans = answerOf(n.name, view);
      const card = el('div');
      card.style.cssText = 'margin-top:6px;padding:6px 8px;border-left:3px solid #ffd84a;background:rgba(255,216,74,.06)';
      const hd = el('div', '', `„${keywordLabel(view)}“`);
      hd.style.cssText = 'color:#ffd84a;font-weight:bold;margin-bottom:3px';
      card.append(hd);
      if (!ans) card.append(el('i', 'a-note', `${n.name} weiß darüber nichts.`));
      else if (!canAsk(n.name, view, p.topics)) card.append(el('i', 'a-note', 'Von diesem Stichwort hast du noch nie gehört.'));
      else if (p.level < (ans.minLevel ?? 1)) card.append(el('i', '', `„${ans.tooLow ?? 'Dazu bist du noch nicht weit genug.'}“`));
      else {
        for (const t of ans.text) card.append(this.markedText(`„${t}“`, n, p));
        const def = ans.quest ? questById(ans.quest) : undefined;
        const st = def ? p.quests[def.id] : undefined;
        if (def && st) {
          if (st.state === 'turned' && ans.done) card.append(el('i', '', `„${ans.done}“`));
          const lbl = st.state === 'turned' ? 'abgeschlossen' : st.state === 'done' ? 'erfüllt – hier abgeben' : this.questGoal(def, p);
          const row = el('div', 'a-note', `Auftrag „${def.name}“: ${lbl}`);
          row.style.color = '#9be37a';
          card.append(row);
        }
      }
      box.append(card);
    }
    // Gehörtes aus anderen Gesprächen ansprechen
    const open_ = new Set(openKeys(n.name));
    const heard = (p.topics ?? []).filter((k) => !open_.has(k));
    if (heard.length) {
      const row = el('div', 'a-note', 'Gehörtes ansprechen:');
      row.style.marginTop = '6px';
      for (const k of heard) {
        const knows = !!answerOf(n.name, k);
        const b = el('button', 'a-kw', keywordLabel(k));
        b.style.cssText += `;margin:2px 4px 0 0;color:#ffd84a;font:inherit;border:1px solid #6a5a2a;background:rgba(255,216,74,.1);padding:0 6px;cursor:pointer;${knows ? '' : 'opacity:.55'}`;
        b.onclick = () => (knows ? this.askTopic(n, k) : ((this.topicView = { npcId: n.id, key: k }), (this.key = '')));
        row.append(b);
      }
      box.append(row);
    }
    body.append(box);
  }

  /** Notizbuch im Aufgabenfenster: alle bekannten Stichworte. */
  private renderNotebook(body: HTMLElement, p: Actor): void {
    body.append(el('div', 'a-sec', `Notizbuch – Bekannte Stichworte (${p.topics?.length ?? 0})`));
    if (!p.topics?.length) {
      body.append(el('div', 'a-note', 'Noch leer. Sprich mit den Leuten und klicke die hervorgehobenen Wörter an; was du hörst, merkst du dir und kannst es anderen gegenüber ansprechen.'));
      return;
    }
    const row = el('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
    for (const k of p.topics) {
      const chip = el('span', 'a-note', keywordLabel(k));
      chip.style.cssText += ';color:#ffd84a;border:1px solid #6a5a2a;padding:0 6px;border-radius:3px';
      row.append(chip);
    }
    body.append(row, el('div', 'a-note', 'Tipp: Stichworte aus einem Gespräch kannst du bei jedem anderen unter „Gehörtes ansprechen“ erfragen.'));
  }

  private skillCard(s: SkillDef, p: Actor): HTMLElement {
    const known = p.skills.includes(s.id);
    const rank = known ? (p.skillRanks[s.id] ?? 1) : 0;
    const c = el('div', 'a-card');
    c.append(Object.assign(el('img'), { src: skillIcon(s) }));
    const t = el('div');
    t.style.flex = '1';
    // Aktive Zauber/Kampf-Skills haben keinen Rang; nur Passive werden gesteigert
    const head = el('div', '', `${s.name} · ${s.area}${known && s.passive ? ` · Rang ${rank}/${MAX_SKILL_RANK}` : ''}${known && !s.passive ? ' · gelernt' : ''}`);
    t.append(head, el('div', 'a-note', `${SCHOOL_NAME[schoolOf(s)]}${s.passive ? ' · passiv' : ''}`), el('div', 'a-note', `${s.desc} Ab Stufe ${s.levelReq}.`), ...skillInfo(s));
    c.append(t);
    if (!s.passive && known) return c;
    if (rank >= MAX_SKILL_RANK) {
      c.append(el('i', 'a-note', 'Maximum'));
      return c;
    }
    const next = rank + 1;
    const price = rankPrice(s.price, next);
    const lvl = s.passive ? rankLevelReq(s.levelReq, next) : s.levelReq;
    const lacking = missingSkillReq(p, s, next);
    // Anforderung ans Attribut: rot, was fehlt
    const need = Object.entries(skillReq(s, next)) as [keyof typeof ATTR_NAME, number][];
    if (need.length) {
      const rq = el('div', 'a-note', `Braucht: ${need.map(([k, v]) => `${ATTR_NAME[k]} ${v}`).join(', ')}`);
      rq.style.color = lacking.length ? '#ff6a4a' : '#9be37a';
      t.append(rq);
    }
    const points = s.passive ? p.skillPoints >= 1 : true;
    const can = p.level >= lvl && p.gold >= price && points && !lacking.length;
    const label = known ? `Rang ${next}: 1 Pkt · ${price}g` : s.passive ? `Lernen: 1 Pkt · ${price}g` : `Lernen: ${price}g`;
    const b = el('button', `a-btn${can ? '' : ' off'}`, label);
    b.title = p.level < lvl ? `Benötigt Stufe ${lvl}` : lacking.length ? `Dir fehlt: ${lacking.join(', ')}` : !points ? 'Keine Skillpunkte' : p.gold < price ? 'Nicht genug Gold' : '';
    b.onclick = () => this.send({ type: known ? 'trainSkill' : 'learnSkill', skillId: s.id });
    c.append(b);
    return c;
  }
}
