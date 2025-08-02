import Phaser from 'phaser';

/**
 * Base class for modal dialogs
 */
export abstract class ModalDialog {
  protected scene: Phaser.Scene;
  protected container: Phaser.GameObjects.Container;
  protected background: Phaser.GameObjects.Rectangle;
  protected titleText: Phaser.GameObjects.Text;
  protected contentContainer: Phaser.GameObjects.Container;
  protected dialogWidth: number;
  protected dialogHeight: number;
  
  constructor(scene: Phaser.Scene, width: number, height: number, title: string) {
    this.scene = scene;
    this.dialogWidth = width;
    this.dialogHeight = height;
    
    // Create main container
    const centerX = scene.cameras.main.width / 2;
    const centerY = scene.cameras.main.height / 2;
    
    this.container = scene.add.container(centerX, centerY);
    this.container.setDepth(1000);
    this.container.setScrollFactor(0);
    
    // Create background
    this.background = scene.add.rectangle(0, 0, width, height, 0x000000, 0.9);
    this.background.setStrokeStyle(3, 0xffffff);
    this.container.add(this.background);
    
    // Create title
    this.titleText = scene.add.text(0, -height/2 + 30, title, {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    this.titleText.setOrigin(0.5);
    this.container.add(this.titleText);
    
    // Create content container
    this.contentContainer = scene.add.container(0, 0);
    this.container.add(this.contentContainer);
    
    // Initially hidden
    this.container.setVisible(false);
    
    // Setup click outside to close
    this.setupClickOutside();
    
    // Setup ESC key to close
    this.setupEscapeKey();
  }
  
  protected abstract createContent(): void;
  
  private setupClickOutside(): void {
    // Create invisible background that covers the whole screen
    const clickBg = this.scene.add.rectangle(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x000000,
      0.5
    );
    clickBg.setScrollFactor(0);
    clickBg.setDepth(999);
    clickBg.setInteractive();
    clickBg.setVisible(false);
    
    clickBg.on('pointerdown', () => {
      this.hide();
    });
    
    this.container.add(clickBg);
    this.container.sendToBack(clickBg);
  }
  
  private setupEscapeKey(): void {
    this.scene.input.keyboard?.on('keydown-ESC', () => {
      if (this.container.visible) {
        this.hide();
      }
    });
  }
  
  public show(): void {
    this.container.setVisible(true);
    
    // Add fade in animation
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Power2'
    });
  }
  
  public hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false);
      }
    });
  }
  
  public destroy(): void {
    this.container.destroy();
  }
}