import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket, type RawData } from 'ws';
import { buildWorld, type TiledMap } from '../src/sim/tiled';
import { addPlayer, applyCommand, drainEvents, getActor, removePlayer, tick, TICK_RATE, type Actor, type GameEvent, type World } from '../src/sim/world';
import { exportPlayer, importPlayer } from '../src/sim/save';
import { commandCost, makeSnapshot, validateCommand } from '../src/sim/net';

export interface ServerOptions {
  /** 0 = freier Port (Tests) */
  port: number;
  /** Standard 127.0.0.1: nur dieser Rechner. Für Freunde im selben Netz 0.0.0.0 setzen. */
  host?: string;
  seed?: number;
  pvp?: boolean;
  /** Datei für Spielstände (Name → Spielstand). Ohne Angabe wird nicht gespeichert. */
  savePath?: string;
  mapPath?: string;
  maxPlayers?: number;
  /** Sekunden, die ein getrennter Spieler nach einem Kampf noch in der Welt bleibt (gegen Combat-Logging) */
  lingerSeconds?: number;
}

export interface RunningServer {
  port: number;
  world: World;
  close(): Promise<void>;
}

interface Client {
  ws: WebSocket;
  name: string;
  actorId: number;
  /** einfache Ratenbegrenzung */
  tokens: number;
  lastRefill: number;
}

const NAME_RE = /^[A-Za-z0-9ÄÖÜäöüß _-]{2,16}$/;
const MAX_COST_PER_SEC = 40;
const JOIN_TIMEOUT_MS = 10_000;
const COMBAT_TICKS = TICK_RATE * 10;

export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const mapPath = opts.mapPath ?? fileURLToPath(new URL('../src/data/aschenthron.json', import.meta.url));
  const map = JSON.parse(readFileSync(mapPath, 'utf8')) as TiledMap;
  const { world: w } = buildWorld(opts.seed ?? (Date.now() >>> 0), map, { player: false });
  w.pvp = opts.pvp ?? true;
  const saves = new Map<string, string>(
    opts.savePath && existsSync(opts.savePath) ? Object.entries(JSON.parse(readFileSync(opts.savePath, 'utf8')) as Record<string, string>) : [],
  );
  const clients = new Map<WebSocket, Client>();
  /** Getrennte Spieler, die nach einem Kampf noch kurz in der Welt bleiben: Name → Akteur und Ablauf-Tick */
  const lingering = new Map<string, { actorId: number; until: number }>();
  let pending: GameEvent[] = [];
  let closed = false;

  /** Spielstand inkl. verbleibender Mörder-Zeit (die Welt-Ticks sind nach einem Neustart nicht vergleichbar). */
  const snapshotSave = (a: Actor): string => {
    const d = JSON.parse(exportPlayer(a)) as { v: number; mapV: number; player: Record<string, unknown> };
    d.player.pkLeft = Math.max(0, a.pkUntil - w.tick);
    return JSON.stringify(d);
  };

  const writeSaves = (): void => {
    if (!opts.savePath || closed) return;
    try {
      writeFileSync(opts.savePath, JSON.stringify(Object.fromEntries(saves)));
    } catch (e) {
      console.error('Speichern fehlgeschlagen:', (e as Error).message);
    }
  };

  const persist = (): void => {
    for (const c of clients.values()) {
      const a = getActor(w, c.actorId);
      if (a) saves.set(c.name, snapshotSave(a));
    }
    writeSaves();
  };

  const wss = new WebSocketServer({ port: opts.port, host: opts.host ?? '127.0.0.1', maxPayload: 16 * 1024 });
  await new Promise<void>((res, rej) => {
    wss.once('listening', () => res());
    wss.once('error', (e: Error) => rej(new Error(`Server konnte nicht starten: ${e.message}`)));
  });
  wss.on('error', (e: Error) => console.error('Serverfehler:', e.message));
  const port = (wss.address() as { port: number }).port;

  /** Akteur endgültig aus der Welt nehmen und speichern. */
  const finalize = (name: string, actorId: number): void => {
    const a = getActor(w, actorId);
    if (a) saves.set(name, snapshotSave(a));
    removePlayer(w, actorId);
    writeSaves();
  };

  const leave = (ws: WebSocket): void => {
    const c = clients.get(ws);
    if (!c) return;
    clients.delete(ws);
    const a = getActor(w, c.actorId);
    if (!a) return;
    const inCombat = w.tick - a.lastHitAt < COMBAT_TICKS || (a.attackedBy !== null && w.tick - a.attackedBy.at < COMBAT_TICKS) || a.pkUntil > w.tick;
    const linger = opts.lingerSeconds ?? 20;
    if (inCombat && linger > 0 && !closed) {
      // bleibt kurz schutzlos in der Welt; Speichern erst beim Entfernen
      lingering.set(c.name.toLowerCase(), { actorId: c.actorId, until: w.tick + linger * TICK_RATE });
      a.path = [];
      a.targetId = null;
      saves.set(c.name, snapshotSave(a));
      writeSaves();
    } else finalize(c.name, c.actorId);
  };

  /** Rangliste: gespeicherte und aktive Spieler, nach XP absteigend (die ersten 10). */
  const leaderboard = (): { name: string; level: number; xp: number }[] => {
    const rows = new Map<string, { name: string; level: number; xp: number }>();
    for (const [name, json] of saves) {
      try {
        const pl = (JSON.parse(json) as { player?: { level?: unknown; xp?: unknown } }).player;
        if (pl && typeof pl.level === 'number' && typeof pl.xp === 'number') rows.set(name.toLowerCase(), { name, level: pl.level, xp: pl.xp });
      } catch { /* kaputter Eintrag: überspringen */ }
    }
    for (const c of clients.values()) {
      const a = getActor(w, c.actorId);
      if (a) rows.set(c.name.toLowerCase(), { name: c.name, level: a.level, xp: a.xp });
    }
    return [...rows.values()].sort((x, y) => y.xp - x.xp).slice(0, 10);
  };

  const send = (ws: WebSocket, msg: unknown): void => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  wss.on('connection', (ws) => {
    const joinTimer = setTimeout(() => {
      if (!clients.has(ws)) ws.close(4001, 'Kein Join');
    }, JOIN_TIMEOUT_MS);
    ws.on('message', (data: RawData) => {
      let msg: { t?: string; name?: unknown; c?: unknown };
      try {
        msg = JSON.parse(data.toString()) as typeof msg;
      } catch {
        return;
      }
      const c = clients.get(ws);
      if (!c) {
        if (msg.t !== 'join') return;
        const name = typeof msg.name === 'string' ? msg.name.trim() : '';
        if (!NAME_RE.test(name)) return send(ws, { t: 'error', reason: 'Ungültiger Name (2–16 Zeichen: Buchstaben, Ziffern, Leerzeichen, _ -).' });
        const key = name.toLowerCase();
        const rejoin = [...clients.values()].some((x) => x.name.toLowerCase() === key);
        if (!rejoin && clients.size >= (opts.maxPlayers ?? 32)) return send(ws, { t: 'error', reason: 'Server ist voll.' });
        // zweite Verbindung mit gleichem Namen ersetzt die erste
        for (const [other, oc] of clients) {
          if (oc.name.toLowerCase() === key) {
            const keep = oc.actorId;
            clients.delete(other);
            // Akteur bleibt bestehen und wird an die neue Verbindung übergeben
            lingering.set(key, { actorId: keep, until: Number.MAX_SAFE_INTEGER });
            other.close(4000, 'Angemeldet an anderer Stelle');
          }
        }
        let actor: Actor | undefined;
        const ghost = lingering.get(key);
        if (ghost) {
          lingering.delete(key);
          actor = getActor(w, ghost.actorId);
        }
        if (!actor) {
          actor = addPlayer(w, name);
          const saved = saves.get(name);
          if (saved && importPlayer(w, actor, saved)) {
            const pkLeft = (JSON.parse(saved) as { player?: { pkLeft?: number } }).player?.pkLeft;
            if (typeof pkLeft === 'number' && pkLeft > 0) actor.pkUntil = w.tick + pkLeft;
          }
        }
        clearTimeout(joinTimer);
        clients.set(ws, { ws, name, actorId: actor.id, tokens: MAX_COST_PER_SEC, lastRefill: Date.now() });
        send(ws, { t: 'welcome', id: actor.id, tickRate: TICK_RATE, pvp: w.pvp, seed: opts.seed ?? 0 });
        return;
      }
      if (msg.t === 'board') return send(ws, { t: 'board', rows: leaderboard() });
      if (msg.t !== 'cmd') return;
      const cmd = validateCommand(w, msg.c);
      if (!cmd) return;
      // Ratenbegrenzung nach Aufwand (Wegsuchen kosten mehr)
      const now = Date.now();
      c.tokens = Math.min(MAX_COST_PER_SEC, c.tokens + ((now - c.lastRefill) / 1000) * MAX_COST_PER_SEC);
      c.lastRefill = now;
      const cost = commandCost(cmd);
      if (c.tokens < cost) return;
      c.tokens -= cost;
      applyCommand(w, c.actorId, cmd);
    });
    ws.on('close', () => {
      clearTimeout(joinTimer);
      leave(ws);
    });
    ws.on('error', () => {
      clearTimeout(joinTimer);
      leave(ws);
    });
  });

  let n = 0;
  const timer = setInterval(() => {
    tick(w);
    pending.push(...drainEvents(w));
    n++;
    for (const [key, g] of lingering) {
      if (w.tick >= g.until) {
        lingering.delete(key);
        const a = getActor(w, g.actorId);
        finalize(a?.name ?? key, g.actorId);
      }
    }
    if (n % 2 === 0) {
      for (const c of clients.values()) {
        const you = getActor(w, c.actorId);
        if (you) send(c.ws, makeSnapshot(w, you, pending));
      }
      pending = [];
    }
    if (n % (TICK_RATE * 30) === 0) persist();
  }, 1000 / TICK_RATE);

  return {
    port,
    world: w,
    async close(): Promise<void> {
      clearInterval(timer);
      persist();
      for (const [key, g] of lingering) {
        const a = getActor(w, g.actorId);
        if (a) saves.set(a.name, snapshotSave(a));
        lingering.delete(key);
      }
      writeSaves();
      closed = true;
      for (const ws of clients.keys()) ws.close();
      await new Promise<void>((res) => wss.close(() => res()));
    },
  };
}
