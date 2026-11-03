import { allSpritePaths } from './spriteMap';
import { installTheme } from './theme';

/** Credits-Seite (F1 oder Knopf im Charakterfenster, schließt mit Esc): Quellenangabe der CC0-Grafiken. */

let box: HTMLDivElement | null = null;

function build(): HTMLDivElement {
  installTheme();
  const d = document.createElement('div');
  d.style.cssText =
    'position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;background:rgba(6,4,8,.78);font:16px/1.4 var(--ui-font);color:#f1e6c8';
  const card = document.createElement('div');
  card.className = 'w-frame';
  card.style.cssText = 'width:min(600px,92vw);max-height:86vh;overflow:auto;padding:8px 14px;box-shadow:0 8px 40px #000';
  const h = document.createElement('h2');
  h.textContent = 'Credits';
  h.style.cssText = 'margin:0 0 10px;font:28px var(--ui-font);color:#ffd24a;letter-spacing:1px;text-shadow:0 2px #131b1b';
  const mk = (html: string): HTMLParagraphElement => {
    const p = document.createElement('p');
    p.innerHTML = html;
    p.style.margin = '8px 0';
    return p;
  };
  card.append(
    h,
    mk('<b>Aschenthron</b> – Dark-Fantasy-ARPG im Browser. Spiellogik, Karte, Effekte und Ton sind selbst geschrieben und werden im Code gezeichnet.'),
    mk(
      `<b>Figuren-, Monster-, NPC- und Item-Grafiken:</b> „Dungeon Crawl 32x32 Tiles“ aus <i>Dungeon Crawl Stone Soup</i>, ` +
        `erstellt von der Dungeon-Crawl-Stone-Soup-Community (Pflege des Pakets: Chris Hamons). Lizenz: <b>CC0</b> (Public Domain Dedication) – keine Namensnennung nötig, hier als Dankeschön.`,
    ),
    mk(`Quelle: <span style="color:#e8c040">opengameart.org/content/dungeon-crawl-32x32-tiles</span><br>Original: <span style="color:#e8c040">github.com/crawl/crawl</span> (rltiles)`),
    mk(
      `<b>Welt, Oberfläche und Schrift:</b> „Ninja Adventure Asset Pack“ von <i>Pixel-Boy</i> und <i>AAA</i> (Gelände, Häuser, Bäume, Props, Fenster- und Knopfrahmen „Theme Wood“, Porträt, Pixelschrift). Lizenz: <b>CC0</b> – keine Namensnennung nötig, hier als Dankeschön.`,
    ),
    mk(`Quelle: <span style="color:#ffd24a">pixel-boy.itch.io/ninja-adventure-asset-pack</span>`),
    mk(
      `<b>Kampf-, Zauber- und Beute-Effekte:</b> gebacken aus <i>pixelfx</i> von Patch und Hugo Duprez (Sprite Fusion), in dunkler Palette, teils angepasst. ` +
        `Lizenz: <b>MIT</b> – Copyright (c) 2026 Patch, Copyright (c) 2026 Hugo Duprez; Lizenztext in <span style="color:#e8c040">tools/pixelfx/LICENSE</span>.`,
    ),
    mk(`Quelle: <span style="color:#e8c040">github.com/patch-gg/pixelfx</span>`),
    mk(`<span style="opacity:.7">Verwendet (Dungeon Crawl): ${allSpritePaths().length} Bilddateien. Einzelheiten stehen in ASSETS.md.</span>`),
  );
  const close = document.createElement('button');
  close.textContent = 'Schließen (Esc)';
  close.className = 'a-btn';
  close.style.cssText = 'margin-top:8px';
  close.onclick = () => setCredits(false);
  card.append(close);
  d.append(card);
  d.addEventListener('mousedown', (e) => {
    if (e.target === d) setCredits(false);
  });
  document.body.append(d);
  return d;
}

export function setCredits(open: boolean): void {
  if (!box) {
    if (!open) return;
    box = build();
  }
  box.style.display = open ? 'flex' : 'none';
}

export function creditsOpen(): boolean {
  return !!box && box.style.display !== 'none';
}

export function toggleCredits(): void {
  setCredits(!creditsOpen());
}

/** Tastenkürzel: F1 öffnet/schließt, Esc schließt. */
export function initCredits(): void {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      toggleCredits();
    } else if (e.key === 'Escape' && creditsOpen()) {
      setCredits(false);
      // nur die Credits schließen: spätere Esc-Handler (Hauptfenster, Fertigkeit abwählen) laufen nicht mehr
      e.stopImmediatePropagation();
    }
  });
}
