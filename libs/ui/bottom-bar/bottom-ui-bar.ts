import Phaser from 'phaser';
import { BOTTOM_UI_CONFIG } from './bottom-ui-config';
import { PlayerLevelSquare } from './components/player-level-square';
import { PlayerInfoDisplay } from './components/player-info-display';
import { CompactStatBar } from './components/compact-stat-bar';
import { MenuButton } from './components/menu-button';
import { DbConnection } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { createLogger, type ModuleLogger } from '@/core/logger';

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

  constructor(scene: Phaser.Scene, playerIdentity: Identity) {
    this.scene = scene;
    this.playerIdentity = playerIdentity;
    
    this.createContainer();
    this.createBackground();
    this.createComponents();
    this.positionComponents();
    
    // Listen for resize events
    this.scene.scale.on('resize', this.onResize, this);
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
    
    // Create menu button
    this.menuButton = new MenuButton(this.scene, 'MENU');
    this.menuButton.setPlayerIdentity(this.playerIdentity);
    
    // Add all components to container
    this.container.add([
      this.levelDisplay.getContainer(),
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
    
    // Position level display (start from left edge, centered vertically)
    this.levelDisplay.setPosition(
      0,
      0
    );
    
    // Position player info (after level display)
    const infoX = 80 + layout.playerInfoMarginLeft;
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
    const totalBarsWidth = (barWidth * 3) + (barSpacing * 2);
    
    // Center the bars in the available space
    const barsStartX = leftBoundary + (availableWidth - totalBarsWidth) / 2;
    
    this.hpBar.setPosition(barsStartX, centerY);
    this.mpBar.setPosition(barsStartX + barWidth + barSpacing, centerY);
    this.expBar.setPosition(barsStartX + (barWidth + barSpacing) * 2, centerY);
  }

  public setDbConnection(dbConnection: DbConnection): void {
    this.dbConnection = dbConnection;
    this.setupDataSubscriptions();
  }

  private setupDataSubscriptions(): void {
    if (!this.dbConnection) return;
    
    // Listen to player updates
    this.dbConnection.db.player.onUpdate((_ctx, _oldPlayer, newPlayer) => {
      if (newPlayer.identity.toHexString() === this.playerIdentity.toHexString()) {
        this.updateFromPlayerData(newPlayer);
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
    
    // Update player info
    this.playerInfo.updateInfo(player.name, 'Soldier'); // TODO: Get actual class/job
    
    // Update stat bars
    this.hpBar.updateValues(player.currentHp, player.maxHp);
    this.mpBar.updateValues(player.currentMana || 50, player.maxMana || 100); // TODO: Implement mana
    
    // Update EXP bar
    const nextLevelConfig = this.findNextLevelConfig(player.level);
    const expRequired = nextLevelConfig?.expRequired || 100;
    this.expBar.updateValues(player.experience, expRequired);
  }

  private findNextLevelConfig(currentLevel: number) {
    if (!this.dbConnection) return null;
    
    for (const config of this.dbConnection.db.playerLevelingConfig.iter()) {
      if (config.level === currentLevel + 1) {
        return config;
      }
    }
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
    
    this.levelDisplay.destroy();
    this.playerInfo.destroy();
    this.hpBar.destroy();
    this.mpBar.destroy();
    this.expBar.destroy();
    this.menuButton.destroy();
    this.container.destroy();
  }
}