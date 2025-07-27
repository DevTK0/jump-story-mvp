import Phaser from 'phaser';
import { BOTTOM_UI_CONFIG } from './bottom-ui-config';
import { PlayerLevelSquare } from './components/player-level-square';
import { PlayerInfoDisplay } from './components/player-info-display';
import { CompactStatBar } from './components/compact-stat-bar';
import { MenuButton } from './components/menu-button';
import { DbConnection, PlayerJob, Job } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { UIContextService, UIEvents } from '../services/ui-context-service';

export class BottomUIBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private logger: ModuleLogger = createLogger('BottomUIBar');

  // UI Components
  private levelDisplay: PlayerLevelSquare;
  private playerInfo: PlayerInfoDisplay;
  private hpBar: CompactStatBar;
  private mpBar: CompactStatBar;
  private expBar: CompactStatBar;
  private menuButton: MenuButton;

  // Data
  private playerIdentity: Identity;
  private dbConnection: DbConnection | null = null;

  // Job unlock data: Map<jobKey, isUnlocked>
  private playerJobUnlockStatus: Map<string, boolean> = new Map();
  // Job table data
  private jobTableData: any[] = [];
  // Flag to track if Job table is loaded
  private isJobTableLoaded: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Get data from context service
    const context = UIContextService.getInstance();
    this.playerIdentity = context.getPlayerIdentity()!;
    this.dbConnection = context.getDbConnection();

    this.createContainer();
    this.createBackground();
    this.createComponents();
    this.positionComponents();

    // Listen for resize events
    this.scene.scale.on('resize', this.onResize, this);
    
    // Subscribe to job data updates
    context.on(UIEvents.PLAYER_JOB_DATA_UPDATED, this.handleJobDataUpdate, this);
    
    // Set up data subscriptions immediately since connection is available
    if (this.dbConnection) {
      this.setupDataSubscriptions();
    }
  }

  private createContainer(): void {
    const camera = this.scene.cameras.main;
    const y = camera.height - BOTTOM_UI_CONFIG.container.height;

    this.container = this.scene.add.container(0, y);
    this.container.setScrollFactor(0); // Fix to camera
    this.container.setDepth(BOTTOM_UI_CONFIG.depth.background);
  }

  private createBackground(): void {
    const camera = this.scene.cameras.main;
    const config = BOTTOM_UI_CONFIG.container;

    this.background = this.scene.add.graphics();

    // Draw background
    this.background.fillStyle(config.backgroundColor, 0.9);
    this.background.fillRect(0, 0, camera.width, config.height);

    // Draw top border
    this.background.lineStyle(config.borderWidth, config.borderColor);
    this.background.lineBetween(0, 0, camera.width, 0);

    this.container.add(this.background);
  }

  private createComponents(): void {
    // Create level display
    this.levelDisplay = new PlayerLevelSquare(this.scene);

    // Create player info
    this.playerInfo = new PlayerInfoDisplay(this.scene);

    // Create stat bars
    this.hpBar = new CompactStatBar(this.scene, 'hp');
    this.mpBar = new CompactStatBar(this.scene, 'mp');
    this.expBar = new CompactStatBar(this.scene, 'exp');

    // Create menu button - no need to set identity, it will get from context
    this.menuButton = new MenuButton(this.scene, 'MENU');

    // Add all components to container
    this.container.add([
      this.levelDisplay.getText(),
      this.playerInfo.getContainer(),
      this.hpBar.getContainer(),
      this.mpBar.getContainer(),
      this.expBar.getContainer(),
      this.menuButton.getContainer(),
    ]);
  }

  private positionComponents(): void {
    const layout = BOTTOM_UI_CONFIG.layout;
    const containerHeight = BOTTOM_UI_CONFIG.container.height;
    const centerY = containerHeight / 2;
    const camera = this.scene.cameras.main;

    // Position level display (left margin, centered vertically)
    this.levelDisplay.setPosition(layout.levelMarginLeft, centerY);

    // Position player info (after level display with some spacing)
    const infoX = layout.levelMarginLeft + 60 + layout.playerInfoMarginLeft;
    this.playerInfo.setPosition(infoX, centerY - 10);

    // Position menu button
    const menuX = camera.width - BOTTOM_UI_CONFIG.menuButton.width - layout.menuButtonMarginRight;
    this.menuButton.setPosition(menuX, centerY - 15);

    // Calculate available space for centering stat bars
    const leftBoundary = infoX + this.playerInfo.getWidth() + layout.statBarsMarginLeft;
    const rightBoundary = menuX - layout.statBarsMarginLeft;
    const availableWidth = rightBoundary - leftBoundary;

    // Calculate total width needed for all bars
    const barWidth = BOTTOM_UI_CONFIG.statBars.width;
    const barSpacing = 30; // Horizontal spacing between bars
    const totalBarsWidth = barWidth * 3 + barSpacing * 2;

    // Center the bars in the available space
    const barsStartX = leftBoundary + (availableWidth - totalBarsWidth) / 2;

    this.hpBar.setPosition(barsStartX, centerY);
    this.mpBar.setPosition(barsStartX + barWidth + barSpacing, centerY);
    this.expBar.setPosition(barsStartX + (barWidth + barSpacing) * 2, centerY);
  }

  private handleJobDataUpdate(data: { jobData: Map<string, boolean>; jobTableData: any[] }): void {
    this.playerJobUnlockStatus = data.jobData;
    this.jobTableData = data.jobTableData;
    
    this.logger.info(`Job data updated via context: ${data.jobData.size} entries, ${data.jobTableData.length} jobs`);
    
    // Update menu button with new data (keep using setPlayerJobData for now)
    if (this.menuButton) {
      this.menuButton.setPlayerJobData(data.jobData, data.jobTableData);
    }
  }

  private setupDataSubscriptions(): void {
    if (!this.dbConnection) return;

    // Store reference to avoid closure issues
    const dbConn = this.dbConnection;

    // Subscribe to PlayerJob and Job tables for the current player
    const playerIdentityHex = this.playerIdentity.toHexString();
    this.logger.info(`Setting up PlayerJob subscription for identity: ${playerIdentityHex}`);

    // First subscribe to Job table (global data)
    dbConn
      .subscriptionBuilder()
      .onApplied(() => {
        this.logger.info('Job table subscription applied');
        // Load any existing job table data
        this.jobTableData = [];
        for (const job of dbConn.db.job.iter()) {
          this.jobTableData.push(job);
        }
        this.logger.info(`Job table loaded with ${this.jobTableData.length} entries`);
      })
      .subscribe([`SELECT * FROM job`]);

    // Listen to Job table inserts to keep jobTableData updated
    dbConn.db.job.onInsert((_ctx, newJob) => {
      this.jobTableData.push(newJob);
      this.logger.info(`Job inserted: ${newJob.jobKey} (ID: ${newJob.jobId})`);
      // Update context service which will emit event to all listeners
      UIContextService.getInstance().updateJobData(this.playerJobUnlockStatus, this.jobTableData);
    });

    // Listen to Job table updates
    dbConn.db.job.onUpdate((_ctx, oldJob, newJob) => {
      const index = this.jobTableData.findIndex((j) => j.jobId === oldJob.jobId);
      if (index !== -1) {
        this.jobTableData[index] = newJob;
        this.logger.info(`Job updated: ${newJob.jobKey} (ID: ${newJob.jobId})`);
        // Update context service which will emit event to all listeners
        UIContextService.getInstance().updateJobData(this.playerJobUnlockStatus, this.jobTableData);
      }
    });

    // Core tables are now subscribed at connection level in SceneConnectionHelper
    // No need for subscribeToAllTables() workaround anymore

    // Then subscribe to PlayerJob data
    dbConn
      .subscriptionBuilder()
      .onApplied(() => {
        this.logger.info('PlayerJob subscription applied');
        const pjCount = Array.from(dbConn.db.playerJob.iter()).length;
        this.logger.info(`PlayerJob table now has ${pjCount} entries`);
        this.updatePlayerJobData();
      })
      .subscribe([`SELECT * FROM player_job WHERE player_identity = x'${playerIdentityHex}'`]);

    // Listen to player updates
    this.dbConnection.db.player.onUpdate((_ctx, _oldPlayer, newPlayer) => {
      if (newPlayer.identity.toHexString() === this.playerIdentity.toHexString()) {
        this.updateFromPlayerData(newPlayer);
      }
    });

    // Listen to PlayerJob updates
    this.dbConnection.db.playerJob.onUpdate((_ctx, _oldPj, newPj) => {
      if (newPj.playerIdentity.toHexString() === this.playerIdentity.toHexString()) {
        this.playerJobUnlockStatus.set(newPj.jobKey, newPj.isUnlocked);
        this.logger.info(`PlayerJob updated: jobKey=${newPj.jobKey}, isUnlocked=${newPj.isUnlocked}`);
        // Update context service which will emit event to all listeners
        UIContextService.getInstance().updateJobData(this.playerJobUnlockStatus, this.jobTableData);
      }
    });

    // Listen to PlayerJob inserts
    this.dbConnection.db.playerJob.onInsert((_ctx, newPj) => {
      if (newPj.playerIdentity.toHexString() === this.playerIdentity.toHexString()) {
        this.playerJobUnlockStatus.set(newPj.jobKey, newPj.isUnlocked);
        this.logger.info(
          `PlayerJob inserted: jobKey=${newPj.jobKey}, isUnlocked=${newPj.isUnlocked}`
        );
        // Update context service which will emit event to all listeners
        UIContextService.getInstance().updateJobData(this.playerJobUnlockStatus, this.jobTableData);
      }
    });

    // Get initial data
    for (const player of this.dbConnection.db.player.iter()) {
      if (player.identity.toHexString() === this.playerIdentity.toHexString()) {
        this.updateFromPlayerData(player);
        break;
      }
    }
  }

  private updateFromPlayerData(player: any): void {
    // Update level
    this.levelDisplay.updateLevel(player.level);

    // Get job display name from job table data
    const job = this.jobTableData.find((j) => j.jobKey === player.job);
    const jobDisplayName = job?.displayName || 'Unknown';

    // Update player info with actual job
    this.playerInfo.updateInfo(player.name, jobDisplayName);
    
    // Update combat state
    this.playerInfo.setCombatState(player.inCombat || false);

    // Update stat bars
    this.hpBar.updateValues(player.currentHp, player.maxHp);
    this.mpBar.updateValues(player.currentMana || 50, player.maxMana || 100); // TODO: Implement mana

    // Update EXP bar
    const nextLevelConfig = this.findNextLevelConfig(player.level);
    const expRequired = nextLevelConfig?.expRequired || 100;
    this.expBar.updateValues(player.experience, expRequired);
  }

  private updatePlayerJobData(): void {
    if (!this.dbConnection || !this.dbConnection.db.playerJob || !this.dbConnection.db.job) {
      this.logger.warn('Tables not yet loaded for PlayerJob data update');
      return;
    }

    // Get current PlayerJob data using iter() instead of value
    const playerJobs: any[] = [];
    for (const pj of this.dbConnection.db.playerJob.iter()) {
      if (pj.playerIdentity.isEqual(this.playerIdentity)) {
        playerJobs.push(pj);
      }
    }

    this.logger.info(`Found ${playerJobs.length} PlayerJob entries for current player`);

    // Job table data should already be loaded from subscription
    this.logger.info(`Using ${this.jobTableData.length} jobs from Job table`);

    // Clear and rebuild the unlock status map
    this.playerJobUnlockStatus.clear();
    playerJobs.forEach((pj) => {
      this.playerJobUnlockStatus.set(pj.jobKey, pj.isUnlocked);
      this.logger.debug(`PlayerJob: jobKey=${pj.jobKey}, isUnlocked=${pj.isUnlocked}`);
    });

    // Update context service which will emit event to all listeners
    UIContextService.getInstance().updateJobData(this.playerJobUnlockStatus, this.jobTableData);
  }

  private findNextLevelConfig(currentLevel: number) {
    if (!this.dbConnection) return null;

    // Debug: Check if we have any level data
    const levelConfigs = Array.from(this.dbConnection.db.playerLevel.iter());
    console.log('PlayerLevel configs available:', levelConfigs.length);
    
    for (const config of levelConfigs) {
      console.log(`Level ${config.level}: ${config.expRequired} exp required`);
      if (config.level === currentLevel + 1) {
        console.log(`Found next level config for level ${currentLevel + 1}: ${config.expRequired} exp`);
        return config;
      }
    }
    console.log(`No config found for level ${currentLevel + 1}`);
    return null;
  }

  public getHeight(): number {
    return BOTTOM_UI_CONFIG.container.height;
  }

  public setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  private onResize(_gameSize: Phaser.Structs.Size): void {
    const camera = this.scene.cameras.main;

    // Update container position
    const y = camera.height - BOTTOM_UI_CONFIG.container.height;
    this.container.setY(y);

    // Redraw background to match new width
    const config = BOTTOM_UI_CONFIG.container;
    this.background.clear();
    this.background.fillStyle(config.backgroundColor, 0.9);
    this.background.fillRect(0, 0, camera.width, config.height);
    this.background.lineStyle(config.borderWidth, config.borderColor);
    this.background.lineBetween(0, 0, camera.width, 0);

    // Reposition all components to handle new width
    this.positionComponents();
  }

  public destroy(): void {
    // Remove resize listener
    this.scene.scale.off('resize', this.onResize, this);
    
    // Remove context event listener
    const context = UIContextService.getInstance();
    context.off(UIEvents.PLAYER_JOB_DATA_UPDATED, this.handleJobDataUpdate, this);

    this.levelDisplay.destroy();
    this.playerInfo.destroy();
    this.hpBar.destroy();
    this.mpBar.destroy();
    this.expBar.destroy();
    this.menuButton.destroy();
    this.container.destroy();
  }
}
