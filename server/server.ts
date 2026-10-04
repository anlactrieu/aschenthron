import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { WebSocketServer, type WebSocket, type RawData } from 'ws';
import { buildWorld, type TiledMap } from '../src/sim/tiled';
import { addPlayer, applyCommand, drainEvents, getActor, removePlayer, tick, TICK_RATE, type Actor, type GameEvent, type World } from '../src/sim/world';
import { exportPlayer, importPlayer } from '../src/sim/save';
import { makeSnapshot, validateCommand } from '../src/sim/net';

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
  /** einfache Ratenbegrenzung (Tokens pro Sekunde) */
  tokens: number;
  lastRefill: number;
}

const NAME_RE = /^[A-Za-z0-9ÄÖÜäöüß _-]{2,16}$/;
const MAX_MSG_PER_SEC = 40;

export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const mapPath = opts.mapPath ?? new URL('../src/data/aschenthron.json', import.meta.url).pathname;
  const map = JSON.parse(readFileSync(mapPath, 'utf8')) as TiledMap;
  const { world: w } = buildWorld(opts.seed ?? (Date.now() >>> 0), map, { player: false });
  w.pvp = opts.pvp ?? true;
  const saves: Record<string, string> = opts.savePath && existsSync(opts.savePath) ? (JSON.parse(readFileSync(opts.savePath, 'utf8')) as Record<string, string>) : {};
  const clients = new Map<WebSocket, Client>();
  let pending: GameEvent[] = [];

  let closed = false;
  const writeSaves = (): void => {
    if (!opts.savePath || closed) return;
    try {
      writeFileSync(opts.savePath, JSON.stringify(saves));
    } catch (e) {
      console.error('Speichern fehlgeschlagen:', (e as Error).message);
    }
  };

  const persist = (): void => {
    if (!opts.savePath) return;
    for (const c of clients.values()) {
      const a = getActor(w, c.actorId);
      if (a) saves[c.name] = exportPlayer(a);
    }
    writeSaves();
  };

  const wss = new WebSocketServer({ port: opts.port, host: opts.host ?? '127.0.0.1', maxPayload: 16 * 1024 });
  await new Promise<void>((res) => wss.once('listening', () => res()));
  const port = (wss.address() as { port: number }).port;

  const leave = (ws: WebSocket): void => {
    const c = clients.get(ws);
    if (!c) return;
    const a = getActor(w, c.actorId);
    if (a && opts.savePath) saves[c.name] = exportPlayer(a);
    removePlayer(w, c.actorId);
    clients.delete(ws);
    writeSaves();
  };

  const send = (ws: WebSocket, msg: unknown): void => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  wss.on('connection', (ws) => {
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
        if (clients.size >= (opts.maxPlayers ?? 32)) return send(ws, { t: 'error', reason: 'Server ist voll.' });
        // zweite Verbindung mit gleichem Namen ersetzt die erste
        for (const [other, oc] of clients) {
          if (oc.name.toLowerCase() === name.toLowerCase()) {
            leave(other);
            other.close(4000, 'Angemeldet an anderer Stelle');
          }
        }
        const actor: Actor = addPlayer(w, name);
        const saved = saves[name];
        if (saved) importPlayer(w, actor, saved);
        clients.set(ws, { ws, name, actorId: actor.id, tokens: MAX_MSG_PER_SEC, lastRefill: Date.now() });
        send(ws, { t: 'welcome', id: actor.id, tickRate: TICK_RATE, pvp: w.pvp, seed: opts.seed ?? 0 });
        return;
      }
      // Ratenbegrenzung
      const now = Date.now();
      c.tokens = Math.min(MAX_MSG_PER_SEC, c.tokens + ((now - c.lastRefill) / 1000) * MAX_MSG_PER_SEC);
      c.lastRefill = now;
      if (c.tokens < 1) return;
      c.tokens -= 1;
      if (msg.t === 'cmd') {
        const cmd = validateCommand(w, msg.c);
        if (cmd) applyCommand(w, c.actorId, cmd);
      }
    });
    ws.on('close', () => leave(ws));
    ws.on('error', () => leave(ws));
  });

  let n = 0;
  const timer = setInterval(() => {
    tick(w);
    pending.push(...drainEvents(w));
    n++;
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
      closed = true;
      for (const ws of clients.keys()) ws.close();
      await new Promise<void>((res) => wss.close(() => res()));
    },
  };
}
