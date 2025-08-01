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
import { ClassSelectionMenu } from './menus/class-selection-menu';
import { TeleportSelectionMenu } from './menus/teleport-selection-menu';
import { LeaderboardDialog } from './menus/leaderboard-dialog';
import { AttackInfoMenu } from './menus/attack-info-menu';
import { PassiveInfoMenu } from './menus/passive-info-menu';
import { jobAttributes } from '../../apps/playground/config/job-attributes';

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
  private classSelectionMenu?: ClassSelectionMenu;
  private nameChangeDialog?: NameChangeDialog;
  private teleportSelectionMenu?: TeleportSelectionMenu;
  private leaderboardDialog?: LeaderboardDialog;
  private attackInfoMenu?: AttackInfoMenu;
  private passiveInfoMenu?: PassiveInfoMenu;
  
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
    this.classSelectionMenu?.destroy();
    this.nameChangeDialog?.destroy();
    this.teleportSelectionMenu?.destroy();
    this.leaderboardDialog?.destroy();
    this.attackInfoMenu?.destroy();
    this.passiveInfoMenu?.destroy();
    
    // Destroy UIContextService if it was initialized
    if (UIContextService.isInitialized()) {
      UIContextService.getInstance().destroy();
    }
  }
  
  // Private creation methods
  
  private createPlayerStatsUI(_config: UICreateConfig): void {
    // Create the new bottom UI bar - no need to pass identity or connection
    this.bottomUIBar = new BottomUIBar(this.scene);
    
    // Create combat skill bar
    this.combatSkillBar = new CombatSkillBar(this.scene);
    
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
    // Create respawn countdown UI
    this.respawnCountdownUI = new RespawnCountdownUI(this.scene);
    this.logger.debug('RespawnCountdownUI created');
  }
  
  private setupKeyboardShortcuts(config: UICreateConfig): void {
    // Test level up animation (U key) - for development
    this.registerKeyboardShortcut('U', () => {
      this.testLevelUpAnimation(config);
    });
    
    // Job menu hotkey (J key)
    this.registerKeyboardShortcut('J', () => {
      this.openJobMenu();
    });
    
    // Name change hotkey (N key)
    this.registerKeyboardShortcut('N', () => {
      this.openNameChangeDialog();
    });
    
    // Teleport menu hotkey (T key)
    this.registerKeyboardShortcut('T', () => {
      this.openTeleportMenu();
    });
    
    // Leaderboard hotkey (L key)
    this.registerKeyboardShortcut('L', () => {
      this.openLeaderboard();
    });
    
    // Attack info hotkey (A key)
    this.registerKeyboardShortcut('A', () => {
      this.openAttackInfo();
    });
    
    // Passive info hotkey (P key)
    this.registerKeyboardShortcut('P', () => {
      this.openPassiveInfo();
    });
    
    // Number keys 1-9 to directly change jobs
    const keyCodes = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    keyCodes.forEach((keyCode, index) => {
      const jobNumber = index + 1;
      this.registerKeyboardShortcut(keyCode, () => {
        this.quickChangeJob(jobNumber);
      });
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
  
  private openJobMenu(): void {
    // Check if player is in combat first
    const context = UIContextService.getInstance();
    const connection = context.getDbConnection();
    const identity = context.getPlayerIdentity();
    
    if (connection && identity) {
      for (const player of connection.db.player.iter()) {
        if (player.identity.toHexString() === identity.toHexString()) {
          if (player.inCombat === true) {
            this.logger.warn('Cannot change jobs while in combat');
            return;
          }
          break;
        }
      }
    }
    
    // Toggle the class selection menu
    if (!this.classSelectionMenu) {
      this.classSelectionMenu = new ClassSelectionMenu(this.scene);
    }
    
    // Toggle visibility
    if (this.classSelectionMenu.visible) {
      this.classSelectionMenu.hide();
    } else {
      this.classSelectionMenu.show();
    }
  }
  
  private openNameChangeDialog(): void {
    // Toggle the name change dialog
    if (!this.nameChangeDialog) {
      this.nameChangeDialog = new NameChangeDialog(this.scene);
    }
    
    // Toggle visibility
    if (this.nameChangeDialog.visible) {
      this.nameChangeDialog.hide();
    } else {
      this.nameChangeDialog.show();
    }
  }
  
  private openTeleportMenu(): void {
    // Toggle the teleport selection menu
    if (!this.teleportSelectionMenu) {
      this.teleportSelectionMenu = new TeleportSelectionMenu(this.scene);
    }
    
    // Toggle visibility
    if (this.teleportSelectionMenu.visible) {
      this.teleportSelectionMenu.hide();
    } else {
      this.teleportSelectionMenu.show();
    }
  }
  
  private openLeaderboard(): void {
    // Toggle the leaderboard dialog
    if (!this.leaderboardDialog) {
      this.leaderboardDialog = new LeaderboardDialog(this.scene);
    }
    
    // Toggle visibility
    if (this.leaderboardDialog.visible) {
      this.leaderboardDialog.hide();
    } else {
      this.leaderboardDialog.show();
    }
  }
  
  private openAttackInfo(): void {
    // Toggle the attack info menu
    if (!this.attackInfoMenu) {
      this.attackInfoMenu = new AttackInfoMenu(this.scene);
    }
    
    // Hide passive menu if open
    if (this.passiveInfoMenu?.visible) {
      this.passiveInfoMenu.hide();
    }
    
    // Toggle visibility
    if (this.attackInfoMenu.visible) {
      this.attackInfoMenu.hide();
    } else {
      this.attackInfoMenu.show();
    }
  }
  
  private openPassiveInfo(): void {
    // Toggle the passive info menu
    if (!this.passiveInfoMenu) {
      this.passiveInfoMenu = new PassiveInfoMenu(this.scene);
    }
    
    // Hide attack menu if open
    if (this.attackInfoMenu?.visible) {
      this.attackInfoMenu.hide();
    }
    
    // Toggle visibility
    if (this.passiveInfoMenu.visible) {
      this.passiveInfoMenu.hide();
    } else {
      this.passiveInfoMenu.show();
    }
  }
  
  private quickChangeJob(jobNumber: number): void {
    // Check if any menu is open
    if (this.classSelectionMenu?.visible || 
        this.teleportSelectionMenu?.visible || 
        this.leaderboardDialog?.visible ||
        this.attackInfoMenu?.visible ||
        this.passiveInfoMenu?.visible ||
        this.nameChangeDialog?.visible) {
        // Don't switch jobs if any menu is open
        return;
    }
    
    // Check if player is in combat first
    const context = UIContextService.getInstance();
    const connection = context.getDbConnection();
    const identity = context.getPlayerIdentity();
    
    if (!connection || !identity) {
      this.logger.warn('No connection or identity for job change');
      return;
    }
    
    // Check combat state
    for (const player of connection.db.player.iter()) {
      if (player.identity.toHexString() === identity.toHexString()) {
        if (player.inCombat === true) {
          this.logger.warn('Cannot change jobs while in combat');
          return;
        }
        break;
      }
    }
    
    // Get job list in order
    const jobList = Object.entries(jobAttributes);
    const index = jobNumber - 1;
    
    if (index >= 0 && index < jobList.length) {
      const [jobId, jobConfig] = jobList[index];
      
      // Check if job is unlocked
      const jobData = context.getJobData();
      const isUnlocked = jobData.jobData.get(jobId) || false;
      
      if (isUnlocked) {
        this.logger.info(`Quick changing to job: ${jobConfig.displayName}`);
        connection.reducers.changeJob(jobId);
      } else {
        this.logger.info(`Job ${jobConfig.displayName} is locked`);
      }
    } else {
      this.logger.warn(`Invalid job number: ${jobNumber}`);
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