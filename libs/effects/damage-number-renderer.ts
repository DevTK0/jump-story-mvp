/**
 * Damage Number Renderer
 * Handles floating combat damage numbers above enemies
 */

import Phaser from 'phaser';
import { DamageEvent } from '@/spacetime/client';
import { EnemyManager } from '@/enemy';
import { DAMAGE_NUMBER_CONFIG, getDamageTypeKey, getDamageDisplayText } from './damage-number-config';

interface DamageNumberState {
  text: Phaser.GameObjects.Text;
  startTime: number;
  enemyId: number;
  initialX: number;
  initialY: number;
}

export class DamageNumberRenderer {
  private scene: Phaser.Scene;
  private enemyManager: EnemyManager | null = null;
  
  // Object pooling
  private textPool: Phaser.GameObjects.Text[] = [];
  private activeNumbers: Map<number, DamageNumberState[]> = new Map();
  private allActiveNumbers: DamageNumberState[] = [];
  

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initializePool();
  }

  /**
   * Set the enemy manager reference for positioning
   */
  public setEnemyManager(enemyManager: EnemyManager): void {
    this.enemyManager = enemyManager;
  }

  /**
   * Initialize the object pool
   */
  private initializePool(): void {
    const { poolSize } = DAMAGE_NUMBER_CONFIG.performance;
    
    for (let i = 0; i < poolSize; i++) {
      const text = this.createPooledText();
      this.textPool.push(text);
    }
  }

  /**
   * Create a reusable text object
   */
  private createPooledText(): Phaser.GameObjects.Text {
    const text = this.scene.add.text(0, 0, '', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#FFFFFF',
    });
    
    text.setVisible(false);
    text.setActive(false);
    text.setDepth(DAMAGE_NUMBER_CONFIG.display.baseDepth);
    
    return text;
  }

  /**
   * Get a text object from the pool
   */
  private getTextFromPool(): Phaser.GameObjects.Text | null {
    let text = this.textPool.pop();
    
    if (!text && this.textPool.length < DAMAGE_NUMBER_CONFIG.performance.maxPoolSize) {
      text = this.createPooledText();
    }
    
    return text || null;
  }

  /**
   * Return a text object to the pool
   */
  private returnTextToPool(text: Phaser.GameObjects.Text): void {
    if (this.textPool.length < DAMAGE_NUMBER_CONFIG.performance.maxPoolSize) {
      text.setVisible(false);
      text.setActive(false);
      text.clearTint();
      this.scene.tweens.killTweensOf(text);
      this.textPool.push(text);
    } else {
      text.destroy();
    }
  }

  /**
   * Handle incoming damage event from SpacetimeDB
   */
  public handleDamageEvent(damageEvent: DamageEvent): void {
    if (!this.enemyManager) {
      console.warn('DamageNumberRenderer: EnemyManager not set');
      return;
    }

    // Validate event is not stale
    if (this.isEventStale(damageEvent)) {
      console.debug(`Stale damage event ${damageEvent.damageEventId} - ignoring`);
      return;
    }

    // Get enemy position
    const position = this.getEnemyPosition(damageEvent.enemyId);
    if (!position) {
      console.debug(`No position found for enemy ${damageEvent.enemyId}`);
      return;
    }

    // Check if we're at max concurrent numbers
    if (this.allActiveNumbers.length >= DAMAGE_NUMBER_CONFIG.performance.maxConcurrentNumbers) {
      console.debug('Max concurrent damage numbers reached - skipping');
      return;
    }

    this.createDamageNumber(damageEvent, position.x, position.y);
  }

  /**
   * Check if damage event is too old to process
   */
  private isEventStale(damageEvent: DamageEvent): boolean {
    const eventTime = damageEvent.timestamp.toDate().getTime();
    const now = Date.now();
    return now - eventTime > DAMAGE_NUMBER_CONFIG.performance.staleEventThresholdMs;
  }

  /**
   * Get enemy sprite position for damage number placement
   */
  private getEnemyPosition(enemyId: number): { x: number; y: number } | null {
    if (!this.enemyManager) return null;

    // Get enemy sprite from enemy manager's enemies map
    const enemies = (this.enemyManager as any).enemies as Map<number, Phaser.Physics.Arcade.Sprite>;
    const enemySprite = enemies.get(enemyId);
    
    if (!enemySprite || !enemySprite.active) {
      return null;
    }

    return {
      x: enemySprite.x,
      y: enemySprite.y + DAMAGE_NUMBER_CONFIG.display.baseYOffset
    };
  }

  /**
   * Create and position a damage number
   */
  private createDamageNumber(damageEvent: DamageEvent, baseX: number, baseY: number): void {
    const text = this.getTextFromPool();
    if (!text) {
      console.debug('No available text objects in pool');
      return;
    }

    // Calculate stacked position
    const position = this.calculateStackedPosition(damageEvent.enemyId, baseX, baseY);
    
    // Configure text appearance
    this.configureTextAppearance(text, damageEvent);
    
    // Position and show text
    text.setPosition(position.x, position.y);
    text.setVisible(true);
    text.setActive(true);
    text.setAlpha(0);

    // Create damage number state
    const damageNumberState: DamageNumberState = {
      text,
      startTime: this.scene.time.now,
      enemyId: damageEvent.enemyId,
      initialX: position.x,
      initialY: position.y,
    };

    // Add to tracking
    this.addToActiveNumbers(damageNumberState);

    // Start animation
    this.animateDamageNumber(damageNumberState);
  }

  /**
   * Calculate position for stacked damage numbers
   */
  private calculateStackedPosition(enemyId: number, baseX: number, baseY: number): { x: number; y: number } {
    const activeForEnemy = this.activeNumbers.get(enemyId) || [];
    const stackIndex = activeForEnemy.length;
    
    const { verticalOffset, horizontalJitter } = DAMAGE_NUMBER_CONFIG.stacking;
    
    // Add random horizontal jitter
    const jitterX = (Math.random() - 0.5) * horizontalJitter * 2;
    
    return {
      x: baseX + jitterX,
      y: baseY - (stackIndex * verticalOffset)
    };
  }

  /**
   * Configure text appearance based on damage type
   */
  private configureTextAppearance(text: Phaser.GameObjects.Text, damageEvent: DamageEvent): void {
    const damageTypeKey = getDamageTypeKey(damageEvent.damageType);
    const style = DAMAGE_NUMBER_CONFIG.styles[damageTypeKey];
    const displayText = getDamageDisplayText(damageEvent.damageAmount, damageEvent.damageType);

    text.setText(displayText);
    text.setStyle({
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      color: style.color,
      stroke: style.stroke,
      strokeThickness: style.strokeThickness,
      fontStyle: style.fontStyle,
    });
  }

  /**
   * Add damage number to active tracking
   */
  private addToActiveNumbers(damageNumberState: DamageNumberState): void {
    // Add to per-enemy tracking
    if (!this.activeNumbers.has(damageNumberState.enemyId)) {
      this.activeNumbers.set(damageNumberState.enemyId, []);
    }
    this.activeNumbers.get(damageNumberState.enemyId)!.push(damageNumberState);

    // Add to global tracking
    this.allActiveNumbers.push(damageNumberState);
  }

  /**
   * Animate the damage number (rise and fade)
   */
  private animateDamageNumber(damageNumberState: DamageNumberState): void {
    const { text, initialX, initialY } = damageNumberState;
    const { duration, riseDistance, spreadRadius } = DAMAGE_NUMBER_CONFIG.animations;

    // Random horizontal spread
    const spreadX = (Math.random() - 0.5) * spreadRadius * 2;
    const targetX = initialX + spreadX;
    const targetY = initialY - riseDistance;

    // Fade in quickly
    this.scene.tweens.add({
      targets: text,
      alpha: 1,
      duration: DAMAGE_NUMBER_CONFIG.animations.fadeInDuration,
      ease: 'Power1.easeOut',
    });

    // Rise and move
    this.scene.tweens.add({
      targets: text,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: DAMAGE_NUMBER_CONFIG.animations.easingCurve,
    });

    // Fade out at the end
    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      duration: DAMAGE_NUMBER_CONFIG.animations.fadeOutDuration,
      delay: duration - DAMAGE_NUMBER_CONFIG.animations.fadeOutDuration,
      ease: 'Power1.easeIn',
      onComplete: () => {
        this.cleanupDamageNumber(damageNumberState);
      },
    });
  }

  /**
   * Clean up completed damage number
   */
  private cleanupDamageNumber(damageNumberState: DamageNumberState): void {
    const { text, enemyId } = damageNumberState;

    // Remove from per-enemy tracking
    const enemyNumbers = this.activeNumbers.get(enemyId);
    if (enemyNumbers) {
      const index = enemyNumbers.indexOf(damageNumberState);
      if (index !== -1) {
        enemyNumbers.splice(index, 1);
      }
      if (enemyNumbers.length === 0) {
        this.activeNumbers.delete(enemyId);
      }
    }

    // Remove from global tracking
    const globalIndex = this.allActiveNumbers.indexOf(damageNumberState);
    if (globalIndex !== -1) {
      this.allActiveNumbers.splice(globalIndex, 1);
    }

    // Return text to pool
    this.returnTextToPool(text);
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): Record<string, any> {
    return {
      poolSize: this.textPool.length,
      activeNumbers: this.allActiveNumbers.length,
      activeEnemies: this.activeNumbers.size,
      maxConcurrent: DAMAGE_NUMBER_CONFIG.performance.maxConcurrentNumbers,
    };
  }

  /**
   * Destroy the renderer and clean up resources
   */
  public destroy(): void {
    // Clean up all active numbers
    this.allActiveNumbers.forEach(state => {
      this.scene.tweens.killTweensOf(state.text);
      state.text.destroy();
    });

    // Clean up pool
    this.textPool.forEach(text => text.destroy());

    // Clear collections
    this.activeNumbers.clear();
    this.allActiveNumbers.length = 0;
    this.textPool.length = 0;
  }
}