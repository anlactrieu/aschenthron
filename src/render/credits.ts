import { allSpritePaths } from './spriteMap';

/** Credits-Seite (F1 oder Knopf im Charakterfenster, schließt mit Esc): Quellenangabe der CC0-Grafiken. */

let box: HTMLDivElement | null = null;

function build(): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText =
    'position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;background:rgba(6,4,8,.78);font:14px/1.5 Georgia,serif;color:#d4c4a8';
  const card = document.createElement('div');
  card.style.cssText =
    'width:min(560px,92vw);max-height:86vh;overflow:auto;background:#17121b;border:1px solid #8a7258;box-shadow:0 8px 40px #000;padding:18px 22px';
  const h = document.createElement('h2');
  h.textContent = 'Credits';
  h.style.cssText = 'margin:0 0 10px;font:bold 22px Georgia,serif;color:#e8d4a8;letter-spacing:1px';
  const mk = (html: string): HTMLParagraphElement => {
    const p = document.createElement('p');
    p.innerHTML = html;
    p.style.margin = '8px 0';
    return p;
  };
  card.append(
    h,
    mk('<b>Aschenthron</b> – Dark-Fantasy-ARPG im Browser. Spiellogik, Karte, Terrain, Wände, Effekte und Ton sind selbst geschrieben und werden im Code gezeichnet.'),
    mk(
      `<b>Figuren-, Monster-, NPC- und Item-Grafiken:</b> „Dungeon Crawl 32x32 Tiles“ aus <i>Dungeon Crawl Stone Soup</i>, ` +
        `erstellt von der Dungeon-Crawl-Stone-Soup-Community (Pflege des Pakets: Chris Hamons). Lizenz: <b>CC0</b> (Public Domain Dedication) – keine Namensnennung nötig, hier als Dankeschön.`,
    ),
    mk(`Quelle: <span style="color:#e8c040">opengameart.org/content/dungeon-crawl-32x32-tiles</span><br>Original: <span style="color:#e8c040">github.com/crawl/crawl</span> (rltiles)`),
    mk(`<span style="opacity:.7">Verwendet: ${allSpritePaths().length} Bilddateien. Einzelheiten stehen in ASSETS.md.</span>`),
  );
  const close = document.createElement('button');
  close.textContent = 'Schließen (Esc)';
  close.style.cssText = 'margin-top:8px;background:#3a2f26;color:#f0e0c0;border:1px solid #8a7258;padding:4px 12px;cursor:pointer;font:13px Georgia,serif';
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
    }
  });
}
