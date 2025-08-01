import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { PlayerStatsUI } from './stats/player-stats-ui';
import { BottomUIBar } from './bottom-bar/bottom-ui-bar';
import { CombatSkillBar } from './combat/combat-skill-bar';
import { FPSCounter } from './performance/fps-counter';
import { PerformanceMetrics } from './performance/performance-metrics';
import { DbMetricsTracker } from './performance/db-metrics-tracker';
import { UI_CONFIG } from './ui-config';
import { UIContextService, type UICreateConfig } from './services/ui-context-service';
import { NameChangeDialog } from './menus/name-change-dialog';
import { BroadcastDisplay } from './broadcast/broadcast-display';
import { RespawnCountdownUI } from './respawn/respawn-countdown-ui';

// Re-export UICreateConfig from UIContextService to maintain compatibility
export type { UICreateConfig };

/**
 * Factory for creating and managing UI components
 */
export class UIFactory {
  private scene: Phaser.Scene;
  private logger: ModuleLogger;
  
  // UI Components
  private playerStatsUI?: PlayerStatsUI;
  private bottomUIBar?: BottomUIBar;
  private combatSkillBar?: CombatSkillBar;
  private fpsCounter?: FPSCounter;
  private performanceMetrics?: PerformanceMetrics;
  private broadcastDisplay?: BroadcastDisplay;
  private respawnCountdownUI?: RespawnCountdownUI;
  
  // Keyboard shortcuts
  private keyboardHandlers: Map<string, () => void> = new Map();
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.logger = createLogger('UIFactory');
  }
  
  /**
   * Create all game UI components
   */
  createGameUI(config: UICreateConfig): void {
    console.log('[UIFactory] createGameUI called', {
      hasConnection: !!config.connection,
      hasIdentity: !!config.identity,
      hasPlayer: !!config.player
    });
    this.logger.info('Creating game UI...');
    
    // Initialize UIContextService first
    console.log('[UIFactory] Initializing UIContextService...');
    UIContextService.initialize(this.scene, config);
    this.logger.debug('UIContextService initialized');
    console.log('[UIFactory] UIContextService initialized successfully');
    
    // Initialize DbMetricsTracker singleton
    DbMetricsTracker.getInstance().initialize(config.connection);
    this.logger.debug('DbMetricsTracker initialized');
    
    // Create player stats UI
    this.createPlayerStatsUI(config);
    
    // Create performance UI
    this.createPerformanceUI();
    
    // Create broadcast display
    this.createBroadcastDisplay(config);
    
    // Create respawn countdown UI
    this.createRespawnCountdownUI();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts(config);
    
    // Check if player has default name and show name change dialog
    this.checkAndShowNameChangeDialog(config);
    
    this.logger.info('Game UI created successfully');
  }
  
  private checkAndShowNameChangeDialog(config: UICreateConfig): void {
    // Wait a bit for UI to be fully initialized
    this.scene.time.delayedCall(500, () => {
      // Check if player has default name
      if (config.connection) {
        for (const player of config.connection.db.player.iter()) {
          if (player.identity.toHexString() === config.identity.toHexString()) {
            if (player.name === 'Player') {
              this.logger.info('Player has default name, showing name change dialog');
              const nameChangeDialog = new NameChangeDialog(this.scene);
              nameChangeDialog.show();
            }
            break;
          }
        }
      }
    });
  }
  
  /**
   * Update UI components
   */
  update(time: number, delta: number): void {
    // Update FPS counter
    if (this.fpsCounter) {
      this.fpsCounter.update(time, delta);
    }
    
    // Update performance metrics
    if (this.performanceMetrics) {
      this.performanceMetrics.update(time, delta);
    }
    
    // Update combat skill bar cooldowns
    if (this.combatSkillBar) {
      this.combatSkillBar.update();
    }
  }
  
  /**
   * Cleanup UI components
   */
  destroy(): void {
    this.logger.info('Destroying UI components...');
    
    // Remove keyboard handlers
    this.keyboardHandlers.forEach((handler, key) => {
      this.scene.input.keyboard?.off(`keydown-${key}`, handler);
    });
    this.keyboardHandlers.clear();
    
    // Destroy UI components
    this.playerStatsUI?.destroy();
    this.bottomUIBar?.destroy();
    this.combatSkillBar?.destroy();
    this.fpsCounter?.destroy();
    this.performanceMetrics?.destroy();
    this.broadcastDisplay?.destroy();
    this.respawnCountdownUI?.destroy();
    
    // Destroy UIContextService if it was initialized
    if (UIContextService.isInitialized()) {
      UIContextService.getInstance().destroy();
    }
  }
  
  // Private creation methods
  
  private createPlayerStatsUI(_config: UICreateConfig): void {
    console.log('[UIFactory] Creating player stats UI...');
    // Create the new bottom UI bar - no need to pass identity or connection
    try {
      this.bottomUIBar = new BottomUIBar(this.scene);
      console.log('[UIFactory] BottomUIBar created successfully');
    } catch (error) {
      console.error('[UIFactory] Failed to create BottomUIBar:', error);
    }
    
    // Create combat skill bar
    try {
      this.combatSkillBar = new CombatSkillBar(this.scene);
      console.log('[UIFactory] CombatSkillBar created successfully');
    } catch (error) {
      console.error('[UIFactory] Failed to create CombatSkillBar:', error);
    }
    
    // Keep the old stats UI but hide it (for backward compatibility)
    this.playerStatsUI = new PlayerStatsUI(this.scene);
    this.playerStatsUI.setVisible(false);
  }
  
  private createPerformanceUI(): void {
    // Get scene config to check if performance UI should be created
    const sceneConfig = this.scene.data.get('sceneConfig');
    
    // Create FPS counter if enabled in config
    if (sceneConfig?.debug?.fps) {
      const fpsConfig = UI_CONFIG.fpsCounter;
      this.fpsCounter = new FPSCounter(this.scene, {
        x: this.scene.scale.width + fpsConfig.defaultPosition.xOffset,
        y: fpsConfig.defaultPosition.y,
        fontSize: fpsConfig.fontSize,
        alpha: fpsConfig.alpha,
      });
    }
    
    // Create performance metrics panel if enabled in config
    if (sceneConfig?.debug?.metrics) {
      const perfConfig = UI_CONFIG.performanceMetrics;
      this.performanceMetrics = new PerformanceMetrics(this.scene, {
        x: perfConfig.position.x,
        y: perfConfig.position.y,
        fontSize: '14px',
        alpha: 0.7,
      });
    }
  }
  
  private createBroadcastDisplay(config: UICreateConfig): void {
    // Create broadcast display if we have a connection
    if (config.connection) {
      this.broadcastDisplay = new BroadcastDisplay(this.scene, config.connection);
      this.logger.debug('BroadcastDisplay created');
    }
  }
  
  private createRespawnCountdownUI(): void {
    console.log('[UIFactory] Creating respawn countdown UI...');
    // Create respawn countdown UI
    try {
      this.respawnCountdownUI = new RespawnCountdownUI(this.scene);
      this.logger.debug('RespawnCountdownUI created');
      console.log('[UIFactory] RespawnCountdownUI created successfully');
    } catch (error) {
      console.error('[UIFactory] Failed to create RespawnCountdownUI:', error);
    }
  }
  
  private setupKeyboardShortcuts(config: UICreateConfig): void {
    // Test level up animation (U key) - for development
    this.registerKeyboardShortcut('U', () => {
      this.testLevelUpAnimation(config);
    });
  }
  
  private registerKeyboardShortcut(key: string, handler: () => void): void {
    if (this.scene.input.keyboard) {
      this.scene.input.keyboard.on(`keydown-${key}`, handler);
      this.keyboardHandlers.set(key, handler);
    }
  }
  
  private testLevelUpAnimation(config: UICreateConfig): void {
    // This is a test function for development
    // The managers are stored in the scene data, not registry
    const managers = this.scene.data.get('managers');
    const levelUpManager = managers?.getLevelUpAnimationManager();
    
    if (levelUpManager && config.connection) {
      // Get current level from database
      let currentLevel = 1;
      for (const player of config.connection.db.player.iter()) {
        if (player.identity.toHexString() === config.identity.toHexString()) {
          currentLevel = player.level;
          break;
        }
      }
      // Trigger level up animation
      levelUpManager.triggerLevelUpAnimation(config.identity, currentLevel + 1);
    }
  }
  
  // Getters for external access
  
  getPlayerStatsUI(): PlayerStatsUI | undefined {
    return this.playerStatsUI;
  }
  
  getBottomUIBar(): BottomUIBar | undefined {
    return this.bottomUIBar;
  }
  
  getFPSCounter(): FPSCounter | undefined {
    return this.fpsCounter;
  }
  
  getPerformanceMetrics(): PerformanceMetrics | undefined {
    return this.performanceMetrics;
  }
}