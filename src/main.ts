import Phaser from 'phaser';
import mapJson from './data/aschenthron.json';
import { GameScene } from './render/GameScene';
import { RemoteSession } from './net/client';
import type { TiledMap } from './sim/tiled';

function showError(msg: string): void {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;color:#c9b79c;font:16px system-ui,sans-serif;background:#0b0a0d';
  const text = document.createElement('div');
  text.textContent = msg;
  const link = document.createElement('a');
  link.style.color = '#e8c040';
  link.href = location.pathname;
  link.textContent = 'Einzelspieler starten';
  d.append(text, link);
  document.body.appendChild(d);
}

async function boot(): Promise<void> {
  const q = new URLSearchParams(location.search);
  let session: RemoteSession | undefined;
  const server = q.get('server');
  if (server) {
    const name = (q.get('name') ?? '').trim() || 'Held';
    session = new RemoteSession(server, name, mapJson as unknown as TiledMap);
    try {
      await session.connect();
    } catch (e) {
      showError(`Mehrspieler: ${(e as Error).message}`);
      return;
    }
  }
  const scene = new GameScene();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    pixelArt: true,
    parent: 'game',
    width: window.innerWidth,
    height: window.innerHeight,
    scale: { mode: Phaser.Scale.RESIZE },
    scene: [],
  });
  game.scene.add('game', scene, true, { session });
  if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
}

void boot();
