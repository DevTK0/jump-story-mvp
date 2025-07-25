import type { System } from '../core/types';
import { Player } from '../player/player';
import { InputSystem } from '../player/input';

/**
 * Configuration for teleport effect
 */
export interface TeleportConfig {
  /** Cooldown between teleports in milliseconds */
  cooldown: number;
  /** Distance to teleport in pixels */
  distance: number;
  /** Maximum X coordinate for teleport bounds */
  maxBoundX: number;
}

/**
 * Default teleport configuration
 */
const DEFAULT_TELEPORT_CONFIG: TeleportConfig = {
  cooldown: 1000, // 1 second
  distance: 800, // pixels
  maxBoundX: 3000, // map width limit
};

/**
 * Teleport effect that moves the player instantly in their facing direction
 * Can be used as a skill, ability, or for testing position reconciliation
 */
export class TeleportEffect implements System {
  private player: Player;
  private lastTeleportTime: number = 0;
  private config: TeleportConfig;

  constructor(player: Player, config?: Partial<TeleportConfig>) {
    this.player = player;
    this.config = {
      ...DEFAULT_TELEPORT_CONFIG,
      ...config,
    };
  }

  update(time: number, _delta: number): void {
    const inputSystem = this.player.getSystem<InputSystem>('input');
    if (!inputSystem) return;

    // Check if teleport key (T) was just pressed
    if (inputSystem.isJustPressed('teleport')) {
      // Teleport key (T) pressed
      this.handleTeleportInput(time);
    }
  }

  private handleTeleportInput(time: number): void {
    // Prevent teleport spam
    if (time - this.lastTeleportTime < this.config.cooldown) {
      // Teleport on cooldown
      return;
    }

    // Don't allow teleport if player is dead
    const stateMachine = this.player.getStateMachine();
    if (stateMachine.isInState('Dead')) {
      // Cannot teleport while dead
      return;
    }

    // Teleport in the direction the player is facing
    const facingDirection = this.player.facingDirection; // -1 for left, 1 for right

    // Calculate target position based on facing direction
    const targetX = this.player.x + this.config.distance * facingDirection;
    const targetY = this.player.y; // Keep Y unchanged for horizontal teleport

    // Ensure the target position is within bounds
    const clampedX = Math.max(0, Math.min(this.config.maxBoundX, targetX));

    // CLIENT-ONLY TELEPORT - Move player locally without telling server
    // This should trigger position reconciliation when server notices the discrepancy
    // CLIENT-ONLY teleport in facing direction

    // Directly set player position on client
    this.player.setPosition(clampedX, targetY);
    this.lastTeleportTime = time;
  }

  // Reserved for future server-side teleport functionality
  // public setDbConnection(dbConnection: DbConnection): void {
  //     this.dbConnection = dbConnection;
  // }

  public destroy(): void {
    // No cleanup needed for this system
  }
}
