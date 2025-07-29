import Phaser from 'phaser';
import { BOTTOM_UI_CONFIG } from '../bottom-ui-config';
import { MenuDropdown } from './menu-dropdown';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { DbConnection } from '@/spacetime/client';
import { UIContextService, UIEvents } from '../../services/ui-context-service';

export class MenuButton {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;
  private dropdown: MenuDropdown;
  private onClick?: () => void;

  constructor(scene: Phaser.Scene, label: string = 'MENU') {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0);

    this.createButton(label);
    this.setupInteraction();

    this.container.setDepth(BOTTOM_UI_CONFIG.depth.buttons);

    // Create dropdown menu - it will get context internally
    this.dropdown = new MenuDropdown(this.scene, this.container);
    
    // Subscribe to job data updates from context
    const context = UIContextService.getInstance();
    context.on(UIEvents.PLAYER_JOB_DATA_UPDATED, this.handleJobDataUpdate, this);
  }

  private createButton(label: string): void {
    const config = BOTTOM_UI_CONFIG.menuButton;

    // Create background - ensure it starts at 0,0 within container
    this.background = this.scene.add.graphics();
    this.background.setPosition(0, 0);
    this.drawBackground(config.backgroundColor);

    // Create text - position relative to container origin
    this.text = this.scene.add.text(config.width / 2, config.height / 2, label, {
      fontSize: config.fontSize,
      color: config.fontColor,
      fontStyle: 'bold',
    });
    this.text.setOrigin(0.5, 0.5);

    this.container.add([this.background, this.text]);
  }

  private drawBackground(color: number): void {
    const config = BOTTOM_UI_CONFIG.menuButton;

    this.background.clear();
    this.background.fillStyle(color, 1);
    this.background.fillRect(0, 0, config.width, config.height);
    this.background.lineStyle(config.borderWidth, config.borderColor);
    this.background.strokeRect(0, 0, config.width, config.height);
  }

  private setupInteraction(): void {
    const config = BOTTOM_UI_CONFIG.menuButton;

    // Make container interactive with proper hit area
    // this.container.setSize(config.width, config.height);
    this.container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, config.width, config.height),
      Phaser.Geom.Rectangle.Contains
    );
    if (this.container.input) {
      this.container.input.cursor = 'pointer';
    }

    // Hover effects
    this.container.on('pointerover', () => {
      this.drawBackground(config.hoverColor);
    });

    this.container.on('pointerout', () => {
      this.drawBackground(config.backgroundColor);
    });

    // Click handler
    this.container.on('pointerdown', () => {
      // Toggle dropdown menu
      this.dropdown.toggle();

      // Call custom onClick if provided
      if (this.onClick) {
        this.onClick();
      }
    });
  }

  public setOnClick(callback: () => void): void {
    this.onClick = callback;
  }

  public setPosition(x: number, y: number): void {
    // Round to prevent sub-pixel positioning issues
    this.container.setPosition(Math.round(x), Math.round(y));
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  private handleJobDataUpdate(_data: { jobData: Map<string, boolean>; jobTableData: any[] }): void {
    // Dropdown will receive the update directly from context
  }

  // Keep these methods for backward compatibility but they won't be called from BottomUIBar anymore
  public setPlayerIdentity(_identity: Identity): void {
    // No longer needed - dropdown gets from context
  }

  public setDbConnection(_dbConnection: DbConnection): void {
    // No longer needed - dropdown gets from context
  }

  public destroy(): void {
    // Unsubscribe from context events
    const context = UIContextService.getInstance();
    context.off(UIEvents.PLAYER_JOB_DATA_UPDATED, this.handleJobDataUpdate, this);
    
    this.dropdown.destroy();
    this.container.destroy();
  }
}
