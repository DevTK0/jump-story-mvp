/**
 * Level Up Renderer
 * Handles level up animations above the player similar to damage renderers
 */

import Phaser from 'phaser';
import { PLAYER_STATS_UI_CONFIG } from './player-stats-ui-config';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { DbConnection } from '@/spacetime/client';

interface LevelUpAnimation {
    text: Phaser.GameObjects.Text;
    updateHandler: () => void;
    playerIdentity: Identity;
}

export class LevelUpRenderer {
    private scene: Phaser.Scene;
    private dbConnection: DbConnection | null = null;
    private activeAnimations: LevelUpAnimation[] = [];
    private playerSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    /**
     * Initialize the renderer with database connection
     */
    public initialize(dbConnection: DbConnection): void {
        this.dbConnection = dbConnection;
    }

    /**
     * Register a player sprite for smooth tracking
     */
    public registerPlayerSprite(identity: Identity, sprite: Phaser.GameObjects.Sprite): void {
        this.playerSprites.set(identity.toHexString(), sprite);
    }

    /**
     * Show level up animation for a player
     */
    public showLevelUpAnimation(playerIdentity: Identity, newLevel: number): void {
        if (!this.dbConnection) {
            console.warn('LevelUpRenderer: Database connection not initialized');
            return;
        }

        // Find player in database
        const playerIdentityHex = playerIdentity.toHexString();
        let player = null;
        
        for (const p of this.dbConnection.db.player.iter()) {
            if (p.identity.toHexString() === playerIdentityHex) {
                player = p;
                break;
            }
        }
        
        if (!player) {
            console.warn('LevelUpRenderer: Player not found');
            return;
        }

        // Create level up text
        const levelUpText = this.createLevelUpText(player.position.x, player.position.y);
        
        // Create update handler for following player
        const updateHandler = () => {
            if (!levelUpText.active) return;
            
            // Try to use sprite position first for smoother tracking
            const sprite = this.playerSprites.get(playerIdentityHex);
            if (sprite && sprite.active) {
                levelUpText.setPosition(
                    sprite.x, 
                    sprite.y + PLAYER_STATS_UI_CONFIG.levelUp.offset.y
                );
            } else if (this.dbConnection) {
                // Fallback to database position
                for (const p of this.dbConnection.db.player.iter()) {
                    if (p.identity.toHexString() === playerIdentityHex) {
                        levelUpText.setPosition(
                            p.position.x, 
                            p.position.y + PLAYER_STATS_UI_CONFIG.levelUp.offset.y
                        );
                        break;
                    }
                }
            }
        };

        // Store animation reference
        const animation: LevelUpAnimation = {
            text: levelUpText,
            updateHandler,
            playerIdentity
        };
        this.activeAnimations.push(animation);

        // Start position update
        this.scene.events.on('update', updateHandler);

        // Apply animations
        this.applyLevelUpAnimations(levelUpText, animation);
    }

    /**
     * Create the level up text object
     */
    private createLevelUpText(x: number, y: number): Phaser.GameObjects.Text {
        const config = PLAYER_STATS_UI_CONFIG.levelUp;
        
        // Create text first
        const levelUpText = this.scene.add.text(
            x, 
            y + config.offset.y, 
            config.text, 
            config.style
        );

        // Apply gradient after text is created and has context
        if (levelUpText.context) {
            const textHeight = parseInt(config.style.fontSize);
            
            // Create vertical gradient (top to bottom)
            const gradient = levelUpText.context.createLinearGradient(0, 0, 0, textHeight);
            gradient.addColorStop(0, config.gradientColors[0]); // Top color
            gradient.addColorStop(1, config.gradientColors[1]); // Bottom color
            
            // Apply gradient through setStyle
            levelUpText.setStyle({
                ...config.style,
                color: gradient as any // Use gradient as fill
            });
        }
        
        // Center and set depth
        levelUpText.setOrigin(0.5, 0.5);
        levelUpText.setDepth(PLAYER_STATS_UI_CONFIG.display.baseDepth + 1);

        return levelUpText;
    }

    /**
     * Apply animations to the level up text
     */
    private applyLevelUpAnimations(text: Phaser.GameObjects.Text, animation: LevelUpAnimation): void {
        const config = PLAYER_STATS_UI_CONFIG.levelUp.animation;

        // Scale bounce animation
        this.scene.tweens.add({
            targets: text,
            scaleX: config.scaleBounce.scale,
            scaleY: config.scaleBounce.scale,
            duration: config.scaleBounce.duration,
            yoyo: config.scaleBounce.yoyo,
            ease: config.scaleBounce.ease
        });

        // Delay before fade
        this.scene.time.delayedCall(config.lingerDuration, () => {
            // Fade out animation
            this.scene.tweens.add({
                targets: text,
                alpha: 0,
                duration: config.fadeDuration,
                ease: 'Power2',
                onComplete: () => {
                    this.cleanupAnimation(animation);
                }
            });
        });
    }

    /**
     * Clean up animation resources
     */
    private cleanupAnimation(animation: LevelUpAnimation): void {
        // Remove update handler
        this.scene.events.off('update', animation.updateHandler);
        
        // Remove from active animations
        const index = this.activeAnimations.indexOf(animation);
        if (index > -1) {
            this.activeAnimations.splice(index, 1);
        }
        
        // Destroy text
        animation.text.destroy();
    }

    /**
     * Clean up all animations (call on scene shutdown)
     */
    public destroy(): void {
        // Clean up all active animations
        for (const animation of this.activeAnimations) {
            this.scene.events.off('update', animation.updateHandler);
            animation.text.destroy();
        }
        this.activeAnimations = [];
    }
}