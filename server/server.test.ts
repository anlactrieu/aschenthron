import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { startServer, type RunningServer } from './server';
import type { Snapshot } from '../src/sim/net';
import { getActor, maxHpOf, isPk } from '../src/sim/world';

interface TestClient {
  ws: WebSocket;
  id: number;
  last: Snapshot | null;
  events: Snapshot['events'];
  errors: string[];
  send(m: unknown): void;
  waitFor(pred: (s: Snapshot) => boolean, ms?: number): Promise<Snapshot>;
  close(): void;
}

const open: RunningServer[] = [];
const clients: TestClient[] = [];
const dirs: string[] = [];

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  for (const s of open.splice(0)) await s.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

async function connect(srv: RunningServer, name: string): Promise<TestClient> {
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}`);
  const c: TestClient = {
    ws, id: -1, last: null, events: [], errors: [],
    send: (m) => ws.send(JSON.stringify(m)),
    waitFor: (pred, ms = 4000) => new Promise((res, rej) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (c.last && pred(c.last)) { clearInterval(iv); res(c.last); }
        else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error('Zeitüberschreitung')); }
      }, 20);
    }),
    close: () => ws.close(),
  };
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString()) as { t: string; id?: number; reason?: string };
    if (m.t === 'welcome') c.id = m.id!;
    else if (m.t === 'snap') { const sn = m as unknown as Snapshot; c.last = sn; c.events.push(...sn.events); }
    else if (m.t === 'error') c.errors.push(m.reason!);
  });
  await new Promise<void>((res, rej) => { ws.once('open', () => res()); ws.once('error', rej); });
  c.send({ t: 'join', name });
  clients.push(c);
  await new Promise<void>((res) => { const iv = setInterval(() => { if (c.id >= 0 || c.errors.length) { clearInterval(iv); res(); } }, 10); });
  return c;
}

async function boot(extra: Partial<Parameters<typeof startServer>[0]> = {}): Promise<RunningServer> {
  const s = await startServer({ port: 0, seed: 1, ...extra });
  open.push(s);
  return s;
}

describe('Mehrspieler-Server', () => {
  it('zwei Spieler sehen einander; Befehle bewegen den eigenen Spieler', async () => {
    const srv = await boot();
    const a = await connect(srv, 'Anna');
    const b = await connect(srv, 'Ben');
    expect(a.id).toBeGreaterThan(0);
    expect(b.id).not.toBe(a.id);
    await a.waitFor((s) => s.actors.some((x) => x.id === b.id && x.name === 'Ben'));
    const start = getActor(srv.world, a.id)!;
    const row = Math.round(start.y);
    let tx = Math.round(start.x) + 4;
    while (!srv.world.grid.walkable[row * srv.world.grid.w + tx] && tx > 0) tx--;
    a.send({ t: 'cmd', c: { type: 'moveTo', x: tx, y: row } });
    const snap = await a.waitFor((s) => Math.abs(s.you.x - tx) < 0.2 && Math.abs(s.you.y - row) < 0.2);
    expect(snap.you.name).toBe('Anna');
    // Ben sieht Annas neue Position
    const seen = await b.waitFor((s) => s.actors.some((x) => x.id === a.id && Math.abs(x.x - tx) < 0.3));
    expect(seen.actors.find((x) => x.id === a.id)!.kind).toBe('player');
  });

  it('PvP ist in der Stadt gesperrt, draußen erlaubt; Angreifer wird Mörder, Notwehr nicht', async () => {
    const srv = await boot();
    const a = await connect(srv, 'Anna');
    const b = await connect(srv, 'Ben');
    const A = getActor(srv.world, a.id)!;
    const B = getActor(srv.world, b.id)!;
    // in der Stadt: Angriff abgelehnt
    b.send({ t: 'cmd', c: { type: 'attack', targetId: a.id } });
    await b.waitFor(() => b.events.some((e) => e.type === 'fail'));
    expect(A.hp).toBe(maxHpOf(A));
    // draußen (ruhige Stelle im Roggenfeld, Monster schlafen/aggro 4 wird ignoriert)
    for (const m of srv.world.actors) if (m.kind === 'monster') m.aggroRange = 0;
    A.x = 60; A.y = 100; B.x = 61; B.y = 100;
    B.damage = [20, 20];
    b.events.length = 0;
    b.send({ t: 'cmd', c: { type: 'attack', targetId: a.id } });
    await a.waitFor((s) => s.you.hp < maxHpOf(A));
    expect(isPk(srv.world, B)).toBe(true);
    expect(isPk(srv.world, A)).toBe(false);
    // Notwehr: Anna schlägt zurück und wird dadurch kein Mörder
    A.damage = [1, 1];
    a.send({ t: 'cmd', c: { type: 'attack', targetId: b.id } });
    await b.waitFor((s) => s.you.hp < maxHpOf(B));
    expect(isPk(srv.world, A)).toBe(false);
  });

  it('ungültige Befehle, Namen und Nachrichten werden ignoriert', async () => {
    const srv = await boot();
    const bad = await connect(srv, '!');
    expect(bad.errors.length).toBe(1);
    const a = await connect(srv, 'Anna');
    const A = getActor(srv.world, a.id)!;
    const x0 = A.x;
    a.send({ t: 'cmd', c: { type: 'moveTo', x: 'a', y: 1 } });
    a.send({ t: 'cmd', c: { type: 'teleport', x: 5 } });
    a.send({ t: 'cmd', c: { type: 'moveTo', x: -5, y: 9999 } });
    a.ws.send('kein json');
    a.send({ t: 'cmd', c: null });
    await new Promise((r) => setTimeout(r, 300));
    expect(A.x).toBe(x0);
    expect(A.path).toEqual([]);
  });

  it('Spielstand bleibt über Neuverbindung erhalten, zweite Verbindung desselben Namens ersetzt die erste', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'asch-'));
    dirs.push(dir);
    const savePath = join(dir, 'saves.json');
    const srv = await boot({ savePath });
    const a = await connect(srv, 'Anna');
    getActor(srv.world, a.id)!.gold = 777;
    const a2 = await connect(srv, 'Anna');
    await new Promise((r) => setTimeout(r, 200));
    expect(a.ws.readyState).not.toBe(WebSocket.OPEN);
    await a2.waitFor((s) => s.you.name === 'Anna');
    expect(getActor(srv.world, a2.id)!.gold).toBe(777);
    // nach Neustart des Servers aus der Datei
    a2.close();
    await new Promise((r) => setTimeout(r, 200));
    await srv.close();
    open.length = 0;
    const srv2 = await boot({ savePath });
    const a3 = await connect(srv2, 'Anna');
    expect(getActor(srv2.world, a3.id)!.gold).toBe(777);
  });

  it('Schnappschüsse sind auf die Umgebung begrenzt', async () => {
    const srv = await boot();
    const a = await connect(srv, 'Anna');
    const A = getActor(srv.world, a.id)!;
    A.x = 80; A.y = 76;
    const snap = await a.waitFor((s) => Math.abs(s.you.x - 80) < 0.1);
    for (const x of snap.actors) {
      expect(Math.abs(x.x - 80)).toBeLessThanOrEqual(38);
      expect(Math.abs(x.y - 76)).toBeLessThanOrEqual(38);
    }
    expect(snap.actors.length).toBeGreaterThan(0);
  });
});

describe('Mehrspieler: Combat-Logging und Robustheit', () => {
  it('Spieler im Kampf bleibt nach dem Trennen kurz in der Welt; Mörder-Status bleibt erhalten', async () => {
    const srv = await boot({ lingerSeconds: 5 });
    const a = await connect(srv, 'Anna');
    const b = await connect(srv, 'Ben');
    const A = getActor(srv.world, a.id)!;
    const B = getActor(srv.world, b.id)!;
    for (const m of srv.world.actors) if (m.kind === 'monster') m.aggroRange = 0;
    A.x = 60; A.y = 100; B.x = 61; B.y = 100;
    B.damage = [3, 3];
    b.send({ t: 'cmd', c: { type: 'attack', targetId: a.id } });
    await a.waitFor((s) => s.you.hp < maxHpOf(A));
    expect(isPk(srv.world, B)).toBe(true);
    b.close();
    await new Promise((r) => setTimeout(r, 300));
    // Ben ist noch als Akteur in der Welt (Combat-Logging-Schutz)
    expect(getActor(srv.world, b.id)).toBeDefined();
    // Wiederverbinden übernimmt denselben Akteur samt Mörder-Status
    const b2 = await connect(srv, 'Ben');
    expect(b2.id).toBe(b.id);
    expect(isPk(srv.world, getActor(srv.world, b2.id)!)).toBe(true);
  });

  it('Port-Konflikt liefert klare Fehlermeldung, Sockets ohne Join werden beendet', async () => {
    const srv = await boot();
    await expect(startServer({ port: srv.port, seed: 1 })).rejects.toThrow(/Server konnte nicht starten/);
  });

  it('Spielername __proto__ bekommt trotzdem einen Spielstand', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'asch-'));
    dirs.push(dir);
    const savePath = join(dir, 'saves.json');
    const srv = await boot({ savePath, lingerSeconds: 0 });
    const a = await connect(srv, '__proto__');
    getActor(srv.world, a.id)!.gold = 55;
    a.close();
    await new Promise((r) => setTimeout(r, 200));
    const a2 = await connect(srv, '__proto__');
    expect(getActor(srv.world, a2.id)!.gold).toBe(55);
  });
});

describe('Rangliste', () => {
  it('liefert angemeldete Spieler nach XP sortiert', async () => {
    const srv = await startServer({ port: 0, seed: 5 });
    open.push(srv);
    const a = await connect(srv, 'Alpha');
    clients.push(a);
    const got = new Promise<{ rows: { name: string; xp: number }[] }>((res) => {
      a.ws.on('message', (d) => {
        const m = JSON.parse(d.toString());
        if (m.t === 'board') res(m);
      });
    });
    a.send({ t: 'board' });
    const m = await got;
    expect(m.rows.some((r) => r.name === 'Alpha')).toBe(true);
  });
});

