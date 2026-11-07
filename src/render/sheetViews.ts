import { figViews } from './figure';
import { ISO } from './iso';

/** Ansichten, die dieses Spiel bäckt (Draufsicht 3, Iso 5); der Worker bekommt sie mit, weil `ISO` dort immer `false` ist */
export const SHEET_VIEWS = figViews(ISO);
