import Phaser from 'phaser';
import { BOTTOM_UI_CONFIG } from '../bottom-ui-config';

export class MenuButton {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private onClick?: () => void;

  constructor(scene: Phaser.Scene, label: string = 'MENU') {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0);
    
    this.createButton(label);
    this.setupInteraction();
    
    this.container.setDepth(BOTTOM_UI_CONFIG.depth.buttons);
  }

  private createButton(label: string): void {
    const config = BOTTOM_UI_CONFIG.menuButton;
    
    // Create background
    this.background = this.scene.add.graphics();
    this.drawBackground(config.backgroundColor);
    
    // Create text
    this.text = this.scene.add.text(
      config.width / 2,
      config.height / 2,
      label,
      {
        fontSize: config.fontSize,
        color: config.fontColor,
        fontStyle: 'bold',
      }
    );
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
    
    // Make container interactive
    this.container.setSize(config.width, config.height);
    this.container.setInteractive({ useHandCursor: true });
    
    // Hover effects
    this.container.on('pointerover', () => {
      this.drawBackground(config.hoverColor);
    });
    
    this.container.on('pointerout', () => {
      this.drawBackground(config.backgroundColor);
    });
    
    // Click handler
    this.container.on('pointerdown', () => {
      if (this.onClick) {
        this.onClick();
      }
    });
  }

  public setOnClick(callback: () => void): void {
    this.onClick = callback;
  }

  public setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public destroy(): void {
    this.container.destroy();
  }
}