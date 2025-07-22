import type { System } from "../core/types";
import { gameEvents } from "../core/events";
import { PlayerEvent } from "./player-events";
import { Player } from "./player";
import { InputSystem } from "./input";
import type { IDebuggable } from "../debug/debug-interfaces";
import { DebugState, ShadowState } from "../debug/debug-state";
import { DEBUG_CONFIG } from "../debug/config";
import { BaseDebugRenderer } from "../debug/debug-renderer";
import { ShadowTrajectoryRenderer } from "./effects/shadow";
import { DbConnection, PlayerState } from "../../module_bindings";
import { SyncManager } from "./sync-manager";

export class MovementSystem extends BaseDebugRenderer implements System, IDebuggable {
    private player: Player;
    private inputSystem: InputSystem;

    // Movement state
    private hasUsedDoubleJump = false;
    private wasOnGround = false; // Track ground contact state
    private movementDisabled = false; // For hurt state knockback

    // Shadow trajectory renderer
    private shadowRenderer: ShadowTrajectoryRenderer;
    
    // Synchronization manager
    public readonly syncManager: SyncManager;

    constructor(player: Player, inputSystem: InputSystem) {
        super();
        this.player = player;
        this.inputSystem = inputSystem;
        this.shadowRenderer = new ShadowTrajectoryRenderer(player.scene);
        this.syncManager = new SyncManager(player);
        this.wasOnGround = player.body?.onFloor() || false;
    }
    
    public setDbConnection(connection: DbConnection): void {
        this.syncManager.setDbConnection(connection);
    }

    update(time: number, _delta: number): void {
        let forceSyncOnGroundContact = false;
        
        // Handle movement physics (skip if climbing or movement disabled, but still do position sync)
        if (!this.player.isClimbing && !this.movementDisabled) {
            const body = this.player.body;
            const onGround = body.onFloor();
            const inputState = this.inputSystem.getInputState();

            // Check for ground contact transition (landing)
            if (onGround && !this.wasOnGround) {
                forceSyncOnGroundContact = true;
                console.log("Player landed - forcing position sync");
            }
            this.wasOnGround = onGround;

            // Horizontal movement (only when on ground)
            if (onGround) {
                const horizontalDir = this.inputSystem.getHorizontalDirection();
                if (horizontalDir !== 0) {
                    body.setVelocityX(horizontalDir * this.player.getSpeed());
                    // Transition to walk state if not already walking or attacking
                    if (!this.player.isInState("Walk") && !this.player.isAttacking) {
                        this.player.transitionToState("Walk");
                    }
                } else {
                    body.setVelocityX(0);
                    // Transition to idle state if not already idle or attacking
                    if (!this.player.isInState("Idle") && !this.player.isAttacking) {
                        this.player.transitionToState("Idle");
                    }
                }
            }

            // Regular jump
            if (inputState.jump && onGround) {
                this.jump();
                this.player.transitionToState("Jump");
                forceSyncOnGroundContact = true; // Force sync on jump takeoff too
                console.log("Player jumped - forcing position sync");
            }

            // Double jump
            this.handleDoubleJump();
        }

        // Sample trajectory for debug mode OR shadow effect (always do this)
        const shouldShowShadow = DebugState.getInstance().enabled || ShadowState.getInstance().enabled;
        if (shouldShowShadow) {
            this.shadowRenderer.sampleTrajectory(
                time,
                this.player.x,
                this.player.y,
                this.player.texture.key,
                this.player.frame.name,
                this.player.flipX,
                this.player.scaleX,
                this.player.scaleY
            );
        } else if (this.shadowRenderer.getTrajectoryPointCount() > 0) {
            // Clear trajectory when both debug and shadow are disabled
            this.shadowRenderer.clearTrajectory();
            this.shadowRenderer.cleanupSprites();
        }
        
        // Sync position to SpacetimeDB if needed (ALWAYS do this, even when climbing)
        this.syncManager.syncPosition(time, forceSyncOnGroundContact);

        // Sync state to SpacetimeDB if needed
        const newState = this.determineMovementState();
        this.syncManager.syncState(newState);
    }
    
    private determineMovementState(): PlayerState {
        // Use the state machine's current DB state
        return this.player.getStateMachine().getCurrentDbState();
    }

    private jump(): void {
        this.player.body.setVelocityY(-this.player.getJumpSpeed());
        gameEvents.emit(PlayerEvent.PLAYER_JUMP, {
            velocity: this.player.getJumpSpeed(),
        });
    }

    private handleDoubleJump(): void {
        const onGround = this.player.body.onFloor();

        // Check for double jump input
        if (
            this.inputSystem.isDoubleJumpPressed() &&
            !onGround &&
            !this.hasUsedDoubleJump &&
            !this.player.isClimbing
        ) {
            this.player.body.setVelocityY(-this.player.getJumpSpeed());
            this.hasUsedDoubleJump = true;
            gameEvents.emit(PlayerEvent.PLAYER_JUMP, {
                velocity: this.player.getJumpSpeed(),
            });
        }

        // Reset double jump when landing
        if (onGround && this.hasUsedDoubleJump) {
            this.hasUsedDoubleJump = false;
        }
    }

    // Public methods for other systems to use
    public forceJump(velocityMultiplier: number = 1): void {
        this.player.body.setVelocityY(
            -this.player.getJumpSpeed() * velocityMultiplier
        );
        gameEvents.emit(PlayerEvent.PLAYER_JUMP, {
            velocity: this.player.getJumpSpeed() * velocityMultiplier,
        });
    }

    public setVelocity(x?: number, y?: number): void {
        if (x !== undefined) {
            this.player.body.setVelocityX(x);
        }
        if (y !== undefined) {
            this.player.body.setVelocityY(y);
        }
    }

    public stopMovement(): void {
        this.player.body.setVelocity(0, 0);
    }

    public isOnGround(): boolean {
        return this.player.body.onFloor();
    }

    public resetDoubleJump(): void {
        this.hasUsedDoubleJump = false;
    }

    // Debug resource cleanup implementation
    cleanupDebugResources(): void {
        this.shadowRenderer.cleanupSprites();
    }

    protected performDebugRender(graphics: Phaser.GameObjects.Graphics): void {
        const body = this.player.body;
        if (!body) return;

        // Draw velocity vector (only in debug mode)
        this.drawVelocityVector(graphics, body);
    }

    /**
     * Render shadow effect separately from debug mode
     * This allows shadow to be shown independently
     */
    public renderShadowEffect(): void {
        if (DebugState.getInstance().enabled || ShadowState.getInstance().enabled) {
            this.shadowRenderer.render();
        }
    }

    private drawVelocityVector(
        graphics: Phaser.GameObjects.Graphics,
        body: Phaser.Physics.Arcade.Body
    ): void {
        const velX = body.velocity.x;
        const velY = body.velocity.y;

        // Only draw if there's some velocity
        if (Math.abs(velX) < 0.1 && Math.abs(velY) < 0.1) return;

        const endX = this.player.x + velX * DEBUG_CONFIG.ui.velocityScale;
        const endY = this.player.y + velY * DEBUG_CONFIG.ui.velocityScale;

        graphics.lineStyle(3, DEBUG_CONFIG.colors.velocity, 0.2);
        graphics.lineBetween(this.player.x, this.player.y, endX, endY);

        // Draw velocity arrow head
        const angle = Math.atan2(velY, velX);
        const arrowLength = DEBUG_CONFIG.ui.arrowLength;
        const arrowAngle = DEBUG_CONFIG.ui.arrowAngle;

        graphics.lineBetween(
            endX,
            endY,
            endX - arrowLength * Math.cos(angle - arrowAngle),
            endY - arrowLength * Math.sin(angle - arrowAngle)
        );

        graphics.lineBetween(
            endX,
            endY,
            endX - arrowLength * Math.cos(angle + arrowAngle),
            endY - arrowLength * Math.sin(angle + arrowAngle)
        );
    }


    protected provideDebugInfo(): Record<string, any> {
        const body = this.player.body;
        return {
            velocity: {
                x: Math.round(body.velocity.x),
                y: Math.round(body.velocity.y),
            },
            onGround: body.onFloor(),
            hasUsedDoubleJump: this.hasUsedDoubleJump,
            trajectoryPoints: this.shadowRenderer.getTrajectoryPointCount(),
        };
    }

    // Clean up all resources
    public setMovementDisabled(disabled: boolean): void {
        this.movementDisabled = disabled;
    }

    destroy(): void {
        this.shadowRenderer.destroy();
    }
}
