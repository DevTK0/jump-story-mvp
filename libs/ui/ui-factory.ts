import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { PlayerStatsUI } from './stats/player-stats-ui';
import { BottomUIBar } from './bottom-bar/bottom-ui-bar';
import { FPSCounter } from './performance/fps-counter';
import { PerformanceMetrics } from './performance/performance-metrics';
import { DbMetricsTracker } from './performance/db-metrics-tracker';
import { UI_CONFIG } from './ui-config';
import { UIContextService, type UICreateConfig } from './services/ui-context-service';

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
  private fpsCounter?: FPSCounter;
  private performanceMetrics?: PerformanceMetrics;
  
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
    this.logger.info('Creating game UI...');
    
    // Initialize UIContextService first
    UIContextService.initialize(this.scene, config);
    this.logger.debug('UIContextService initialized');
    
    // Initialize DbMetricsTracker singleton
    DbMetricsTracker.getInstance().initialize(config.connection);
    this.logger.debug('DbMetricsTracker initialized');
    
    // Create player stats UI
    this.createPlayerStatsUI(config);
    
    // Create performance UI
    this.createPerformanceUI();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts(config);
    
    this.logger.info('Game UI created successfully');
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
    this.fpsCounter?.destroy();
    this.performanceMetrics?.destroy();
    
    // Destroy UIContextService if it was initialized
    if (UIContextService.isInitialized()) {
      UIContextService.getInstance().destroy();
    }
  }
  
  // Private creation methods
  
  private createPlayerStatsUI(_config: UICreateConfig): void {
    // Create the new bottom UI bar - no need to pass identity or connection
    this.bottomUIBar = new BottomUIBar(this.scene);
    
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