/**
 * Player Damage Number Renderer
 * Handles floating damage numbers above the player when they take damage
 */

import Phaser from 'phaser';
import { PlayerDamageEvent } from '@/spacetime/client';
import { Player } from '../player';
import {
  DAMAGE_RENDERER_CONFIG,
  getDamageTypeKey,
  getDamageDisplayText,
  getDamageStyle,
} from './damage-renderer-config';
import { DbConnection } from '@/spacetime/client';
import { PeerManager } from '@/peer';
import { skillEffectSprites } from '../../../apps/playground/config/sprite-config';

interface PlayerDamageState {
  text: Phaser.GameObjects.Text;
  startTime: number;
  initialX: number;
  initialY: number;
  damageEvent: PlayerDamageEvent;
}

interface SkillEffectState {
  sprite: Phaser.GameObjects.Sprite;
  targetSprite: Phaser.GameObjects.Sprite;
  updateEvent: Phaser.Time.TimerEvent;
}

export class PlayerDamageRenderer {
  private scene: Phaser.Scene;
  private player: Player | null = null;
  private dbConnection: DbConnection | null = null;
  private peerManager: PeerManager | null = null;

  // Object pooling
  private textPool: Phaser.GameObjects.Text[] = [];
  private activeNumbers: PlayerDamageState[] = [];
  
  // Skill effects tracking
  private activeSkillEffects: Map<string, SkillEffectState> = new Map();

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
   * Set peer manager for accessing peer sprites
   */
  public setPeerManager(peerManager: PeerManager): void {
    this.peerManager = peerManager;
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

    // Subscribe to ALL player damage events from the database
    this.dbConnection.db.playerDamageEvent.onInsert((_ctx, damageEvent) => {
      this.handleDamageEvent(damageEvent);
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
    text.setDepth(DAMAGE_RENDERER_CONFIG.display.player.baseDepth);

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
    console.log('🎯 PlayerDamageRenderer: Received damage event', {
      damageSource: damageEvent.damageSource,
      damageAmount: damageEvent.damageAmount,
      spawnId: damageEvent.spawnId,
      skillEffect: damageEvent.skillEffect,
      playerIdentity: damageEvent.playerIdentity.toHexString()
    });

    // Get the target sprite (local player or peer)
    const targetSprite = this.getTargetSprite(damageEvent.playerIdentity.toHexString());
    if (!targetSprite) {
      console.warn('PlayerDamageRenderer: Target player sprite not found');
      return;
    }

    // Validate event is not stale
    if (this.isEventStale(damageEvent)) {
      console.log('❌ PlayerDamageRenderer: Event is stale, ignoring');
      return;
    }

    // Apply knockback effect only for local player
    if (this.dbConnection && 
        damageEvent.playerIdentity.toHexString() === this.dbConnection.identity?.toHexString()) {
      console.log('🚀 PlayerDamageRenderer: Calling applyKnockbackEffect');
      this.applyKnockbackEffect(damageEvent);
    }

    // Render damage numbers only for local player
    if (this.dbConnection && 
        damageEvent.playerIdentity.toHexString() === this.dbConnection.identity?.toHexString()) {
      // Check if we're at max concurrent numbers
      if (
        this.activeNumbers.length >= DAMAGE_RENDERER_CONFIG.performance.player.maxConcurrentNumbers
      ) {
        // Remove oldest
        const oldest = this.activeNumbers.shift();
        if (oldest) {
          this.cleanupDamageNumber(oldest);
        }
      }

      this.createDamageNumber(damageEvent);
    }
    
    // Render skill effect if present
    if (damageEvent.skillEffect) {
      this.createPlayerSkillEffect(damageEvent.skillEffect, targetSprite);
    }
  }

  /**
   * Apply knockback effect and hit animation based on damage event
   */
  private applyKnockbackEffect(damageEvent: PlayerDamageEvent): void {
    console.log('⚡ applyKnockbackEffect called with damageSource:', damageEvent.damageSource);
    
    if (!this.player || !this.dbConnection) {
      console.log('❌ Missing player or dbConnection:', { player: !!this.player, dbConnection: !!this.dbConnection });
      return;
    }

    // Only apply knockback/invul effects for server-generated damage
    // Client collision damage (Phase 1) already handled these effects
    if (damageEvent.damageSource !== "server_attack") {
      console.log('🚫 Skipping effects for damageSource:', damageEvent.damageSource);
      return; // Skip effects for client collision damage
    }

    console.log('✅ Proceeding with server attack effects');

    // Get damage source position to determine knockback direction
    const damageSourcePosition = this.getDamageSourcePosition(damageEvent);
    
    let knockbackDirection = { x: -1, y: 0 }; // Default fallback
    
    if (damageSourcePosition) {
      // Calculate knockback direction (away from damage source)
      const directionX = this.player.x > damageSourcePosition.x ? 1 : -1;
      knockbackDirection = { x: directionX, y: 0 };
    } else {
      // Fallback: apply default knockback away from player's facing direction
      const directionX = this.player.facingDirection === 1 ? -1 : 1;
      knockbackDirection = { x: directionX, y: 0 };
    }

    // Use the existing animation system to play damaged animation with knockback and flashing
    console.log('🎬 Getting animation system...');
    const animationSystem = this.player.getSystem('animations') as any;
    console.log('🎬 Animation system found:', !!animationSystem);
    
    if (animationSystem && animationSystem.playDamagedAnimation) {
      console.log('🎬 Calling playDamagedAnimation with direction:', knockbackDirection);
      const result = animationSystem.playDamagedAnimation(knockbackDirection);
      console.log('🎬 playDamagedAnimation result:', result);
    } else {
      console.warn('PlayerDamageRenderer: Animation system not found, cannot apply damage effects');
      console.log('🎬 Debug info:', { 
        animationSystem: !!animationSystem, 
        hasMethod: animationSystem ? 'playDamagedAnimation' in animationSystem : false,
        availableMethods: animationSystem ? Object.getOwnPropertyNames(Object.getPrototypeOf(animationSystem)) : []
      });
    }
  }

  /**
   * Get the position of the damage source (enemy that caused the damage)
   */
  private getDamageSourcePosition(damageEvent: PlayerDamageEvent): { x: number; y: number } | null {
    if (!this.dbConnection) return null;

    try {
      // Find the spawn that caused the damage
      const damageSource = this.dbConnection.db.spawn.spawnId.find(damageEvent.spawnId);
      if (damageSource) {
        return { x: damageSource.x, y: damageSource.y };
      }
    } catch (error) {
      console.warn('Failed to get damage source position:', error);
    }

    return null;
  }

  /**
   * Check if damage event is too old to process
   */
  private isEventStale(damageEvent: PlayerDamageEvent): boolean {
    const eventTime = damageEvent.timestamp.toDate().getTime();
    const now = Date.now();
    return now - eventTime > DAMAGE_RENDERER_CONFIG.performance.staleEventThresholdMs;
  }

  /**
   * Create and position a damage number
   */
  private createDamageNumber(damageEvent: PlayerDamageEvent): void {
    const text = this.getTextFromPool();
    if (!text || !this.player) return;

    // Get hit index for stacking (default to 0 for backwards compatibility)
    const hitIndex = damageEvent.hitIndex || 0;
    const totalHits = damageEvent.totalHits || 1;

    // Position above player with vertical stacking based on hit index
    const baseX = this.player.x;
    const stackOffset = hitIndex * -25; // Each hit 25px higher
    const baseY = this.player.y + DAMAGE_RENDERER_CONFIG.display.player.baseYOffset + stackOffset;

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

    // Start animation with stagger delay
    this.animateDamageNumber(damageNumberState);
  }

  /**
   * Configure text appearance based on damage type
   */
  private configureTextAppearance(
    text: Phaser.GameObjects.Text,
    damageEvent: PlayerDamageEvent
  ): void {
    const damageTypeKey = getDamageTypeKey(damageEvent.damageType);
    const style = getDamageStyle(damageTypeKey, 'player');
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
   * Animate the damage number
   */
  private animateDamageNumber(damageNumberState: PlayerDamageState): void {
    const { text, initialX, initialY, damageEvent } = damageNumberState;
    const { duration, riseDistance, spreadRadius } = DAMAGE_RENDERER_CONFIG.animations.player;

    // Use deterministic spread
    const seed = this.createSeedFromDamageEvent(damageEvent) + 1;
    const spreadX = (this.seededRandom(seed) - 0.5) * spreadRadius * 2;
    const targetX = initialX + spreadX;
    const targetY = initialY - riseDistance;

    // Calculate stagger delay based on hit index
    const hitIndex = damageEvent.hitIndex || 0;
    const staggerDelay = hitIndex * 100; // 100ms between each hit appearance

    // Fade in
    this.scene.tweens.add({
      targets: text,
      alpha: 1,
      duration: DAMAGE_RENDERER_CONFIG.animations.fadeInDuration,
      delay: staggerDelay,
      ease: 'Power1.easeOut',
    });

    // Rise and move
    this.scene.tweens.add({
      targets: text,
      x: targetX,
      y: targetY,
      duration: duration,
      delay: staggerDelay,
      ease: DAMAGE_RENDERER_CONFIG.animations.easingCurve,
    });

    // Fade out
    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      duration: DAMAGE_RENDERER_CONFIG.animations.player.fadeOutDuration,
      delay: staggerDelay + duration - DAMAGE_RENDERER_CONFIG.animations.player.fadeOutDuration,
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

    return (timestamp % 10000) + damage + damageTypeNum * 10000;
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
   * Seeded random number generator
   */
  private seededRandom(seed: number): number {
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;

    seed = (a * seed + c) % m;
    return seed / m;
  }

  /**
   * Destroy the renderer and clean up resources
   */
  public destroy(): void {
    // Clean up all active numbers
    this.activeNumbers.forEach((state) => {
      this.scene.tweens.killTweensOf(state.text);
      state.text.destroy();
    });

    // Clean up pool
    this.textPool.forEach((text) => text.destroy());
    
    // Clean up skill effects
    this.activeSkillEffects.forEach((effectState) => {
      effectState.updateEvent.destroy();
      effectState.sprite.destroy();
    });

    // Clear collections
    this.activeNumbers.length = 0;
    this.textPool.length = 0;
    this.activeSkillEffects.clear();
  }

  /**
   * Get the target sprite for damage rendering (local player or peer)
   */
  private getTargetSprite(playerIdentityHex: string): Phaser.GameObjects.Sprite | null {
    // Check if it's the local player
    if (this.dbConnection && 
        playerIdentityHex === this.dbConnection.identity?.toHexString()) {
      return this.player;
    }
    
    // Otherwise, try to get peer sprite
    if (this.peerManager) {
      return this.peerManager.getPeerSprite(playerIdentityHex);
    }
    
    return null;
  }

  /**
   * Create and play skill effect on the target player/peer
   */
  private createPlayerSkillEffect(effectKey: string, targetSprite: Phaser.GameObjects.Sprite): void {
    // Create effect sprite at target position
    const effect = this.scene.add.sprite(
      targetSprite.x,
      targetSprite.y,
      effectKey
    );

    // Configure effect visual properties
    effect.setDepth(targetSprite.depth + 100);
    
    // Use scale from sprite config if available
    const spriteConfig = skillEffectSprites[effectKey];
    const scale = spriteConfig?.scale || 2;
    effect.setScale(scale);

    // Start position update timer to follow player
    const updateEvent = this.scene.time.addEvent({
      delay: 16, // ~60fps
      callback: () => {
        if (targetSprite && targetSprite.active) {
          effect.setPosition(targetSprite.x, targetSprite.y);
        } else {
          // Clean up if target is no longer active (dead)
          this.cleanupSkillEffect(effectId);
        }
      },
      loop: true
    });

    // Generate unique key for tracking
    const effectId = `${effectKey}_${Date.now()}_${Math.random()}`;
    this.activeSkillEffects.set(effectId, {
      sprite: effect,
      targetSprite: targetSprite,
      updateEvent: updateEvent
    });

    // Try to play animation
    const animKey = `${effectKey}_play`;
    if (this.scene.anims.exists(animKey)) {
      // Play the animation with repeat: 0 to ensure it plays once
      effect.play({ key: animKey, repeat: 0 });
      
      // Clean up after animation completes
      effect.on('animationcomplete', () => {
        this.cleanupSkillEffect(effectId);
      });
      
      // Fallback cleanup in case animationcomplete doesn't fire
      const animDuration = effect.anims.currentAnim?.duration || 600;
      this.scene.time.delayedCall(animDuration + 100, () => {
        if (this.activeSkillEffects.has(effectId)) {
          this.cleanupSkillEffect(effectId);
        }
      });
    } else {
      // If no animation, clean up after a delay
      this.scene.time.delayedCall(600, () => {
        this.cleanupSkillEffect(effectId);
      });
    }

    console.log('PlayerDamageRenderer: Created skill effect', { 
      effectKey, 
      targetIdentity: targetSprite === this.player ? 'local' : 'peer' 
    });
  }

  /**
   * Clean up a skill effect
   */
  private cleanupSkillEffect(effectId: string): void {
    const effectState = this.activeSkillEffects.get(effectId);
    if (effectState) {
      effectState.updateEvent.destroy();
      effectState.sprite.destroy();
      this.activeSkillEffects.delete(effectId);
    }
  }
}
