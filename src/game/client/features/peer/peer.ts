import Phaser from "phaser";
import type { Player as PlayerData } from "../../module_bindings";
import { PLAYER_CONFIG } from "../player/config";

export interface PeerConfig {
    scene: Phaser.Scene;
    playerData: PlayerData;
}

export class Peer extends Phaser.GameObjects.Sprite {
    private playerData: PlayerData;
    private nameLabel!: Phaser.GameObjects.Text;

    // Interpolation properties
    private targetPosition = { x: 0, y: 0 };
    private interpolationSpeed = 0.15;

    // Animation tracking
    private currentAnimation: string | null = null;

    constructor(config: PeerConfig) {
        // Create soldier sprite with initial frame
        super(
            config.scene,
            config.playerData.position.x,
            config.playerData.position.y,
            "soldier",
            0
        );

        this.playerData = config.playerData;

        // Add to scene (no physics - peers are visual only)
        config.scene.add.existing(this);

        // Set depth to render above ground/platforms
        this.setDepth(10);

        // Set scale to match main player
        this.setScale(PLAYER_CONFIG.movement.scale);

        // Set visual properties to distinguish from main player
        this.setAlpha(0.9);
        this.setTint(0xbbbbbb);

        // Initialize target position
        this.targetPosition = {
            x: config.playerData.position.x,
            y: config.playerData.position.y,
        };

        // Create name label
        this.createNameLabel();

        // Start with idle animation
        this.playAnimation("soldier-idle-anim");

        console.log(
            `Created peer sprite for ${this.playerData.name} at (${this.x}, ${this.y}) with scale ${PLAYER_CONFIG.movement.scale}`
        );
    }

    private createNameLabel(): void {
        this.nameLabel = this.scene.add.text(
            this.x,
            this.y - 60,
            this.playerData.name,
            {
                fontSize: "12px",
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 2,
            }
        );
        this.nameLabel.setOrigin(0.5, 0.5);
        this.nameLabel.setDepth(11); // Above the peer sprite
    }

    private playAnimation(animationKey: string): void {
        if (
            this.scene.anims.exists(animationKey) &&
            this.currentAnimation !== animationKey
        ) {
            this.play(animationKey);
            this.currentAnimation = animationKey;
        }
    }

    private determineAnimation(): string {
        // Check if peer is moving based on target position change
        const distance = Phaser.Math.Distance.Between(
            this.x,
            this.y,
            this.targetPosition.x,
            this.targetPosition.y
        );

        if (distance > 2) {
            return "soldier-walk-anim";
        } else {
            return "soldier-idle-anim";
        }
    }

    public updateFromData(playerData: PlayerData): void {
        this.playerData = playerData;

        // Update target position for interpolation
        const newTargetX = playerData.position.x;
        const newTargetY = playerData.position.y;

        // Check if target position changed significantly
        const targetDistance = Phaser.Math.Distance.Between(
            this.targetPosition.x,
            this.targetPosition.y,
            newTargetX,
            newTargetY
        );

        if (targetDistance > 0.5) {
            // Check for teleport distance (if too far, snap immediately)
            const currentDistance = Phaser.Math.Distance.Between(
                this.x,
                this.y,
                newTargetX,
                newTargetY
            );

            if (currentDistance > 150) {
                // Teleport if too far
                this.setPosition(newTargetX, newTargetY);
                this.targetPosition = { x: newTargetX, y: newTargetY };
                this.nameLabel.setPosition(this.x, this.y - 60);
                console.log(
                    `Teleported peer ${this.playerData.name} to (${this.x}, ${this.y})`
                );
            } else {
                // Set new target for smooth interpolation
                this.targetPosition = { x: newTargetX, y: newTargetY };
                console.log(
                    `Updated peer ${this.playerData.name} target to (${newTargetX}, ${newTargetY})`
                );
            }
        }
    }

    public update(): void {
        // Smooth interpolation towards target position
        const distance = Phaser.Math.Distance.Between(
            this.x,
            this.y,
            this.targetPosition.x,
            this.targetPosition.y
        );

        if (distance > 1) {
            // Handle facing direction based on movement
            if (this.targetPosition.x < this.x) {
                this.setFlipX(true);
            } else if (this.targetPosition.x > this.x) {
                this.setFlipX(false);
            }

            // Interpolate position
            const newX = Phaser.Math.Linear(
                this.x,
                this.targetPosition.x,
                this.interpolationSpeed
            );
            const newY = Phaser.Math.Linear(
                this.y,
                this.targetPosition.y,
                this.interpolationSpeed
            );

            this.setPosition(newX, newY);

            // Update name label position
            this.nameLabel.setPosition(this.x, this.y - 60);
        }

        // Update animation based on movement
        const targetAnimation = this.determineAnimation();
        this.playAnimation(targetAnimation);
    }

    public getPlayerData(): PlayerData {
        return this.playerData;
    }

    public destroy(): void {
        this.nameLabel?.destroy();
        super.destroy();
    }
}
