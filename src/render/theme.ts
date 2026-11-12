import { NINJA_BASE } from './ninja';

/**
 * Zentrales UI-Theme „Schiefer und Eisen“ (reines CSS, eigene Zeichnung): kalter Schiefer, Eisenband mit Nieten,
 * Fließtext in Serifen-Systemschrift (mind. 16 px), Pixelschrift `NinjaUi` (CC0) nur für Titel und Namen.
 * Alle Fenster, Tooltips, HUD-Elemente und Credits nutzen nur diese Variablen und Klassen.
 */

export const faceUrl = (who: string): string => `${NINJA_BASE}Actor/Character/${who}/Faceset.png`;

/** Eisenband mit vier Nieten: Hintergrund-Ebenen, die Rahmenbreite `--bw` bestimmt Band und Nietengröße. */
const RIVET = 'linear-gradient(#8a909a,#8a909a) no-repeat';
const IRON_BG = `${RIVET} left calc(var(--bw)/4) top calc(var(--bw)/4)/calc(var(--bw)/2) calc(var(--bw)/2) border-box,`
  + `${RIVET} right calc(var(--bw)/4) top calc(var(--bw)/4)/calc(var(--bw)/2) calc(var(--bw)/2) border-box,`
  + `${RIVET} left calc(var(--bw)/4) bottom calc(var(--bw)/4)/calc(var(--bw)/2) calc(var(--bw)/2) border-box,`
  + `${RIVET} right calc(var(--bw)/4) bottom calc(var(--bw)/4)/calc(var(--bw)/2) calc(var(--bw)/2) border-box,`
  + 'linear-gradient(var(--slate),var(--slate-d)) padding-box,'
  + 'linear-gradient(#444950,#2c3036) border-box';

export const THEME_CSS = `
@font-face{font-family:'NinjaUi';src:url("${NINJA_BASE}Ui/Font/NormalFont.ttf") format('truetype');font-display:swap}
:root{
  --pix:'NinjaUi','Courier New',ui-monospace,monospace;
  --body:Charter,'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;
  --ui-font:var(--body);
  --bw:8px;--cw:4px;--tl-h:108px;--mm-h:0px;
  --ink:#0b0c0e;--iron:#4a4f57;--iron-l:#7b818b;--slate:#22252a;--slate-d:#1a1c20;
  --wood:#22252a;--wood-d:#15171a;--wood-l:#4a4f57;
  --txt:#dcd7ca;--dim:#a39f93;--title:#e6dfcc;--link:#e59a5c;--focus:#fff;
  --gold:#e6dfcc;--orange:#e0a070;--violet:#c9a0ff;--green:#86d890;--red:#ff8878;
  --dmg-in:#e9b0a8;--gain:#d8c88a;--speech:#b9c4d6;
}
body{font-family:var(--body);font-synthesis:none}
button,input,select,textarea{font-family:var(--body)}

/* Fenster, Panels: Schiefer mit Eisenband und Nieten */
.w-frame,.a-win{border:var(--bw) solid transparent;background:${IRON_BG};box-shadow:inset 0 0 0 1px var(--ink),0 0 0 1px var(--ink),0 4px 14px rgba(0,0,0,.6);box-sizing:content-box;color:var(--txt);font:16px/1.45 var(--body)}
/* Titelleiste: dunkle Eisenplatte, Pixelschrift */
.a-win h3,.w-plate{background:#15171a;border-bottom:1px solid var(--iron);color:var(--title);font-family:var(--pix);font-weight:400;letter-spacing:.5px}
/* Knöpfe und Reiter */
.a-btn,.a-tab,.t-btn{background:#2b2f35;border:1px solid #5a606a;border-radius:0;box-shadow:inset 0 1px 0 #6b727d,0 2px 0 var(--ink);box-sizing:border-box;color:var(--txt);font-family:var(--body)}
.a-btn:hover,.a-tab:hover,.t-btn:hover{background:#363b42}
.a-btn:active,.t-btn:active{background:#202328;box-shadow:inset 0 2px 3px #000;transform:translateY(1px)}
.a-btn:disabled,.a-btn.off{background:#202226;color:#85817a;box-shadow:none;cursor:default}
.a-tab:not(.on){background:#1c1e22;color:var(--dim)}
.a-tab.on{background:#2b2f35;color:var(--title);box-shadow:inset 0 -3px 0 var(--title),0 2px 0 var(--ink)}
.a-tab:not(.on):hover{color:var(--title)}
/* Sichtbarer Tastaturfokus */
.a-btn:focus-visible,.a-tab:focus-visible,.t-btn:focus-visible,.a-kw:focus-visible,.a-x:focus-visible,.hb:focus-visible,.a-slot:focus-visible,.chr-hd:focus-visible,summary:focus-visible,.a-win input:focus-visible,.a-win select:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
/* Slots: Inventarzelle als Vertiefung; Seltenheitsfarbe als Innenring über --rc */
.a-slot,.hb,.fc{background:#121316;border:var(--cw) solid #0d0e10;box-shadow:0 0 0 1px var(--iron);box-sizing:border-box}
.a-slot.item,.hb{--rc:transparent}
.a-slot.item{box-shadow:inset 0 0 0 2px var(--rc),0 0 0 1px var(--iron)}
/* Tooltip-Panel */
.tipbox{letter-spacing:0}
.tipbox .tp-name{color:var(--title);font-family:var(--pix);font-size:18px;line-height:1.25}
.tipbox .tp-pri{color:var(--violet)}
.tipbox .tp-big{color:var(--violet);font-size:24px;line-height:1.1}
.tipbox .tp-bonus{color:var(--green)}
.tipbox .tp-dim{color:var(--dim)}
.tipbox .tp-set{color:var(--orange)}
/* Stichworte: Glut-Orange, unterstrichen */
.a-kw{color:var(--link);font:inherit;font-style:normal;background:none;border:0;border-bottom:1px solid var(--link);padding:0 2px;margin:0 1px;cursor:pointer}
.a-kw.off{cursor:default;opacity:.75;border-bottom-style:dotted}
.a-kw:hover{background:rgba(229,154,92,.14)}
`;

let done = false;
/** Schrift und Theme-Klassen einmal einhängen (vor allen anderen Stilen aufrufen). */
export function installTheme(): void {
  if (done || typeof document === 'undefined') return;
  done = true;
  const st = document.createElement('style');
  st.id = 'a-theme';
  st.textContent = THEME_CSS;
  document.head.prepend(st);
}

/** Leiste (Leben/Mana/…): Eisenkante, dunkle Mulde, Füllung mit Lichtkante. */
export const BAR_CSS = `
.pbar{position:relative;height:24px;background:#0a0a0c;border:1px solid var(--iron);box-shadow:0 0 0 1px var(--ink);box-sizing:border-box;margin:4px}
.pbar .liq{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(180deg,var(--c1) 0 2px,var(--c2) 2px calc(100% - 3px),var(--c3) calc(100% - 3px))}
.pbar.hp{--c1:#c8564c;--c2:#a03a34;--c3:#6e1d20}
.pbar.mp{--c1:#6586c8;--c2:#3f5fa3;--c3:#243c78}
.pbar .t{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:600 16px/1 var(--body);color:#fff;text-shadow:0 1px 0 #000,0 0 3px #000,0 0 3px #000}
`;
