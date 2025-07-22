import Phaser from "phaser";
import type { System } from "../../shared/types";
import { Player } from "./player";
import { InputSystem } from "./input";
import { gameEvents, GameEvent } from "../../shared/events";
import { PLAYER_CONFIG } from "./config";

interface PlayerAnimationConfig {
    key: string;
    spriteKey: string;
    frames: { start: number; end: number };
    frameRate: number;
    repeat: number;
}

export class AnimationSystem implements System {
    private player: Player;
    private scene: Phaser.Scene;

    // Animation configurations
    private animations: Map<string, PlayerAnimationConfig> = new Map();

    // State tracking
    private currentAnimation: string | null = null;
    private isPlayingAttackAnimation = false;
    private isPlayingHurtAnimation = false;
    private isInvulnerable = false;
    private invulnerabilityTimer: number | null = null;

    constructor(
        player: Player,
        _inputSystem: InputSystem,
        scene: Phaser.Scene
    ) {
        this.player = player;
        this.scene = scene;

        this.setupAnimations();
        this.bindEvents();
    }

    private setupAnimations(): void {
        const soldierAnimations: PlayerAnimationConfig[] = [
            {
                key: "soldier-idle-anim",
                spriteKey: "soldier",
                frames: { start: 0, end: 5 },
                frameRate: PLAYER_CONFIG.animations.soldier.idle.framerate,
                repeat: -1,
            },
            {
                key: "soldier-walk-anim",
                spriteKey: "soldier",
                frames: { start: 9, end: 16 },
                frameRate: PLAYER_CONFIG.animations.soldier.walk.framerate,
                repeat: -1,
            },
            {
                key: "soldier-attack1-anim",
                spriteKey: "soldier",
                frames: { start: 18, end: 23 },
                frameRate: PLAYER_CONFIG.animations.soldier.attack.framerate,
                repeat: 0,
            },
            {
                key: "soldier-attack2-anim",
                spriteKey: "soldier",
                frames: { start: 27, end: 32 },
                frameRate: PLAYER_CONFIG.animations.soldier.attack.framerate,
                repeat: 0,
            },
            {
                key: "soldier-attack3-anim",
                spriteKey: "soldier",
                frames: { start: 36, end: 45 },
                frameRate: PLAYER_CONFIG.animations.soldier.attack.framerate,
                repeat: 0,
            },
            {
                key: "soldier-hurt-anim",
                spriteKey: "soldier",
                frames: { start: 45, end: 49 }, // Assuming hurt frames are at 54-58
                frameRate: 15,
                repeat: 0,
            },
        ];

        // Create animations in Phaser and store configs
        soldierAnimations.forEach((config) => {
            this.createAnimation(config);
        });
    }

    private createAnimation(config: PlayerAnimationConfig): void {
        this.scene.anims.create({
            key: config.key,
            frames: this.scene.anims.generateFrameNumbers(
                config.spriteKey,
                config.frames
            ),
            frameRate: config.frameRate,
            repeat: config.repeat,
        });

        this.animations.set(config.key, config);
    }

    private bindEvents(): void {
        // Listen for combat events to handle attack animations
        gameEvents.on(GameEvent.PLAYER_ATTACKED, (data: any) => {
            this.isPlayingAttackAnimation = true;

            // Play the appropriate attack animation based on attack type
            const attackType = data.attackType || 1;
            const animationKey = `soldier-attack${attackType}-anim`;
            this.playAnimation(animationKey);

            // Listen for attack complete to reset flag
            const onAttackComplete = () => {
                this.isPlayingAttackAnimation = false;
                // Don't need to remove listener since we used 'once'
            };
            // For now, just use a timeout since we don't have the actual event
            setTimeout(onAttackComplete, 300);
        });
    }

    update(_time: number, _delta: number): void {
        if (!this.player.isAlive) {
            return;
        }

        // Don't change animations during attack or hurt
        if (this.isPlayingAttackAnimation || this.isPlayingHurtAnimation) {
            return;
        }

        // Determine appropriate animation based on state
        const targetAnimation = this.determineAnimation();

        // Only change if different from current
        if (targetAnimation !== this.currentAnimation) {
            this.playAnimation(targetAnimation);
        }
    }

    private determineAnimation(): string {
        const body = this.player.body;

        // Climbing animations (if we have them)
        if (this.player.isClimbing) {
            // For now, use idle while climbing
            return "soldier-idle-anim";
        }

        // Ground-based animations
        if (Math.abs(body.velocity.x) > 0.1) {
            return "soldier-walk-anim";
        } else {
            return "soldier-idle-anim";
        }
    }

    private playAnimation(animationKey: string): void {
        if (this.animations.has(animationKey)) {
            this.player.play(animationKey);
            this.currentAnimation = animationKey;
        } else {
            console.warn(`Animation '${animationKey}' not found`);
        }
    }

    // Public API
    public createCustomAnimation(
        key: string,
        spriteKey: string,
        frames: { start: number; end: number },
        frameRate: number,
        repeat: number = -1
    ): void {
        const config: PlayerAnimationConfig = {
            key,
            spriteKey,
            frames,
            frameRate,
            repeat,
        };

        this.createAnimation(config);
    }

    public forcePlayAnimation(animationKey: string): void {
        this.playAnimation(animationKey);
    }

    public stopAnimation(): void {
        this.player.anims.stop();
        this.currentAnimation = null;
    }

    public pauseAnimation(): void {
        this.player.anims.pause();
    }

    public resumeAnimation(): void {
        this.player.anims.resume();
    }

    public isAnimationPlaying(animationKey?: string): boolean {
        if (animationKey) {
            return (
                this.player.anims.isPlaying &&
                this.player.anims.currentAnim?.key === animationKey
            );
        }
        return this.player.anims.isPlaying;
    }

    public getCurrentAnimation(): string | null {
        return this.player.anims.currentAnim?.key || null;
    }

    public hasAnimation(key: string): boolean {
        return this.animations.has(key);
    }

    public playHurtAnimation(knockbackDirection?: { x: number; y: number }): boolean {
        // Don't play hurt animation if already invulnerable
        if (this.isInvulnerable) {
            return false;
        }

        this.isPlayingHurtAnimation = true;
        this.isInvulnerable = true;

        // Disable movement input during hurt state
        const movementSystem = this.player.getSystem("movement") as any;
        if (movementSystem && movementSystem.setMovementDisabled) {
            movementSystem.setMovementDisabled(true);
        }
        
        // Disable climbing input and exit climbing if currently climbing
        const climbingSystem = this.player.getSystem("climbing") as any;
        if (climbingSystem) {
            if (climbingSystem.setClimbingDisabled) {
                climbingSystem.setClimbingDisabled(true);
            }
            // exitClimbing is automatically called by setClimbingDisabled if currently climbing
        }

        // Apply knockback if direction provided
        if (knockbackDirection && this.player.body) {
            const body = this.player.body as Phaser.Physics.Arcade.Body;
            const knockbackForce = 200; // Reduced knockback strength
            
            // For ground-based knockback, prioritize horizontal movement with small upward boost
            const isGroundKnockback = Math.abs(knockbackDirection.y) < 0.3; // Mostly horizontal
            
            if (isGroundKnockback) {
                // Ground knockback: moderate horizontal push + small upward boost
                body.setVelocity(
                    knockbackDirection.x * knockbackForce,
                    -100 // Small upward velocity to lift off ground slightly
                );
            } else {
                // Air knockback: use full direction
                body.setVelocity(
                    knockbackDirection.x * knockbackForce,
                    knockbackDirection.y * knockbackForce
                );
            }
        }

        // Add visual feedback during invulnerability (flashing effect)
        this.startInvulnerabilityFlash();

        this.playAnimation("soldier-hurt-anim");

        // Reset hurt animation flag and re-enable movement after animation completes
        const onHurtComplete = () => {
            this.isPlayingHurtAnimation = false;
            // Re-enable movement after hurt animation
            if (movementSystem && movementSystem.setMovementDisabled) {
                movementSystem.setMovementDisabled(false);
            }
            // Re-enable climbing after hurt animation
            if (climbingSystem && climbingSystem.setClimbingDisabled) {
                climbingSystem.setClimbingDisabled(false);
            }
        };
        setTimeout(onHurtComplete, 400);

        // End invulnerability after 1 second
        if (this.invulnerabilityTimer) {
            clearTimeout(this.invulnerabilityTimer);
        }
        this.invulnerabilityTimer = window.setTimeout(() => {
            this.isInvulnerable = false;
            this.player.clearTint(); // Remove flashing effect
        }, 1000);

        return true;
    }

    private startInvulnerabilityFlash(): void {
        let flashCount = 0;
        const maxFlashes = 10; // Flash 10 times over 1 second
        
        const flashInterval = setInterval(() => {
            if (flashCount >= maxFlashes || !this.isInvulnerable) {
                clearInterval(flashInterval);
                this.player.clearTint();
                return;
            }
            
            // Alternate between normal and transparent
            if (flashCount % 2 === 0) {
                this.player.setTint(0xffffff); // Normal
                this.player.setAlpha(0.5); // Semi-transparent
            } else {
                this.player.setAlpha(1); // Fully visible
            }
            
            flashCount++;
        }, 100); // Flash every 100ms
    }

    public isPlayerInvulnerable(): boolean {
        return this.isInvulnerable;
    }

    destroy(): void {
        // Clean up timers
        if (this.invulnerabilityTimer) {
            clearTimeout(this.invulnerabilityTimer);
        }
        
        // Clean up event listeners
        gameEvents.off(GameEvent.PLAYER_ATTACKED);
        this.animations.clear();
    }
}
