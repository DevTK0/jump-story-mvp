import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { GAME_WIDTH, GAME_HEIGHT } from './features/stage';

// Physics constants for game config
const PHYSICS_GRAVITY_Y = 900;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#87CEEB',
  scene: GameScene,
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