import Phaser from 'phaser';
import { DbConnection } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { PlayerQueryService } from '@/player';

export class PlayerStatsUI {
    private scene: Phaser.Scene;
    private dbConnection: DbConnection | null = null;
    private playerIdentity: Identity;
    private playerQueryService: PlayerQueryService | null = null;
    
    // UI Elements
    private container!: Phaser.GameObjects.Container;
    private identityText!: Phaser.GameObjects.Text;
    private hpBar!: Phaser.GameObjects.Graphics;
    private hpBarBg!: Phaser.GameObjects.Graphics;
    private manaBar!: Phaser.GameObjects.Graphics;
    private manaBarBg!: Phaser.GameObjects.Graphics;
    private hpText!: Phaser.GameObjects.Text;
    private manaText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    
    // UI Configuration
    private readonly UI_CONFIG = {
        x: 20,
        y: 20,
        barWidth: 200,
        barHeight: 16,
        barSpacing: 25,
        identitySpacing: 20,
        fontSize: 14,
        colors: {
            hpBar: 0xFF0000,      // Red
            hpBarBg: 0x660000,    // Dark red
            manaBar: 0x0066FF,    // Blue
            manaBarBg: 0x000066,  // Dark blue
            text: '#FFFFFF',      // White
            barBorder: 0xFFFFFF   // White border
        }
    };

    constructor(scene: Phaser.Scene, playerIdentity: Identity) {
        this.scene = scene;
        this.playerIdentity = playerIdentity;
        this.createUI();
    }

    private createUI(): void {
        // Create container for all UI elements
        this.container = this.scene.add.container(this.UI_CONFIG.x, this.UI_CONFIG.y);
        this.container.setDepth(1000); // High depth to stay on top
        this.container.setScrollFactor(0); // Fix to camera - doesn't move with world

        // Create player identity text
        const identityStr = this.playerIdentity.toHexString();
        this.identityText = this.scene.add.text(0, 0, `Player: ${identityStr}`, {
            fontSize: `${this.UI_CONFIG.fontSize}px`,
            color: this.UI_CONFIG.colors.text,
            fontStyle: 'bold'
        });

        // Create HP bar background
        this.hpBarBg = this.scene.add.graphics();
        this.hpBarBg.fillStyle(this.UI_CONFIG.colors.hpBarBg);
        this.hpBarBg.fillRect(0, this.UI_CONFIG.identitySpacing, this.UI_CONFIG.barWidth, this.UI_CONFIG.barHeight);
        this.hpBarBg.lineStyle(1, this.UI_CONFIG.colors.barBorder);
        this.hpBarBg.strokeRect(0, this.UI_CONFIG.identitySpacing, this.UI_CONFIG.barWidth, this.UI_CONFIG.barHeight);

        // Create HP bar
        this.hpBar = this.scene.add.graphics();

        // Create mana bar background
        this.manaBarBg = this.scene.add.graphics();
        this.manaBarBg.fillStyle(this.UI_CONFIG.colors.manaBarBg);
        this.manaBarBg.fillRect(0, this.UI_CONFIG.identitySpacing + this.UI_CONFIG.barSpacing, this.UI_CONFIG.barWidth, this.UI_CONFIG.barHeight);
        this.manaBarBg.lineStyle(1, this.UI_CONFIG.colors.barBorder);
        this.manaBarBg.strokeRect(0, this.UI_CONFIG.identitySpacing + this.UI_CONFIG.barSpacing, this.UI_CONFIG.barWidth, this.UI_CONFIG.barHeight);

        // Create mana bar
        this.manaBar = this.scene.add.graphics();

        // Create text elements
        this.hpText = this.scene.add.text(this.UI_CONFIG.barWidth + 10, this.UI_CONFIG.identitySpacing, 'HP: 100/100', {
            fontSize: `${this.UI_CONFIG.fontSize}px`,
            color: this.UI_CONFIG.colors.text
        });

        this.manaText = this.scene.add.text(this.UI_CONFIG.barWidth + 10, this.UI_CONFIG.identitySpacing + this.UI_CONFIG.barSpacing, 'MP: 50/50', {
            fontSize: `${this.UI_CONFIG.fontSize}px`,
            color: this.UI_CONFIG.colors.text
        });

        this.levelText = this.scene.add.text(0, this.UI_CONFIG.identitySpacing + this.UI_CONFIG.barSpacing * 2, 'Level: 1', {
            fontSize: `${this.UI_CONFIG.fontSize}px`,
            color: this.UI_CONFIG.colors.text
        });

        // Add all elements to container
        this.container.add([
            this.identityText,
            this.hpBarBg,
            this.hpBar,
            this.manaBarBg,
            this.manaBar,
            this.hpText,
            this.manaText,
            this.levelText
        ]);

        // Initial update
        this.updateStats(100, 100, 50, 50, 1);
    }

    private updateStats(currentHp: number, maxHp: number, currentMana: number, maxMana: number, level: number): void {
        // Update HP bar
        const hpPercentage = Math.max(0, Math.min(1, currentHp / maxHp));
        this.hpBar.clear();
        this.hpBar.fillStyle(this.UI_CONFIG.colors.hpBar);
        this.hpBar.fillRect(0, this.UI_CONFIG.identitySpacing, this.UI_CONFIG.barWidth * hpPercentage, this.UI_CONFIG.barHeight);

        // Update mana bar
        const manaPercentage = Math.max(0, Math.min(1, currentMana / maxMana));
        this.manaBar.clear();
        this.manaBar.fillStyle(this.UI_CONFIG.colors.manaBar);
        this.manaBar.fillRect(0, this.UI_CONFIG.identitySpacing + this.UI_CONFIG.barSpacing, this.UI_CONFIG.barWidth * manaPercentage, this.UI_CONFIG.barHeight);

        // Update text
        this.hpText.setText(`HP: ${Math.floor(currentHp)}/${Math.floor(maxHp)}`);
        this.manaText.setText(`MP: ${Math.floor(currentMana)}/${Math.floor(maxMana)}`);
        this.levelText.setText(`Level: ${level}`);
    }

    public setDbConnection(dbConnection: DbConnection): void {
        this.dbConnection = dbConnection;
        this.setupOptimizedPlayerSubscription();
    }

    private setupOptimizedPlayerSubscription(): void {
        if (!this.dbConnection) return;

        // Get the singleton PlayerQueryService (should already be initialized by PlaygroundScene)
        this.playerQueryService = PlayerQueryService.getInstance();
        if (!this.playerQueryService) {
            console.warn('⚠️ PlayerStatsUI: PlayerQueryService singleton not available, falling back to direct subscription');
            this.setupFallbackSubscription();
            return;
        }
        
        // The PlayerQueryService already has the targeted subscription set up,
        // so we just need to set up our own event listeners for UI updates
        this.setupSharedSubscriptionListeners();
        
        // Initial update from cached data
        this.updateFromCurrentPlayerData();
    }

    /**
     * Set up event listeners that work with the shared PlayerQueryService subscription
     * We need to filter by identity since the subscription is shared
     */
    private setupSharedSubscriptionListeners(): void {
        if (!this.dbConnection) return;

        // Listen to player updates and filter for our specific player
        this.dbConnection.db.player.onUpdate((_ctx, _oldPlayer, newPlayer) => {
            if (newPlayer.identity.toHexString() === this.playerIdentity.toHexString()) {
                console.log('🔄 PlayerStatsUI: Player updated via shared subscription');
                this.updateStats(
                    newPlayer.currentHp,
                    newPlayer.maxHp,
                    newPlayer.currentMana,
                    newPlayer.maxMana,
                    newPlayer.level
                );
            }
        });

        this.dbConnection.db.player.onInsert((_ctx, insertedPlayer) => {
            if (insertedPlayer.identity.toHexString() === this.playerIdentity.toHexString()) {
                console.log('➕ PlayerStatsUI: Player inserted via shared subscription');
                this.updateStats(
                    insertedPlayer.currentHp,
                    insertedPlayer.maxHp,
                    insertedPlayer.currentMana,
                    insertedPlayer.maxMana,
                    insertedPlayer.level
                );
            }
        });
    }

    /**
     * Fallback to old subscription pattern if targeted subscription fails
     */
    private setupFallbackSubscription(): void {
        if (!this.dbConnection) return;

        console.warn('⚠️ PlayerStatsUI: Using fallback subscription - less efficient');

        this.dbConnection.db.player.onUpdate((_ctx, _oldPlayer, newPlayer) => {
            // Only update if this is our specific player
            if (newPlayer.identity.toHexString() === this.playerIdentity.toHexString()) {
                this.updateStats(
                    newPlayer.currentHp,
                    newPlayer.maxHp,
                    newPlayer.currentMana,
                    newPlayer.maxMana,
                    newPlayer.level
                );
            }
        });

        // Initial update with current player data
        this.updateFromCurrentPlayerData();
    }

    private updateFromCurrentPlayerData(): void {
        if (!this.playerQueryService) return;

        // Use optimized PlayerQueryService for current player data
        const player = this.playerQueryService.findCurrentPlayer();
        if (player) {
            this.updateStats(
                player.currentHp,
                player.maxHp,
                player.currentMana,
                player.maxMana,
                player.level
            );
        }
    }

    public getPlayerIdentity(): Identity {
        return this.playerIdentity;
    }

    public setVisible(visible: boolean): void {
        this.container.setVisible(visible);
    }

    public destroy(): void {
        this.container.destroy();
    }
}