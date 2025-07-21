import type { System } from "../../shared/types";
import { gameEvents, GameEvent } from "../../shared/events";
import { Player } from "./player";
import { InputSystem } from "./input";
import type { IDebuggable } from "../debug/debug-interfaces";
import { DebugState, ShadowState } from "../debug/debug-state";
import { DEBUG_CONFIG } from "../debug/config";
import { BaseDebugRenderer } from "../debug/debug-renderer";
import { ShadowTrajectoryRenderer } from "./effects/shadow";
import { DbConnection } from "../../module_bindings";

export class MovementSystem extends BaseDebugRenderer implements System, IDebuggable {
    private player: Player;
    private inputSystem: InputSystem;

    // Movement state
    private hasUsedDoubleJump = false;

    // Shadow trajectory renderer
    private shadowRenderer: ShadowTrajectoryRenderer;
    
    // Position synchronization
    private lastSyncedPosition = { x: 0, y: 0 };
    private lastSyncTime = 0;
    private syncThreshold = 10; // pixels
    private syncInterval = 200; // milliseconds
    private dbConnection: DbConnection | null = null;

    constructor(player: Player, inputSystem: InputSystem) {
        super();
        this.player = player;
        this.inputSystem = inputSystem;
        this.shadowRenderer = new ShadowTrajectoryRenderer(player.scene);
        this.lastSyncedPosition = { x: player.x, y: player.y };
    }
    
    public setDbConnection(connection: DbConnection): void {
        this.dbConnection = connection;
    }

    update(time: number, _delta: number): void {
        // Don't move if climbing (handled by climbing system)
        if (this.player.isClimbing) {
            return;
        }

        const body = this.player.body;
        const onGround = body.onFloor();
        const inputState = this.inputSystem.getInputState();

        // Horizontal movement (only when on ground)
        if (onGround) {
            const horizontalDir = this.inputSystem.getHorizontalDirection();
            if (horizontalDir !== 0) {
                body.setVelocityX(horizontalDir * this.player.getSpeed());
            } else {
                body.setVelocityX(0);
            }
        }

        // Regular jump
        if (inputState.jump && onGround) {
            this.jump();
        }

        // Double jump
        this.handleDoubleJump();

        // Sample trajectory for debug mode OR shadow effect
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
        
        // Sync position to SpacetimeDB if needed
        this.syncPositionIfNeeded(time);
    }
    
    private syncPositionIfNeeded(time: number): void {
        if (!this.dbConnection) return;
        
        // Check if enough time has passed since last sync
        if (time - this.lastSyncTime < this.syncInterval) return;
        
        // Check if position has changed significantly
        const currentX = this.player.x;
        const currentY = this.player.y;
        const deltaX = Math.abs(currentX - this.lastSyncedPosition.x);
        const deltaY = Math.abs(currentY - this.lastSyncedPosition.y);
        
        if (deltaX > this.syncThreshold || deltaY > this.syncThreshold) {
            this.dbConnection.reducers.updatePlayerPosition(currentX, currentY);
            this.lastSyncedPosition = { x: currentX, y: currentY };
            this.lastSyncTime = time;
        }
    }

    private jump(): void {
        this.player.body.setVelocityY(-this.player.getJumpSpeed());
        gameEvents.emit(GameEvent.PLAYER_JUMP, {
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
            gameEvents.emit(GameEvent.PLAYER_JUMP, {
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
        gameEvents.emit(GameEvent.PLAYER_JUMP, {
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
    destroy(): void {
        this.shadowRenderer.destroy();
    }
}
