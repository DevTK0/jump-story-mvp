import { Player, type PlayerConfig } from './player';
import { InputSystem } from './input';
import { MovementSystem } from './movement/movement';
import { ClimbingSystem } from './movement/climbing';
import { CombatSystemEnhanced } from './combat/combat-enhanced';
import { AnimationSystem } from './animations';
import { RespawnSystem } from './state/respawn-system';
import { SyncSystem } from './sync/sync-system';
// import { TeleportEffect } from '../effects'; // T key now opens teleport menu
import { DebugSystem } from '@/debug/debug-system';
import { DeathMonitor } from './combat/death-monitor';
import jobAttributesConfig from '../../apps/playground/config/job-attributes';

/**
 * Builder pattern implementation for creating fully configured Player instances.
 * Provides a fluent API for step-by-step player configuration and system setup.
 *
 * Usage:
 * ```typescript
 * const player = new PlayerBuilder(scene)
 *   .setPosition(100, 200)
 *   .setTexture('soldier')
 *   .withCombat({ damage: 10, reach: 50 })
 *   .withDebugging()
 *   .build();
 * ```
 */
export class PlayerBuilder {
  private config: PlayerConfig;
  private enabledSystems: Set<string> = new Set(['input', 'movement']); // Always include core systems

  constructor(scene: Phaser.Scene) {
    // Initialize with default configuration
    this.config = {
      scene,
      x: 0,
      y: 0,
      texture: 'soldier',
    };
  }

  /**
   * Set the player's starting position
   */
  public setPosition(x: number, y: number): PlayerBuilder {
    this.config.x = x;
    this.config.y = y;
    return this;
  }

  /**
   * Set the player's texture and optional frame
   */
  public setTexture(texture: string, frame?: string | number): PlayerBuilder {
    this.config.texture = texture;
    if (frame !== undefined) {
      this.config.frame = frame;
    }
    return this;
  }

  /**
   * Configure combat system with custom attack configuration
   */
  public withCombat(): PlayerBuilder {
    this.enabledSystems.add('combat');
    return this;
  }

  /**
   * Enable climbing system for ladder interactions
   */
  public withClimbing(): PlayerBuilder {
    this.enabledSystems.add('climbing');
    return this;
  }

  /**
   * Enable animation system for sprite animations
   */
  public withAnimations(): PlayerBuilder {
    this.enabledSystems.add('animations');
    return this;
  }

  /**
   * Enable debug system for development tools
   */
  public withDebugging(): PlayerBuilder {
    this.enabledSystems.add('debug');
    return this;
  }

  /**
   * Enable all available systems (full-featured player)
   */
  public withAllSystems(): PlayerBuilder {
    this.enabledSystems.add('combat');
    this.enabledSystems.add('climbing');
    this.enabledSystems.add('animations');
    this.enabledSystems.add('debug');
    return this;
  }

  /**
   * Disable a specific system (useful for minimal configurations)
   */
  public withoutSystem(systemName: string): PlayerBuilder {
    if (systemName === 'input' || systemName === 'movement') {
      console.warn(`Cannot disable core system: ${systemName}`);
      return this;
    }
    this.enabledSystems.delete(systemName);
    return this;
  }

  /**
   * Build and return the fully configured Player instance
   */
  public build(): Player {
    // Create the player instance
    const player = Player.create(this.config);

    // Initialize player components
    player.initializeInput();
    player.initializeStateMachine();

    // Create and register systems based on configuration
    this.createAndRegisterSystems(player);

    return player;
  }

  private createAndRegisterSystems(player: Player): void {
    const systems = new Map<string, any>();

    // Create input system (always required)
    const inputSystem = new InputSystem(player);
    systems.set('input', inputSystem);

    // Create movement system (always required)
    const movementSystem = new MovementSystem(player, inputSystem);
    systems.set('movement', movementSystem);

    // Create sync system (always required for online play)
    const syncSystem = new SyncSystem(player);
    syncSystem.setMovementSystem(movementSystem);
    systems.set('sync', syncSystem);

    // Create death monitor (always required)
    const deathMonitor = new DeathMonitor(player);
    systems.set('deathMonitor', deathMonitor);

    // Create optional systems based on configuration
    if (this.enabledSystems.has('climbing')) {
      const climbingSystem = new ClimbingSystem(
        player,
        inputSystem,
        movementSystem,
        this.config.scene
      );
      systems.set('climbing', climbingSystem);
    }

    if (this.enabledSystems.has('combat')) {
      // Use enhanced combat system for auto hitbox generation
      const playerJob = this.config.texture || 'soldier';
      const jobConfig = jobAttributesConfig.jobs[playerJob] || jobAttributesConfig.jobs.soldier;
      
      if (!jobAttributesConfig.jobs[playerJob]) {
        console.warn(`Job ${playerJob} not found, defaulting to soldier`);
      }
      
      const combatSystem = new CombatSystemEnhanced(
        player,
        inputSystem,
        this.config.scene,
        playerJob,
        jobConfig
      );
      systems.set('combat', combatSystem);

      // Listen for job changes to update combat system
      player.on('jobChanged', (newJob: string) => {
        const newJobConfig = jobAttributesConfig.jobs[newJob] || jobAttributesConfig.jobs.soldier;
        combatSystem.setPlayerJob(newJob, newJobConfig);
        if (player.texture.key !== newJob) {
          logger.info(`[jobChanged] Setting job to [${newJob}] as texture detected to be ${player.texture.key}`);
          player.setTexture(newJob);
        }
      });
    }

    if (this.enabledSystems.has('animations')) {
      const animationSystem = new AnimationSystem(player, inputSystem, this.config.scene);
      systems.set('animations', animationSystem);
    }

    if (this.enabledSystems.has('debug')) {
      const debugSystem = new DebugSystem(player, inputSystem, this.config.scene);
      systems.set('debug', debugSystem);
    }

    // Create respawn system (always enabled for online play)
    const respawnSystem = new RespawnSystem(player);
    systems.set('respawn', respawnSystem);

    // Teleport effect removed - T key now opens teleport menu
    // const teleportEffect = new TeleportEffect(player);
    // systems.set('teleport', teleportEffect);

    // Register all created systems with the player
    for (const [name, system] of systems.entries()) {
      player.registerSystem(name, system);
    }
  }

  /**
   * Create a preset configuration for a basic player (minimal systems)
   */
  public static createBasic(scene: Phaser.Scene, x: number, y: number): PlayerBuilder {
    return new PlayerBuilder(scene).setPosition(x, y);
  }

  /**
   * Create a preset configuration for a combat-ready player
   */
  public static createCombatPlayer(scene: Phaser.Scene, x: number, y: number): PlayerBuilder {
    return new PlayerBuilder(scene).setPosition(x, y).withCombat().withAnimations().withClimbing();
  }

  /**
   * Create a preset configuration for a fully-featured development player
   */
  public static createDevPlayer(scene: Phaser.Scene, x: number, y: number): PlayerBuilder {
    return new PlayerBuilder(scene).setPosition(x, y).withAllSystems();
  }
}
