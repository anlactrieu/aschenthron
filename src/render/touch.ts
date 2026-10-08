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
html.touch .hb,html.touch .orb,html.touch .a-tab,html.touch .a-tabs,html.touch .a-slot,html.touch .a-x,html.touch .a-btn{touch-action:manipulation}
html.touch input,html.touch textarea{-webkit-user-select:text;user-select:text}
/* Fenster: rechts, volle Höhe, Spielwelt links bleibt sichtbar; nicht verschiebbar, dafür einklappbar */
html.touch .a-win{zoom:1;position:fixed;display:none;flex-direction:column;top:max(6px,env(safe-area-inset-top))!important;bottom:max(6px,env(safe-area-inset-bottom));right:max(6px,env(safe-area-inset-right))!important;left:auto!important;width:min(560px,max(60vw,430px))!important;max-width:calc(100vw - 12px);max-height:none;font-size:14px}
html.touch .a-win.a-min{bottom:auto}
html.touch .a-win.a-min>*:not(h3){display:none!important}
html.touch .a-win h3{cursor:default;padding:0 0 0 10px;min-height:44px;flex:none}
html.touch .a-win h3 .a-x{display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;margin:0;padding:0;font-size:20px;border-radius:0}
html.touch .a-win h3 .a-x.a-fold{border-left:1px solid #4b3f3a}
html.touch .a-tabs{overflow-x:auto;flex:none;scrollbar-width:none}
html.touch .a-tabs::-webkit-scrollbar{display:none}
html.touch .a-tab{flex:none;padding:0 14px;min-height:44px;display:flex;align-items:center;white-space:nowrap;font-size:13px}
html.touch .a-body{flex:1 1 auto;min-height:0;max-height:none;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain}
html.touch .a-btn{min-height:40px;padding:6px 14px;font-size:14px}
html.touch .a-doll{max-width:100%}
html.touch .a-sel{flex:none;max-height:46%;overflow-y:auto;border-top:2px solid #d8a24a;background:#16121b;padding:8px 10px;font:13px/1.4 Georgia,serif;touch-action:pan-y}
html.touch .a-sel .a-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;position:sticky;bottom:-8px;background:#16121b;padding:6px 0 8px}
html.touch .a-slot.sel{outline:2px solid #ffd86a;outline-offset:1px}
/* HUD kleiner, Tippflächen bleiben >= 44 px */
html.touch .orb{width:52px;height:52px;border-width:2px}
html.touch .orb .t{font-size:11px}
html.touch .hb{width:40px;height:40px;border-width:2px}
html.touch .hb img{width:30px;height:30px}
/* HUD links bündig, rechts Platz für die Bedienleiste; viele Fertigkeiten brechen in eine zweite Reihe um */
html.touch #t-hud{left:max(8px,env(safe-area-inset-left))!important;right:76px;transform:none!important;gap:6px!important}
html.touch #t-hud>div:nth-child(2){flex:1 1 0;min-width:0}
html.touch #t-hud .orb{flex:none}
html.touch .t-hot{flex-wrap:wrap;justify-content:center;gap:2px!important}
html.touch .hb .k{font-size:10px}
html.touch .hb .c{font-size:13px}
html.touch .hb .cnt{font-size:11px}
/* Bedienleiste unten rechts */
#t-bar{position:fixed;z-index:8;right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:flex-end;gap:6px}
#t-bar .t-btn,#t-menu .t-btn{min-width:48px;min-height:48px;padding:0 12px;background:linear-gradient(180deg,#4a3c2e,#2e251e);color:#f0e0c0;border:2px solid #8a7258;border-radius:6px;font:bold 13px Georgia,serif;box-shadow:0 2px 8px rgba(0,0,0,.7);touch-action:manipulation}
#t-bar .t-btn:active,#t-menu .t-btn:active{background:#6a5640}
#t-menu{display:none;grid-template-columns:repeat(3,auto);gap:5px;max-height:calc(100vh - 180px);overflow-y:auto;background:rgba(14,12,18,.94);border:1px solid #6b5a48;padding:6px;border-radius:6px}
#t-menu.open{display:grid}
#t-menu .t-btn{min-height:42px;font-size:12px;padding:0 8px}
/* Aufgabenanzeige einklappbar */
html.touch .tr-fold{max-width:min(220px,34vw);cursor:pointer}
html.touch .tr-fold>div:not(:first-child){display:none}
html.touch .tr-fold>div:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
html.touch .tr-fold>div:first-child .a-btn{display:none}
html.touch .tr-fold::after{content:'▾ mehr';display:block;font-size:11px;opacity:.7}
html.touch .tr-open::after{content:'▴ weniger';display:block;font-size:11px;opacity:.7}
/* Querformat-Hinweis */
#t-rot{position:fixed;inset:0;z-index:200;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0b0a0d;color:#e8d9b0;font:18px Georgia,serif;text-align:center;padding:24px}
#t-rot b{font-size:44px}
@media (orientation:portrait){html.touch #t-rot{display:flex}}
`;

export function initTouch(): void {
  if (!isTouch) return;
  document.documentElement.classList.add('touch');
  const style = document.createElement('style');
  style.textContent = TOUCH_CSS;
  document.head.appendChild(style);
  // Viewport: kein Zoomen, Notch-Bereiche nutzen
  const meta = document.querySelector<HTMLMetaElement>('meta[name=viewport]');
  if (meta) meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
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
