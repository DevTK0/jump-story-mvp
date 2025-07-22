import Phaser from 'phaser';
import { PlaygroundScene } from './scenes/playground-scene';
import { STAGE_CONFIG } from '@/stage';

// Physics constants for game config
const PHYSICS_GRAVITY_Y = 900;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: STAGE_CONFIG.world.width,
  height: STAGE_CONFIG.world.height,
  backgroundColor: '#87CEEB',
  scene: PlaygroundScene,
  parent: 'game-container',
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PHYSICS_GRAVITY_Y },
      debug: false
    }
  }
};

// Create and start the game
const game = new Phaser.Game(gameConfig);

export default game;