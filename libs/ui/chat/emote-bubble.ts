import Phaser from 'phaser';

export interface EmoteBubbleConfig {
  x: number;
  y: number;
  texture: string;
  emoteScale?: number;
  duration?: number;
  frameRate?: number;
  backgroundColor?: number;
  borderColor?: number;
  borderWidth?: number;
}

export class EmoteBubble extends Phaser.GameObjects.Container {
  private config: Required<EmoteBubbleConfig>;
  private background: Phaser.GameObjects.Graphics;
  private sprite: Phaser.GameObjects.Sprite;
  private timer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, config: EmoteBubbleConfig) {
    super(scene, config.x, config.y);

    // Set defaults
    this.config = {
      x: config.x,
      y: config.y,
      texture: config.texture,
      emoteScale: config.emoteScale ?? 0.2, // Smaller for bubble
      duration: config.duration ?? 2000,
      frameRate: config.frameRate ?? 12,
      backgroundColor: config.backgroundColor ?? 0xffffff,
      borderColor: config.borderColor ?? 0x000000,
      borderWidth: config.borderWidth ?? 2,
    };

    // Create the background graphics
    this.background = scene.add.graphics();

    // Create the sprite
    this.sprite = scene.add.sprite(0, 0, this.config.texture);
    this.sprite.setScale(this.config.emoteScale);

    // Calculate bubble size based on sprite size
    const spriteSize = 187 * this.config.emoteScale; // Original size * scale
    const padding = 15;
    const bubbleSize = spriteSize + padding * 2;

    // Draw the speech bubble
    this.drawBubble(bubbleSize);

    // Add components to container
    this.add([this.background, this.sprite]);

    // Create animation if it doesn't exist
    const animKey = `${this.config.texture}_anim`;
    if (!scene.anims.exists(animKey)) {
      // Count frames in the spritesheet
      const texture = scene.textures.get(this.config.texture);
      const frameCount = texture.frameTotal - 1; // Subtract 1 for the __BASE frame

      // Create animation using all frames
      const frames: Phaser.Types.Animations.AnimationFrame[] = [];
      for (let i = 0; i < frameCount; i++) {
        frames.push({ key: this.config.texture, frame: i });
      }

      scene.anims.create({
        key: animKey,
        frames: frames,
        frameRate: this.config.frameRate,
        repeat: -1, // Loop forever
      });
    }

    // Play the animation
    this.sprite.play(animKey);

    // Add to scene and set depth
    scene.add.existing(this);
    this.setDepth(100); // Above player but below UI

    // Auto-destroy after duration
    this.timer = scene.time.delayedCall(this.config.duration, () => {
      this.destroy();
    });
  }

  private drawBubble(size: number): void {
    const halfSize = size / 2;
    const cornerRadius = 10;
    const tailSize = 8;

    // Clear previous graphics
    this.background.clear();

    // Fill style
    this.background.fillStyle(this.config.backgroundColor, 1);
    this.background.lineStyle(this.config.borderWidth, this.config.borderColor, 1);

    // Draw rounded rectangle
    this.background.fillRoundedRect(-halfSize, -halfSize, size, size, cornerRadius);
    this.background.strokeRoundedRect(-halfSize, -halfSize, size, size, cornerRadius);

    // Draw tail
    this.background.fillStyle(this.config.backgroundColor, 1);
    this.background.beginPath();
    this.background.moveTo(-tailSize, halfSize - 1);
    this.background.lineTo(0, halfSize + tailSize);
    this.background.lineTo(tailSize, halfSize - 1);
    this.background.closePath();
    this.background.fillPath();

    // Draw tail outline
    this.background.lineStyle(this.config.borderWidth, this.config.borderColor, 1);
    this.background.beginPath();
    this.background.moveTo(-tailSize, halfSize - 1);
    this.background.lineTo(0, halfSize + tailSize);
    this.background.lineTo(tailSize, halfSize - 1);
    this.background.strokePath();

    // Cover the top part of the tail with background color
    this.background.fillStyle(this.config.backgroundColor, 1);
    this.background.fillRect(-tailSize - 1, halfSize - 3, tailSize * 2 + 2, 4);
  }

  public updatePosition(x: number, y: number): void {
    this.setPosition(x, y);
  }

  public destroy(): void {
    if (this.timer) {
      this.timer.remove();
    }
    if (this.sprite) {
      this.sprite.stop();
      this.sprite.destroy();
    }
    if (this.background) {
      this.background.destroy();
    }
    super.destroy();
  }
}
