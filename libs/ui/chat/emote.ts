import Phaser from "phaser";

export interface EmoteConfig {
    x: number;
    y: number;
    texture: string;
    scale?: number;
    duration?: number;
    frameRate?: number;
}

export class Emote extends Phaser.GameObjects.Container {
    private sprite!: Phaser.GameObjects.Sprite;
    private config!: Required<EmoteConfig>;
    
    constructor(scene: Phaser.Scene, config: EmoteConfig) {
        super(scene, config.x, config.y);
        
        // Validate config
        if (!config || !config.texture) {
            console.error('Invalid emote config provided');
            super.destroy();
            return;
        }
        
        // Set defaults
        this.config = {
            x: config.x,
            y: config.y,
            texture: config.texture,
            scale: config.scale ?? 0.3, // Scale down the 187x187 sprite
            duration: config.duration ?? 2000, // 2 seconds
            frameRate: config.frameRate ?? 12
        };
        
        // Create the sprite
        if (!scene.textures.exists(this.config.texture)) {
            console.error(`Texture "${this.config.texture}" not found!`);
            // Create a placeholder or return early
            super.destroy();
            return;
        }
        this.sprite = scene.add.sprite(0, 0, this.config.texture);
        this.sprite.setScale(this.config.scale);
        
        // Add to container
        this.add(this.sprite);
        
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
                repeat: -1 // Loop forever
            });
        }
        
        // Play the animation
        this.sprite.play(animKey);
        
        // Add to scene and set depth
        scene.add.existing(this);
        this.setDepth(100); // Above player but below UI
        
        // Auto-destroy after duration
        if (this.config.duration && this.config.duration > 0) {
            scene.time.delayedCall(this.config.duration, () => {
                this.destroy();
            });
        }
    }
    
    public updatePosition(x: number, y: number): void {
        this.setPosition(x, y);
    }
    
    public destroy(): void {
        if (this.sprite) {
            this.sprite.stop();
            this.sprite.destroy();
        }
        super.destroy();
    }
}