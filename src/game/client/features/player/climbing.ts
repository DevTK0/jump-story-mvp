import Phaser from "phaser";
import type { System } from "../../shared/types";
import { gameEvents, GameEvent } from "../../shared/events";
import { Player } from "./Player";
import { InputSystem } from "./input";
import { MovementSystem } from "./movement";
import { CLIMB_SPEED, CLIMB_CENTER_THRESHOLD, CLIMB_SNAP_SPEED } from "./constants";
import type { IDebuggable } from "../../shared/debug";
import { DEBUG_CONFIG, BaseDebugRenderer } from "../../shared/debug";

export class ClimbingSystem
    extends BaseDebugRenderer
    implements System, IDebuggable
{
    private player: Player;
    private inputSystem: InputSystem;
    private movementSystem: MovementSystem;
    private scene: Phaser.Scene;

    // Climbeable areas from tilemap
    private climbeableGroup: Phaser.Physics.Arcade.Group | null = null;

    // State
    private originalGravity = 0;
    private isInClimbeableArea = false;
    private currentClimbeableArea: Phaser.Physics.Arcade.StaticBody | null = null;
    private isSnappingToCenter = false;

    constructor(
        player: Player,
        inputSystem: InputSystem,
        movementSystem: MovementSystem,
        scene: Phaser.Scene
    ) {
        super();
        this.player = player;
        this.inputSystem = inputSystem;
        this.movementSystem = movementSystem;
        this.scene = scene;
        this.originalGravity = this.player.body.gravity.y;
    }

    // Set up climbeable areas from tilemap
    public setClimbeableGroup(group: Phaser.Physics.Arcade.Group): void {
        this.climbeableGroup = group;
        this.setupClimbeableOverlaps();
    }

    update(_time: number, _delta: number): void {
        // Update climbeable area detection
        this.checkClimbeableOverlap();

        // Disable gravity when on climbeable surface (even when not actively climbing)
        this.handleClimbeableGravity();

        if (this.player.isClimbing) {
            this.updateClimbing();
            this.handleClimbingExit();
        } else {
            this.checkClimbingStart();
        }
    }

    private checkClimbingStart(): void {
        const inputState = this.inputSystem.getInputState();
        const onGround = this.movementSystem.isOnGround();

        // Check for climbing initiation - player must be near center of climbable area
        if (inputState.up && this.isInClimbeableArea && this.isPlayerNearClimbeableCenter()) {
            this.startClimbing();
        }

        // Check for climbing descent from ground
        if (inputState.down && onGround && this.isInClimbeableArea && this.isPlayerNearClimbeableCenter()) {
            this.startClimbing();
        }
    }

    private updateClimbing(): void {
        if (!this.player.isClimbing) return;

        const body = this.player.body;
        const inputState = this.inputSystem.getInputState();
        
        let targetVelocityY = 0;
        let targetVelocityX = 0;

        // Handle snapping to center if just started climbing or still aligning
        if (this.currentClimbeableArea) {
            const playerCenterX = body.x + body.width / 2;
            const climbeableCenterX = this.currentClimbeableArea.x + this.currentClimbeableArea.width / 2;
            const distanceFromCenter = climbeableCenterX - playerCenterX;
            
            // Snap to center horizontally if not already aligned
            if (Math.abs(distanceFromCenter) > 2) { // 2px tolerance
                this.isSnappingToCenter = true;
                targetVelocityX = Math.sign(distanceFromCenter) * CLIMB_SNAP_SPEED;
                
                // Limit snap distance to prevent overshooting
                if (Math.abs(targetVelocityX) > Math.abs(distanceFromCenter * 60)) { // 60fps assumption
                    targetVelocityX = distanceFromCenter * 60;
                }
            } else {
                this.isSnappingToCenter = false;
                targetVelocityX = 0;
            }
        }

        // Vertical climbing movement (only if not actively snapping)
        if (!this.isSnappingToCenter || Math.abs(targetVelocityX) < 50) {
            if (inputState.up) {
                targetVelocityY = -CLIMB_SPEED;
            } else if (inputState.down) {
                targetVelocityY = CLIMB_SPEED;
            }
        }

        body.setVelocity(targetVelocityX, targetVelocityY);

        // Exit climbing if no longer in climbeable area
        if (!this.isInClimbeableArea) {
            this.exitClimbing();
        }
    }

    private handleClimbingExit(): void {
        const inputState = this.inputSystem.getInputState();
        const onGround = this.movementSystem.isOnGround();

        // Exit climbing with horizontal movement when on ground
        if (onGround && (inputState.left || inputState.right)) {
            this.exitClimbing();
            return;
        }

        // Jump off climbeable surface
        if (inputState.jump) {
            const horizontalDir = this.inputSystem.getHorizontalDirection();

            this.exitClimbing();

            // Apply jump
            this.movementSystem.forceJump();

            // Apply horizontal velocity
            if (horizontalDir !== 0) {
                this.movementSystem.setVelocity(
                    horizontalDir * this.player.getSpeed()
                );
                this.player.facingDirection = horizontalDir as 1 | -1;
            }
        }
    }

    private startClimbing(): void {
        this.player.setPlayerState({ isClimbing: true });

        // Store and disable gravity
        const body = this.player.body;
        this.originalGravity = body.gravity.y;
        body.setGravityY(0);
        body.setVelocity(0, 0);

        gameEvents.emit(GameEvent.PLAYER_CLIMB_START, {
            climbableObject: this.player,
        });
    }

    private exitClimbing(): void {
        if (!this.player.isClimbing) return;

        this.player.setPlayerState({ isClimbing: false });

        // Restore gravity
        const body = this.player.body;
        body.setGravityY(this.originalGravity);
        body.setVelocity(0, 0);

        gameEvents.emit(GameEvent.PLAYER_CLIMB_END);
    }

    private setupClimbeableOverlaps(): void {
        if (!this.climbeableGroup) return;

        // Set up overlap detection for climbeable areas
        this.scene.physics.add.overlap(
            this.player,
            this.climbeableGroup,
            () => {
                this.isInClimbeableArea = true;
            },
            undefined,
            this.scene
        );
    }

    private checkClimbeableOverlap(): void {
        if (!this.climbeableGroup) {
            this.isInClimbeableArea = false;
            this.currentClimbeableArea = null;
            return;
        }

        const playerBody = this.player.body;
        this.isInClimbeableArea = false;
        this.currentClimbeableArea = null;

        // Check if player bounds overlap with any climbeable area bounds
        for (const climbeableRect of this.climbeableGroup.children.entries) {
            const climbeableBody = climbeableRect.body as Phaser.Physics.Arcade.StaticBody;
            
            if (climbeableBody && 
                playerBody.x < climbeableBody.x + climbeableBody.width &&
                playerBody.x + playerBody.width > climbeableBody.x &&
                playerBody.y < climbeableBody.y + climbeableBody.height &&
                playerBody.y + playerBody.height > climbeableBody.y) {
                
                this.isInClimbeableArea = true;
                this.currentClimbeableArea = climbeableBody;
                break;
            }
        }
    }

    private handleClimbeableGravity(): void {
        const body = this.player.body;
        const onGround = this.movementSystem.isOnGround();
        
        // Only handle gravity when actively climbing and not on ground
        if (this.player.isClimbing && !onGround) {
            // Completely disable all downward forces when climbing
            body.setGravityY(0);
            
            // Counter any world gravity with upward acceleration (Y-axis only)
            const worldGravity = this.scene.physics.world.gravity.y;
            if (worldGravity > 0) {
                // Keep existing X acceleration, only set Y acceleration
                body.setAcceleration(body.acceleration.x, -worldGravity);
            }
        } else {
            // Restore normal physics when not climbing or when on ground
            body.setGravityY(this.originalGravity);
            // Only clear Y acceleration, preserve any X acceleration
            body.setAcceleration(body.acceleration.x, 0);
        }
    }

    private isPlayerSupportedByClimbable(): boolean {
        if (!this.currentClimbeableArea) return false;
        
        const body = this.player.body;
        
        // Check if player is moving upward (jumping/falling through)
        if (body.velocity.y < -50) { // Upward velocity threshold
            return false;
        }
        
        // Check if player is close to the bottom of the climbable area
        // This prevents gravity disable when just passing through the middle
        const playerBottom = body.y + body.height;
        const climbableBottom = this.currentClimbeableArea.y + this.currentClimbeableArea.height;
        const distanceFromBottom = climbableBottom - playerBottom;
        
        // Only consider "supported" if within reasonable distance of bottom or moving slowly
        return distanceFromBottom < 50 || Math.abs(body.velocity.y) < 50;
    }

    private isPlayerNearClimbeableCenter(): boolean {
        if (!this.currentClimbeableArea) return false;
        
        const playerCenterX = this.player.body.x + this.player.body.width / 2;
        const climbeableCenterX = this.currentClimbeableArea.x + this.currentClimbeableArea.width / 2;
        const distanceFromCenter = Math.abs(playerCenterX - climbeableCenterX);
        const maxAllowedDistance = (this.currentClimbeableArea.width / 2) * CLIMB_CENTER_THRESHOLD;
        
        return distanceFromCenter <= maxAllowedDistance;
    }

    // Public API
    public isPlayerOnClimbeable(): boolean {
        return this.isInClimbeableArea;
    }

    public canGrabClimbeable(): boolean {
        return this.isInClimbeableArea && !this.player.isClimbing;
    }

    public forceExitClimbing(): void {
        this.exitClimbing();
    }

    // Debug rendering implementation
    protected performDebugRender(graphics: Phaser.GameObjects.Graphics): void {
        // Draw climbeable areas
        if (this.climbeableGroup) {
            graphics.lineStyle(2, DEBUG_CONFIG.colors.climbeable, 0.8);
            graphics.fillStyle(DEBUG_CONFIG.colors.climbeable, 0.2);

            this.climbeableGroup.children.entries.forEach((climbeable) => {
                const body =
                    climbeable.body as Phaser.Physics.Arcade.StaticBody;
                if (body) {
                    graphics.fillRect(body.x, body.y, body.width, body.height);
                    graphics.strokeRect(
                        body.x,
                        body.y,
                        body.width,
                        body.height
                    );
                }
            });
        }
    }

    protected provideDebugInfo(): Record<string, any> {
        return {
            "climb.climbing": this.player.isClimbing,
            "climb.inArea": this.isInClimbeableArea,
            "climb.supported": this.isPlayerSupportedByClimbable(),
            "climb.nearCenter": this.isPlayerNearClimbeableCenter(),
            "climb.snapping": this.isSnappingToCenter,
            "climb.bodyGravity": this.player.body.gravity.y,
            "climb.worldGravity": this.scene.physics.world.gravity.y,
            "climb.velocityY": Math.round(this.player.body.velocity.y),
            "climb.velocityX": Math.round(this.player.body.velocity.x),
            "climb.accelY": Math.round(this.player.body.acceleration.y),
            "climb.accelX": Math.round(this.player.body.acceleration.x),
            "climb.areas": this.climbeableGroup?.children.entries.length || 0,
        };
    }
}
