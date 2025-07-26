import { Scene } from 'phaser';
import type { ErrorRecoveryStrategy, ErrorContext } from './error-boundary';
import { NetworkError, GameStateError } from './error-boundary';
import { createLogger, type ModuleLogger } from './logger';

/**
 * Player State Recovery Strategy
 * Handles errors related to player state corruption
 */
export class PlayerStateRecoveryStrategy implements ErrorRecoveryStrategy {
  private logger: ModuleLogger = createLogger('PlayerStateRecovery');

  canRecover(error: Error, context: ErrorContext): boolean {
    return (
      error.message.includes('player') ||
      error.message.includes('Player') ||
      (context.system === 'player' && error instanceof GameStateError)
    );
  }

  async recover(_error: Error, context: ErrorContext): Promise<void> {
    if (!context.scene) {
      throw new Error('No scene context for player recovery');
    }

    const scene = context.scene as any;

    if (!scene.player) {
      throw new Error('No player found in scene');
    }

    this.logger.info('Attempting player state recovery');

    try {
      // Reset player physics
      if (scene.player.body) {
        scene.player.body.setVelocity(0, 0);
        scene.player.body.setAcceleration(0, 0);
      }

      // Reset player state machine if it exists
      const stateMachine = scene.player.getSystem?.('state');
      if (stateMachine) {
        stateMachine.transitionTo('Idle');
      }

      // Reset player position to safe location
      if (scene.respawnSystem) {
        scene.respawnSystem.requestRespawn();
      } else {
        // Fallback to spawn position
        scene.player.setPosition(1000, 100);
      }

      // Clear any active animations
      scene.player.anims?.stop();

      this.logger.info('Player state recovery successful');
    } catch (recoveryError) {
      this.logger.error('Player state recovery failed', { error: recoveryError });
      throw recoveryError;
    }
  }
}

/**
 * Enemy System Recovery Strategy
 * Handles errors in enemy management
 */
export class EnemySystemRecoveryStrategy implements ErrorRecoveryStrategy {
  private logger: ModuleLogger = createLogger('EnemySystemRecovery');

  canRecover(error: Error, context: ErrorContext): boolean {
    return (
      error.message.includes('enemy') ||
      error.message.includes('Enemy') ||
      context.system === 'enemy'
    );
  }

  async recover(_error: Error, context: ErrorContext): Promise<void> {
    if (!context.scene) {
      throw new Error('No scene context for enemy recovery');
    }

    const scene = context.scene as any;

    if (!scene.enemyManager) {
      throw new Error('No enemy manager found in scene');
    }

    this.logger.info('Attempting enemy system recovery');

    try {
      // Clear all enemy references and restart
      scene.enemyManager.cleanup();

      // Re-establish database connection if needed
      const dbConnection = scene.dbConnectionManager?.getConnection();
      if (dbConnection) {
        scene.enemyManager.setDbConnection(dbConnection);
      }

      this.logger.info('Enemy system recovery successful');
    } catch (recoveryError) {
      this.logger.error('Enemy system recovery failed', { error: recoveryError });
      throw recoveryError;
    }
  }
}

/**
 * Physics System Recovery Strategy
 * Handles physics-related errors
 */
export class PhysicsRecoveryStrategy implements ErrorRecoveryStrategy {
  private logger: ModuleLogger = createLogger('PhysicsRecovery');

  canRecover(error: Error, _context: ErrorContext): boolean {
    return (
      error.message.includes('physics') ||
      error.message.includes('Physics') ||
      error.message.includes('body') ||
      error.message.includes('collision')
    );
  }

  async recover(_error: Error, context: ErrorContext): Promise<void> {
    if (!context.scene) {
      throw new Error('No scene context for physics recovery');
    }

    const scene = context.scene;
    this.logger.info('Attempting physics recovery');

    try {
      // Pause physics
      scene.physics.pause();

      // Clear any stuck bodies
      scene.physics.world.bodies.entries.forEach((body: any) => {
        if (body) {
          body.setVelocity(0, 0);
          body.setAcceleration(0, 0);
          body.setAngularVelocity(0);
        }
      });

      // Resume physics
      scene.physics.resume();

      this.logger.info('Physics recovery successful');
    } catch (recoveryError) {
      this.logger.error('Physics recovery failed', { error: recoveryError });
      throw recoveryError;
    }
  }
}

/**
 * Animation System Recovery Strategy
 * Handles animation-related errors
 */
export class AnimationRecoveryStrategy implements ErrorRecoveryStrategy {
  private logger: ModuleLogger = createLogger('AnimationRecovery');

  canRecover(error: Error, context: ErrorContext): boolean {
    return (
      error.message.includes('animation') ||
      error.message.includes('Animation') ||
      error.message.includes('anim') ||
      context.system === 'animation'
    );
  }

  async recover(_error: Error, context: ErrorContext): Promise<void> {
    if (!context.scene) {
      throw new Error('No scene context for animation recovery');
    }

    const scene = context.scene as any;
    this.logger.info('Attempting animation recovery');

    try {
      // Stop all running animations
      scene.anims.pauseAll();

      // Clear animation listeners that might be stuck
      if (scene.player) {
        scene.player.off('animationcomplete');
        scene.player.off('animationrepeat');
        scene.player.off('animationstart');
      }

      // Resume animations
      scene.anims.resumeAll();

      // Reset player to idle animation if available
      if (scene.player && scene.player.anims) {
        try {
          scene.player.play('soldier-idle-anim');
        } catch (e) {
          this.logger.debug('Failed to reset player animation during recovery:', e);
          // Continue recovery even if animation doesn't exist
        }
      }

      this.logger.info('Animation recovery successful');
    } catch (recoveryError) {
      this.logger.error('Animation recovery failed', { error: recoveryError });
      throw recoveryError;
    }
  }
}

/**
 * Network Reconnection Strategy
 * Handles network disconnection and reconnection
 */
export class NetworkReconnectionStrategy implements ErrorRecoveryStrategy {
  private logger: ModuleLogger = createLogger('NetworkReconnection');
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly RECONNECT_DELAY = 2000;

  canRecover(error: Error, _context: ErrorContext): boolean {
    return error instanceof NetworkError && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS;
  }

  async recover(_error: Error, context: ErrorContext): Promise<void> {
    if (!context.scene) {
      throw new Error('No scene context for network recovery');
    }

    const scene = context.scene as any;

    if (!scene.dbConnectionManager) {
      throw new Error('No database connection manager found');
    }

    this.reconnectAttempts++;
    this.logger.info(
      `Attempting network reconnection (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`
    );

    try {
      // Show reconnection UI
      this.showReconnectionUI(scene);

      // Wait before reconnecting
      await new Promise((resolve) => setTimeout(resolve, this.RECONNECT_DELAY));

      // Attempt reconnection
      await scene.dbConnectionManager.reconnect();

      // Re-establish all system connections
      const connection = scene.dbConnectionManager.getConnection();
      if (connection) {
        // Reconnect player systems
        if (scene.player) {
          const syncSystem = scene.player.getSystem('sync');
          if (syncSystem) {
            syncSystem.setDbConnection(connection);
          }
        }

        // Reconnect enemy manager
        if (scene.enemyManager) {
          scene.enemyManager.setDbConnection(connection);
        }

        // Reconnect peer manager
        if (scene.peerManager) {
          scene.peerManager.setDbConnection(connection);
        }
      }

      // Hide reconnection UI
      this.hideReconnectionUI(scene);

      this.logger.info('Network reconnection successful');
      this.reconnectAttempts = 0;
    } catch (recoveryError) {
      this.logger.error(`Network reconnection failed (attempt ${this.reconnectAttempts})`, {
        error: recoveryError,
      });

      if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        this.showConnectionFailedUI(scene);
      }

      throw recoveryError;
    }
  }

  private showReconnectionUI(scene: Scene): void {
    const camera = scene.cameras.main;
    const x = camera.centerX;
    const y = camera.centerY;

    // Create overlay
    const overlay = scene.add.rectangle(x, y, camera.width, camera.height, 0x000000, 0.8);
    overlay.setScrollFactor(0);
    overlay.setDepth(10000);
    overlay.setName('reconnect-overlay');

    // Create text
    const text = scene.add.text(x, y, 'Connection lost. Reconnecting...', {
      fontSize: '24px',
      color: '#ffffff',
      align: 'center',
    });
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(10001);
    text.setName('reconnect-text');

    // Add spinner animation
    const spinner = scene.add.text(x, y + 40, '⟳', {
      fontSize: '32px',
      color: '#ffffff',
    });
    spinner.setOrigin(0.5);
    spinner.setScrollFactor(0);
    spinner.setDepth(10001);
    spinner.setName('reconnect-spinner');

    scene.tweens.add({
      targets: spinner,
      angle: 360,
      duration: 1000,
      repeat: -1,
    });
  }

  private hideReconnectionUI(scene: Scene): void {
    const overlay = scene.children.getByName('reconnect-overlay');
    const text = scene.children.getByName('reconnect-text');
    const spinner = scene.children.getByName('reconnect-spinner');

    if (overlay) overlay.destroy();
    if (text) text.destroy();
    if (spinner) spinner.destroy();
  }

  private showConnectionFailedUI(scene: Scene): void {
    this.hideReconnectionUI(scene);

    const camera = scene.cameras.main;
    const x = camera.centerX;
    const y = camera.centerY;

    // Create overlay
    const overlay = scene.add.rectangle(x, y, camera.width, camera.height, 0x000000, 0.9);
    overlay.setScrollFactor(0);
    overlay.setDepth(10000);

    // Create text
    const text = scene.add.text(x, y - 20, 'Connection Failed', {
      fontSize: '28px',
      color: '#ff0000',
      align: 'center',
    });
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(10001);

    // Create reload button
    const button = scene.add.text(x, y + 40, 'Click to Reload', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 20, y: 10 },
    });
    button.setOrigin(0.5);
    button.setScrollFactor(0);
    button.setDepth(10001);
    button.setInteractive({ useHandCursor: true });

    button.on('pointerdown', () => {
      window.location.reload();
    });
  }
}

/**
 * Register all recovery strategies
 */
export function registerAllRecoveryStrategies(): void {
  const errorBoundary = (window as any).errorBoundary;
  if (!errorBoundary) return;

  errorBoundary.registerRecoveryStrategy('player-state', new PlayerStateRecoveryStrategy());
  errorBoundary.registerRecoveryStrategy('enemy-system', new EnemySystemRecoveryStrategy());
  errorBoundary.registerRecoveryStrategy('physics', new PhysicsRecoveryStrategy());
  errorBoundary.registerRecoveryStrategy('animation', new AnimationRecoveryStrategy());
  errorBoundary.registerRecoveryStrategy('network-reconnection', new NetworkReconnectionStrategy());
}
