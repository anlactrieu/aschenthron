/** Handy-Modus: Touch-Erkennung und Zusatz-Stile. Auf Geräten mit Maus (Laptop) bleibt alles wie bisher. */

function detect(): boolean {
  try {
    if (new URLSearchParams(location.search).get('touch') === '1') return true; // zum Testen am Laptop
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export const isTouch = detect();

/** Alles, was nur im Touch-Modus (Klasse `touch` am html-Element) gilt. */
const TOUCH_CSS = `
html.touch,html.touch body{overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;position:fixed;inset:0;width:100%;height:100%}
html.touch canvas,html.touch #game{touch-action:none}
/* Spielfläche = ganzer Bildschirm inklusive Notch-/Statusleisten-Bereich (sonst bleibt oben ein schwarzer Balken) */
html.touch #game{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh}
html.touch canvas{display:block}
html.touch .hb,html.touch .pbar,html.touch .a-tab,html.touch .a-tabs,html.touch .a-slot,html.touch .a-x,html.touch .a-btn{touch-action:manipulation}
html.touch input,html.touch textarea{-webkit-user-select:text;user-select:text}
/* Fenster: rechts, volle Höhe, Spielwelt links bleibt sichtbar; nicht verschiebbar, dafür einklappbar */
html.touch{--bw:6px;--cw:4px;--tl-h:58px}
html.touch .a-win{zoom:1;position:fixed;display:none;flex-direction:column;top:max(6px,env(safe-area-inset-top))!important;bottom:max(6px,env(safe-area-inset-bottom));right:max(6px,env(safe-area-inset-right))!important;left:auto!important;width:min(560px,max(60vw,430px))!important;max-width:calc(100vw - 12px);max-height:none;font-size:16px}
html.touch .a-win.a-min{bottom:auto}
html.touch .a-win.a-min>*:not(h3){display:none!important}
html.touch .a-win h3{cursor:default;padding:0 0 0 10px;min-height:44px;flex:none}
html.touch .a-win h3 .a-x{display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;margin:0;padding:0;font-size:20px;border-radius:0}
html.touch .a-win h3 .a-x.a-fold{border-left:2px solid var(--ink)}
html.touch .a-tabs{flex-wrap:nowrap;overflow-x:auto;flex:none;scrollbar-width:none}
html.touch .a-tabs::-webkit-scrollbar{display:none}
html.touch .a-tab{flex:none;padding:0 14px;min-height:44px;display:flex;align-items:center;white-space:nowrap;font-size:15px}
html.touch .a-body{flex:1 1 auto;min-height:0;max-height:none;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain}
html.touch .a-btn{min-height:40px;padding:6px 14px;font-size:16px}
html.touch .a-doll{max-width:100%}
html.touch .a-sel{flex:none;max-height:46%;overflow-y:auto;border-top:3px solid #f06733;background:#26221a;padding:8px 10px;font:15px/1.4 var(--ui-font);touch-action:pan-y}
html.touch .a-sel .a-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;position:sticky;bottom:-8px;background:#26221a;padding:6px 0 8px;text-transform:none}
html.touch .a-slot.sel{outline:2px solid #ffd86a;outline-offset:1px}
html.touch .a-x{min-height:44px}
/* HUD kleiner, Tippflächen bleiben >= 44 px */
html.touch .pbar{height:18px;margin:4px}
html.touch #t-hud .pbar{flex:0 0 58px}
html.touch .pbar .t{font-size:13px}
html.touch .hb{flex:0 1 40px;width:40px;height:40px}
html.touch #hud-tl .face{width:38px;height:38px}
html.touch #hud-tl .fc{width:46px;height:46px}
html.touch #hud-tl .hdr{min-width:104px;padding-left:4px}
html.touch #hud-tl .nm{font-size:15px;max-width:110px}
html.touch #hud-tl .lv{display:none}
html.touch #hud-tl .pbar{height:14px;margin:2px 4px 2px 2px}
html.touch #hud-tl .pbar .t{font-size:11px}
/* HUD links bündig, rechts Platz für die Bedienleiste; viele Fertigkeiten brechen in eine zweite Reihe um */
html.touch #t-hud{left:max(8px,env(safe-area-inset-left))!important;right:76px;transform:none!important;gap:6px!important}
html.touch #t-hud>div:nth-child(2){flex:1 1 0;min-width:0}
html.touch .t-hot{flex-wrap:wrap;justify-content:center;gap:2px!important}
html.touch .hb .k{font-size:12px}
html.touch .hb .c{font-size:15px}
html.touch .hb .cnt{font-size:13px}
/* Bedienleiste unten rechts */
#t-bar{position:fixed;z-index:8;right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:flex-end;gap:6px}
#t-bar .t-btn,#t-menu .t-btn{min-width:48px;min-height:48px;padding:0 10px;font:16px var(--ui-font);touch-action:manipulation}
#t-menu{display:none;grid-template-columns:repeat(3,auto);gap:5px;max-height:calc(100vh - 180px);overflow-y:auto;padding:4px;--bw:6px}
#t-menu.open{display:grid}
#t-menu .t-btn{min-height:42px;font-size:14px;padding:0 8px}
/* Aufgabenanzeige einklappbar */
html.touch .tr-fold{max-width:min(220px,34vw);cursor:pointer}
html.touch .tr-fold>div:not(:first-child){display:none}
html.touch .tr-fold>div:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
html.touch .tr-fold>div:first-child .a-btn{display:none}
html.touch .tr-fold::after{content:'▾ mehr';display:block;font-size:13px;opacity:.7}
html.touch .tr-open::after{content:'▴ weniger';display:block;font-size:13px;opacity:.7}
/* Querformat-Hinweis */
#t-rot{position:fixed;inset:0;z-index:200;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0b0a0d;color:#e8d9b0;font:20px var(--ui-font);text-align:center;padding:24px}
#t-rot b{font-size:44px}
@media (orientation:portrait){html.touch #t-rot{display:flex}}
`;

export function initTouch(): void {
  if (!isTouch) return;
  document.documentElement.classList.add('touch');
  const style = document.createElement('style');
  style.textContent = TOUCH_CSS;
  document.head.appendChild(style);
  const rot = document.createElement('div');
  rot.id = 't-rot';
  rot.innerHTML = '<b>⟳</b><div>Bitte das Gerät drehen –<br>Aschenthron wird im Querformat gespielt.</div>';
  document.body.appendChild(rot);
  // iOS: Pinch-Zoom der Seite und Langdruck-Menü unterbinden (Pinch gehört der Spielkamera)
  // Erste Berührung: Vollbild anfordern (nur mit Geste erlaubt), damit die Adressleiste verschwindet
  const first = (): void => {
    document.removeEventListener('pointerup', first);
    if (!isFullscreen()) goFullscreen();
  };
  document.addEventListener('pointerup', first);
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault());
}

/** Läuft die Seite schon als installierte App (Home-Bildschirm) oder im Vollbild? */
export function isFullscreen(): boolean {
  return !!document.fullscreenElement || window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** Vollbild per Browser (Android/iPad). Auf dem iPhone gibt es das nicht: dort hilft nur „Zum Home-Bildschirm“. */
export function goFullscreen(): boolean {
  const el = document.documentElement;
  if (!document.fullscreenEnabled || !el.requestFullscreen) return false;
  void el.requestFullscreen({ navigationUI: 'hide' }).then(() => (screen.orientation as { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => undefined)).catch(() => undefined);
  return true;
}
