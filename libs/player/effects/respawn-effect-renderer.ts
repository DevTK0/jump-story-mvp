import Phaser from 'phaser';
import type { Player } from '../player';
import { createLogger } from '@/core/logger';
import { respawnEffectSprites } from '../../../apps/playground/config/sprite-config';
import { getAudioManager } from '@/core/audio';

const logger = createLogger('RespawnEffectRenderer');

/**
 * RespawnEffectRenderer - Renders respawn visual effect when player respawns
 * 
 * Plays a visual effect animation on the player when they respawn from death.
 */
export class RespawnEffectRenderer {
  private scene: Phaser.Scene;
  private player: Player;
  private activeEffect: Phaser.GameObjects.Sprite | null = null;
  private updateEvent: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
  }

  /**
   * Play the respawn effect at the player's position
   */
  public playRespawnEffect(): void {
    logger.debug('Playing respawn effect');
    
    // Play respawn sound
    try {
      const audioManager = getAudioManager(this.scene);
      audioManager.playSound('respawn', {
        volume: 0.5
      });
      logger.debug('Playing respawn sound');
    } catch (error) {
      logger.warn('Failed to play respawn sound:', error);
    }
    
    // Clean up any existing effect
    this.cleanup();

    // Check if texture exists
    if (!this.scene.textures.exists('respawn')) {
      logger.error('Respawn texture not found! Make sure respawn sprite is loaded.');
      return;
    }

    // Create respawn effect sprite at player position
    const effect = this.scene.add.sprite(
      this.player.x,
      this.player.y,
      'respawn'
    );

    logger.debug('Created respawn sprite:', { 
      texture: effect.texture.key,
      visible: effect.visible,
      position: { x: effect.x, y: effect.y }
    });

    // Set depth to render above player
    effect.setDepth(this.player.depth + 100); // Higher depth to ensure visibility
    
    // Start position update timer to follow player
    this.updateEvent = this.scene.time.addEvent({
      delay: 16, // ~60fps
      callback: () => {
        if (this.activeEffect && this.player) {
          this.activeEffect.setPosition(this.player.x, this.player.y);
        }
      },
      loop: true
    });
    
    // Use scale from sprite config if available
    const spriteConfig = respawnEffectSprites['respawn'];
    const scale = spriteConfig?.scale || 2;
    effect.setScale(scale);

    // Store reference
    this.activeEffect = effect;

    // Play the animation
    const animKey = 'respawn_play';
    try {
      if (this.scene.anims.exists(animKey)) {
        effect.play(animKey);
        logger.debug('Playing respawn animation:', animKey, {
          frameTotal: effect.anims.getTotalFrames(),
          currentFrame: effect.anims.currentFrame?.index,
          isPlaying: effect.anims.isPlaying
        });
      } else {
        logger.warn('Respawn animation not found:', animKey);
        // Debug info
        logger.debug('Animation not found, may need to check sprite loading');
        
        // Try to show the static sprite at least
        effect.setFrame(0);
        logger.debug('Showing static frame 0');
        
        // Still clean up after a delay
        this.scene.time.delayedCall(1000, () => {
          this.cleanup();
        });
      }
    } catch (error) {
      logger.error('Error playing respawn animation:', error);
      // Clean up on error
      effect.destroy();
      if (this.activeEffect === effect) {
        this.activeEffect = null;
      }
    }

    // Clean up after animation completes
    effect.on('animationcomplete', () => {
      logger.debug('Respawn animation complete, cleaning up');
      this.cleanup();
    });

    logger.info('Respawn effect played at position:', { 
      playerPos: { x: this.player.x, y: this.player.y },
      effectVisible: this.activeEffect?.visible,
      effectScale: this.activeEffect?.scale,
      effectDepth: this.activeEffect?.depth,
      playerDepth: this.player.depth
    });
  }

  private cleanup(): void {
    if (this.activeEffect) {
      this.activeEffect.destroy();
      this.activeEffect = null;
    }
    
    if (this.updateEvent) {
      this.updateEvent.destroy();
      this.updateEvent = null;
    }
  }

  public destroy(): void {
    this.cleanup();
  }
}