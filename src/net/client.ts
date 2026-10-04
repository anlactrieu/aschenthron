import { buildWorld, type TiledMap } from '../sim/tiled';
import { actorFromLite, type Snapshot } from '../sim/net';
import type { Command, GameEvent, World } from '../sim/world';

/**
 * Verbindung zu einem Aschenthron-Server. Der Client rechnet nichts selbst: er hält eine Spiegelwelt
 * (Karte lokal, Akteure und Beute aus den Schnappschüssen) und schickt nur Befehle.
 */
export class RemoteSession {
  readonly world: World;
  readonly tiles: number[];
  playerId = -1;
  pvp = false;
  private ws: WebSocket | null = null;
  private events: GameEvent[] = [];
  closed = false;

  constructor(private url: string, private name: string, map: TiledMap) {
    const built = buildWorld(0, map, { player: false });
    this.world = built.world;
    this.tiles = built.tiles;
    this.world.actors = [];
    this.world.pvp = true;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const fail = (m: string) => reject(new Error(m));
      ws.onerror = () => fail('Keine Verbindung zum Server.');
      ws.onclose = () => {
        this.closed = true;
        if (this.playerId < 0) fail('Verbindung geschlossen.');
      };
      ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name: this.name }));
      ws.onmessage = (ev) => {
        let m: { t: string; id?: number; reason?: string; pvp?: boolean };
        try {
          m = JSON.parse(String(ev.data)) as typeof m;
        } catch {
          return;
        }
        if (m.t === 'error') return fail(m.reason ?? 'Fehler');
        if (m.t === 'welcome') {
          this.playerId = m.id!;
          this.pvp = !!m.pvp;
          this.world.pvp = this.pvp;
          return;
        }
        if (m.t === 'snap') {
          this.apply(m as unknown as Snapshot);
          resolve();
        }
      };
    });
  }

  private apply(s: Snapshot): void {
    const w = this.world;
    w.tick = s.tick;
    w.actors = [s.you, ...s.actors.map((l) => actorFromLite(l, s.tick))];
    w.ground = s.ground;
    for (const c of s.chests) {
      const ch = w.chests.find((x) => x.id === c.id);
      if (ch) ch.opened = c.opened;
    }
    this.events.push(...s.events);
  }

  send(c: Command): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'cmd', c }));
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
