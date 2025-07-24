import Phaser from 'phaser';
import { ENEMY_CONFIG } from './config/config';

export interface EnemyConfig {
  speed: number;
  size: number;
  color: number;
  trackingRange: number;
  maxSpeed: number;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private config: EnemyConfig;
  private target: Phaser.GameObjects.GameObject & { x: number; y: number };
  private isDestroyed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig, target: Phaser.GameObjects.GameObject & { x: number; y: number }) {
    super(scene, x, y, '');
    
    this.config = config;
    this.target = target;
    
    this.setupPhysics();
    this.setupVisual();
  }

  private setupPhysics(): void {
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);
    
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setSize(this.config.size, this.config.size);
      body.setCollideWorldBounds(true);
      body.setGravityY(0);
      body.setDrag(ENEMY_CONFIG.physics.drag);
      body.setBounce(ENEMY_CONFIG.physics.bounce);
    }
  }

  private setupVisual(): void {
    const textureKey = 'enemy_dot';
    
    if (!this.scene.textures.exists(textureKey)) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(this.config.color);
      graphics.fillCircle(this.config.size / 2, this.config.size / 2, this.config.size / 2);
      
      graphics.generateTexture(textureKey, this.config.size, this.config.size);
      graphics.destroy();
    }
    
    this.setTexture(textureKey);
    this.setOrigin(0.5, 0.5);
    this.setDepth(5);
  }

  public update(): void {
    this.updateTracking();
  }

  private updateTracking(): void {
    if (this.isDestroyed || !this.active) return;
    
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body) return;
    
    const distanceX = this.target.x - this.x;
    const distanceY = this.target.y - this.y;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    
    if (distance === 0) {
      body.setVelocity(0, 0);
      return;
    }
    
    if (distance < this.config.trackingRange) {
      const normalizedX = distanceX / distance;
      const normalizedY = distanceY / distance;
      
      const speedMultiplier = Math.min(distance / 100, 1);
      const currentSpeed = this.config.speed * speedMultiplier;
      
      const targetVelX = normalizedX * currentSpeed;
      const targetVelY = normalizedY * currentSpeed;
      
      body.setVelocity(
        Math.min(Math.max(targetVelX, -this.config.maxSpeed), this.config.maxSpeed),
        Math.min(Math.max(targetVelY, -this.config.maxSpeed), this.config.maxSpeed)
      );
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    super.destroy();
  }

  public getConfig(): EnemyConfig {
    return this.config;
  }

  public isAlive(): boolean {
    return !this.isDestroyed && this.active;
  }
}

export const DEFAULT_ENEMY_CONFIG: EnemyConfig = {
  speed: ENEMY_CONFIG.properties.speed,
  size: ENEMY_CONFIG.properties.size,
  color: ENEMY_CONFIG.visual.color,
  trackingRange: ENEMY_CONFIG.properties.trackingRange,
  maxSpeed: ENEMY_CONFIG.properties.maxSpeed
};