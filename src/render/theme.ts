import { NINJA_BASE } from './ninja';

/**
 * Zentrales UI-Theme (Ninja Adventure, CC0): Pixelschrift, Holzrahmen, Knöpfe, Reiter, Slots.
 * Alle Fenster, Tooltips, HUD-Elemente und Credits nutzen nur diese Variablen und Klassen.
 * Bilder aus `Ui/Theme/Theme Wood`, per `border-image` (9-Slice) mit `image-rendering: pixelated` gestreckt.
 */

const img = (n: string): string => `url("${NINJA_BASE}Ui/Theme/Theme%20Wood/${n}.png")`;
export const faceUrl = (who: string): string => `${NINJA_BASE}Actor/Character/${who}/Faceset.png`;

export const THEME_CSS = `
@font-face{font-family:'NinjaUi';src:url("${NINJA_BASE}Ui/Font/NormalFont.ttf") format('truetype');font-display:swap}
:root{
  --ui-font:'NinjaUi','Courier New',ui-monospace,monospace,sans-serif;
  --bw:10px;--cw:6px;--tl-h:108px;--mm-h:0px;
  --ink:#131b1b;--wood:#46402e;--wood-d:#2d2a1f;--wood-l:#6b5a3c;
  --txt:#f1e6c8;--dim:#b4a888;--gold:#ffd24a;--orange:#ff9a3c;--violet:#c58cff;--green:#7fe08a;--red:#ff6a5a;
}
body{font-family:var(--ui-font);font-synthesis:none;letter-spacing:.3px;word-spacing:2px}
button,input,select,textarea{font-family:var(--ui-font);letter-spacing:.3px;word-spacing:2px}

/* Holzrahmen (Fenster, Panels): 10-px-Rahmen aus nine_path_panel, Innenfläche dunkles Holz */
.w-frame,.a-win{border:var(--bw) solid transparent;border-image:${img('nine_path_panel')} 5 / var(--bw) stretch;background:var(--wood);background-clip:padding-box;image-rendering:pixelated;box-sizing:content-box;color:var(--txt);font:16px/1.35 var(--ui-font)}
/* Titelleiste / Knöpfe / Reiter: Orange-Platte aus button_*.png */
.a-win h3,.a-btn,.a-tab,.t-btn,.w-plate{border:solid transparent;border-width:4px 4px 6px;border-image:${img('button_normal')} 2 2 3 2 fill / 4px 4px 6px stretch;background:none;image-rendering:pixelated;box-sizing:border-box;color:var(--ink)}
.a-btn:hover,.a-tab:hover,.t-btn:hover{border-image-source:${img('button_hover')}}
.a-btn:active,.t-btn:active{border-image-source:${img('button_pressed')};color:var(--txt)}
.a-btn:disabled,.a-btn.off{border-image-source:${img('button_disabled')};color:#3d3a2c;cursor:default}
.a-tab:not(.on){border-image-source:${img('button_pressed')};color:var(--txt)}
.a-tab:not(.on):hover{color:var(--gold)}
/* Slots: Inventarzelle; Seltenheitsfarbe als Innenring über --rc */
.a-slot,.hb,.fc{border:var(--cw) solid transparent;border-image:${img('inventory_cell')} 3 fill / var(--cw) stretch;image-rendering:pixelated;box-sizing:border-box}
.a-slot.item,.hb{--rc:transparent}
.a-slot.item{box-shadow:inset 0 0 0 2px var(--rc)}
/* Tooltip-Panel (dunkel, Holzrahmen) */
.tipbox{text-transform:uppercase;letter-spacing:.6px}
.tipbox .tp-name{color:var(--gold);font-size:18px;line-height:1.2}
.tipbox .tp-pri{color:var(--violet)}
.tipbox .tp-big{color:var(--violet);font-size:24px;line-height:1.1}
.tipbox .tp-bonus{color:var(--green)}
.tipbox .tp-dim{color:var(--dim)}
.tipbox .tp-set{color:var(--orange)}
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

/** Pixelleiste (Leben/Mana/…): Rahmen aus Tinte + Orangering, Füllung mit Lichtkante. */
export const BAR_CSS = `
.pbar{position:relative;height:24px;background:#1d1810;border:3px solid var(--ink);box-shadow:0 0 0 3px #f06733,0 0 0 5px var(--ink);box-sizing:border-box;margin:5px}
.pbar .liq{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(180deg,var(--c1) 0 3px,var(--c2) 3px calc(100% - 4px),var(--c3) calc(100% - 4px))}
.pbar.hp{--c1:#ff9a8a;--c2:#d83a3a;--c3:#8a1f22}
.pbar.mp{--c1:#9ac0ff;--c2:#3a6ae0;--c3:#1f3a8a}
.pbar .t{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:16px/1 var(--ui-font);color:#fff;text-shadow:-1px 0 var(--ink),1px 0 var(--ink),0 -1px var(--ink),0 1px var(--ink)}
`;
