import Phaser from 'phaser';
import type { Player as PlayerData } from '@/spacetime/client';
import { PLAYER_CONFIG } from '../player/config';
import { PEER_CONFIG } from './peer-config';
import { PeerHealthBar } from './ui/peer-health-bar';
import { PeerStateMachine } from './state/peer-state-machine';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { emitSceneEvent } from '@/core/scene';

export interface PeerConfig {
  scene: Phaser.Scene;
  playerData: PlayerData;
}

export class Peer extends Phaser.GameObjects.Sprite {
  private playerData: PlayerData;
  private nameLabel!: Phaser.GameObjects.Text;
  private healthBar!: PeerHealthBar;
  private logger: ModuleLogger = createLogger('Peer');

  // Interpolation properties
  private targetPosition = { x: 0, y: 0 };
  private interpolationSpeed = PEER_CONFIG.interpolation.speed;

  // Track current job for change detection
  private currentJob: string;

  // State machine for animation management
  private stateMachine!: PeerStateMachine;
  private isDeathAnimationComplete = false;
  
  // Death animation last frames for different jobs
  private static readonly DEATH_LAST_FRAMES: Record<string, number> = {
    soldier: 57,
    knight: 80,
    wizard: 138,
    archer: 63,
    swordsman: 93,
    'armored-axeman': 57,
    'knight-templar': 104,
    healer: 84,
  };

  constructor(config: PeerConfig) {
    // Create sprite with job texture
    const job = config.playerData.job || 'swordsman';
    super(config.scene, config.playerData.x, config.playerData.y, job, 0);
    
    this.logger.info(`🎮 Creating peer ${config.playerData.name} with job: ${job} (playerData.job: ${config.playerData.job})`);

    this.playerData = config.playerData;
    this.currentJob = job;

    // Add to scene (no physics - peers are visual only)
    config.scene.add.existing(this);

    // Set depth to render above enemies but below main player
    this.setDepth(PEER_CONFIG.display.depth);

    // Set scale to match main player
    this.setScale(PLAYER_CONFIG.movement.scale);

    // Set visual properties to distinguish from main player
    this.setAlpha(PEER_CONFIG.display.alpha);
    this.setTint(PEER_CONFIG.display.tint);

    // Make interactive for click events
    // The sprite frame is 100x100 but the actual character is smaller
    // Set a hit area around the character body
    this.setInteractive(new Phaser.Geom.Rectangle(35, 25, 30, 50), Phaser.Geom.Rectangle.Contains);
    this.setupContextMenu();

    // Initialize target position
    this.targetPosition = {
      x: config.playerData.x,
      y: config.playerData.y,
    };

    // Animations are now created at scene level

    // Create name label
    this.createNameLabel();

    // Create health bar
    this.createHealthBar();

    // Initialize state machine
    this.stateMachine = new PeerStateMachine(this, this.playerData.state);

    this.logger.debug(
      `Created peer sprite for ${this.playerData.name} at (${this.x}, ${this.y}) with scale ${PLAYER_CONFIG.movement.scale} in state ${this.playerData.state.tag}`
    );
  }

  private createNameLabel(): void {
    this.nameLabel = this.scene.add.text(
      this.x,
      this.y + PEER_CONFIG.display.nameLabel.offsetY,
      this.playerData.name,
      {
        fontSize: PEER_CONFIG.display.nameLabel.fontSize,
        color: PEER_CONFIG.display.nameLabel.color,
        stroke: PEER_CONFIG.display.nameLabel.stroke,
        strokeThickness: PEER_CONFIG.display.nameLabel.strokeThickness,
      }
    );
    this.nameLabel.setOrigin(0.5, 0.5);
    this.nameLabel.setDepth(PEER_CONFIG.display.nameLabel.depth); // Above the peer sprite
  }

  private createHealthBar(): void {
    this.healthBar = new PeerHealthBar(this.scene, this.x, this.y, this.playerData.maxHp);

    // Initialize health bar with current health
    this.healthBar.updateHealth(this.playerData.currentHp);
  }

  public playAnimation(animationKey: string): void {
    if (!this.scene.anims.exists(animationKey)) {
      this.logger.warn(`Animation ${animationKey} does not exist for peer ${this.playerData.name} with job ${this.currentJob}`);
      // Try fallback to soldier animation if job animation doesn't exist
      const fallbackKey = animationKey.replace(this.currentJob, 'soldier');
      if (this.scene.anims.exists(fallbackKey)) {
        this.logger.warn(`Using fallback animation ${fallbackKey}`);
        animationKey = fallbackKey;
      } else {
        return;
      }
    }

    // Check animation types
    const isAttackAnim = animationKey.includes('attack');
    const isDeathAnim = animationKey.includes('death');

    // Skip death animation if it has already completed
    if (isDeathAnim && this.isDeathAnimationComplete) {
      return;
    }

    // Clear any existing animation listeners
    this.off('animationcomplete');

    if (isAttackAnim) {
      // For attacks, always stop current animation and restart
      this.anims.stop();
      try {
        this.play(animationKey);
        
        // Listen for animation complete to transition back
        this.once('animationcomplete', () => {
          // Let state machine handle the transition
          this.stateMachine.handleServerStateChange(this.playerData.state);
        });
      } catch (error) {
        this.logger.error(`Failed to play attack animation ${animationKey}:`, error);
      }
    } else if (isDeathAnim) {
      // Death animation plays once and stops
      try {
        this.play(animationKey);

        this.once('animationcomplete', (animation: any) => {
          if (animation.key === animationKey) {
            this.anims.stop();
            // Use job-specific death frame
            const deathFrame = Peer.DEATH_LAST_FRAMES[this.currentJob] || PEER_CONFIG.animation.soldierDeathLastFrame;
            this.setFrame(deathFrame);
            this.isDeathAnimationComplete = true;
          }
        });
      } catch (error) {
        this.logger.error(`Failed to play death animation ${animationKey}:`, error);
      }
    } else {
      // Regular animations (idle, walk, etc) - should loop
      try {
        this.play(animationKey, true); // true for loop
      } catch (error) {
        this.logger.error(`Failed to play animation ${animationKey}:`, error);
      }
    }
  }

  public resetDeathAnimation(): void {
    this.isDeathAnimationComplete = false;
  }

  private handleJobChange(newJob: string): void {
    this.logger.info(
      `🔄 handleJobChange: Peer ${this.playerData.name} job changed from ${this.currentJob} to ${newJob}`
    );
    this.currentJob = newJob;

    // Check if texture exists
    if (this.scene.textures.exists(newJob)) {
      this.logger.info(`✅ Texture '${newJob}' exists, updating sprite`);
      // Update texture to new job
      this.setTexture(newJob);
    } else {
      this.logger.error(`❌ Texture '${newJob}' not found! Available textures:`, 
        Array.from(this.scene.textures.list.keys()).filter(k => !k.startsWith('__')));
      // Fallback to soldier if texture doesn't exist
      this.setTexture('soldier');
    }

    // Force state machine to update animations with new job
    this.stateMachine.forceAnimationUpdate();
  }

  private setupContextMenu(): void {
    // Left-click handling
    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        // Emit type-safe event for scene to handle - use world coordinates
        emitSceneEvent(this.scene, 'peer:clicked', {
          peer: this,
          identity: this.playerData.identity,
          name: this.playerData.name,
          x: pointer.worldX,
          y: pointer.worldY,
        });
      }
    });

    // Hover effect
    this.on('pointerover', () => {
      this.setTint(0xaaaaff); // Lighter tint on hover
      this.scene.input.setDefaultCursor('pointer');
    });

    this.on('pointerout', () => {
      this.setTint(PEER_CONFIG.display.tint); // Reset to normal tint
      this.scene.input.setDefaultCursor('default');
    });
  }

  public updateFromData(playerData: PlayerData): void {
    const previousState = this.playerData?.state?.tag;
    const previousJob = this.currentJob;
    this.playerData = playerData;

    this.logger.info(`🔄 Peer updateFromData: ${this.playerData.name} - job: ${playerData.job}, previousJob: ${previousJob}`);

    // Check for job change
    if (playerData.job && playerData.job !== previousJob) {
      this.logger.info(`🎯 Job change detected for ${this.playerData.name}: ${previousJob} -> ${playerData.job}`);
      this.handleJobChange(playerData.job);
    } else {
      this.logger.debug(`📍 No job change for ${this.playerData.name}: still ${playerData.job}`);
    }

    // State machine will handle respawn animation reset

    // Update target position for interpolation
    const newTargetX = playerData.x;
    const newTargetY = playerData.y;

    // Check if target position changed significantly
    const targetDistance = Phaser.Math.Distance.Between(
      this.targetPosition.x,
      this.targetPosition.y,
      newTargetX,
      newTargetY
    );

    if (targetDistance > PEER_CONFIG.interpolation.minMoveDistance) {
      // Check for teleport distance (if too far, snap immediately)
      const currentDistance = Phaser.Math.Distance.Between(this.x, this.y, newTargetX, newTargetY);

      if (currentDistance > PEER_CONFIG.interpolation.teleportDistance) {
        // Teleport if too far
        this.setPosition(newTargetX, newTargetY);
        this.targetPosition = { x: newTargetX, y: newTargetY };
        this.nameLabel.setPosition(this.x, this.y + PEER_CONFIG.display.nameLabel.offsetY);
        this.healthBar.updatePosition(this.x, this.y);
        this.logger.debug(`Teleported peer ${this.playerData.name} to (${this.x}, ${this.y}`);
      } else {
        // Set new target for smooth interpolation
        this.targetPosition = { x: newTargetX, y: newTargetY };
        this.logger.debug(
          `Updated peer ${this.playerData.name} target to (${newTargetX}, ${newTargetY})`
        );
      }
    }

    // Update health bar
    this.healthBar.updateHealth(playerData.currentHp);

    // Check if state changed and let state machine handle it
    if (previousState !== playerData.state.tag) {
      this.logger.debug(
        `Peer ${this.playerData.name} state changed from ${previousState} to ${playerData.state.tag}`
      );
      this.stateMachine.handleServerStateChange(playerData.state);
    }
  }

  public update(): void {
    // Smooth interpolation towards target position
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.targetPosition.x,
      this.targetPosition.y
    );

    if (distance > 1) {
      // Interpolate position
      const newX = Phaser.Math.Linear(this.x, this.targetPosition.x, this.interpolationSpeed);
      const newY = Phaser.Math.Linear(this.y, this.targetPosition.y, this.interpolationSpeed);

      this.setPosition(newX, newY);

      // Update name label and health bar positions
      this.nameLabel.setPosition(this.x, this.y + PEER_CONFIG.display.nameLabel.offsetY);
      this.healthBar.updatePosition(this.x, this.y);
    }

    // Update facing direction based on server data
    this.updateFacingDirection();

    // Update state machine
    this.stateMachine.update(this.scene.time.now, this.scene.game.loop.delta);
  }

  private updateFacingDirection(): void {
    // Set facing direction based on server data
    if (this.playerData.facing.tag === 'Left') {
      this.setFlipX(true);
    } else {
      this.setFlipX(false);
    }
  }

  public getPlayerData(): PlayerData {
    return this.playerData;
  }

  public destroy(): void {
    // Remove all event listeners
    this.off('animationcomplete');

    // Clean up state machine
    this.stateMachine?.destroy();

    this.nameLabel?.destroy();
    this.healthBar?.destroy();
    super.destroy();
  }
}
