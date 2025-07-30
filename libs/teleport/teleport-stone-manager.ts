import * as Phaser from 'phaser';
import { DbConnection, Teleport, PlayerTeleport } from '@/spacetime/client';
import type { EventContext } from '@/spacetime/client';

export class TeleportStoneManager {
  private scene: Phaser.Scene;
  private clientDB: DbConnection;
  private teleportSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private playerIdentity: string | null = null;

  constructor(scene: Phaser.Scene, clientDB: DbConnection) {
    this.scene = scene;
    this.clientDB = clientDB;
  }

  public init(): void {
    const identity = this.clientDB.identity;
    if (!identity) {
      console.warn('Player identity not available yet. TeleportStoneManager not initialized.');
      return;
    }
    this.playerIdentity = identity.toHexString();

    // Subscribe to teleport tables
    this.subscribeTeleportTables();

    // Register reducers to listen for teleport data
    this.registerReducers();

    // Query existing teleports will happen after subscription is applied
  }

  private subscribeTeleportTables(): void {
    this.clientDB
      .subscriptionBuilder()
      .onApplied(() => {
        this.initializeExistingTeleports();
      })
      .subscribe(['SELECT * FROM Teleport', 'SELECT * FROM PlayerTeleport']);
  }

  private registerReducers(): void {
    // Subscribe to Teleport table for stone locations
    this.clientDB.db.teleport.onInsert((_ctx: EventContext, teleport: Teleport) => {
      this.createTeleportStone(teleport);
    });

    this.clientDB.db.teleport.onDelete((_ctx: EventContext, teleport: Teleport) => {
      this.removeTeleportStone(teleport.locationName);
    });

    this.clientDB.db.playerTeleport.onInsert(
      (_ctx: EventContext, playerTeleport: PlayerTeleport) => {
        if (playerTeleport.playerIdentity.toHexString() === this.playerIdentity) {
          this.updateTeleportSprite(playerTeleport.locationName, playerTeleport.isUnlocked);
        }
      }
    );

    this.clientDB.db.playerTeleport.onUpdate(
      (_ctx: EventContext, _oldData: PlayerTeleport, newData: PlayerTeleport) => {
        if (newData.playerIdentity.toHexString() === this.playerIdentity) {
          this.updateTeleportSprite(newData.locationName, newData.isUnlocked);
        }
      }
    );
  }

  private initializeExistingTeleports(): void {
    // Create sprites for all existing teleports
    const teleports = Array.from(this.clientDB.db.teleport.iter());
    for (const teleport of teleports) {
      this.createTeleportStone(teleport);
    }

    // Update sprites based on player's unlock states
    const playerTeleports = Array.from(this.clientDB.db.playerTeleport.iter());
    const myTeleports = playerTeleports.filter(
      (pt) => pt.playerIdentity.toHexString() === this.playerIdentity
    );

    for (const playerTeleport of myTeleports) {
      this.updateTeleportSprite(playerTeleport.locationName, playerTeleport.isUnlocked);
    }
  }

  private createTeleportStone(teleport: Teleport): void {
    if (this.teleportSprites.has(teleport.locationName)) {
      return; // Already exists
    }

    // Create sprite centered on the teleport tile
    const sprite = this.scene.add.sprite(
      teleport.x + 16,
      teleport.y + 16,
      'teleport-stone',
      0
    );

    sprite.setDepth(1);
    sprite.setOrigin(0.5, 0.5);
    this.teleportSprites.set(teleport.locationName, sprite);
  }

  private removeTeleportStone(locationName: string): void {
    const sprite = this.teleportSprites.get(locationName);
    if (sprite) {
      sprite.destroy();
      this.teleportSprites.delete(locationName);
    }
  }

  private updateTeleportSprite(locationName: string, isUnlocked: boolean): void {
    const sprite = this.teleportSprites.get(locationName);
    if (!sprite) {
      console.warn(`Teleport sprite not found for location: ${locationName}`);
      return;
    }

    const currentFrame = sprite.frame.name;
    const targetFrame = isUnlocked ? 1 : 0;

    if (currentFrame !== targetFrame.toString()) {
      sprite.setFrame(targetFrame);
      
      if (isUnlocked) {
        this.playUnlockAnimation(sprite);
      }
    }
  }

  private playUnlockAnimation(sprite: Phaser.GameObjects.Sprite): void {
    // Scale animation
    this.scene.tweens.add({
      targets: sprite,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 200,
      ease: 'Power2',
      yoyo: true,
      onComplete: () => {
        this.createUnlockParticles(sprite.x, sprite.y);
      },
    });

    // Flash effect
    this.scene.tweens.add({
      targets: sprite,
      alpha: 0.3,
      duration: 100,
      ease: 'Power1',
      yoyo: true,
      repeat: 2,
    });
  }

  private createUnlockParticles(x: number, y: number): void {
    // Create simple sparkle effect using individual sprites
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 100 + Math.random() * 50;

      const particle = this.scene.add.sprite(x, y, 'teleport-stone', 1);
      particle.setScale(0.3);
      particle.setAlpha(1);
      particle.setBlendMode(Phaser.BlendModes.ADD);

      // Animate outward
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        },
      });
    }
  }

  public destroy(): void {
    for (const sprite of this.teleportSprites.values()) {
      sprite.destroy();
    }
    this.teleportSprites.clear();
  }
}
