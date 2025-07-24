import Phaser from "phaser";
import type { Player as PlayerData } from "@/spacetime/client";
import { PLAYER_CONFIG } from "../player/config";
import { PEER_CONFIG } from "./peer-config";
import { PeerHealthBar } from "./peer-health-bar";

export interface PeerConfig {
    scene: Phaser.Scene;
    playerData: PlayerData;
}

export class Peer extends Phaser.GameObjects.Sprite {
    private playerData: PlayerData;
    private nameLabel!: Phaser.GameObjects.Text;
    private healthBar!: PeerHealthBar;

    // Interpolation properties
    private targetPosition = { x: 0, y: 0 };
    private interpolationSpeed = PEER_CONFIG.interpolation.speed;

    // Animation tracking
    private currentAnimation: string | null = null;
    private isPlayingAttackAnimation = false;
    private attackAnimationTimeout: NodeJS.Timeout | null = null;
    private isDeathAnimationComplete = false;

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
        this.setDepth(PEER_CONFIG.display.depth);

        // Set scale to match main player
        this.setScale(PLAYER_CONFIG.movement.scale);

        // Set visual properties to distinguish from main player
        this.setAlpha(PEER_CONFIG.display.alpha);
        this.setTint(PEER_CONFIG.display.tint);

        // Initialize target position
        this.targetPosition = {
            x: config.playerData.position.x,
            y: config.playerData.position.y,
        };

        // Animations are now created at scene level

        // Create name label
        this.createNameLabel();

        // Create health bar
        this.createHealthBar();

        // Start with appropriate animation based on state
        const initialAnim = this.determineAnimation();
        this.playAnimation(initialAnim);

        console.log(
            `Created peer sprite for ${this.playerData.name} at (${this.x}, ${this.y}) with scale ${PLAYER_CONFIG.movement.scale} in state ${this.playerData.state.tag}, initial anim: ${initialAnim}`
        );
    }

    private createNameLabel(): void {
        this.nameLabel = this.scene.add.text(
            this.x,
            this.y + PEER_CONFIG.display.nameLabel.offsetY,
            this.playerData.name,
            {
                fontSize: PEER_CONFIG.display.nameLabel.fontSize,
                color: PEER_CONFIG.display.nameLabel.color,
                stroke: PEER_CONFIG.display.nameLabel.stroke,
                strokeThickness: PEER_CONFIG.display.nameLabel.strokeThickness,
            }
        );
        this.nameLabel.setOrigin(0.5, 0.5);
        this.nameLabel.setDepth(PEER_CONFIG.display.nameLabel.depth); // Above the peer sprite
    }

    private createHealthBar(): void {
        this.healthBar = new PeerHealthBar(
            this.scene,
            this.x,
            this.y,
            this.playerData.maxHp
        );
        
        // Initialize health bar with current health
        this.healthBar.updateHealth(this.playerData.currentHp);
    }


    private playAnimation(animationKey: string): void {
        if (!this.scene.anims.exists(animationKey)) {
            console.warn(`Animation ${animationKey} does not exist for peer ${this.playerData.name}`);
            return;
        }

        // Check animation types
        const isAttackAnim = animationKey.includes("attack");
        const isDeathAnim = animationKey.includes("death");
        
        // Skip if we're already playing this exact animation (unless it's an attack that needs to restart)
        if (this.currentAnimation === animationKey && this.anims.isPlaying && !isAttackAnim) {
            return;
        }
        
        // Skip death animation if it has already completed
        if (isDeathAnim && this.isDeathAnimationComplete) {
            return;
        }
        
        
        // Clear any existing animation listeners
        this.off('animationcomplete');
        
        // Clear attack timeout if exists
        if (this.attackAnimationTimeout) {
            clearTimeout(this.attackAnimationTimeout);
            this.attackAnimationTimeout = null;
        }
        
        if (isAttackAnim) {
            // For attacks, always stop current animation and restart
            this.anims.stop();
            this.isPlayingAttackAnimation = true;
            this.play(animationKey);
            this.currentAnimation = animationKey;
            
            // Set a timeout as a safety net (max attack duration is 600ms for attack2)
            this.attackAnimationTimeout = setTimeout(() => {
                if (this.isPlayingAttackAnimation) {
                    console.warn(`Attack animation ${animationKey} timed out for peer ${this.playerData.name}`);
                    this.isPlayingAttackAnimation = false;
                    this.currentAnimation = null;
                    // Force update to next animation
                    const nextAnim = this.determineAnimation();
                    if (nextAnim !== animationKey) {
                        this.playAnimation(nextAnim);
                    }
                }
            }, 800);
            
            // Listen for animation complete
            this.once('animationcomplete', () => {
                if (this.attackAnimationTimeout) {
                    clearTimeout(this.attackAnimationTimeout);
                    this.attackAnimationTimeout = null;
                }
                this.isPlayingAttackAnimation = false;
                // Transition to next animation based on current state
                const nextAnim = this.determineAnimation();
                if (nextAnim !== animationKey) {
                    this.currentAnimation = null;
                    this.playAnimation(nextAnim);
                }
            });
        } else if (isDeathAnim) {
            // Death animation plays once and stops
            this.isPlayingAttackAnimation = false;
            this.play(animationKey);
            this.currentAnimation = animationKey;
            
            this.once('animationcomplete', (animation: any) => {
                if (animation.key === animationKey) {
                    this.anims.stop();
                    this.setFrame(57); // Last frame of death animation
                    this.isDeathAnimationComplete = true;
                }
            });
        } else {
            // Regular animations (idle, walk, etc) - should loop
            this.isPlayingAttackAnimation = false;
            this.play(animationKey, true); // true for loop
            this.currentAnimation = animationKey;
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
                return "soldier-damaged-anim";
            case "Dead":
                return "soldier-death-anim";
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
        
        // Reset death animation flag if peer respawns
        if (previousState === "Dead" && playerData.state.tag !== "Dead") {
            this.isDeathAnimationComplete = false;
        }

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

        if (targetDistance > PEER_CONFIG.interpolation.minMoveDistance) {
            // Check for teleport distance (if too far, snap immediately)
            const currentDistance = Phaser.Math.Distance.Between(
                this.x,
                this.y,
                newTargetX,
                newTargetY
            );

            if (currentDistance > PEER_CONFIG.interpolation.teleportDistance) {
                // Teleport if too far
                this.setPosition(newTargetX, newTargetY);
                this.targetPosition = { x: newTargetX, y: newTargetY };
                this.nameLabel.setPosition(this.x, this.y + PEER_CONFIG.display.nameLabel.offsetY);
                this.healthBar.updatePosition(this.x, this.y);
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

        // Update health bar
        this.healthBar.updateHealth(playerData.currentHp);

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

            // Update name label and health bar positions
            this.nameLabel.setPosition(this.x, this.y + PEER_CONFIG.display.nameLabel.offsetY);
            this.healthBar.updatePosition(this.x, this.y);
        }

        // Update facing direction based on server data
        this.updateFacingDirection();

        // Safety check: if we think we're playing an attack but the state isn't attack, reset
        if (this.isPlayingAttackAnimation && 
            this.playerData.state.tag !== "Attack1" && 
            this.playerData.state.tag !== "Attack2" && 
            this.playerData.state.tag !== "Attack3") {
            this.isPlayingAttackAnimation = false;
            this.currentAnimation = null; // Force animation update
        }

        // Update animation based on current state
        const targetAnimation = this.determineAnimation();
        
        // Only call playAnimation if we need to change animation
        if (this.currentAnimation !== targetAnimation || !this.anims.isPlaying) {
            this.playAnimation(targetAnimation);
        }
    }

    private updateFacingDirection(): void {
        // Set facing direction based on server data
        if (this.playerData.facing.tag === "Left") {
            this.setFlipX(true);
        } else {
            this.setFlipX(false);
        }
    }

    public getPlayerData(): PlayerData {
        return this.playerData;
    }

    public destroy(): void {
        // Clear any pending timeouts
        if (this.attackAnimationTimeout) {
            clearTimeout(this.attackAnimationTimeout);
            this.attackAnimationTimeout = null;
        }
        
        // Remove all event listeners
        this.off('animationcomplete');
        
        this.nameLabel?.destroy();
        this.healthBar?.destroy();
        super.destroy();
    }
}
