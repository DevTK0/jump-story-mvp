import type { Scene } from 'phaser';
import { getAudioManager } from '@/core/audio';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { onSceneEvent, offSceneEvent } from '@/core/scene/scene-events';

/**
 * Service that handles playing audio for player events
 */
export class PlayerEventAudioService {
  private scene: Scene;
  private logger: ModuleLogger;
  private isDestroyed = false;
  private lastJumpTime = 0;
  private jumpCooldown = 100; // Minimum ms between jump sounds

  constructor(scene: Scene) {
    this.scene = scene;
    this.logger = createLogger('PlayerEventAudioService');
    
    // Listen for player events
    onSceneEvent(this.scene, 'player:died', this.handlePlayerDeath, this);
    onSceneEvent(this.scene, 'player:jumped', this.handlePlayerJump, this);
    onSceneEvent(this.scene, 'player:respawned', this.handlePlayerRespawn, this);
    onSceneEvent(this.scene, 'player:class-changed', this.handleClassChange, this);
    onSceneEvent(this.scene, 'teleport:unlocked', this.handleTeleportUnlock, this);
    
    this.logger.info('PlayerEventAudioService initialized');
  }
  
  
  /**
   * Handle player death event
   */
  private handlePlayerDeath = (): void => {
    if (this.isDestroyed) return;
    
    try {
      const audioManager = getAudioManager(this.scene);
      audioManager.playSound('death', {
        volume: 0.4
      });
      
      this.logger.debug('Playing death sound');
    } catch (error) {
      this.logger.warn('Failed to play death sound:', error);
    }
  };
  
  /**
   * Handle player jump event
   */
  private handlePlayerJump = (): void => {
    this.playJumpSound();
  };
  
  /**
   * Handle player respawn event
   */
  private handlePlayerRespawn = (): void => {
    this.playRespawnSound();
  };
  
  /**
   * Handle class change event
   */
  private handleClassChange = (): void => {
    this.playClassChangeSound();
  };
  
  /**
   * Handle teleport unlock event
   */
  private handleTeleportUnlock = (): void => {
    this.playTeleportUnlockSound();
  };
  
  /**
   * Play respawn sound - call this when player respawns
   */
  public playRespawnSound(): void {
    if (this.isDestroyed) return;
    
    try {
      const audioManager = getAudioManager(this.scene);
      audioManager.playSound('respawn', {
        volume: 0.5
      });
      
      this.logger.debug('Playing respawn sound');
    } catch (error) {
      this.logger.warn('Failed to play respawn sound:', error);
    }
  }
  
  /**
   * Play class change sound - call this when player changes class
   */
  public playClassChangeSound(): void {
    if (this.isDestroyed) return;
    
    try {
      const audioManager = getAudioManager(this.scene);
      audioManager.playSound('classChange', {
        volume: 0.6
      });
      
      this.logger.debug('Playing class change sound');
    } catch (error) {
      this.logger.warn('Failed to play class change sound:', error);
    }
  }
  
  /**
   * Play jump sound - call this from movement system when player jumps
   */
  public playJumpSound(): void {
    if (this.isDestroyed) return;
    
    // Prevent jump sound spam
    const now = Date.now();
    if (now - this.lastJumpTime < this.jumpCooldown) return;
    this.lastJumpTime = now;
    
    try {
      const audioManager = getAudioManager(this.scene);
      audioManager.playSound('jump', {
        volume: 0.3
      });
      
      this.logger.debug('Playing jump sound');
    } catch (error) {
      this.logger.warn('Failed to play jump sound:', error);
    }
  }
  
  /**
   * Play teleport unlock sound
   */
  public playTeleportUnlockSound(): void {
    if (this.isDestroyed) return;
    
    try {
      const audioManager = getAudioManager(this.scene);
      audioManager.playSound('teleportUnlock', {
        volume: 0.7
      });
      
      this.logger.debug('Playing teleport unlock sound');
    } catch (error) {
      this.logger.warn('Failed to play teleport unlock sound:', error);
    }
  }
  
  
  public destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    // Remove event listeners
    offSceneEvent(this.scene, 'player:died', this.handlePlayerDeath, this);
    offSceneEvent(this.scene, 'player:jumped', this.handlePlayerJump, this);
    offSceneEvent(this.scene, 'player:respawned', this.handlePlayerRespawn, this);
    offSceneEvent(this.scene, 'player:class-changed', this.handleClassChange, this);
    offSceneEvent(this.scene, 'teleport:unlocked', this.handleTeleportUnlock, this);
    
    this.logger.info('PlayerEventAudioService destroyed');
  }
}