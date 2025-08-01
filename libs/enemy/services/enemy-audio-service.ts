import type { Scene } from 'phaser';
import { getAudioManager } from '@/core/audio';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { enemyAttributes, bossAttributes } from '../../../apps/playground/config/enemy-attributes';

/**
 * Service that handles playing audio for enemy events
 */
export class EnemyAudioService {
  private scene: Scene;
  private logger: ModuleLogger;
  private isDestroyed = false;
  
  // Track enemy types by spawnId for audio lookup
  private enemyTypeMap = new Map<number, string>();

  constructor(scene: Scene) {
    this.scene = scene;
    this.logger = createLogger('EnemyAudioService');
    
    this.logger.info('EnemyAudioService initialized');
  }
  
  /**
   * Set the enemy manager reference
   */
  public setEnemyManager(_enemyManager: any): void {
    // Currently not needed, kept for API compatibility
  }
  
  /**
   * Set the boss manager reference
   */
  public setBossManager(_bossManager: any): void {
    // Currently not needed, kept for API compatibility
  }
  
  /**
   * Register an enemy spawn for audio tracking
   */
  public registerEnemySpawn(spawnId: number, enemyType: string): void {
    this.enemyTypeMap.set(spawnId, enemyType);
    this.logger.debug(`Registered enemy spawn: ${enemyType} (${spawnId})`);
  }
  
  /**
   * Unregister an enemy when it's despawned
   */
  public unregisterEnemy(spawnId: number): void {
    this.enemyTypeMap.delete(spawnId);
  }
  
  /**
   * Play damage sound for an enemy
   */
  public playEnemyDamageSound(spawnId: number): void {
    if (this.isDestroyed) return;
    
    const enemyType = this.enemyTypeMap.get(spawnId);
    if (!enemyType) {
      this.logger.debug(`Enemy type not found for spawnId: ${spawnId}`);
      return;
    }
    
    // Check if it's a boss or regular enemy
    const bossConfig = bossAttributes.bosses[enemyType];
    const enemyConfig = enemyAttributes.enemies[enemyType];
    
    let audioKey: string | undefined;
    
    if (bossConfig && bossConfig.audio?.on_damaged) {
      audioKey = bossConfig.audio.on_damaged;
    } else if (bossConfig) {
      // Boss without custom sound - use default boss hit sound
      audioKey = 'bossHit';
    } else if (enemyConfig && enemyConfig.audio?.on_damaged) {
      audioKey = enemyConfig.audio.on_damaged;
    } else {
      // Use default enemy damage sound
      audioKey = 'enemyHit';
    }
    
    this.playSound(audioKey, 0.3);
  }
  
  /**
   * Play death sound for an enemy
   */
  public playEnemyDeathSound(spawnId: number): void {
    if (this.isDestroyed) return;
    
    const enemyType = this.enemyTypeMap.get(spawnId);
    if (!enemyType) {
      this.logger.debug(`Enemy type not found for spawnId: ${spawnId}`);
      return;
    }
    
    // Check if it's a boss or regular enemy
    const bossConfig = bossAttributes.bosses[enemyType];
    const enemyConfig = enemyAttributes.enemies[enemyType];
    
    let audioKey: string | undefined;
    
    if (bossConfig && bossConfig.audio?.on_death) {
      audioKey = bossConfig.audio.on_death;
    } else if (bossConfig) {
      // Boss without custom sound - use default boss death sound
      audioKey = 'bossDeath';
    } else if (enemyConfig && enemyConfig.audio?.on_death) {
      audioKey = enemyConfig.audio.on_death;
    } else {
      // Use default enemy death sound
      audioKey = 'enemyDeath';
    }
    
    this.playSound(audioKey, 0.4);
  }
  
  /**
   * Play boss attack sound
   */
  public playBossAttackSound(spawnId: number, attackNumber: 1 | 2 | 3): void {
    if (this.isDestroyed) return;
    
    const enemyType = this.enemyTypeMap.get(spawnId);
    if (!enemyType) {
      this.logger.debug(`Boss type not found for spawnId: ${spawnId}`);
      return;
    }
    
    const bossConfig = bossAttributes.bosses[enemyType];
    if (!bossConfig) {
      this.logger.debug(`Boss config not found for type: ${enemyType}`);
      return;
    }
    
    let audioKey: string | undefined;
    
    switch (attackNumber) {
      case 1:
        audioKey = bossConfig.audio?.attack1 || 'bossAttack1';
        break;
      case 2:
        audioKey = bossConfig.audio?.attack2 || 'bossAttack2';
        break;
      case 3:
        audioKey = bossConfig.audio?.attack3 || 'bossAttack3';
        break;
    }
    
    this.playSound(audioKey, 0.5);
  }
  
  /**
   * Helper to play a sound
   */
  private playSound(audioKey: string, volume: number): void {
    try {
      const audioManager = getAudioManager(this.scene);
      audioManager.playSound(audioKey, { volume });
      
      this.logger.debug(`Playing sound: ${audioKey}`);
    } catch (error) {
      this.logger.warn(`Failed to play sound ${audioKey}:`, error);
    }
  }
  
  public destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    this.enemyTypeMap.clear();
    
    this.logger.info('EnemyAudioService destroyed');
  }
}