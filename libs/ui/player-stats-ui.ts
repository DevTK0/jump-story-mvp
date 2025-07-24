import Phaser from 'phaser';
import { DbConnection } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

export class PlayerStatsUI {
    private scene: Phaser.Scene;
    private dbConnection: DbConnection | null = null;
    private playerIdentity: Identity;
    
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
        this.setupPlayerSubscription();
    }

    private setupPlayerSubscription(): void {
        if (!this.dbConnection) return;

        // Subscribe to player updates - only process updates for our specific player
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
        if (!this.dbConnection) return;

        // Find and update with current player data
        for (const player of this.dbConnection.db.player.iter()) {
            if (player.identity.toHexString() === this.playerIdentity.toHexString()) {
                this.updateStats(
                    player.currentHp,
                    player.maxHp,
                    player.currentMana,
                    player.maxMana,
                    player.level
                );
                break;
            }
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