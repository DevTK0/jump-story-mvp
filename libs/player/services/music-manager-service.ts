import type { Scene } from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import type { DbConnection } from '@/spacetime/client';
import { onSceneEvent, offSceneEvent } from '@/core/scene/scene-events';

/**
 * Service that manages background and battle music with fade transitions
 */
export class MusicManagerService {
  private scene: Scene;
  private logger: ModuleLogger;
  private connection?: DbConnection;
  private isDestroyed = false;
  
  // Music state
  private currentMusicKey?: string;
  private backgroundMusic?: Phaser.Sound.BaseSound;
  private battleMusic?: Phaser.Sound.BaseSound;
  private activeBossCount = 0;
  private isFading = false;
  
  // Music configuration
  private readonly FADE_DURATION = 500; // 500ms fade
  private readonly BACKGROUND_MUSIC_KEY = 'backgroundMusic';
  private readonly BATTLE_MUSIC_KEY = 'battleMusic';

  constructor(scene: Scene) {
    this.scene = scene;
    this.logger = createLogger('MusicManagerService');
    
    // Listen for boss spawn events
    onSceneEvent(this.scene, 'boss:spawned', this.handleBossSpawn, this);
    // Listen for boss despawn events (in case boss is removed without defeat)
    onSceneEvent(this.scene, 'boss:despawned', this.handleBossDespawn, this);
    
    this.logger.info('MusicManagerService initialized');
  }
  
  /**
   * Initialize the service with required dependencies
   */
  public initialize(connection: DbConnection): void {
    this.connection = connection;
    
    // Subscribe to broadcast messages for boss defeat detection
    this.connection.reducers.onBroadcastMessage(this.handleBroadcastMessage);
    
    // Start background music immediately
    this.startBackgroundMusic();
    
    this.logger.info('MusicManagerService initialized with dependencies');
  }
  
  /**
   * Handle broadcast messages to detect boss defeat
   */
  private handleBroadcastMessage = (_ctx: any, message: string): void => {
    if (this.isDestroyed) return;
    
    // Check if this is a boss defeat message
    if (message.includes('has been defeated!')) {
      this.logger.info('Boss defeat detected from broadcast:', message);
      this.handleBossDefeat();
    }
  };
  
  /**
   * Start playing background music
   */
  private startBackgroundMusic(): void {
    if (this.currentMusicKey === this.BACKGROUND_MUSIC_KEY) return;
    
    try {
      // Create background music sound if not exists
      if (!this.backgroundMusic) {
        this.backgroundMusic = this.scene.sound.add(this.BACKGROUND_MUSIC_KEY, {
          volume: 0,
          loop: true
        });
      }
      
      // Play and fade in
      this.backgroundMusic.play();
      this.fadeIn(this.backgroundMusic);
      this.currentMusicKey = this.BACKGROUND_MUSIC_KEY;
      
      this.logger.info('Started background music');
    } catch (error) {
      this.logger.error('Failed to start background music:', error);
    }
  }
  
  /**
   * Called when a boss is spawned
   */
  private handleBossSpawn = (): void => {
    if (this.isDestroyed || this.isFading) return;
    
    this.activeBossCount++;
    
    // Only transition to battle music on first boss
    if (this.activeBossCount === 1) {
      this.logger.info('First boss spawned, transitioning to battle music');
      this.transitionToBattleMusic();
    } else {
      this.logger.info(`Additional boss spawned, total: ${this.activeBossCount}`);
    }
  };
  
  /**
   * Called when a boss is despawned (could be death or other removal)
   */
  private handleBossDespawn = (): void => {
    if (this.isDestroyed || this.isFading) return;
    
    // Treat despawn as defeat
    this.handleBossDefeat();
  };
  
  /**
   * Called when a boss is defeated
   */
  private handleBossDefeat(): void {
    if (this.isDestroyed || this.isFading) return;
    
    if (this.activeBossCount > 0) {
      this.activeBossCount--;
      
      this.logger.info(`Boss defeated, remaining: ${this.activeBossCount}`);
      
      // Only transition back to background music when all bosses are defeated
      if (this.activeBossCount === 0) {
        this.logger.info('All bosses defeated, transitioning to background music');
        this.transitionToBackgroundMusic();
      }
    }
  }
  
  /**
   * Transition from background to battle music
   */
  private transitionToBattleMusic(): void {
    if (this.currentMusicKey === this.BATTLE_MUSIC_KEY || this.isFading) return;
    
    this.isFading = true;
    
    try {
      // Create battle music sound if not exists
      if (!this.battleMusic) {
        this.battleMusic = this.scene.sound.add(this.BATTLE_MUSIC_KEY, {
          volume: 0,
          loop: true
        });
      }
      
      // Fade out background music
      if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
        this.fadeOut(this.backgroundMusic, () => {
          this.backgroundMusic?.stop();
          
          // Start and fade in battle music
          this.battleMusic?.play();
          this.fadeIn(this.battleMusic!, () => {
            this.isFading = false;
          });
        });
      } else {
        // No background music playing, just start battle music
        this.battleMusic.play();
        this.fadeIn(this.battleMusic, () => {
          this.isFading = false;
        });
      }
      
      this.currentMusicKey = this.BATTLE_MUSIC_KEY;
      
    } catch (error) {
      this.logger.error('Failed to transition to battle music:', error);
      this.isFading = false;
    }
  }
  
  /**
   * Transition from battle to background music
   */
  private transitionToBackgroundMusic(): void {
    if (this.currentMusicKey === this.BACKGROUND_MUSIC_KEY || this.isFading) return;
    
    this.isFading = true;
    
    try {
      // Fade out battle music
      if (this.battleMusic && this.battleMusic.isPlaying) {
        this.fadeOut(this.battleMusic, () => {
          this.battleMusic?.stop();
          
          // Start and fade in background music
          this.backgroundMusic?.play();
          this.fadeIn(this.backgroundMusic!, () => {
            this.isFading = false;
          });
        });
      } else {
        // No battle music playing, just start background music
        this.backgroundMusic?.play();
        this.fadeIn(this.backgroundMusic!, () => {
          this.isFading = false;
        });
      }
      
      this.currentMusicKey = this.BACKGROUND_MUSIC_KEY;
      
    } catch (error) {
      this.logger.error('Failed to transition to background music:', error);
      this.isFading = false;
    }
  }
  
  /**
   * Fade in audio
   */
  private fadeIn(sound: Phaser.Sound.BaseSound, onComplete?: () => void): void {
    const targetVolume = sound.key === this.BACKGROUND_MUSIC_KEY ? 0.3 : 0.4;
    
    this.scene.tweens.add({
      targets: sound,
      volume: targetVolume,
      duration: this.FADE_DURATION,
      ease: 'Linear',
      onComplete
    });
  }
  
  /**
   * Fade out audio
   */
  private fadeOut(sound: Phaser.Sound.BaseSound, onComplete?: () => void): void {
    this.scene.tweens.add({
      targets: sound,
      volume: 0,
      duration: this.FADE_DURATION,
      ease: 'Linear',
      onComplete
    });
  }
  
  /**
   * Reset boss count (useful for scene transitions)
   */
  public resetBossCount(): void {
    this.activeBossCount = 0;
  }
  
  /**
   * Clean up the service
   */
  public destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    // Remove event listeners
    offSceneEvent(this.scene, 'boss:spawned', this.handleBossSpawn, this);
    offSceneEvent(this.scene, 'boss:despawned', this.handleBossDespawn, this);
    
    // Remove broadcast listener
    if (this.connection) {
      this.connection.reducers.removeOnBroadcastMessage(this.handleBroadcastMessage);
    }
    
    // Stop all music
    if (this.backgroundMusic) {
      this.scene.tweens.killTweensOf(this.backgroundMusic);
      this.backgroundMusic.stop();
      this.backgroundMusic.destroy();
    }
    
    if (this.battleMusic) {
      this.scene.tweens.killTweensOf(this.battleMusic);
      this.battleMusic.stop();
      this.battleMusic.destroy();
    }
    
    this.logger.info('MusicManagerService destroyed');
  }
}