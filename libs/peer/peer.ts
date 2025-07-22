import Phaser from "phaser";
import type { Player as PlayerData } from "@/spacetime/client";
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
    private isPlayingAttackAnimation = false;

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

        // Set depth to render above enemies but below main player
        this.setDepth(8);

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

        // Start with appropriate animation based on state
        this.playAnimation(this.determineAnimation());

        console.log(
            `Created peer sprite for ${this.playerData.name} at (${this.x}, ${this.y}) with scale ${PLAYER_CONFIG.movement.scale} in state ${this.playerData.state.tag}`
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
            // Check if this is an attack animation
            const isAttackAnim = animationKey.includes("attack");
            
            if (isAttackAnim) {
                this.isPlayingAttackAnimation = true;
                this.play(animationKey);
                this.currentAnimation = animationKey;
                
                // Listen for animation complete to reset attack flag
                this.once('animationcomplete', () => {
                    this.isPlayingAttackAnimation = false;
                    console.log(`Attack animation ${animationKey} completed for peer ${this.playerData.name}`);
                });
            } else {
                // Don't interrupt attack animations with other animations
                if (!this.isPlayingAttackAnimation) {
                    this.play(animationKey);
                    this.currentAnimation = animationKey;
                }
            }
        }
    }

    private determineAnimation(): string {
        // Use state to determine animation
        switch (this.playerData.state.tag) {
            case "Attack1":
                return "soldier-attack1-anim";
            case "Attack2":
                return "soldier-attack2-anim";
            case "Attack3":
                return "soldier-attack3-anim";
            case "Walk":
                return "soldier-walk-anim";
            case "Climbing":
                // For now, use idle for climbing (can add climbing animation later)
                return "soldier-idle-anim";
            case "Damaged":
                // For now, use idle for damaged (can add damage animation later)
                return "soldier-idle-anim";
            case "Dead":
                // For now, use idle for dead (can add death animation later)
                return "soldier-idle-anim";
            case "Idle":
                return "soldier-idle-anim";
            case "Unknown":
            default:
                console.warn(`Peer ${this.playerData.name} has unknown state: ${this.playerData.state.tag}`);
                return "soldier-idle-anim";
        }
    }

    public updateFromData(playerData: PlayerData): void {
        const previousState = this.playerData?.state?.tag;
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

        // Check if state changed and update animation accordingly
        if (previousState !== playerData.state.tag) {
            console.log(`Peer ${this.playerData.name} state changed from ${previousState} to ${playerData.state.tag}`);
            // Force animation update for state changes (especially attacks)
            const newAnimation = this.determineAnimation();
            this.playAnimation(newAnimation);
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
