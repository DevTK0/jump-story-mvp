/**
 * Respawn Countdown UI
 * Displays countdown timer when player is dead and waiting to respawn
 */

import Phaser from 'phaser';
import { DbConnection, Player as ServerPlayer } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { createLogger } from '@/core/logger';
import { UIContextService } from '../services/ui-context-service';

export class RespawnCountdownUI {
  private scene: Phaser.Scene;
  private dbConnection: DbConnection | null = null;
  private playerIdentity: Identity;
  private logger = createLogger('RespawnCountdownUI');

  // UI Elements
  private container!: Phaser.GameObjects.Container;
  private backgroundRect!: Phaser.GameObjects.Rectangle;
  private countdownText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  
  // State
  private isVisible: boolean = false;
  private respawnAvailableAt: number = 0;
  private updateInterval?: number;

  constructor(scene: Phaser.Scene) {
    console.log('[RespawnCountdownUI] Constructor called');
    this.scene = scene;
    
    // Get data from context service
    console.log('[RespawnCountdownUI] Getting UIContextService instance...');
    let context;
    let identity;
    
    try {
      context = UIContextService.getInstance();
      console.log('[RespawnCountdownUI] Got context, getting player identity...');
      identity = context.getPlayerIdentity();
    } catch (error) {
      console.error('[RespawnCountdownUI] Error getting UIContextService or identity:', error);
      return;
    }
    
    if (!identity) {
      console.log('[RespawnCountdownUI] No identity available, will wait...');
      this.logger.debug('Player identity not available yet, waiting...');
      this.waitForIdentity();
      return;
    }
    
    console.log('[RespawnCountdownUI] Identity available, proceeding with full initialization');
    
    this.playerIdentity = identity;
    this.dbConnection = context.getDbConnection();
    
    this.logger.debug('Initializing RespawnCountdownUI');
    
    this.createUI();
    
    // Setup data listener
    if (this.dbConnection) {
      this.setupDataListener();
    }
  }

  private createUI(): void {
    // Create container at center of screen
    const centerX = this.scene.cameras.main.width / 2;
    const centerY = this.scene.cameras.main.height / 2;
    
    this.container = this.scene.add.container(centerX, centerY);
    this.container.setDepth(1000); // High depth to appear above everything
    this.container.setScrollFactor(0); // Fixed to camera
    this.container.setVisible(false);

    // Create semi-transparent background
    this.backgroundRect = this.scene.add.rectangle(0, 0, 400, 150, 0x000000, 0.8);
    this.backgroundRect.setStrokeStyle(2, 0xff0000);
    
    // Create countdown text
    this.countdownText = this.scene.add.text(0, -20, 'Respawn in: 0s', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      align: 'center'
    });
    this.countdownText.setOrigin(0.5);
    
    // Create instruction text
    this.instructionText = this.scene.add.text(0, 20, 'Press R to respawn', {
      fontSize: '18px',
      color: '#cccccc',
      fontFamily: 'Arial, sans-serif',
      align: 'center'
    });
    this.instructionText.setOrigin(0.5);
    
    // Add elements to container
    this.container.add([this.backgroundRect, this.countdownText, this.instructionText]);
  }

  private setupDataListener(): void {
    if (!this.dbConnection) return;

    // Listen to player updates
    this.dbConnection.db.player.onUpdate((_ctx, _oldPlayer, newPlayer) => {
      if (newPlayer.identity.toHexString() === this.playerIdentity.toHexString()) {
        this.handlePlayerUpdate(newPlayer);
      }
    });

    // Check initial state
    const currentPlayer = Array.from(this.dbConnection.db.player.iter()).find(
      p => p.identity.toHexString() === this.playerIdentity.toHexString()
    );
    
    if (currentPlayer) {
      this.handlePlayerUpdate(currentPlayer);
    }
  }

  private handlePlayerUpdate(player: ServerPlayer): void {
    // Check if player is dead
    if (player.state.tag === 'Dead' || player.currentHp <= 0) {
      // Extract timestamp from SpacetimeDB Timestamp object and convert to milliseconds
      const timestamp = player.respawnAvailableAt as any;
      this.respawnAvailableAt = Number(timestamp.__timestamp_micros_since_unix_epoch__) / 1000;
      this.show();
    } else {
      this.hide();
    }
  }

  private show(): void {
    if (this.isVisible) return;
    
    this.isVisible = true;
    this.container.setVisible(true);
    
    // Start update loop
    this.updateInterval = window.setInterval(() => {
      this.updateCountdown();
    }, 100); // Update every 100ms for smooth countdown
    
    // Initial update
    this.updateCountdown();
  }

  private hide(): void {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    this.container.setVisible(false);
    
    // Clear update interval
    if (this.updateInterval) {
      window.clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  private updateCountdown(): void {
    // respawnAvailableAt is already in milliseconds
    const currentTime = Date.now();
    const remainingTime = Math.max(0, this.respawnAvailableAt - currentTime);
    
    if (remainingTime > 0) {
      // Show countdown
      const seconds = Math.ceil(remainingTime / 1000);
      this.countdownText.setText(`Respawn in: ${seconds}s`);
      this.countdownText.setColor('#ff6666');
      this.instructionText.setText('Please wait...');
      this.instructionText.setColor('#999999');
    } else {
      // Ready to respawn
      this.countdownText.setText('Ready to respawn!');
      this.countdownText.setColor('#66ff66');
      this.instructionText.setText('Press R to respawn');
      this.instructionText.setColor('#ffffff');
      
      // Add pulsing effect when ready
      this.scene.tweens.add({
        targets: this.countdownText,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  private waitForIdentity(): void {
    const context = UIContextService.getInstance();
    
    // Check periodically for identity
    const checkInterval = this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        const identity = context.getPlayerIdentity();
        if (identity) {
          this.logger.debug('Player identity now available, initializing RespawnCountdownUI');
          this.playerIdentity = identity;
          this.dbConnection = context.getDbConnection();
          
          // Create UI and setup listeners
          this.createUI();
          
          if (this.dbConnection) {
            this.setupDataListener();
          }
          
          // Stop checking
          checkInterval.remove();
        }
      },
      loop: true
    });
  }

  public destroy(): void {
    if (this.updateInterval) {
      window.clearInterval(this.updateInterval);
    }
    if (this.container) {
      this.container.destroy();
    }
  }
}