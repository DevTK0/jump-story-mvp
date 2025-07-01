// Main player class
export { Player, type PlayerConfig } from './Player';

// Player systems
export { InputSystem } from './input';
export { MovementSystem } from './movement';
export { ClimbingSystem, type ClimbingConfig } from './climbing';
export { CombatSystem, type AttackConfig } from './combat';
export { AnimationSystem } from './animations';

// Factory function to create a fully configured player
import { Player, type PlayerConfig } from './Player';
import { InputSystem } from './input';
import { MovementSystem } from './movement';
import { ClimbingSystem, type ClimbingConfig } from './climbing';
import { CombatSystem, type AttackConfig } from './combat';
import { AnimationSystem } from './animations';

export interface PlayerFactoryConfig extends PlayerConfig {
  climbingConfig?: ClimbingConfig;
  attackConfig?: AttackConfig;
}

export function createPlayer(config: PlayerFactoryConfig): Player {
  // Create the player instance
  const player = new Player(config);
  
  // Create all systems
  const inputSystem = new InputSystem(player);
  const movementSystem = new MovementSystem(player, inputSystem);
  const climbingSystem = new ClimbingSystem(player, inputSystem, movementSystem, config.scene);
  const combatSystem = new CombatSystem(player, inputSystem, config.scene, config.attackConfig);
  const animationSystem = new AnimationSystem(player, inputSystem, config.scene);
  
  // Configure climbing if config provided
  if (config.climbingConfig) {
    climbingSystem.setConfig(config.climbingConfig);
  }
  
  // Register systems with the player
  player.registerSystem('input', inputSystem);
  player.registerSystem('movement', movementSystem);
  player.registerSystem('climbing', climbingSystem);
  player.registerSystem('combat', combatSystem);
  player.registerSystem('animations', animationSystem);
  
  return player;
}

// Type exports
export type { System } from '../../shared/types';

// Export player constants
export * from './constants';