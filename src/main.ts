import Phaser from 'phaser';
import { GameScene } from './render/GameScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth,
  height: window.innerHeight,
  scale: { mode: Phaser.Scale.RESIZE },
  scene: [GameScene],
});

if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
