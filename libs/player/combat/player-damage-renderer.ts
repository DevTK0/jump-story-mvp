/**
 * Player Damage Number Renderer
 * Handles floating damage numbers above the player when they take damage
 */

import Phaser from 'phaser';
import { PlayerDamageEvent } from '@/spacetime/client';
import { Player } from '../player';
import { getDamageTypeKey, getDamageDisplayText } from './damage-number-config';
import { DbConnection } from '@/spacetime/client';

interface PlayerDamageState {
  text: Phaser.GameObjects.Text;
  startTime: number;
  initialX: number;
  initialY: number;
  damageEvent: PlayerDamageEvent;
}

// Player damage specific configuration
const PLAYER_DAMAGE_CONFIG = {
  styles: {
    Normal: { 
      fontSize: '18px', 
      fontFamily: 'monospace', 
      color: '#FF6666', // Light red for player damage
      stroke: '#000000', 
      strokeThickness: 2,
      fontStyle: 'normal'
    },
    Crit: { 
      fontSize: '24px', 
      fontFamily: 'monospace', 
      color: '#FF0000', // Bright red for crits
      stroke: '#000000', 
      strokeThickness: 3,
      fontStyle: 'bold'
    },
    Weak: { 
      fontSize: '16px', 
      fontFamily: 'monospace', 
      color: '#FFB366', // Orange for resisted damage
      stroke: '#000000', 
      strokeThickness: 1,
      fontStyle: 'normal'
    },
    Strong: { 
      fontSize: '20px', 
      fontFamily: 'monospace', 
      color: '#CC0000', // Dark red for strong hits
      stroke: '#000000', 
      strokeThickness: 2,
      fontStyle: 'bold'
    },
    Immune: { 
      fontSize: '16px', 
      fontFamily: 'monospace', 
      color: '#00FF00', // Green for immune (shouldn't happen but just in case)
      stroke: '#000000', 
      strokeThickness: 1,
      fontStyle: 'italic'
    },
  },
  animations: {
    duration: 2000,           // Longer duration for player damage
    fadeInDuration: 200,      
    fadeOutDuration: 400,     
    riseDistance: 100,        // Rise higher for visibility
    spreadRadius: 20,         
    easingCurve: 'Power2.easeOut',
  },
  display: {
    baseDepth: 200,           // Higher than enemy damage numbers
    baseYOffset: -80,         // Position above player sprite
  },
  performance: {
    maxConcurrentNumbers: 10, // Limit for player damage
    staleEventThresholdMs: 5000,
  },
};

export class PlayerDamageRenderer {
  private scene: Phaser.Scene;
  private player: Player | null = null;
  private dbConnection: DbConnection | null = null;
  
  // Object pooling
  private textPool: Phaser.GameObjects.Text[] = [];
  private activeNumbers: PlayerDamageState[] = [];
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initializePool();
  }

  /**
   * Set the player reference for positioning
   */
  public setPlayer(player: Player): void {
    this.player = player;
  }

  /**
   * Set database connection and subscribe to events
   */
  public setDbConnection(connection: DbConnection): void {
    this.dbConnection = connection;
    this.setupDamageEventSubscription();
  }

  /**
   * Subscribe to player damage events
   */
  private setupDamageEventSubscription(): void {
    if (!this.dbConnection) return;

    // Subscribe to player damage events from the database
    this.dbConnection.db.playerDamageEvent.onInsert((_ctx, damageEvent) => {
      // Only show damage for the local player
      if (this.dbConnection && 
          damageEvent.playerIdentity.toHexString() === this.dbConnection.identity?.toHexString()) {
        this.handleDamageEvent(damageEvent);
      }
    });
  }

  /**
   * Initialize the object pool
   */
  private initializePool(): void {
    const poolSize = 20; // Smaller pool for player
    
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
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#FFFFFF',
    });
    
    text.setVisible(false);
    text.setActive(false);
    text.setDepth(PLAYER_DAMAGE_CONFIG.display.baseDepth);
    
    return text;
  }

  /**
   * Get a text object from the pool
   */
  private getTextFromPool(): Phaser.GameObjects.Text | null {
    let text = this.textPool.pop();
    
    if (!text) {
      text = this.createPooledText();
    }
    
    return text || null;
  }

  /**
   * Return a text object to the pool
   */
  private returnTextToPool(text: Phaser.GameObjects.Text): void {
    text.setVisible(false);
    text.setActive(false);
    text.clearTint();
    this.scene.tweens.killTweensOf(text);
    this.textPool.push(text);
  }

  /**
   * Handle incoming damage event
   */
  public handleDamageEvent(damageEvent: PlayerDamageEvent): void {
    if (!this.player) {
      console.warn('PlayerDamageRenderer: Player not set');
      return;
    }

    // Validate event is not stale
    if (this.isEventStale(damageEvent)) {
      return;
    }

    // Check if we're at max concurrent numbers
    if (this.activeNumbers.length >= PLAYER_DAMAGE_CONFIG.performance.maxConcurrentNumbers) {
      // Remove oldest
      const oldest = this.activeNumbers.shift();
      if (oldest) {
        this.cleanupDamageNumber(oldest);
      }
    }

    this.createDamageNumber(damageEvent);
  }

  /**
   * Check if damage event is too old to process
   */
  private isEventStale(damageEvent: PlayerDamageEvent): boolean {
    const eventTime = damageEvent.timestamp.toDate().getTime();
    const now = Date.now();
    return now - eventTime > PLAYER_DAMAGE_CONFIG.performance.staleEventThresholdMs;
  }

  /**
   * Create and position a damage number
   */
  private createDamageNumber(damageEvent: PlayerDamageEvent): void {
    const text = this.getTextFromPool();
    if (!text || !this.player) return;

    // Position above player
    const baseX = this.player.x;
    const baseY = this.player.y + PLAYER_DAMAGE_CONFIG.display.baseYOffset;
    
    // Add some horizontal randomness
    const seed = this.createSeedFromDamageEvent(damageEvent);
    const jitterX = (this.seededRandom(seed) - 0.5) * 20;
    
    // Configure text appearance
    this.configureTextAppearance(text, damageEvent);
    
    // Position and show text
    text.setPosition(baseX + jitterX, baseY);
    text.setVisible(true);
    text.setActive(true);
    text.setAlpha(0);

    // Create damage number state
    const damageNumberState: PlayerDamageState = {
      text,
      startTime: this.scene.time.now,
      initialX: baseX + jitterX,
      initialY: baseY,
      damageEvent: damageEvent,
    };

    // Add to tracking
    this.activeNumbers.push(damageNumberState);

    // Start animation
    this.animateDamageNumber(damageNumberState);
  }

  /**
   * Configure text appearance based on damage type
   */
  private configureTextAppearance(text: Phaser.GameObjects.Text, damageEvent: PlayerDamageEvent): void {
    const damageTypeKey = getDamageTypeKey(damageEvent.damageType);
    const style = PLAYER_DAMAGE_CONFIG.styles[damageTypeKey];
    const displayText = '-' + getDamageDisplayText(damageEvent.damageAmount, damageEvent.damageType);

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
   * Animate the damage number
   */
  private animateDamageNumber(damageNumberState: PlayerDamageState): void {
    const { text, initialX, initialY, damageEvent } = damageNumberState;
    const { duration, riseDistance, spreadRadius } = PLAYER_DAMAGE_CONFIG.animations;

    // Use deterministic spread
    const seed = this.createSeedFromDamageEvent(damageEvent) + 1;
    const spreadX = (this.seededRandom(seed) - 0.5) * spreadRadius * 2;
    const targetX = initialX + spreadX;
    const targetY = initialY - riseDistance;

    // Fade in
    this.scene.tweens.add({
      targets: text,
      alpha: 1,
      duration: PLAYER_DAMAGE_CONFIG.animations.fadeInDuration,
      ease: 'Power1.easeOut',
    });

    // Rise and move
    this.scene.tweens.add({
      targets: text,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: PLAYER_DAMAGE_CONFIG.animations.easingCurve,
    });

    // Fade out
    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      duration: PLAYER_DAMAGE_CONFIG.animations.fadeOutDuration,
      delay: duration - PLAYER_DAMAGE_CONFIG.animations.fadeOutDuration,
      ease: 'Power1.easeIn',
      onComplete: () => {
        this.cleanupDamageNumber(damageNumberState);
      },
    });
  }

  /**
   * Clean up completed damage number
   */
  private cleanupDamageNumber(damageNumberState: PlayerDamageState): void {
    const { text } = damageNumberState;

    // Remove from tracking
    const index = this.activeNumbers.indexOf(damageNumberState);
    if (index !== -1) {
      this.activeNumbers.splice(index, 1);
    }

    // Return text to pool
    this.returnTextToPool(text);
  }

  /**
   * Create a deterministic seed from damage event data
   */
  private createSeedFromDamageEvent(damageEvent: PlayerDamageEvent): number {
    const timestamp = damageEvent.timestamp.toDate().getTime();
    const damage = Math.round(damageEvent.damageAmount * 100);
    const damageTypeNum = this.damageTypeToNumber(damageEvent.damageType);
    
    return (timestamp % 10000) + damage + (damageTypeNum * 10000);
  }

  /**
   * Convert damage type to number for seeding
   */
  private damageTypeToNumber(damageType: any): number {
    switch (damageType.tag) {
      case 'Normal': return 1;
      case 'Crit': return 2;
      case 'Weak': return 3;
      case 'Strong': return 4;
      case 'Immune': return 5;
      default: return 0;
    }
  }

  /**
   * Seeded random number generator
   */
  private seededRandom(seed: number): number {
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;
    
    seed = (a * seed + c) % m;
    return (seed / m);
  }

  /**
   * Destroy the renderer and clean up resources
   */
  public destroy(): void {
    // Clean up all active numbers
    this.activeNumbers.forEach(state => {
      this.scene.tweens.killTweensOf(state.text);
      state.text.destroy();
    });

    // Clean up pool
    this.textPool.forEach(text => text.destroy());

    // Clear collections
    this.activeNumbers.length = 0;
    this.textPool.length = 0;
  }
}