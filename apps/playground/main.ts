import Phaser from 'phaser';
import { PreloaderScene } from './scenes/preloader-scene';
import { PlaygroundScene } from './scenes/playground-scene';

// Physics constants for game config
const PHYSICS_GRAVITY_Y = 900;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#87CEEB',
  scene: [PreloaderScene, PlaygroundScene],
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    target: 120,
    forceSetTimeOut: true,
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PHYSICS_GRAVITY_Y },
      debug: true,
    },
  },
  audio: {
    disableWebAudio: false,
  },
};

// Create and start the game
const game = new Phaser.Game(gameConfig);

export default game;
