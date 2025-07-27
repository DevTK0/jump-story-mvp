/**
 * Enemy Damage Renderer
 * Handles floating damage numbers above enemies when they take damage
 */

import Phaser from 'phaser';
import { EnemyDamageEvent } from '@/spacetime/client';
import { EnemyManager } from '@/enemy';
import {
  DAMAGE_RENDERER_CONFIG,
  getDamageTypeKey,
  getDamageDisplayText,
  getDamageStyle,
} from './damage-renderer-config';

interface DamageNumberState {
  text: Phaser.GameObjects.Text;
  startTime: number;
  spawnId: number;
  initialX: number;
  initialY: number;
  damageEvent: EnemyDamageEvent;
}

export class EnemyDamageRenderer {
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
    const { poolSize } = DAMAGE_RENDERER_CONFIG.performance;

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
    text.setDepth(DAMAGE_RENDERER_CONFIG.display.enemy.baseDepth);

    return text;
  }

  /**
   * Get a text object from the pool
   */
  private getTextFromPool(): Phaser.GameObjects.Text | null {
    let text = this.textPool.pop();

    if (!text && this.textPool.length < DAMAGE_RENDERER_CONFIG.performance.maxPoolSize) {
      text = this.createPooledText();
    }

    return text || null;
  }

  /**
   * Return a text object to the pool
   */
  private returnTextToPool(text: Phaser.GameObjects.Text): void {
    if (this.textPool.length < DAMAGE_RENDERER_CONFIG.performance.maxPoolSize) {
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
  public handleDamageEvent(damageEvent: EnemyDamageEvent): void {
    if (!this.enemyManager) {
      console.warn('EnemyDamageRenderer: EnemyManager not set');
      return;
    }

    // Validate event is not stale
    if (this.isEventStale(damageEvent)) {
      console.debug(`Stale damage event ${damageEvent.damageEventId} - ignoring`);
      return;
    }

    // Get enemy position
    const position = this.getEnemyPosition(damageEvent.spawnId);
    if (!position) {
      console.warn(
        `[EnemyDamageRenderer] No position found for enemy ${damageEvent.spawnId} - enemy sprite may be missing or invisible`
      );
      return;
    }

    // Check if we're at max concurrent numbers
    if (this.allActiveNumbers.length >= DAMAGE_RENDERER_CONFIG.performance.maxConcurrentNumbers) {
      console.debug('Max concurrent damage numbers reached - skipping');
      return;
    }

    this.createDamageNumber(damageEvent, position.x, position.y);
  }

  /**
   * Check if damage event is too old to process
   */
  private isEventStale(damageEvent: EnemyDamageEvent): boolean {
    const eventTime = damageEvent.timestamp.toDate().getTime();
    const now = Date.now();
    return now - eventTime > DAMAGE_RENDERER_CONFIG.performance.staleEventThresholdMs;
  }

  /**
   * Get enemy sprite position for damage number placement
   */
  private getEnemyPosition(spawnId: number): { x: number; y: number } | null {
    if (!this.enemyManager) return null;

    // Get enemy sprite from enemy manager
    const enemySprite = this.enemyManager.getEnemySprite(spawnId);

    // Allow damage numbers on dead enemies that are still visible (playing death animation)
    if (!enemySprite || !enemySprite.visible) {
      return null;
    }

    return {
      x: enemySprite.x,
      y: enemySprite.y + DAMAGE_RENDERER_CONFIG.display.enemy.baseYOffset,
    };
  }

  /**
   * Create and position a damage number
   */
  private createDamageNumber(damageEvent: EnemyDamageEvent, baseX: number, baseY: number): void {
    const text = this.getTextFromPool();
    if (!text) {
      console.debug('No available text objects in pool');
      return;
    }

    // Calculate stacked position
    const position = this.calculateStackedPosition(damageEvent.spawnId, baseX, baseY, damageEvent);

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
      spawnId: damageEvent.spawnId,
      initialX: position.x,
      initialY: position.y,
      damageEvent: damageEvent,
    };

    // Add to tracking
    this.addToActiveNumbers(damageNumberState);

    // Start animation
    this.animateDamageNumber(damageNumberState);
  }

  /**
   * Calculate position for stacked damage numbers
   */
  private calculateStackedPosition(
    spawnId: number,
    baseX: number,
    baseY: number,
    damageEvent: EnemyDamageEvent
  ): { x: number; y: number } {
    const activeForEnemy = this.activeNumbers.get(spawnId) || [];
    const stackIndex = activeForEnemy.length;

    const { verticalOffset, horizontalJitter } = DAMAGE_RENDERER_CONFIG.stacking;

    // Use deterministic jitter based on damage event data for synchronization
    const seed = this.createSeedFromDamageEvent(damageEvent);
    const jitterX = (this.seededRandom(seed) - 0.5) * horizontalJitter * 2;

    return {
      x: baseX + jitterX,
      y: baseY - stackIndex * verticalOffset,
    };
  }

  /**
   * Configure text appearance based on damage type
   */
  private configureTextAppearance(
    text: Phaser.GameObjects.Text,
    damageEvent: EnemyDamageEvent
  ): void {
    const damageTypeKey = getDamageTypeKey(damageEvent.damageType);
    const style = getDamageStyle(damageTypeKey, 'enemy');
    const displayText = getDamageDisplayText(damageEvent.damageAmount, damageEvent.damageType);

    text.setText(displayText);

    // Apply gradient if specified
    if (style.useGradient && style.gradientColors && text.context) {
      // Get text dimensions for gradient
      const textHeight = parseInt(style.fontSize);

      // Create vertical gradient (top to bottom)
      const gradient = text.context.createLinearGradient(0, 0, 0, textHeight);
      gradient.addColorStop(0, style.gradientColors[0]); // Top color
      gradient.addColorStop(1, style.gradientColors[1]); // Bottom color

      text.setStyle({
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        color: gradient as any, // Use gradient as fill
        stroke: style.stroke,
        strokeThickness: style.strokeThickness,
        fontStyle: style.fontStyle,
      });
    } else {
      // Fallback to solid color
      text.setStyle({
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        color: style.color,
        stroke: style.stroke,
        strokeThickness: style.strokeThickness,
        fontStyle: style.fontStyle,
      });
    }

    // Add scale effect for critical hits
    if (damageTypeKey === 'Crit') {
      text.setScale(1.5);
      this.scene.tweens.add({
        targets: text,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: 'Back.easeOut',
      });
    }
  }

  /**
   * Add damage number to active tracking
   */
  private addToActiveNumbers(damageNumberState: DamageNumberState): void {
    // Add to per-enemy tracking
    if (!this.activeNumbers.has(damageNumberState.spawnId)) {
      this.activeNumbers.set(damageNumberState.spawnId, []);
    }
    this.activeNumbers.get(damageNumberState.spawnId)!.push(damageNumberState);

    // Add to global tracking
    this.allActiveNumbers.push(damageNumberState);
  }

  /**
   * Animate the damage number (rise and fade)
   */
  private animateDamageNumber(damageNumberState: DamageNumberState): void {
    const { text, initialX, initialY, damageEvent } = damageNumberState;
    const { duration, riseDistance, spreadRadius } = DAMAGE_RENDERER_CONFIG.animations;

    // Use deterministic spread based on damage event data for synchronization
    const seed = this.createSeedFromDamageEvent(damageEvent) + 1; // +1 to differentiate from jitter seed
    const spreadX = (this.seededRandom(seed) - 0.5) * spreadRadius * 2;
    const targetX = initialX + spreadX;
    const targetY = initialY - riseDistance;

    // Fade in quickly
    this.scene.tweens.add({
      targets: text,
      alpha: 1,
      duration: DAMAGE_RENDERER_CONFIG.animations.fadeInDuration,
      ease: 'Power1.easeOut',
    });

    // Rise and move
    this.scene.tweens.add({
      targets: text,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: DAMAGE_RENDERER_CONFIG.animations.easingCurve,
    });

    // Fade out at the end
    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      duration: DAMAGE_RENDERER_CONFIG.animations.fadeOutDuration,
      delay: duration - DAMAGE_RENDERER_CONFIG.animations.fadeOutDuration,
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
    const { text, spawnId } = damageNumberState;

    // Remove from per-enemy tracking
    const enemyNumbers = this.activeNumbers.get(spawnId);
    if (enemyNumbers) {
      const index = enemyNumbers.indexOf(damageNumberState);
      if (index !== -1) {
        enemyNumbers.splice(index, 1);
      }
      if (enemyNumbers.length === 0) {
        this.activeNumbers.delete(spawnId);
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
   * Create a deterministic seed from damage event data
   */
  private createSeedFromDamageEvent(damageEvent: EnemyDamageEvent): number {
    // Use damage event properties to create a deterministic seed
    // This ensures all clients generate the same "random" positions
    const timestamp = damageEvent.timestamp.toDate().getTime();
    const spawnId = damageEvent.spawnId;
    const damage = Math.round(damageEvent.damageAmount * 100); // Convert to integer

    // Convert damage type tag to number
    const damageTypeNum = this.damageTypeToNumber(damageEvent.damageType);

    // Combine values to create a unique but deterministic seed
    return (timestamp % 10000) + spawnId * 1000 + damage + damageTypeNum * 10000;
  }

  /**
   * Convert damage type to number for seeding
   */
  private damageTypeToNumber(damageType: any): number {
    switch (damageType.tag) {
      case 'Normal':
        return 1;
      case 'Crit':
        return 2;
      case 'Weak':
        return 3;
      case 'Strong':
        return 4;
      case 'Immune':
        return 5;
      default:
        return 0;
    }
  }

  /**
   * Seeded random number generator for deterministic positioning
   */
  private seededRandom(seed: number): number {
    // Simple linear congruential generator for deterministic randomness
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;

    seed = (a * seed + c) % m;
    return seed / m;
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): Record<string, any> {
    return {
      poolSize: this.textPool.length,
      activeNumbers: this.allActiveNumbers.length,
      activeEnemies: this.activeNumbers.size,
      maxConcurrent: DAMAGE_RENDERER_CONFIG.performance.maxConcurrentNumbers,
    };
  }

  /**
   * Destroy the renderer and clean up resources
   */
  public destroy(): void {
    // Clean up all active numbers
    this.allActiveNumbers.forEach((state) => {
      this.scene.tweens.killTweensOf(state.text);
      state.text.destroy();
    });

    // Clean up pool
    this.textPool.forEach((text) => text.destroy());

    // Clear collections
    this.activeNumbers.clear();
    this.allActiveNumbers.length = 0;
    this.textPool.length = 0;
  }
}
