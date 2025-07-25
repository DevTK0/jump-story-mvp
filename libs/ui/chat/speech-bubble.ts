import Phaser from 'phaser';

export interface SpeechBubbleConfig {
  x: number;
  y: number;
  message: string;
  duration?: number;
  backgroundColor?: number;
  textColor?: string;
  fontSize?: string;
  maxWidth?: number;
}

export class SpeechBubble extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private tail: Phaser.GameObjects.Graphics;
  private config: Required<SpeechBubbleConfig>;
  private fadeOutTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, config: SpeechBubbleConfig) {
    super(scene, config.x, config.y);

    // Set defaults
    this.config = {
      x: config.x,
      y: config.y,
      message: config.message,
      duration: config.duration ?? 5000, // 5 seconds default
      backgroundColor: config.backgroundColor ?? 0xffffff,
      textColor: config.textColor ?? '#000000',
      fontSize: config.fontSize ?? '14px',
      maxWidth: config.maxWidth ?? 200,
    };

    // Create bubble components
    this.background = scene.add.graphics();
    this.tail = scene.add.graphics();

    // Create text with proper word wrapping
    this.text = scene.add.text(0, 0, this.config.message, {
      fontSize: this.config.fontSize,
      color: this.config.textColor,
      fontFamily: '"Arial Rounded MT Bold", "Trebuchet MS", "Verdana", sans-serif',
      wordWrap: {
        width: this.config.maxWidth - 40, // Account for padding
        useAdvancedWrap: true,
      },
      padding: { x: 10, y: 10 },
      align: 'center',
    });

    // Center text origin
    this.text.setOrigin(0.5, 0.5);

    // Draw bubble background
    this.drawBubble();

    // Add components to container
    this.add([this.background, this.tail, this.text]);

    // Add to scene
    scene.add.existing(this);

    // Set depth to render above other elements
    this.setDepth(100);

    // Animate entrance
    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Auto-remove after duration
    if (this.config.duration > 0) {
      this.fadeOutTimer = scene.time.delayedCall(this.config.duration - 200, () => {
        this.fadeOut();
      });
    }
  }

  private drawBubble(): void {
    const padding = 20;
    // Cap the bubble width to maxWidth
    const bubbleWidth = Math.min(this.text.width + padding * 2, this.config.maxWidth);
    const bubbleHeight = this.text.height + padding * 2;
    const cornerRadius = 10;

    // Position the bubble so its bottom (including tail) is at y=0
    // This way when we position the container, we can place it exactly above the character
    const bubbleY = -(bubbleHeight / 2 + 15); // 15 is tail height

    // Draw rounded rectangle background
    this.background.fillStyle(this.config.backgroundColor, 0.9);
    this.background.lineStyle(2, 0x333333, 1);
    this.background.fillRoundedRect(
      -bubbleWidth / 2,
      bubbleY - bubbleHeight / 2,
      bubbleWidth,
      bubbleHeight,
      cornerRadius
    );
    this.background.strokeRoundedRect(
      -bubbleWidth / 2,
      bubbleY - bubbleHeight / 2,
      bubbleWidth,
      bubbleHeight,
      cornerRadius
    );

    // Draw tail at the bottom of the bubble
    this.tail.fillStyle(this.config.backgroundColor, 0.9);
    this.tail.lineStyle(2, 0x333333, 1);
    this.tail.beginPath();
    this.tail.moveTo(0, bubbleY + bubbleHeight / 2);
    this.tail.lineTo(-10, 0); // Point to character position
    this.tail.lineTo(10, 0);
    this.tail.closePath();
    this.tail.fillPath();
    this.tail.strokePath();

    // Also reposition the text to match the bubble
    this.text.y = bubbleY;
  }

  private fadeOut(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      },
    });
  }

  public updatePosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public destroy(): void {
    // Cancel the fade out timer if it exists
    if (this.fadeOutTimer) {
      this.fadeOutTimer.remove();
      this.fadeOutTimer = undefined;
    }

    // Stop all tweens on this object
    this.scene.tweens.killTweensOf(this);

    // Call parent destroy
    super.destroy();
  }
}
